-- =============================================================================
-- Nirog OS — Pharmacy portal login & signup (run in Supabase SQL Editor)
-- =============================================================================
-- Fixes:
--   • Pharmacy users failing login when `profiles` row is missing or RLS blocked signup inserts
--   • `ensure_pharmacy_from_metadata()` backfills `pharmacies` + `profiles` from
--     `auth.users.raw_user_meta_data->pharmacy_signup` (set by PharmacySignup.tsx)
--
-- After running: Dashboard → Authentication → Policies: ensure `authenticated`
-- can call this RPC (GRANT below).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) PHARMACIES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pharmacies (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES public.clinics (id) ON DELETE SET NULL,
  owner_name text,
  name text NOT NULL DEFAULT 'Pharmacy',
  license_number text,
  phone text,
  email text,
  address text,
  city text,
  pincode text,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pharmacies ADD COLUMN IF NOT EXISTS owner_name text;
ALTER TABLE public.pharmacies ADD COLUMN IF NOT EXISTS license_number text;
ALTER TABLE public.pharmacies ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.pharmacies ADD COLUMN IF NOT EXISTS pincode text;
ALTER TABLE public.pharmacies ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- 2) PROFILES — ensure pharmacy columns exist (names vary by project)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pharmacy_id uuid REFERENCES public.pharmacies (id);

-- Pharmacy staff may not have a clinic until invite linking; allow NULL if not already
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'clinic_id'
  ) THEN
    ALTER TABLE public.profiles ALTER COLUMN clinic_id DROP NOT NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 3) PHARMACY INVITES (used by doctor invite flow + signup token consume)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pharmacy_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  clinic_id uuid NOT NULL REFERENCES public.clinics (id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users (id),
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pharmacy_invites_clinic_id_idx ON public.pharmacy_invites (clinic_id);

-- ---------------------------------------------------------------------------
-- 4) CLINIC_SETTINGS — unique key for logo upserts (LogoContext)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clinic_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 5) RPC — backfill pharmacy row + profile from auth metadata (called on login)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_pharmacy_from_metadata ()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $fn$
DECLARE
  uid uuid := auth.uid ();
  meta jsonb;
  ph jsonb;
  cid uuid;
  tok text;
BEGIN
  IF uid IS NULL THEN
    RETURN;
  END IF;

  SELECT
    raw_user_meta_data INTO meta
  FROM
    auth.users
  WHERE
    id = uid;

  IF meta IS NULL THEN
    RETURN;
  END IF;

  ph := meta -> 'pharmacy_signup';

  IF ph IS NULL OR jsonb_typeof (ph) != 'object' THEN
    RETURN;
  END IF;

  BEGIN
    cid := NULLIF (trim(ph ->> 'clinic_id'), '')::uuid;
  EXCEPTION
    WHEN OTHERS THEN
      cid := NULL;
  END;

  INSERT INTO public.pharmacies (id, clinic_id, owner_name, name, license_number, phone, email, address, city, pincode, is_verified)
    VALUES (uid, cid, ph ->> 'owner_name', COALESCE(ph ->> 'pharmacy_name', 'Pharmacy'), ph ->> 'license_number', ph ->> 'phone', ph ->> 'email', ph ->> 'address', ph ->> 'city', ph ->> 'pincode', FALSE)
  ON CONFLICT (id)
    DO UPDATE SET
      clinic_id = COALESCE(EXCLUDED.clinic_id, public.pharmacies.clinic_id),
      owner_name = COALESCE(EXCLUDED.owner_name, public.pharmacies.owner_name),
      name = COALESCE(EXCLUDED.name, public.pharmacies.name),
      license_number = COALESCE(EXCLUDED.license_number, public.pharmacies.license_number),
      phone = COALESCE(EXCLUDED.phone, public.pharmacies.phone),
      email = COALESCE(EXCLUDED.email, public.pharmacies.email),
      address = COALESCE(EXCLUDED.address, public.pharmacies.address),
      city = COALESCE(EXCLUDED.city, public.pharmacies.city),
      pincode = COALESCE(EXCLUDED.pincode, public.pharmacies.pincode);

  INSERT INTO public.profiles (id, role, pharmacy_id, clinic_id, full_name)
    VALUES (uid, 'pharmacy_staff', uid, cid, ph ->> 'owner_name')
  ON CONFLICT (id)
    DO UPDATE SET
      role = 'pharmacy_staff',
      pharmacy_id = COALESCE(public.profiles.pharmacy_id, EXCLUDED.pharmacy_id),
      clinic_id = COALESCE(public.profiles.clinic_id, EXCLUDED.clinic_id),
      full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);

  tok := NULLIF (trim(ph ->> 'invite_token'), '');

  IF tok IS NOT NULL AND EXISTS (
    SELECT
      1
    FROM
      information_schema.tables
    WHERE
      table_schema = 'public'
      AND table_name = 'pharmacy_invites') THEN
    UPDATE
      public.pharmacy_invites
    SET
      status = 'used'
    WHERE
      token = tok
      AND status = 'pending';
  END IF;
END
$fn$;

REVOKE ALL ON FUNCTION public.ensure_pharmacy_from_metadata () FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_pharmacy_from_metadata () TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_pharmacy_from_metadata () TO service_role;

-- =============================================================================
-- RLS hints (adjust to your policies):
--   • pharmacies: allow pharmacy user to SELECT/UPDATE own row (id = auth.uid())
--   • profiles: allow user to SELECT/UPDATE own row
-- If inserts from the app still fail, use the RPC above after login only.
-- =============================================================================
