-- NirogAI schema additions.
-- Patient-facing AI content is keyed by front_desk_id only, never by PII.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS patient_ai_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  front_desk_id TEXT NOT NULL UNIQUE,
  case_summary TEXT,
  case_summary_generated_at TIMESTAMPTZ,
  soap_notes JSONB,
  drug_check_log JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE patient_ai_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinic_staff_only" ON patient_ai_cache;
CREATE POLICY "clinic_staff_only" ON patient_ai_cache
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature TEXT NOT NULL,
  model_used TEXT,
  tokens_approx INTEGER,
  latency_ms INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  error_code TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinic_staff_ai_usage_log" ON ai_usage_log;
CREATE POLICY "clinic_staff_ai_usage_log" ON ai_usage_log
  FOR SELECT USING (auth.role() = 'authenticated');

DO $$
BEGIN
  IF to_regclass('public.medical_records') IS NOT NULL THEN
    ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS soap_note JSONB;
    ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS ai_scribe_transcript TEXT;
    ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS ai_flags JSONB;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.patients') IS NOT NULL THEN
    ALTER TABLE patients ADD COLUMN IF NOT EXISTS front_desk_id TEXT UNIQUE;
  END IF;
END $$;

-- Optional one-time backfill for existing rows. Uses created_at when present.
DO $$
BEGIN
  IF to_regclass('public.patients') IS NOT NULL THEN
    WITH numbered AS (
      SELECT id, 'P-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at NULLS LAST, id)::TEXT, 4, '0') AS generated_front_desk_id
      FROM patients
      WHERE front_desk_id IS NULL
    )
    UPDATE patients
    SET front_desk_id = numbered.generated_front_desk_id
    FROM numbered
    WHERE patients.id = numbered.id
      AND patients.front_desk_id IS NULL;
  END IF;
END $$;

-- Supabase Storage bucket note:
-- Create a private bucket named "private-voice-notes" and keep public = false.
-- Raw audio should be deleted immediately after successful transcription.
-- AI-generated content columns should remain readable only to authenticated clinic staff via RLS.
