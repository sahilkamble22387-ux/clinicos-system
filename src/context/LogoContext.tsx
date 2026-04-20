import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { supabase } from '../../services/db';
import { LOGO_CONFIG } from '../constants/logo';

type LogoUrls = {
  icon: string;
  iconWhite: string;
  full: string;
  fullWhite: string;
};

type LogoContextValue = {
  logoUrls: LogoUrls;
  loading: boolean;
  updateLogo: (variant: 'icon' | 'full', url: string) => Promise<void>;
  resetToDefaults: () => Promise<void>;
};

const DEFAULT_URLS: LogoUrls = {
  icon: LOGO_CONFIG.icon,
  iconWhite: LOGO_CONFIG.iconWhite,
  full: LOGO_CONFIG.full,
  fullWhite: LOGO_CONFIG.fullWhite,
};

const LogoContext = createContext<LogoContextValue | undefined>(undefined);

const SETTINGS_KEYS = {
  icon: 'logo_icon_url',
  full: 'logo_full_url',
} as const;

async function fetchPersistedLogoUrls(): Promise<Partial<LogoUrls>> {
  try {
    const client: any = supabase as any;
    if (!client?.from) return {};

    const { data, error } = await client
      .from('clinic_settings')
      .select('key,value')
      .in('key', [SETTINGS_KEYS.icon, SETTINGS_KEYS.full]);

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[LogoContext] Failed to load clinic_settings:', error.message);
      return {};
    }

    const result: Partial<LogoUrls> = {};
    data?.forEach((row: { key: string; value: string }) => {
      if (row.key === SETTINGS_KEYS.icon && row.value) {
        result.icon = row.value;
      }
      if (row.key === SETTINGS_KEYS.full && row.value) {
        result.full = row.value;
      }
    });

    return result;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[LogoContext] Unexpected error loading logo URLs:', err);
    return {};
  }
}

async function persistLogoUrl(variant: 'icon' | 'full', url: string): Promise<void> {
  const client: any = supabase as any;
  if (!client?.from) return;

  const key = SETTINGS_KEYS[variant];
  try {
    const { error } = await client
      .from('clinic_settings')
      .upsert(
        { key, value: url },
        { onConflict: 'key' },
      );

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[LogoContext] Failed to persist logo URL:', error.message);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[LogoContext] Unexpected error persisting logo URL:', err);
  }
}

async function clearPersistedLogos(): Promise<void> {
  const client: any = supabase as any;
  if (!client?.from) return;

  try {
    const { error } = await client
      .from('clinic_settings')
      .delete()
      .in('key', [SETTINGS_KEYS.icon, SETTINGS_KEYS.full]);

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[LogoContext] Failed to clear logo URLs:', error.message);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[LogoContext] Unexpected error clearing logo URLs:', err);
  }
}

export const LogoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [logoUrls, setLogoUrls] = useState<LogoUrls>(DEFAULT_URLS);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      const persisted = await fetchPersistedLogoUrls();
      if (cancelled) return;

      setLogoUrls((prev) => ({
        icon: persisted.icon ?? prev.icon,
        iconWhite: prev.iconWhite,
        full: persisted.full ?? prev.full,
        fullWhite: prev.fullWhite,
      }));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const updateLogo = useCallback(
    async (variant: 'icon' | 'full', url: string) => {
      setLogoUrls((prev) => {
        if (variant === 'icon') {
          return { ...prev, icon: url };
        }
        return { ...prev, full: url };
      });

      await persistLogoUrl(variant, url);
    },
    [],
  );

  const resetToDefaults = useCallback(async () => {
    setLogoUrls(DEFAULT_URLS);
    await clearPersistedLogos();
  }, []);

  const value = useMemo<LogoContextValue>(
    () => ({
      logoUrls,
      loading,
      updateLogo,
      resetToDefaults,
    }),
    [logoUrls, loading, updateLogo, resetToDefaults],
  );

  return <LogoContext.Provider value={value}>{children}</LogoContext.Provider>;
};

/** Logo image URLs only — safe to use without LogoProvider (falls back to LOGO_CONFIG). */
export function useLogoUrls(): LogoUrls {
  const ctx = useContext(LogoContext);
  return ctx?.logoUrls ?? DEFAULT_URLS;
}

/** Full context — use in LogoUpload / admin; requires LogoProvider. */
export function useLogo(): LogoContextValue {
  const ctx = useContext(LogoContext);
  if (!ctx) {
    throw new Error('useLogo must be used within a LogoProvider');
  }
  return ctx;
}

