import { useState, useEffect } from 'react';
import type { InterviewConfig } from './types/interview';
import { SetupModal } from './components/SetupModal';
import { InterviewRoom } from './components/interview/InterviewRoom';
import { getStoredData, setStoredData, deleteStoredData } from './lib/store';

function App() {
  const [config, setConfig] = useState<InterviewConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStoredData('interviewConfig').then((data) => {
      if (data) setConfig(data);
      setLoading(false);
    });
  }, []);

  const handleStart = async (c: InterviewConfig) => {
    // Unlock Audio Context and TTS by speaking a silent utterance
    const utterance = new SpeechSynthesisUtterance('');
    window.speechSynthesis.speak(utterance);
    
    // Always clear previous interview state when manually starting a new one
    await deleteStoredData('interviewState');
    
    await setStoredData('interviewConfig', c);
    setConfig(c);
  };

  const handleReset = async () => {
    window.speechSynthesis.cancel();
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
    </div>
  );
}

export default App;
