/**
 * database.types.ts
 *
 * Supabase database schema types derived from the actual tables used
 * across all services and components.
 *
 * Passing `Database` as the generic to `createClient<Database>` resolves
 * all TypeScript "is never" errors — every `.from('table')` call becomes
 * correctly typed instead of returning `never`.
 *
 * NOTE: Each table entry requires a `Relationships` field to satisfy the
 * `GenericTable` constraint in @supabase/supabase-js ≥2.x.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      clinics: {
        Row: {
          id: string;
          name: string;
          owner_id: string;
          created_at: string;
          updated_at: string | null;
          doctor_name: string | null;
          qualifications: string[] | null;
          registration_number: string | null;
          specialization: string | null;
          experience_years: number | null;
          phone_number: string | null;
          clinic_name_override: string | null;
          clinic_address: string | null;
          clinic_email: string | null;
          clinic_timings: string | null;
          doctor_signature_base64: string | null;
          stamp_base64: string | null;
          onboarding_completed: boolean;
          plan_status: string | null;
          trial_banner_dismissed_until: string | null;
          queue_accepting_patients: boolean | null;
          emergency_mode: boolean | null;
          emergency_triggered_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          owner_id: string;
          created_at?: string;
          updated_at?: string | null;
          doctor_name?: string | null;
          qualifications?: string[] | null;
          registration_number?: string | null;
          specialization?: string | null;
          experience_years?: number | null;
          phone_number?: string | null;
          clinic_name_override?: string | null;
          clinic_address?: string | null;
          clinic_email?: string | null;
          clinic_timings?: string | null;
          doctor_signature_base64?: string | null;
          stamp_base64?: string | null;
          onboarding_completed?: boolean;
          plan_status?: string | null;
          trial_banner_dismissed_until?: string | null;
          queue_accepting_patients?: boolean | null;
          emergency_mode?: boolean | null;
          emergency_triggered_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          owner_id?: string;
          created_at?: string;
          updated_at?: string | null;
          doctor_name?: string | null;
          qualifications?: string[] | null;
          registration_number?: string | null;
          specialization?: string | null;
          experience_years?: number | null;
          phone_number?: string | null;
          clinic_name_override?: string | null;
          clinic_address?: string | null;
          clinic_email?: string | null;
          clinic_timings?: string | null;
          doctor_signature_base64?: string | null;
          stamp_base64?: string | null;
          onboarding_completed?: boolean;
          plan_status?: string | null;
          trial_banner_dismissed_until?: string | null;
          queue_accepting_patients?: boolean | null;
          emergency_mode?: boolean | null;
          emergency_triggered_at?: string | null;
        };
        Relationships: [];
      };

      profiles: {
        Row: {
          id: string;
          clinic_id: string | null;
          role: string | null;
          full_name: string | null;
          pharmacy_id: string | null;
          onboarding_completed: boolean | null;
          registration_number: string | null;
          plan_status: string | null;
        };
        Insert: {
          id: string;
          clinic_id?: string | null;
          role?: string | null;
          full_name?: string | null;
          pharmacy_id?: string | null;
          onboarding_completed?: boolean | null;
          registration_number?: string | null;
          plan_status?: string | null;
        };
        Update: {
          id?: string;
          clinic_id?: string | null;
          role?: string | null;
          full_name?: string | null;
          pharmacy_id?: string | null;
          onboarding_completed?: boolean | null;
          registration_number?: string | null;
          plan_status?: string | null;
        };
        Relationships: [];
      };

      patients: {
        Row: {
          id: string;
          full_name: string;
          phone: string;
          gender: string | null;
          dob: string | null;
          address: string | null;
          clinic_id: string;
          status: string;
          is_active: boolean;
          source: string;
          consultation_fee: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          phone: string;
          gender?: string | null;
          dob?: string | null;
          address?: string | null;
          clinic_id: string;
          status?: string;
          is_active?: boolean;
          source?: string;
          consultation_fee?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone?: string;
          gender?: string | null;
          dob?: string | null;
          address?: string | null;
          clinic_id?: string;
          status?: string;
          is_active?: boolean;
          source?: string;
          consultation_fee?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      appointments: {
        Row: {
          id: string;
          patient_id: string;
          clinic_id: string;
          status: string;
          bp_systolic: number | null;
          bp_diastolic: number | null;
          heart_rate: number | null;
          weight_kg: number | null;
          temperature_f: number | null;
          created_at: string;
          updated_at: string;
          pharmacy_id: string | null;
          pharmacy_status: string | null;
        };
        Insert: {
          id?: string;
          patient_id: string;
          clinic_id: string;
          status?: string;
          bp_systolic?: number | null;
          bp_diastolic?: number | null;
          heart_rate?: number | null;
          weight_kg?: number | null;
          temperature_f?: number | null;
          created_at?: string;
          updated_at?: string;
          pharmacy_id?: string | null;
          pharmacy_status?: string | null;
        };
        Update: {
          id?: string;
          patient_id?: string;
          clinic_id?: string;
          status?: string;
          bp_systolic?: number | null;
          bp_diastolic?: number | null;
          heart_rate?: number | null;
          weight_kg?: number | null;
          temperature_f?: number | null;
          created_at?: string;
          updated_at?: string;
          pharmacy_id?: string | null;
          pharmacy_status?: string | null;
        };
        Relationships: [];
      };

      medical_records: {
        Row: {
          id: string;
          patient_id: string;
          clinic_id: string;
          diagnosis: string;
          prescription: string | null;
          doctor_notes: string | null;
          fee_collected: number;
          payment_method: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          clinic_id: string;
          diagnosis: string;
          prescription?: string | null;
          doctor_notes?: string | null;
          fee_collected?: number;
          payment_method?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          clinic_id?: string;
          diagnosis?: string;
          prescription?: string | null;
          doctor_notes?: string | null;
          fee_collected?: number;
          payment_method?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      prescription_items: {
        Row: {
          id: string;
          medical_record_id: string;
          clinic_id: string;
          medicine_name: string;
          dosage: string;
          duration: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          medical_record_id: string;
          clinic_id: string;
          medicine_name: string;
          dosage?: string;
          duration?: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          medical_record_id?: string;
          clinic_id?: string;
          medicine_name?: string;
          dosage?: string;
          duration?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };

      prescriptions: {
        Row: {
          id: string;
          clinic_id: string;
          patient_id: string;
          medical_record_id: string | null;
          pharmacy_id: string | null;
          pharmacy_status: string;
          patient_name: string;
          patient_phone: string;
          patient_age: string | null;
          patient_gender: string | null;
          clinic_name: string;
          doctor_name: string;
          doctor_qualification: string | null;
          doctor_registration_no: string | null;
          clinic_address: string | null;
          clinic_phone: string | null;
          doctor_signature_base64: string | null;
          diagnosis: string;
          doctor_notes: string | null;
          fee_collected: number;
          payment_method: string;
          medicines: Json;
          vitals: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clinic_id: string;
          patient_id: string;
          medical_record_id?: string | null;
          pharmacy_id?: string | null;
          pharmacy_status?: string;
          patient_name: string;
          patient_phone: string;
          patient_age?: string | null;
          patient_gender?: string | null;
          clinic_name: string;
          doctor_name: string;
          doctor_qualification?: string | null;
          doctor_registration_no?: string | null;
          clinic_address?: string | null;
          clinic_phone?: string | null;
          doctor_signature_base64?: string | null;
          diagnosis: string;
          doctor_notes?: string | null;
          fee_collected?: number;
          payment_method?: string;
          medicines?: Json;
          vitals?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clinic_id?: string;
          patient_id?: string;
          medical_record_id?: string | null;
          pharmacy_id?: string | null;
          pharmacy_status?: string;
          patient_name?: string;
          patient_phone?: string;
          patient_age?: string | null;
          patient_gender?: string | null;
          clinic_name?: string;
          doctor_name?: string;
          doctor_qualification?: string | null;
          doctor_registration_no?: string | null;
          clinic_address?: string | null;
          clinic_phone?: string | null;
          doctor_signature_base64?: string | null;
          diagnosis?: string;
          doctor_notes?: string | null;
          fee_collected?: number;
          payment_method?: string;
          medicines?: Json;
          vitals?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      medicines: {
        Row: {
          id: string;
          name: string;
          generic_name: string | null;
          strength: string | null;
          form: string | null;
          is_custom: boolean;
          created_by_clinic_id: string | null;
          usage_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          generic_name?: string | null;
          strength?: string | null;
          form?: string | null;
          is_custom?: boolean;
          created_by_clinic_id?: string | null;
          usage_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          generic_name?: string | null;
          strength?: string | null;
          form?: string | null;
          is_custom?: boolean;
          created_by_clinic_id?: string | null;
          usage_count?: number;
          created_at?: string;
        };
        Relationships: [];
      };

      pharmacies: {
        Row: {
          id: string;
          clinic_id: string | null;
          owner_name: string | null;
          name: string;
          license_number: string | null;
          phone: string | null;
          address: string | null;
          city: string | null;
          pincode: string | null;
          is_verified: boolean | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          clinic_id?: string | null;
          owner_name?: string | null;
          name?: string;
          license_number?: string | null;
          phone?: string | null;
          address?: string | null;
          city?: string | null;
          pincode?: string | null;
          is_verified?: boolean | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          clinic_id?: string | null;
          owner_name?: string | null;
          name?: string;
          license_number?: string | null;
          phone?: string | null;
          address?: string | null;
          city?: string | null;
          pincode?: string | null;
          is_verified?: boolean | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };

      pharmacy_clinic_links: {
        Row: {
          id: string;
          clinic_id: string;
          pharmacy_id: string;
          status: string;
          is_primary: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clinic_id: string;
          pharmacy_id: string;
          status?: string;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clinic_id?: string;
          pharmacy_id?: string;
          status?: string;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      pharmacy_invites: {
        Row: {
          id: string;
          clinic_id: string;
          created_by: string;
          token: string;
          status: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          clinic_id: string;
          created_by: string;
          token?: string;
          status?: string;
          expires_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          clinic_id?: string;
          created_by?: string;
          token?: string;
          status?: string;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };

      subscriptions: {
        Row: {
          id: string;
          clinic_id: string;
          plan_name: string;
          status: string;
          is_paid: boolean;
          is_locked: boolean;
          trial_starts_at: string;
          trial_ends_at: string;
          subscription_starts_at: string | null;
          subscription_ends_at: string | null;
          grace_period_ends_at: string | null;
          amount_paid: number | null;
          utr_number: string | null;
          admin_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clinic_id: string;
          plan_name?: string;
          status?: string;
          is_paid?: boolean;
          is_locked?: boolean;
          trial_starts_at?: string;
          trial_ends_at?: string;
          subscription_starts_at?: string | null;
          subscription_ends_at?: string | null;
          grace_period_ends_at?: string | null;
          amount_paid?: number | null;
          utr_number?: string | null;
          admin_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clinic_id?: string;
          plan_name?: string;
          status?: string;
          is_paid?: boolean;
          is_locked?: boolean;
          trial_starts_at?: string;
          trial_ends_at?: string;
          subscription_starts_at?: string | null;
          subscription_ends_at?: string | null;
          grace_period_ends_at?: string | null;
          amount_paid?: number | null;
          utr_number?: string | null;
          admin_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      clinic_settings: {
        Row: {
          id: string;
          key: string;
          value: string | null;
          clinic_id: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          value?: string | null;
          clinic_id?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          value?: string | null;
          clinic_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };

      admin_notifications: {
        Row: {
          id: string;
          clinic_id: string;
          type: string;
          payload: Json;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          clinic_id: string;
          type: string;
          payload?: Json;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          clinic_id?: string;
          type?: string;
          payload?: Json;
          is_read?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
    };

    Views: {
      [_ in never]: never;
    };

    Functions: {
      ensure_pharmacy_from_metadata: {
        Args: Record<PropertyKey, never>;
        Returns: void;
      };
    };

    Enums: {
      [_ in never]: never;
    };
  };
}
