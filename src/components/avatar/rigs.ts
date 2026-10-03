import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMExpressionPresetName, VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import { breathPhase, idleHeadMotion, lerp, type FaceFrame } from './faceAnimator';

/**
 * A loaded avatar plus the handles needed to animate it.
 * - VRM: standardized humanoid bones + expression presets.
 * - GLB: bones found by name, ARKit / Oculus-viseme morph targets (e.g. MetaPerson).
 */
export type AvatarRig = VrmRig | GlbRig;

interface VrmRig {
  kind: 'vrm';
  root: THREE.Object3D;
  vrm: VRM;
  head: THREE.Object3D | null;
  spine: THREE.Object3D | null;
}

interface GlbRig {
  kind: 'glb';
  root: THREE.Object3D;
  meshes: THREE.Mesh[];
  jaw: THREE.Bone | null;
  head: THREE.Bone | null;
  headInitRot: THREE.Euler | null;
  spine: THREE.Bone | null;
  spineInitRot: THREE.Euler | null;
  mixer: THREE.AnimationMixer | null;
}

const isGlbUrl = (url: string) => {
  const lower = url.toLowerCase();
  return lower.endsWith('.glb') || lower.endsWith('.gltf');
};

/** GLTF loader with the VRM plugin enabled unless the URL is obviously a plain GLB/GLTF. */
export function createAvatarLoader(url: string): GLTFLoader {
  const loader = new GLTFLoader();
  if (!isGlbUrl(url)) {
    loader.register((parser) => new VRMLoaderPlugin(parser));
  }
  return loader;
}

const disableFrustumCulling = (root: THREE.Object3D) =>
  root.traverse((o) => {
    o.frustumCulled = false;
  });

// ── Setup ───────────────────────────────────────────────────────────

function setupVrmRig(vrm: VRM, scene: THREE.Scene): VrmRig {
  scene.add(vrm.scene);
  vrm.scene.rotation.y = Math.PI;
  disableFrustumCulling(vrm.scene);

  // Idle pose: lower arms
  const h = vrm.humanoid;
  h.getNormalizedBoneNode('leftUpperArm')?.rotation.set(0, 0, Math.PI * 0.42);
  h.getNormalizedBoneNode('rightUpperArm')?.rotation.set(0, 0, -Math.PI * 0.42);
  h.getNormalizedBoneNode('leftLowerArm')?.rotation.set(0, 0, Math.PI * 0.08);
  h.getNormalizedBoneNode('rightLowerArm')?.rotation.set(0, 0, -Math.PI * 0.08);

  // Log available expressions for debugging
  const names = vrm.expressionManager?.expressions?.map((e) => e.expressionName) ?? [];
  console.log('[VRM] Available expressions:', names);

  return {
    kind: 'vrm',
    root: vrm.scene,
    vrm,
    head: h.getNormalizedBoneNode('head'),
    spine: h.getNormalizedBoneNode('spine'),
  };
}

/** Rotations that bring common GLB rigs down from T-pose. */
const GLB_ARM_POSE: Record<string, number> = {
  leftarm: 1.2,
  rightarm: -1.2,
  leftforearm: 0.2,
  rightforearm: -0.2,
};

function setupGlbRig(gltf: GLTF, scene: THREE.Scene, camera: THREE.PerspectiveCamera): GlbRig {
  console.log('[GLB] Loading as standard GLB model');
  const root = gltf.scene;
  scene.add(root);

  // Find bounding box as fallback
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const fallbackHeadY = box.max.y;

  disableFrustumCulling(root);

  // Collect meshes with morph targets and find bones
  const meshes: THREE.Mesh[] = [];
  let jaw: THREE.Bone | null = null;
  let head: THREE.Bone | null = null;
  let spine: THREE.Bone | null = null;

  root.traverse((child) => {
    if (child instanceof THREE.Mesh && child.morphTargetDictionary) {
      meshes.push(child);
      console.log('[GLB] Mesh with morphTargets:', child.name, Object.keys(child.morphTargetDictionary));
    }
    if (child instanceof THREE.Bone) {
      const name = child.name.toLowerCase();
      if (name.includes('jaw')) jaw = child;
      if (name.includes('head') && !name.includes('headtop')) head = child;
      if (name.includes('spine') && !name.includes('spine1') && !name.includes('spine2')) spine = child;

      // Lower arms from T-pose
      if (name in GLB_ARM_POSE) child.rotation.set(0, 0, GLB_ARM_POSE[name]);
    }
  });

  const headBone = head as THREE.Bone | null;
  const spineBone = spine as THREE.Bone | null;
  console.log('[GLB] Jaw bone:', (jaw as THREE.Bone | null)?.name, '| Head bone:', headBone?.name, '| Spine bone:', spineBone?.name);
  console.log('[GLB] Morphable meshes found:', meshes.length);

  // Frame camera based on head bone
  if (headBone) {
    const headPos = new THREE.Vector3();
    headBone.getWorldPosition(headPos);
    // Position camera directly in front of the head and look exactly at the head
    camera.position.set(headPos.x, headPos.y, headPos.z + 0.65);
    camera.lookAt(headPos.x, headPos.y, headPos.z);
  } else {
    camera.position.set(0, fallbackHeadY - size.y * 0.15, size.y * 0.55);
    camera.lookAt(0, fallbackHeadY - size.y * 0.2, 0);
  }

  // Play the built-in idle animation if any
  let mixer: THREE.AnimationMixer | null = null;
  if (gltf.animations.length > 0) {
    mixer = new THREE.AnimationMixer(root);
    const clip = gltf.animations[0];
    mixer.clipAction(clip).play();
    console.log('[GLB] Playing animation:', clip.name, 'duration:', clip.duration);
  }

  return {
    kind: 'glb',
    root,
    meshes,
    jaw,
    head: headBone,
    headInitRot: headBone ? headBone.rotation.clone() : null,
    spine: spineBone,
    spineInitRot: spineBone ? spineBone.rotation.clone() : null,
    mixer,
  };
}

/** Adds the loaded model to the scene and returns a rig for it. */
export function createRig(gltf: GLTF, scene: THREE.Scene, camera: THREE.PerspectiveCamera): AvatarRig {
  const vrm = gltf.userData.vrm as VRM | undefined;
  return vrm ? setupVrmRig(vrm, scene) : setupGlbRig(gltf, scene, camera);
}

export function disposeRig(rig: AvatarRig) {
  if (rig.kind === 'glb') rig.mixer?.stopAllAction();
  rig.root.removeFromParent();
  VRMUtils.deepDispose(rig.root);
}

// ── Per-frame animation ─────────────────────────────────────────────

// ── Helper: safe expression setter ──────────────────────────────────
function setExpr(vrm: VRM, name: string, value: number) {
  try {
    vrm.expressionManager?.setValue(name, value);
  } catch { /* expression not available on this model */ }
}

function animateVrm(rig: VrmRig, f: FaceFrame) {
  const { vrm } = rig;

  // ─── 1. BREATHING ─────────────────────────────────────
  if (rig.spine) rig.spine.rotation.x = breathPhase(f.elapsed) * 0.003;

  // ─── 2. HEAD MICRO-MOVEMENT ───────────────────────────
  if (rig.head) {
    const { yaw, pitch } = idleHeadMotion(f.elapsed, f.speaking);
    rig.head.rotation.y = yaw;
    rig.head.rotation.x = pitch;
  }

  // Apply universal state to VRM
  setExpr(vrm, VRMExpressionPresetName.Blink, f.blink);

  setExpr(vrm, VRMExpressionPresetName.LookLeft, Math.max(0, -f.gazeX));
  setExpr(vrm, VRMExpressionPresetName.LookRight, Math.max(0, f.gazeX));
  setExpr(vrm, VRMExpressionPresetName.LookUp, Math.max(0, -f.gazeY));
  setExpr(vrm, VRMExpressionPresetName.LookDown, Math.max(0, f.gazeY));

  setExpr(vrm, VRMExpressionPresetName.Aa, f.viseme.aa);
  setExpr(vrm, VRMExpressionPresetName.Ee, f.viseme.ee);
  setExpr(vrm, VRMExpressionPresetName.Ih, f.viseme.ih);
  setExpr(vrm, VRMExpressionPresetName.Oh, f.viseme.oh);
  setExpr(vrm, VRMExpressionPresetName.Ou, f.viseme.ou);

  setExpr(vrm, VRMExpressionPresetName.Happy, f.emotionWeights.happy);
  setExpr(vrm, VRMExpressionPresetName.Relaxed, f.emotionWeights.relaxed);
  setExpr(vrm, VRMExpressionPresetName.Surprised, f.emotionWeights.surprised);
  setExpr(vrm, VRMExpressionPresetName.Sad, f.emotionWeights.sad);

  // ─── 7. UPDATE VRM ───────────────────────────────────
  vrm.update(f.dt);
}

/** Lip-sync morphs that must be reset to 0 when the avatar stops speaking. */
const GLB_SPEECH_MORPHS = [
  'aa', 'E', 'ih', 'oh', 'ou', 'PP',
  'jawOpen', 'mouthPucker', 'mouthFunnel',
  'mouthUpperUpLeft', 'mouthUpperUpRight',
  'mouthLowerDownLeft', 'mouthLowerDownRight',
  'cheekPuff',
];

// GLB Morph-target blendshapes (Oculus Visemes + ARKit eyes)
function applyGlbMorphs(mesh: THREE.Mesh, f: FaceFrame) {
  const dict = mesh.morphTargetDictionary;
  const inf = mesh.morphTargetInfluences;
  if (!dict || !inf) return;

  const setMorph = (name: string, value: number) => {
    if (name in dict) inf[dict[name]] = value;
  };
  const { viseme: v, emotionWeights: e } = f;

  // Blinking
  setMorph('eyeBlinkLeft', f.blink);
  setMorph('eyeBlinkRight', f.blink);

  // Emotions (ARKit)
  const isSmirk = f.emotion === 'smirk';
  const baseSmileLeft = e.happy * 0.9 + (isSmirk ? 0.6 : 0);
  const baseSmileRight = e.happy * 0.9 + (isSmirk ? 0.1 : 0);
  const speakingSmile = f.speaking ? v.ee * 0.3 : 0;

  setMorph('mouthSmileLeft', baseSmileLeft + speakingSmile);
  setMorph('mouthSmileRight', baseSmileRight + speakingSmile);

  // Sarcastic squint for smirk
  setMorph('eyeSquintLeft', isSmirk ? 0.5 : 0);
  setMorph('eyeSquintRight', isSmirk ? 0.5 : 0);
  setMorph('browDownLeft', e.sad * 0.6 + (isSmirk ? 0.4 : 0));
  setMorph('browDownRight', e.sad * 0.6 + (isSmirk ? 0.4 : 0));

  setMorph('browInnerUp', e.surprised * 0.8 + e.sad * 0.6);
  setMorph('browOuterUpLeft', e.surprised * 0.8);
  setMorph('browOuterUpRight', e.surprised * 0.8);
  setMorph('mouthFrownLeft', e.sad * 0.5);
  setMorph('mouthFrownRight', e.sad * 0.5);

  if (!f.speaking) {
    for (const name of GLB_SPEECH_MORPHS) setMorph(name, 0);
    return;
  }

  // Lip sync via MetaPerson/Oculus Visemes
  // Wide/open visemes (keep low to avoid huge jaw drop)
  setMorph('aa', v.aa * 0.4);
  setMorph('E', v.ee * 0.4);
  setMorph('ih', v.ih * 0.4);
  // Pucker/funnel visemes (reduced to avoid excessive lip pursing)
  setMorph('oh', v.oh * 0.6);
  setMorph('ou', v.ou * 0.6);
  setMorph('PP', v.aa < 0.1 && v.oh < 0.1 ? 0.25 : 0);

  // Fallbacks if model uses ARKit instead
  setMorph('jawOpen', (v.aa + v.oh) * 0.15);
  setMorph('mouthPucker', v.ou * 0.6);
  setMorph('mouthFunnel', v.oh * 0.5);

  // Gentle upper lip movement (prevent exposing gums)
  const upperLipLift = (v.aa + v.ee + v.ih) * 0.3;
  setMorph('mouthUpperUpLeft', upperLipLift);
  setMorph('mouthUpperUpRight', upperLipLift);

  setMorph('mouthLowerDownLeft', (v.aa + v.oh) * 0.2);
  setMorph('mouthLowerDownRight', (v.aa + v.oh) * 0.2);
  setMorph('cheekPuff', v.ou * 0.15);
}

function animateGlb(rig: GlbRig, f: FaceFrame) {
  // Update animation mixer
  rig.mixer?.update(f.dt);

  // GLB Head micro-movement
  if (rig.head && rig.headInitRot) {
    const { yaw, pitch } = idleHeadMotion(f.elapsed, f.speaking);
    rig.head.rotation.y = rig.headInitRot.y + yaw * 0.3;
    rig.head.rotation.x = rig.headInitRot.x + pitch * 0.3;
  }

  // GLB Breathing via spine
  if (rig.spine && rig.spineInitRot) {
    rig.spine.rotation.x = rig.spineInitRot.x + breathPhase(f.elapsed) * 0.002;
  }

  if (rig.meshes.length > 0) {
    for (const mesh of rig.meshes) applyGlbMorphs(mesh, f);
  } else if (rig.jaw) {
    // Fallback: if no morph targets, just flap the jaw bone
    const v = f.viseme;
    const targetJawAngle = f.speaking ? (v.aa + v.oh + v.ou + v.ee * 0.5 + v.ih * 0.4) * 0.25 : 0;
    rig.jaw.rotation.x = lerp(rig.jaw.rotation.x, targetJawAngle, 12, f.dt);
  }
}

export function animateRig(rig: AvatarRig, frame: FaceFrame) {
  if (rig.kind === 'vrm') animateVrm(rig, frame);
  else animateGlb(rig, frame);
}
