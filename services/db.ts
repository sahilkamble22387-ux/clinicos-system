/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Environment variables — all values MUST live in .env (or Vercel env vars)
// Required:  VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
// Optional:  VITE_SITE_URL  (set to your Vercel production URL, e.g.
//            https://clinicos.vercel.app — used as the emailRedirectTo
//            for auth confirmation emails. Falls back to window.location.origin.)
// ---------------------------------------------------------------------------
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
    // Surface as a non-dismissible error in dev; silent in prod
    console.error(
        '[ClinicOS] Supabase env vars missing. ' +
        'Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env (dev) ' +
        'or Vercel Environment Variables (prod).'
    );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '');