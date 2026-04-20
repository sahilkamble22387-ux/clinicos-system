import { useEffect, useState } from 'react';

interface VersionPayload {
  version?: string;
}

export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const currentVersion = import.meta.env.VITE_APP_VERSION;
    if (!currentVersion || currentVersion === 'BUILD_HASH_PLACEHOLDER') return;

    const check = async () => {
      try {
        const response = await fetch(`/version.json?t=${Date.now()}`, {
          cache: 'no-store',
        });
        const data = (await response.json()) as VersionPayload;

        if (
          data.version &&
          data.version !== 'BUILD_HASH_PLACEHOLDER' &&
          data.version !== currentVersion
        ) {
          setUpdateAvailable(true);
        }
      } catch {
        // Ignore version polling failures in local/dev and transient network cases.
      }
    };

    void check();
    const interval = window.setInterval(() => {
      void check();
    }, 5 * 60 * 1000);

    return () => window.clearInterval(interval);
  }, []);

  return {
    updateAvailable,
    dismissUpdate: () => setUpdateAvailable(false),
  };
}
