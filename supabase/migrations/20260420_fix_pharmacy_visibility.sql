-- =============================================================================
-- 2026-04-20 — Fix: Pharmacy accounts not visible in Doctor Portal
-- =============================================================================
-- Root causes:
--   1. `pharmacies` table has no RLS SELECT policy — doctors cannot read
--      pharmacy rows, so the "signed-in pharmacies" directory is always empty.
--   2. `profiles` table has no RLS SELECT policy allowing doctors to read
--      pharmacy_staff profiles (needed for the merge step in fetchDoctorPharmacyNetwork).
--   3. Newly signed-up pharmacies without an invite token have no
--      pharmacy_clinic_links row and clinic_id = NULL, so they are invisible
--      to the linked-pharmacy filter.
--   4. clinic_settings: ensure `email` column on pharmacies exists (belt-and-suspenders).
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1.  pharmacies — RLS policies
--     • Any authenticated user can read the pharmacy directory (needed by doctors)
--     • Pharmacy owner can insert / update their own row
-- ---------------------------------------------------------------------------
ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read pharmacies" ON public.pharmacies;
CREATE POLICY "Anyone authenticated can read pharmacies"
ON public.pharmacies FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Pharmacy owner can insert own row" ON public.pharmacies;
CREATE POLICY "Pharmacy owner can insert own row"
ON public.pharmacies FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Pharmacy owner can update own row" ON public.pharmacies;
CREATE POLICY "Pharmacy owner can update own row"
ON public.pharmacies FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Service-role always bypasses RLS, so no service_role policy needed.

-- ---------------------------------------------------------------------------
-- 2.  profiles — allow doctors to read pharmacy_staff profiles
--     (pharmacyService.ts queries profiles WHERE role = 'pharmacy_staff'
--      to merge pharmacy details into the directory)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Own-row access (already present in most setups, re-create safely)
DROP POLICY IF EXISTS "User can read own profile" ON public.profiles;
CREATE POLICY "User can read own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Allow any authenticated user to read pharmacy_staff profiles
-- (so doctors can populate the pharmacy directory)
DROP POLICY IF EXISTS "Authenticated can read pharmacy staff profiles" ON public.profiles;
CREATE POLICY "Authenticated can read pharmacy staff profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (role = 'pharmacy_staff');

-- Own-row upsert (insert + update)
DROP POLICY IF EXISTS "User can upsert own profile" ON public.profiles;
CREATE POLICY "User can upsert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "User can update own profile" ON public.profiles;
CREATE POLICY "User can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3.  pharmacy_clinic_links — ensure INSERT policy allows pharmacy staff
--     to create their own link row during signup (when they have a clinic_id
--     from the invite but are inserting the row themselves, not the doctor).
-- ---------------------------------------------------------------------------

-- Extend the existing INSERT policy to also allow pharmacy staff to
-- self-register a link for their own pharmacy_id.
DROP POLICY IF EXISTS "Pharmacy staff can insert own link" ON public.pharmacy_clinic_links;
CREATE POLICY "Pharmacy staff can insert own link"
ON public.pharmacy_clinic_links FOR INSERT
TO authenticated
WITH CHECK (
  pharmacy_id = auth.uid()
);

-- ---------------------------------------------------------------------------
-- 4.  Back-fill pharmacy_clinic_links for ALL pharmacies that have a
--     clinic_id set but no corresponding link row.
--     This covers accounts created before this migration.
-- ---------------------------------------------------------------------------
INSERT INTO public.pharmacy_clinic_links (clinic_id, pharmacy_id, status, is_primary)
SELECT p.clinic_id, p.id, 'active', false
FROM   public.pharmacies p
WHERE  p.clinic_id IS NOT NULL
ON CONFLICT (clinic_id, pharmacy_id) DO UPDATE
  SET status     = CASE
                     WHEN public.pharmacy_clinic_links.status IN ('cancelled') THEN 'active'
                     ELSE public.pharmacy_clinic_links.status
                   END,
      updated_at = now();

-- ---------------------------------------------------------------------------
-- 5.  Ensure pharmacy staff profiles have pharmacy_id set
--     (safety net for accounts created without the backfill trigger running)
-- ---------------------------------------------------------------------------
UPDATE public.profiles pr
SET    pharmacy_id = pr.id
WHERE  pr.role        = 'pharmacy_staff'
  AND  pr.pharmacy_id IS NULL
  AND  EXISTS (SELECT 1 FROM public.pharmacies ph WHERE ph.id = pr.id);

-- ---------------------------------------------------------------------------
-- 6.  email column on pharmacies (created by pharmacy_portal_auth.sql but
--     confirm it exists — ADD COLUMN IF NOT EXISTS is idempotent)
-- ---------------------------------------------------------------------------
ALTER TABLE public.pharmacies ADD COLUMN IF NOT EXISTS email text;

COMMIT;
