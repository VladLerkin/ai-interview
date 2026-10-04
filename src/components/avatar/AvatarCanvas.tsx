import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { REMOTE_GLB_AVATAR_URL } from '../../config/avatars';
import type { AvatarEmotion } from './emotions';
import { createFaceAnimator } from './faceAnimator';
import { animateRig, createAvatarLoader, createRig, disposeRig, reframeCamera, type AvatarRig } from './rigs';
import { createStage } from './stage';

interface AvatarCanvasProps {
  speaking: boolean;
  emotion?: AvatarEmotion;
  avatarUrl?: string;
  onModelReady?: () => void;
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * Three.js avatar: loads a VRM or GLB model and drives procedural breathing,
 * head motion, blinking, gaze, emotions and lip sync every frame.
 */
export const AvatarCanvas: React.FC<AvatarCanvasProps> = ({
  speaking,
  emotion = 'neutral',
  avatarUrl = REMOTE_GLB_AVATAR_URL,
  onModelReady,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Initializing 3D Engine...');

  // Latest props for the animation loop (avoids re-creating the scene on every render).
  const speakingRef = useRef(speaking);
  const emotionRef = useRef(emotion);
  const onModelReadyRef = useRef(onModelReady);
  useEffect(() => {
    speakingRef.current = speaking;
    emotionRef.current = emotion;
    onModelReadyRef.current = onModelReady;
  });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    setStatus('Setting up scene...');
    const stage = createStage(container);
    let rig: AvatarRig | null = null;
    let disposed = false;

    // ── Load model (VRM or GLB) ─────────────────────────────────────
    setStatus('Loading avatar model...');
    createAvatarLoader(avatarUrl).load(
      avatarUrl,
      (gltf) => {
        if (disposed) return; // unmounted while loading
        try {
          rig = createRig(gltf, stage.scene, stage.camera);
          setStatus('');
          onModelReadyRef.current?.();
        } catch (err) {
          console.error('Model parse error:', err);
          setStatus('Error parsing model: ' + errorMessage(err));
        }
      },
      (progress) => {
        if (!disposed && progress.total > 0) {
          setStatus(`Loading model: ${Math.round((100 * progress.loaded) / progress.total)}%`);
        }
      },
      (err) => {
        console.error('Model load error:', err);
        if (!disposed) setStatus('Model load error: ' + errorMessage(err));
      },
    );

    // ── Animation loop ──────────────────────────────────────────────
    const timer = new THREE.Timer();
    const nextFaceFrame = createFaceAnimator();
    let frameId = 0;

    const animate = (timestamp: number) => {
      timer.update(timestamp);
      const frame = nextFaceFrame(timer.getDelta(), speakingRef.current, emotionRef.current);
      if (rig) animateRig(rig, frame);
      stage.render();
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);

    // ── Resize (also adapts camera framing for portrait / mobile) ───
    const handleResize = () => {
      stage.resize();
      if (rig) reframeCamera(rig, stage.camera, container.clientWidth || window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    const resizeTimer = setTimeout(handleResize, 100);

    return () => {
      disposed = true;
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
      cancelAnimationFrame(frameId);
      if (rig) disposeRig(rig);
      stage.dispose();
    };
  }, [avatarUrl]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-b from-blue-900/20 to-purple-900/20 rounded-2xl overflow-hidden glass-panel">
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-dark-900 via-transparent to-transparent opacity-60" />

      {status && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
          <div className="bg-black/80 text-red-400 p-4 rounded-xl font-mono text-sm max-w-[80%] text-center">
            {status}
          </div>
        </div>
      )}
    </div>
  );
};
