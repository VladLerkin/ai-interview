import { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRM, VRMExpressionPresetName } from '@pixiv/three-vrm';
import { globalAudioAnalyser, globalSpeechVisemeTracker } from '../lib/audio';

// ── Viseme definitions ──────────────────────────────────────────────
// Each viseme blends multiple VRM mouth shapes for realistic lip sync.
// Values are weights (0–1) for each expression preset.
interface Viseme {
  aa: number;
  ee: number;
  ih: number;
  oh: number;
  ou: number;
}

const VISEME_SILENCE: Viseme = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };
const VISEME_AH: Viseme = { aa: 0.7, ee: 0, ih: 0, oh: 0.1, ou: 0 }; // "father"
const VISEME_EE: Viseme = { aa: 0, ee: 0.6, ih: 0.3, oh: 0, ou: 0 }; // "see"
const VISEME_IH: Viseme = { aa: 0.1, ee: 0.2, ih: 0.5, oh: 0, ou: 0 }; // "sit"
const VISEME_OH: Viseme = { aa: 0.15, ee: 0, ih: 0, oh: 0.4, ou: 0.1 }; // "go"
const VISEME_OO: Viseme = { aa: 0, ee: 0, ih: 0, oh: 0.08, ou: 0.45 }; // "blue"
const VISEME_CLOSED: Viseme = { aa: 0.03, ee: 0, ih: 0, oh: 0, ou: 0.03 }; // "m", "b", "p"
const VISEME_DENTAL: Viseme = { aa: 0.08, ee: 0.12, ih: 0.08, oh: 0, ou: 0 }; // "s", "f", "th"
const VISEME_WIDE: Viseme = { aa: 0.3, ee: 0.15, ih: 0.1, oh: 0, ou: 0 }; // "a" as in "cat"

// Weighted syllable table: [viseme, probability, minHoldMs, maxHoldMs]
const SYLLABLE_TABLE: [Viseme, number, number, number][] = [
  [VISEME_SILENCE, 0.10, 100, 280],   // brief pause
  [VISEME_CLOSED, 0.12, 40, 100],   // closed consonant
  [VISEME_DENTAL, 0.10, 40, 90],   // dental/fricative
  [VISEME_AH, 0.15, 70, 180],   // open "ah"
  [VISEME_WIDE, 0.10, 60, 150],   // wide "a"
  [VISEME_EE, 0.12, 60, 160],   // "ee"
  [VISEME_IH, 0.10, 50, 130],   // "ih"
  [VISEME_OH, 0.11, 70, 170],   // "oh"
  [VISEME_OO, 0.10, 60, 140],   // "oo"
];

// ── Emotion type ────────────────────────────────────────────────────
export type AvatarEmotion = 'neutral' | 'happy' | 'thinking' | 'concerned' | 'greeting' | 'smirk';

interface AvatarCanvasProps {
  speaking: boolean;
  emotion?: AvatarEmotion;
  avatarUrl?: string;
  onModelReady?: () => void;
}

// ── Helper: safe expression setter ──────────────────────────────────
function setExpr(vrm: VRM, name: string, value: number) {
  try {
    vrm.expressionManager?.setValue(name, value);
  } catch { /* expression not available on this model */ }
}

// ── Helper: lerp ────────────────────────────────────────────────────
function lerp(current: number, target: number, speed: number, dt: number): number {
  return current + (target - current) * Math.min(1, speed * dt);
}

// ── Helper: pick weighted random syllable ───────────────────────────
function pickSyllable(): { viseme: Viseme; holdMs: number } {
  let r = Math.random();
  for (const [viseme, prob, minMs, maxMs] of SYLLABLE_TABLE) {
    r -= prob;
    if (r <= 0) {
      return { viseme, holdMs: minMs + Math.random() * (maxMs - minMs) };
    }
  }
  // Fallback
  return { viseme: VISEME_AH, holdMs: 100 };
}

// ── Component ───────────────────────────────────────────────────────
export const AvatarCanvas: React.FC<AvatarCanvasProps> = ({
  speaking,
  emotion = 'neutral',
  avatarUrl = '/avatar.glb',
  onModelReady,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const vrmRef = useRef<VRM | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const glbMeshesRef = useRef<THREE.Mesh[]>([]);
  const animationIdRef = useRef<number>(0);
  const timerRef = useRef(new THREE.Timer());
  const [debugText, setDebugText] = useState('Initializing 3D Engine...');

  // Shared mutable state for the animation loop (avoids re-creating effects)
  const speakingRef = useRef(speaking);
  const emotionRef = useRef(emotion);
  const onModelReadyRef = useRef(onModelReady);
  speakingRef.current = speaking;
  emotionRef.current = emotion;
  onModelReadyRef.current = onModelReady;

  // ── Scene setup (runs once) ─────────────────────────────────────
  const setupScene = useCallback((container: HTMLDivElement) => {
    if (rendererRef.current && container.contains(rendererRef.current.domElement)) {
      return; // Already set up (StrictMode guard)
    }

    setDebugText('Setting up scene...');
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const width = container.clientWidth || window.innerWidth / 2;
    const height = container.clientHeight || window.innerHeight;
    const camera = new THREE.PerspectiveCamera(25, width / height, 0.1, 20);
    camera.position.set(0, 1.35, 1.6);
    camera.lookAt(0, 1.3, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Studio lighting
    const keyLight = new THREE.DirectionalLight(0xfff5ee, 3.0);
    keyLight.position.set(1, 2, 3);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xb0c4de, 1.5);
    fillLight.position.set(-2, 1, 2);
    scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight(0x6699ff, 1.0);
    rimLight.position.set(0, 2, -3);
    scene.add(rimLight);
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));

    // Subtle grid
    const gridHelper = new THREE.GridHelper(10, 20, 0x1a2a3a, 0x1a2a3a);
    scene.add(gridHelper);

    // ── Load Model (VRM or GLB) ─────────────────────────────────────
    setDebugText('Loading avatar model...');
    const isGlb = avatarUrl.toLowerCase().endsWith('.glb') || avatarUrl.toLowerCase().endsWith('.gltf');

    const loader = new GLTFLoader();
    if (!isGlb) {
      loader.register((parser) => new VRMLoaderPlugin(parser));
    }

    loader.load(
      avatarUrl,
      (gltf) => {
        try {
          const vrm = gltf.userData.vrm as VRM;

          if (vrm) {
            // ── VRM path (existing logic) ──
            scene.add(vrm.scene);
            vrm.scene.rotation.y = Math.PI;
            vrmRef.current = vrm;
            vrm.scene.traverse((o: any) => { o.frustumCulled = false; });

            // Idle pose: lower arms
            const h = vrm.humanoid;
            if (h) {
              const la = h.getNormalizedBoneNode('leftUpperArm');
              const ra = h.getNormalizedBoneNode('rightUpperArm');
              const lla = h.getNormalizedBoneNode('leftLowerArm');
              const rla = h.getNormalizedBoneNode('rightLowerArm');
              if (la) la.rotation.set(0, 0, Math.PI * 0.42);
              if (ra) ra.rotation.set(0, 0, -Math.PI * 0.42);
              if (lla) lla.rotation.set(0, 0, Math.PI * 0.08);
              if (rla) rla.rotation.set(0, 0, -Math.PI * 0.08);
            }

            // Log available expressions for debugging
            const names = vrm.expressionManager?.expressions?.map(e => e.expressionName) ?? [];
            console.log('[VRM] Available expressions:', names);
          } else {
            // ── GLB path ──
            console.log('[GLB] Loading as standard GLB model');
            scene.add(gltf.scene);

            // Find bounding box as fallback
            const box = new THREE.Box3().setFromObject(gltf.scene);
            const size = box.getSize(new THREE.Vector3());
            let fallbackHeadY = box.max.y;

            gltf.scene.traverse((o: any) => { o.frustumCulled = false; });

            // Collect meshes with morph targets and find bones
            const meshes: THREE.Mesh[] = [];
            let jawBone: any = null;
            let headBone: any = null;
            let spineBone: any = null;
            let leftEyeBone: any = null;
            let rightEyeBone: any = null;

            gltf.scene.traverse((child: any) => {
              if (child.isMesh && child.morphTargetDictionary) {
                meshes.push(child);
                console.log('[GLB] Mesh with morphTargets:', child.name, Object.keys(child.morphTargetDictionary));
              }
              if (child.isBone) {
                const name = child.name.toLowerCase();
                if (name.includes('jaw') || name === 'jaw') jawBone = child;
                if (name.includes('head') && !name.includes('headtop')) {
                  headBone = child;
                  child.userData.initRot = new THREE.Euler().copy(child.rotation);
                }
                if (name.includes('spine') && !name.includes('spine1') && !name.includes('spine2')) {
                  spineBone = child;
                  child.userData.initRot = new THREE.Euler().copy(child.rotation);
                }
                if (name.includes('lefteye') || name.includes('eye_l') || name.includes('eye.l')) leftEyeBone = child;
                if (name.includes('righteye') || name.includes('eye_r') || name.includes('eye.r')) rightEyeBone = child;
                
                // Lower arms from T-pose
                if (name === 'leftarm') child.rotation.set(0, 0, 1.2);
                if (name === 'rightarm') child.rotation.set(0, 0, -1.2);
                if (name === 'leftforearm') child.rotation.set(0, 0, 0.2);
                if (name === 'rightforearm') child.rotation.set(0, 0, -0.2);
              }
            });

            glbMeshesRef.current = meshes;
            console.log('[GLB] Jaw bone:', jawBone?.name, '| Head bone:', headBone?.name, '| Spine bone:', spineBone?.name);
            console.log('[GLB] Morphable meshes found:', meshes.length);

            // Store bones in a ref-accessible way via scene userData
            gltf.scene.userData._jawBone = jawBone;
            gltf.scene.userData._headBone = headBone;
            gltf.scene.userData._spineBone = spineBone;
            gltf.scene.userData._leftEyeBone = leftEyeBone;
            gltf.scene.userData._rightEyeBone = rightEyeBone;
            gltf.scene.userData._mixer = null;

            // Lower arms from T-pose
            gltf.scene.traverse((child: any) => {
               if (child.isBone) {
                 const name = child.name.toLowerCase();
                 if (name === 'leftarm') child.rotation.set(0, 0, 1.2);
                 if (name === 'rightarm') child.rotation.set(0, 0, -1.2);
                 if (name === 'leftforearm') child.rotation.set(0, 0, 0.2);
                 if (name === 'rightforearm') child.rotation.set(0, 0, -0.2);
               }
            });

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
            if (gltf.animations.length > 0) {
              const mixer = new THREE.AnimationMixer(gltf.scene);
              const clip = gltf.animations[0];
              const action = mixer.clipAction(clip);
              action.play();
              gltf.scene.userData._mixer = mixer;
              console.log('[GLB] Playing animation:', clip.name, 'duration:', clip.duration);
            }
          }
          setDebugText('');
          onModelReadyRef.current?.();
        } catch (e: any) {
          console.error('Model parse error:', e);
          setDebugText('Error parsing model: ' + (e?.message || e));
        }
      },
      (progress) => {
        if (progress.total > 0) {
          setDebugText(`Loading model: ${Math.round(100 * progress.loaded / progress.total)}%`);
        }
      },
      (error: any) => {
        console.error('Model load error:', error);
        setDebugText('Model load error: ' + (error?.message || error));
      }
    );

    // ── Animation state ───────────────────────────────────────────
    timerRef.current.reset();
    let elapsed = 0;

    // Blink state
    let nextBlinkTime = 1.5 + Math.random() * 3;
    let doubleBlinkChance = false;

    // Viseme state (lip sync)
    const currentViseme: Viseme = { ...VISEME_SILENCE };
    let targetViseme: Viseme = { ...VISEME_SILENCE };
    let visemeHoldRemaining = 0;

    // Emotion state (smoothly interpolated)
    const currentEmotionWeights = { happy: 0, relaxed: 0.15, surprised: 0, angry: 0, sad: 0 };

    // Gaze state
    let gazeTargetX = 0;
    let gazeTargetY = 0;
    let currentGazeX = 0;
    let currentGazeY = 0;
    let nextGazeChange = 1 + Math.random() * 3;

    // ── Main animation loop ───────────────────────────────────────
    const animate = (timestamp: number) => {
      timerRef.current.update(timestamp);
      const dt = timerRef.current.getDelta();
      elapsed += dt;

      // ─── UNIVERSAL STATE UPDATES ──────────────────────────────
      // 1. Viseme Lip Sync
      if (speakingRef.current) {
        const speechViseme = globalSpeechVisemeTracker.getCurrentViseme();
        const audioEnergy = globalAudioAnalyser.active ? globalAudioAnalyser.getAudioEnergy() : 1.0;

        if (speechViseme) {
          // Modulate phonetic syllable viseme by speech audio envelope.
          // In silent pauses or between sentences, mouth closes naturally.
          const effectiveEnergy = globalAudioAnalyser.active ? Math.max(0.12, audioEnergy) : 1.0;
          targetViseme = {
            aa: speechViseme.aa * effectiveEnergy,
            ee: speechViseme.ee * effectiveEnergy,
            ih: speechViseme.ih * effectiveEnergy,
            oh: speechViseme.oh * effectiveEnergy,
            ou: speechViseme.ou * effectiveEnergy,
          };
        } else if (globalAudioAnalyser.active && audioEnergy > 0.05) {
          // Dynamic syllable generation modulated by voice energy
          visemeHoldRemaining -= dt * 1000;
          if (visemeHoldRemaining <= 0) {
            const syl = pickSyllable();
            targetViseme = {
              aa: syl.viseme.aa * audioEnergy,
              ee: syl.viseme.ee * audioEnergy,
              ih: syl.viseme.ih * audioEnergy,
              oh: syl.viseme.oh * audioEnergy,
              ou: syl.viseme.ou * audioEnergy,
            };
            visemeHoldRemaining = syl.holdMs;
          }
        } else {
          visemeHoldRemaining -= dt * 1000;
          if (visemeHoldRemaining <= 0) {
            const syl = pickSyllable();
            targetViseme = { ...syl.viseme };
            visemeHoldRemaining = syl.holdMs;
          }
        }
      } else {
        targetViseme = { ...VISEME_SILENCE };
      }

      const vLerp = 14;
      currentViseme.aa = lerp(currentViseme.aa, targetViseme.aa, vLerp, dt);
      currentViseme.ee = lerp(currentViseme.ee, targetViseme.ee, vLerp, dt);
      currentViseme.ih = lerp(currentViseme.ih, targetViseme.ih, vLerp, dt);
      currentViseme.oh = lerp(currentViseme.oh, targetViseme.oh, vLerp, dt);
      currentViseme.ou = lerp(currentViseme.ou, targetViseme.ou, vLerp, dt);

      // 2. Blinking
      let currentBlink = 0;
      if (elapsed > nextBlinkTime) {
        const blinkDur = 0.12;
        const p = (elapsed - nextBlinkTime) / blinkDur;
        if (p < 1) {
          currentBlink = p < 0.5 ? p * 2 : 2 - p * 2;
        } else {
          if (doubleBlinkChance) {
            nextBlinkTime = elapsed + 0.2;
            doubleBlinkChance = false;
          } else {
            nextBlinkTime = elapsed + 2 + Math.random() * 5;
            doubleBlinkChance = Math.random() < 0.2;
          }
        }
      }

      // 3. Emotions
      const emo = emotionRef.current;
      const targetEmotions = { happy: 0, relaxed: 0.15, surprised: 0, angry: 0, sad: 0 };
      switch (emo) {
        case 'happy':
          targetEmotions.happy = 0.7; targetEmotions.relaxed = 0.3; break;
        case 'greeting':
          targetEmotions.happy = 0.5; targetEmotions.relaxed = 0.25; break;
        case 'thinking':
          targetEmotions.relaxed = 0.1; targetEmotions.happy = 0; break;
        case 'smirk':
          targetEmotions.happy = 0.2; 
          targetEmotions.relaxed = 0.3; 
          targetEmotions.surprised = 0; 
          break;
        case 'concerned':
          targetEmotions.sad = 0.2; targetEmotions.relaxed = 0; break;
        case 'neutral':
        default:
          targetEmotions.relaxed = 0.15; break;
      }
      if (speakingRef.current) {
        targetEmotions.happy = Math.max(targetEmotions.happy, 0.25);
      }
      const eLerp = 3;
      currentEmotionWeights.happy = lerp(currentEmotionWeights.happy, targetEmotions.happy, eLerp, dt);
      currentEmotionWeights.relaxed = lerp(currentEmotionWeights.relaxed, targetEmotions.relaxed, eLerp, dt);
      currentEmotionWeights.surprised = lerp(currentEmotionWeights.surprised, targetEmotions.surprised, eLerp, dt);
      currentEmotionWeights.sad = lerp(currentEmotionWeights.sad, targetEmotions.sad, eLerp, dt);

      // 4. Gaze
      if (elapsed > nextGazeChange) {
        if (Math.random() < 0.3) {
          gazeTargetX = (Math.random() - 0.5) * 0.4;
          gazeTargetY = (Math.random() - 0.5) * 0.2;
        } else {
          gazeTargetX = 0; gazeTargetY = 0;
        }
        nextGazeChange = elapsed + 1.5 + Math.random() * 4;
      }
      currentGazeX = lerp(currentGazeX, gazeTargetX, 3, dt);
      currentGazeY = lerp(currentGazeY, gazeTargetY, 3, dt);


      const vrm = vrmRef.current;
      if (vrm) {
        // ─── 1. BREATHING ─────────────────────────────────────
        const breathOffset = Math.sin(elapsed * 1.5) * 0.003;
        const spine = vrm.humanoid?.getNormalizedBoneNode('spine');
        if (spine) spine.rotation.x = breathOffset;

        // ─── 2. HEAD MICRO-MOVEMENT ───────────────────────────
        const head = vrm.humanoid?.getNormalizedBoneNode('head');
        if (head) {
          const baseY = Math.sin(elapsed * 0.35) * 0.025;
          const baseX = Math.sin(elapsed * 0.55) * 0.012;
          const speakNod = speakingRef.current ? Math.sin(elapsed * 2.5) * 0.008 : 0;
          head.rotation.y = baseY;
          head.rotation.x = baseX + speakNod;
        }

        // Apply universal state to VRM
        setExpr(vrm, VRMExpressionPresetName.Blink, currentBlink);
        
        setExpr(vrm, VRMExpressionPresetName.LookLeft, Math.max(0, -currentGazeX));
        setExpr(vrm, VRMExpressionPresetName.LookRight, Math.max(0, currentGazeX));
        setExpr(vrm, VRMExpressionPresetName.LookUp, Math.max(0, -currentGazeY));
        setExpr(vrm, VRMExpressionPresetName.LookDown, Math.max(0, currentGazeY));

        setExpr(vrm, VRMExpressionPresetName.Aa, currentViseme.aa);
        setExpr(vrm, VRMExpressionPresetName.Ee, currentViseme.ee);
        setExpr(vrm, VRMExpressionPresetName.Ih, currentViseme.ih);
        setExpr(vrm, VRMExpressionPresetName.Oh, currentViseme.oh);
        setExpr(vrm, VRMExpressionPresetName.Ou, currentViseme.ou);

        setExpr(vrm, VRMExpressionPresetName.Happy, currentEmotionWeights.happy);
        setExpr(vrm, VRMExpressionPresetName.Relaxed, currentEmotionWeights.relaxed);
        setExpr(vrm, VRMExpressionPresetName.Surprised, currentEmotionWeights.surprised);
        setExpr(vrm, VRMExpressionPresetName.Sad, currentEmotionWeights.sad);


        // ─── 7. UPDATE VRM ───────────────────────────────────
        vrm.update(dt);
      }

      // ─── GLB bone-based & morph-target animation ─────────────
      if (!vrmRef.current && sceneRef.current) {
        const root = sceneRef.current.children.find((c: any) => c.userData?._headBone !== undefined || c.userData?._jawBone !== undefined);
        if (root) {
          const jawBone = root.userData._jawBone as THREE.Bone | null;
          const headBone = root.userData._headBone as THREE.Bone | null;
          const spineBone = root.userData._spineBone as THREE.Bone | null;
          const mixer = root.userData._mixer as THREE.AnimationMixer | null;

          // Update animation mixer
          if (mixer) mixer.update(dt);

          // GLB Head micro-movement
          if (headBone && headBone.userData.initRot) {
            const baseY = Math.sin(elapsed * 0.35) * 0.025;
            const baseX = Math.sin(elapsed * 0.55) * 0.012;
            const speakNod = speakingRef.current ? Math.sin(elapsed * 2.5) * 0.008 : 0;
            headBone.rotation.y = headBone.userData.initRot.y + baseY * 0.3;
            headBone.rotation.x = headBone.userData.initRot.x + (baseX + speakNod) * 0.3;
          }

          // GLB Breathing via spine
          if (spineBone && spineBone.userData.initRot) {
            const breathOffset = Math.sin(elapsed * 1.5) * 0.002;
            spineBone.rotation.x = spineBone.userData.initRot.x + breathOffset;
          }

          // GLB Morph-target blendshapes (Oculus Visemes + ARKit eyes)
          const meshes = glbMeshesRef.current;
          if (meshes.length > 0) {
            for (const mesh of meshes) {
              const dict = mesh.morphTargetDictionary;
              const inf = mesh.morphTargetInfluences;
              if (!dict || !inf) continue;

              const setMorph = (name: string, value: number) => {
                if (name in dict) inf[dict[name]] = value;
              };

              // Blinking
              setMorph('eyeBlinkLeft', currentBlink);
              setMorph('eyeBlinkRight', currentBlink);

              // Emotions (ARKit)
              const isSmirk = emo === 'smirk';
              const baseSmileLeft = currentEmotionWeights.happy * 0.9 + (isSmirk ? 0.6 : 0);
              const baseSmileRight = currentEmotionWeights.happy * 0.9 + (isSmirk ? 0.1 : 0);
              
              setMorph('mouthSmileLeft', baseSmileLeft + (speakingRef.current ? currentViseme.ee * 0.3 : 0));
              setMorph('mouthSmileRight', baseSmileRight + (speakingRef.current ? currentViseme.ee * 0.3 : 0));
              
              // Sarcastic squint for smirk
              setMorph('eyeSquintLeft', isSmirk ? 0.5 : 0);
              setMorph('eyeSquintRight', isSmirk ? 0.5 : 0);
              setMorph('browDownLeft', currentEmotionWeights.sad * 0.6 + (isSmirk ? 0.4 : 0));
              setMorph('browDownRight', currentEmotionWeights.sad * 0.6 + (isSmirk ? 0.4 : 0));
              
              setMorph('browInnerUp', currentEmotionWeights.surprised * 0.8 + currentEmotionWeights.sad * 0.6);
              setMorph('browOuterUpLeft', currentEmotionWeights.surprised * 0.8);
              setMorph('browOuterUpRight', currentEmotionWeights.surprised * 0.8);
              setMorph('mouthFrownLeft', currentEmotionWeights.sad * 0.5);
              setMorph('mouthFrownRight', currentEmotionWeights.sad * 0.5);

              // Lip sync via MetaPerson/Oculus Visemes & ARKit
              if (speakingRef.current) {
                // Oculus/ReadyPlayerMe standard visemes (clean natural articulation)
                setMorph('aa', currentViseme.aa * 0.55); 
                setMorph('E', currentViseme.ee * 0.5);
                setMorph('ih', currentViseme.ih * 0.4);
                setMorph('oh', currentViseme.oh * 0.55);
                setMorph('ou', currentViseme.ou * 0.5);
                setMorph('PP', (currentViseme.aa < 0.08 && currentViseme.oh < 0.08 && currentViseme.ou < 0.08) ? 0.35 : 0);
                
                // ARKit standard blendshapes (natural jaw & lip rounding, NO square gum-baring)
                setMorph('jawOpen', (currentViseme.aa * 0.55 + currentViseme.oh * 0.25) * 0.35);
                setMorph('mouthPucker', currentViseme.ou * 0.5);
                setMorph('mouthFunnel', currentViseme.oh * 0.4);
                setMorph('mouthClose', (currentViseme.aa < 0.08 && currentViseme.oh < 0.08) ? 0.25 : 0);
              } else {
                setMorph('aa', 0);
                setMorph('E', 0);
                setMorph('ih', 0);
                setMorph('oh', 0);
                setMorph('ou', 0);
                setMorph('PP', 0);
                setMorph('jawOpen', 0);
                setMorph('mouthPucker', 0);
                setMorph('mouthFunnel', 0);
                setMorph('mouthClose', 0);
              }
            }
          } else if (jawBone) {
            // Fallback: if no morph targets, just flap the jaw bone
            let targetJawAngle = 0;
            if (speakingRef.current) {
              const totalViseme = currentViseme.aa + currentViseme.oh + currentViseme.ou + currentViseme.ee * 0.5 + currentViseme.ih * 0.4;
              targetJawAngle = totalViseme * 0.25; 
            }
            jawBone.rotation.x = lerp(jawBone.rotation.x, targetJawAngle, 12, dt);
          }
        }
      }

      renderer.render(scene, camera);
      animationIdRef.current = requestAnimationFrame(animate);
    };
    animationIdRef.current = requestAnimationFrame(animate);

    // ── Resize ────────────────────────────────────────────────────
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth / 2;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
    const resizeTimer = setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
      cancelAnimationFrame(animationIdRef.current);
      if (container && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      vrmRef.current = null;
      glbMeshesRef.current = [];
    };
  }, [avatarUrl]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    return setupScene(container);
  }, [setupScene]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-b from-blue-900/20 to-purple-900/20 rounded-2xl overflow-hidden glass-panel">
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-dark-900 via-transparent to-transparent opacity-60" />

      {debugText && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
          <div className="bg-black/80 text-red-400 p-4 rounded-xl font-mono text-sm max-w-[80%] text-center">
            {debugText}
          </div>
        </div>
      )}
    </div>
  );
};
