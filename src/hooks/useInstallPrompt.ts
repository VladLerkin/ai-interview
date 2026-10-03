import { useCallback, useEffect, useState } from 'react';

/** Captures the PWA `beforeinstallprompt` event so the app can show its own "Install" button. */
export const useInstallPrompt = () => {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setPromptEvent(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = useCallback(async () => {
    if (!promptEvent) return;
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') setPromptEvent(null);
  }, [promptEvent]);

  return { canInstall: promptEvent !== null, install };
};
