/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Environment variables — all values MUST live in .env (or Vercel env vars)
// Required:  VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
// ---------------------------------------------------------------------------
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

let finalUrl = supabaseUrl || '';
let isProxy = false;

if (typeof window !== 'undefined') {
    const isLocalhost =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';

    if (!isLocalhost) {
        finalUrl = `${window.location.origin}/supabase-proxy`;
        isProxy = true;
    }
}

if (finalUrl && !finalUrl.startsWith('http')) finalUrl = `https://${finalUrl}`;
if (finalUrl.endsWith('/')) finalUrl = finalUrl.slice(0, -1);

if (!finalUrl || !supabaseAnonKey) {
    console.error(
        '[NirogOS] Supabase env vars missing. ' +
        'Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.',
    );
}

// Global 8-second fetch timeout
const customFetch = async (url: string | URL | Request, options: RequestInit = {}) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (err: any) {
        clearTimeout(id);
        if (err.name === 'AbortError') {
            throw new Error(
                `[Supabase] Connection timed out after 8 s ` +
                `(Mode: ${isProxy ? 'PROXY (Prod)' : 'DIRECT (Local)'}).`,
            );
        }
        throw err;
    }
};

let supabaseClient: ReturnType<typeof createClient>;

try {
    console.log(`[Supabase] Mode: ${isProxy ? 'PROXY (Prod)' : 'DIRECT (Local)'}`);
    console.log(`[Network]  Base URL: ${finalUrl}`);

    supabaseClient = createClient(finalUrl, supabaseAnonKey ?? '', {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            // BUG FIX 7: Was 'clinicos-auth' — updated to match the rebrand migration
            // keys in App.tsx so the auth token is stored under the same namespace.
            storageKey: 'nirogos-auth',
        },
        global: {
            fetch: customFetch,
            headers: { 'x-client-info': 'nirogos-proxy' },
        },
    });
} catch (error) {
    console.error('[Supabase] Init failed:', error);
    // Provide a no-op client so the app doesn't crash on import
    supabaseClient = {} as ReturnType<typeof createClient>;
}

export const supabase = supabaseClient;