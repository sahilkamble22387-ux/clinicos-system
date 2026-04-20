/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY as string | undefined;

export const adminDbConfig = {
    enabled: Boolean(supabaseUrl && serviceRoleKey),
    url: supabaseUrl ?? '',
    hasServiceRoleKey: Boolean(serviceRoleKey),
};

export const adminDb = adminDbConfig.enabled
    ? createClient(supabaseUrl!, serviceRoleKey!, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
        global: {
            headers: {
                'x-client-info': 'nirogos-admin-dashboard',
            },
        },
    })
    : null;
