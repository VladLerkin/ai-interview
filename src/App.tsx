import { useState, useEffect } from 'react';
import type { InterviewConfig } from './types/interview';
import { SetupModal } from './components/SetupModal';
import { InterviewRoom } from './components/interview/InterviewRoom';
import { getStoredData, setStoredData, deleteStoredData } from './lib/store';
import { stopAllSpeech, globalAudioAnalyser } from './lib/audio';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import { Download } from 'lucide-react';

function App() {
  const [config, setConfig] = useState<InterviewConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const { canInstall, install } = useInstallPrompt();

  // Global listener to unlock Web Audio API & SpeechSynthesis on any user interaction
  useEffect(() => {
    const unlock = () => {
      globalAudioAnalyser.resume().catch(() => {});
      try {
        window.speechSynthesis?.resume();
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('click', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    getStoredData('interviewConfig').then((data) => {
      if (data) setConfig(data);
      setLoading(false);
    });
  }, []);

  const handleStart = async (c: InterviewConfig) => {
    // Unlock Audio Context and TTS
    globalAudioAnalyser.resume().catch(() => {});
    try {
      window.speechSynthesis?.resume();
    } catch {
      /* ignore */
    }
    const utterance = new SpeechSynthesisUtterance('');
    window.speechSynthesis.speak(utterance);
    
    // Always clear previous interview state when manually starting a new one
    await deleteStoredData('interviewState');
    
    await setStoredData('interviewConfig', c);
    setConfig(c);
  };

  const handleReset = async () => {
    stopAllSpeech();
    await deleteStoredData('interviewState');
    // Keep config so they don't have to re-upload the resume
    // We just trigger a re-render of SetupModal so they can review or change settings
    setConfig(null);
  };

  if (loading) {
    return <div className="min-h-screen bg-dark-900 flex items-center justify-center text-white">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-dark-900 text-white selection:bg-primary-500/30">
      {!config ? (
        <SetupModal onStart={handleStart} />
      ) : (
        <InterviewRoom config={config} onReset={handleReset} />
      )}

      {canInstall && (
        <button
          onClick={install}
          className="fixed bottom-6 right-6 z-50 bg-primary-600 hover:bg-primary-500 text-white font-semibold px-5 py-3 rounded-full shadow-xl shadow-primary-500/20 flex items-center gap-2 transition-all transform hover:-translate-y-1 hover:scale-105"
        >
          <Download className="w-5 h-5" />
          Install App
        </button>
      )}
    </div>
  );
}

export default App;
