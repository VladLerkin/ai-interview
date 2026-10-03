import { useRef, useState } from 'react';
import { globalAudioAnalyser, type Viseme } from '../lib/audio';

/**
 * Hook to use or connect to the Web Audio API FFT Analyser.
 * Allows connecting an HTMLAudioElement for zero-latency lip sync.
 */
export const useAudioAnalyser = () => {
  const [isActive, setIsActive] = useState(globalAudioAnalyser.active);
  const analyserRef = useRef(globalAudioAnalyser);

  const connectAudioElement = (element: HTMLAudioElement) => {
    analyserRef.current.connectAudioElement(element);
    setIsActive(true);
  };

  const disconnect = () => {
    analyserRef.current.disconnect();
    setIsActive(false);
  };

  const getViseme = (): Viseme | null => {
    return analyserRef.current.getViseme();
  };

  return {
    analyser: globalAudioAnalyser,
    isActive,
    connectAudioElement,
    disconnect,
    getViseme,
  };
};
