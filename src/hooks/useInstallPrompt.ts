import { useCallback, useEffect, useState } from 'react';

/**
 * Captures the PWA `beforeinstallprompt` event so the app can show its own "Install" button.
 * `index.html` stashes an early event in `window.deferredPrompt` (it can fire before React mounts).
 */
export const useInstallPrompt = () => {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(window.deferredPrompt ?? null);

  useEffect(() => {
    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      window.deferredPrompt = e;
      setPromptEvent(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = useCallback(async () => {
    if (!promptEvent) return;
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      window.deferredPrompt = null;
      setPromptEvent(null);
    }
  }, [promptEvent]);

  return { canInstall: promptEvent !== null, install };
};
