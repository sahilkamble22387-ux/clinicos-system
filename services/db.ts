/// <reference types="vite/client" />

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase Environment Variables!', { supabaseUrl, supabaseAnonKey });
}

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key'
);

// Types
export interface Patient {
    id: string;
    full_name: string;
    phone: string;
    address: string;
    gender: string;
    dob: string;
    created_at: string;
}

export interface Appointment {
    id: string;
    patient_id: string;
    status: string;
    created_at: string;
    patients?: Patient; // For joined queries
}
