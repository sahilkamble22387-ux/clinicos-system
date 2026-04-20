/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

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

// Global 10-second fetch timeout (increased from 8s for slow networks)
const customFetch = async (url: string | URL | Request, options: RequestInit = {}) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10_000);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (err: unknown) {
        clearTimeout(id);
        if (err instanceof Error && err.name === 'AbortError') {
            throw new Error(
                `[Supabase] Connection timed out after 10 s ` +
                `(Mode: ${isProxy ? 'PROXY (Prod)' : 'DIRECT (Local)'}).`,
            );
        }
        throw err;
    }
};

let supabaseClient: ReturnType<typeof createClient<Database>>;

try {
    if (import.meta.env.DEV) {
        // Only log in development — avoids noisy prod logs
        console.log(`[Supabase] Mode: ${isProxy ? 'PROXY (Prod)' : 'DIRECT (Local)'}`);
        console.log(`[Network]  Base URL: ${finalUrl}`);
    }

    supabaseClient = createClient<Database>(finalUrl, supabaseAnonKey ?? '', {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storageKey: 'nirogos-auth',
        },
        global: {
            fetch: customFetch,
            headers: { 'x-client-info': 'nirogos-proxy' },
        },
        // Optimise realtime: only connect when needed (saves bandwidth)
        realtime: {
            params: {
                eventsPerSecond: 10,
            },
        },
    });
} catch (error) {
    console.error('[Supabase] Init failed:', error);
    // Provide a no-op client so the app doesn't crash on import
    supabaseClient = {} as ReturnType<typeof createClient<Database>>;
}

export const supabase = supabaseClient;

// Convenience type helpers so callers can use DB row types without
// importing the entire Database type.
export type Tables<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Row'];

export type TablesInsert<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Insert'];

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Update'];