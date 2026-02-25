/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Environment variables — all values MUST live in .env (or Vercel env vars)
// Required:  VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
// Optional:  VITE_SITE_URL  (set to your Vercel production URL, e.g.
//            https://clinicos-system.vercel.app — used as the emailRedirectTo
//            for auth confirmation emails. Falls back to window.location.origin.)
// ---------------------------------------------------------------------------
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

let finalUrl = supabaseUrl || '';
let isProxy = false;

if (typeof window !== 'undefined') {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // Apply strict Vercel Proxy ONLY in production
    if (!isLocalhost) {
        finalUrl = `${window.location.origin}/supabase-proxy`;
        isProxy = true;
    }
}

// Ensure valid URL
if (finalUrl && !finalUrl.startsWith('http')) {
    finalUrl = `https://${finalUrl}`;
}
if (finalUrl.endsWith('/')) {
    finalUrl = finalUrl.slice(0, -1);
}

if (!finalUrl || !supabaseAnonKey) {
    console.error('[ClinicOS] Supabase env vars missing. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
}

// Global 8-second fetch timeout to prevent infinite hanging
const customFetch = async (url: string | URL | Request, options: RequestInit = {}) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 8000);
    try {
        options.signal = controller.signal;
        const response = await fetch(url, options);
        clearTimeout(id);
        return response;
    } catch (err: any) {
        clearTimeout(id);
        if (err.name === 'AbortError') {
            throw new Error(`[Supabase] Connection timed out after 8 seconds (Mode: ${isProxy ? 'PROXY (Prod)' : 'DIRECT (Local)'}).`);
        }
        throw err;
    }
};

let supabaseClient: any;
try {
    console.log(`[Supabase] Mode: ${isProxy ? 'PROXY (Prod)' : 'DIRECT (Local)'}`);
    console.log(`[Network] Request base URL: ${finalUrl}`);

    supabaseClient = createClient(finalUrl, supabaseAnonKey ?? '', {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storageKey: 'clinicos-auth',
        },
        global: {
            fetch: customFetch,
            headers: {
                'x-client-info': 'clinicos-proxy'
            }
        }
    });
} catch (error) {
    console.error('[Supabase] Init failed:', error);
}

export const supabase = supabaseClient;