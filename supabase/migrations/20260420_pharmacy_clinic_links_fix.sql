-- 2026-04-20
-- Creates pharmacy_clinic_links table (missing from schema).
-- This is the bridge table that lets doctors link their clinic to pharmacies
-- and lets pharmacies see which clinics they are linked to.
-- Also ensures pharmacies.clinic_id is kept in sync when links are made active.

BEGIN;

-- ── 1. pharmacy_clinic_links ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pharmacy_clinic_links (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   uuid        NOT NULL REFERENCES public.clinics(id)   ON DELETE CASCADE,
  pharmacy_id uuid        NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  status      text        NOT NULL DEFAULT 'pending',   -- pending | active | cancelled
  is_primary  boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, pharmacy_id)
);

ALTER TABLE public.pharmacy_clinic_links ENABLE ROW LEVEL SECURITY;

-- Doctors (clinic owners / profiles) can read links for their own clinic
DROP POLICY IF EXISTS "Clinic members can read their links" ON public.pharmacy_clinic_links;
CREATE POLICY "Clinic members can read their links"
ON public.pharmacy_clinic_links FOR SELECT
TO authenticated
USING (
  clinic_id IN (
    SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
    UNION
    SELECT id        FROM public.clinics  WHERE owner_id = auth.uid()
  )
  OR
  pharmacy_id IN (
    SELECT pharmacy_id FROM public.profiles WHERE id = auth.uid() AND role = 'pharmacy_staff'
  )
);

-- Doctors can insert link requests
DROP POLICY IF EXISTS "Clinic members can insert link requests" ON public.pharmacy_clinic_links;
CREATE POLICY "Clinic members can insert link requests"
ON public.pharmacy_clinic_links FOR INSERT
TO authenticated
WITH CHECK (
  clinic_id IN (
    SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
    UNION
    SELECT id        FROM public.clinics  WHERE owner_id = auth.uid()
  )
);

-- Both sides can update (doctor sets primary, pharmacy accepts/declines)
DROP POLICY IF EXISTS "Participants can update their links" ON public.pharmacy_clinic_links;
CREATE POLICY "Participants can update their links"
ON public.pharmacy_clinic_links FOR UPDATE
TO authenticated
USING (
  clinic_id IN (
    SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
    UNION
    SELECT id        FROM public.clinics  WHERE owner_id = auth.uid()
  )
  OR
  pharmacy_id IN (
    SELECT pharmacy_id FROM public.profiles WHERE id = auth.uid() AND role = 'pharmacy_staff'
  )
)
WITH CHECK (true);

-- ── 2. pharmacy_invites ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pharmacy_invites (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id  uuid        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  created_by uuid        REFERENCES auth.users(id),
  token      text        NOT NULL UNIQUE,
  status     text        NOT NULL DEFAULT 'pending',  -- pending | used | expired
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pharmacy_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic members can manage their invites" ON public.pharmacy_invites;
CREATE POLICY "Clinic members can manage their invites"
ON public.pharmacy_invites FOR ALL
TO authenticated
USING (
  clinic_id IN (
    SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
    UNION
    SELECT id        FROM public.clinics  WHERE owner_id = auth.uid()
  )
);

-- Pharmacy staff need to read invites by token during signup
DROP POLICY IF EXISTS "Anyone authenticated can read invites by token" ON public.pharmacy_invites;
CREATE POLICY "Anyone authenticated can read invites by token"
ON public.pharmacy_invites FOR SELECT
TO authenticated
USING (true);

-- ── 3. clinic_settings ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clinic_settings (
  key        text PRIMARY KEY,
  value      text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clinic_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage clinic settings" ON public.clinic_settings;
CREATE POLICY "Authenticated users can manage clinic settings"
ON public.clinic_settings FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ── 4. Back-fill links from existing pharmacies.clinic_id ────────────────────
-- For every pharmacy already linked to a clinic via the old direct FK,
-- ensure there is a corresponding active row in pharmacy_clinic_links.
INSERT INTO public.pharmacy_clinic_links (clinic_id, pharmacy_id, status, is_primary)
SELECT p.clinic_id, p.id, 'active', true
FROM public.pharmacies p
WHERE p.clinic_id IS NOT NULL
ON CONFLICT (clinic_id, pharmacy_id) DO UPDATE
  SET status = EXCLUDED.status,
      updated_at = now();

-- ── 5. Trigger: keep pharmacies.clinic_id in sync when link becomes active ───
CREATE OR REPLACE FUNCTION public.sync_pharmacy_clinic_id_on_link()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'active' THEN
    UPDATE public.pharmacies
    SET clinic_id = NEW.clinic_id
    WHERE id = NEW.pharmacy_id;

    -- Also update profile so role-checks stay consistent
    UPDATE public.profiles
    SET clinic_id = NEW.clinic_id
    WHERE id = NEW.pharmacy_id AND role = 'pharmacy_staff';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_pharmacy_clinic_id_on_link ON public.pharmacy_clinic_links;
CREATE TRIGGER sync_pharmacy_clinic_id_on_link
AFTER INSERT OR UPDATE OF status ON public.pharmacy_clinic_links
FOR EACH ROW
EXECUTE FUNCTION public.sync_pharmacy_clinic_id_on_link();

COMMIT;
