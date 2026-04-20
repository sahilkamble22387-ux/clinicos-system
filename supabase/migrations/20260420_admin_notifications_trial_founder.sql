BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Notifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  target text NOT NULL DEFAULT 'all',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read notifications" ON public.notifications;
CREATE POLICY "Anyone authenticated can read notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (true);

CREATE INDEX IF NOT EXISTS notifications_created_at_idx
  ON public.notifications (created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_target_idx
  ON public.notifications (target);

-- ---------------------------------------------------------------------------
-- 2) Trial banner state should live in Supabase, not localStorage
-- ---------------------------------------------------------------------------
ALTER TABLE public.clinics
ADD COLUMN IF NOT EXISTS trial_banner_dismissed_until timestamptz DEFAULT NULL;

-- Normalize older short trials to the current 30-day trial window.
UPDATE public.subscriptions
SET
  status = CASE WHEN status = 'trialing' THEN 'trial' ELSE status END,
  trial_ends_at = GREATEST(
    COALESCE(trial_ends_at, now() + interval '30 days'),
    COALESCE(trial_starts_at, now()) + interval '30 days'
  ),
  updated_at = now()
WHERE lower(COALESCE(status, '')) IN ('trial', 'trialing')
  AND (
    trial_ends_at IS NULL
    OR trial_starts_at IS NULL
    OR trial_ends_at < trial_starts_at + interval '30 days'
  );

-- Normalize old plan names so the admin dashboard and app only use current tiers.
UPDATE public.subscriptions
SET
  plan_name = CASE
    WHEN lower(plan_name) IN ('essential', 'starter') THEN 'basic'
    WHEN lower(plan_name) IN ('professional', 'premium', 'elite', 'pro', 'enterprise', 'clinic_pro') THEN 'professional'
    ELSE plan_name
  END,
  updated_at = now()
WHERE lower(COALESCE(plan_name, '')) IN (
  'essential',
  'starter',
  'professional',
  'premium',
  'elite',
  'pro',
  'enterprise',
  'clinic_pro'
);

-- ---------------------------------------------------------------------------
-- 3) Founder-plan metadata (dashboard uses plan_name='founder')
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  features_data_type text;
  features_udt_name text;
  basic_features text[] := ARRAY[
    'Full clinic workspace access',
    'Unlimited patients and records',
    'QR check-in and WhatsApp prescriptions',
    'Analytics dashboard and exports',
    'No patient-data usage limit',
    'Admin-controlled clinic management'
  ];
  professional_features text[] := ARRAY[
    'Everything in Basic',
    'Priority support and faster activation help',
    'Founder onboarding assistance',
    'Operational guidance for rollout clinics',
    'Unlimited patients and records',
    'No patient-data usage limit'
  ];
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'plans'
  ) THEN
    RETURN;
  END IF;

  SELECT data_type, udt_name
  INTO features_data_type, features_udt_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'plans'
    AND column_name = 'features'
  LIMIT 1;

  DELETE FROM public.plans
  WHERE lower(name) IN ('premium', 'elite', 'essential');

  UPDATE public.plans SET name = 'Basic', price = 499 WHERE lower(name) = 'basic';
  UPDATE public.plans SET name = 'Professional', price = 999 WHERE lower(name) = 'professional';
  UPDATE public.plans SET name = 'Founder', price = 599 WHERE lower(name) = 'founder';

  IF features_data_type = 'ARRAY' AND features_udt_name = '_text' THEN
    UPDATE public.plans SET features = basic_features WHERE lower(name) = 'basic';
    UPDATE public.plans SET features = professional_features WHERE lower(name) = 'professional';
    UPDATE public.plans SET features = professional_features WHERE lower(name) = 'founder';

    INSERT INTO public.plans (name, price, features)
    SELECT 'Basic', 499, basic_features
    WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE lower(name) = 'basic');

    INSERT INTO public.plans (name, price, features)
    SELECT 'Professional', 999, professional_features
    WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE lower(name) = 'professional');

    INSERT INTO public.plans (name, price, features)
    SELECT 'Founder', 599, professional_features
    WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE lower(name) = 'founder');
  ELSIF features_udt_name = 'jsonb' THEN
    UPDATE public.plans SET features = to_jsonb(basic_features) WHERE lower(name) = 'basic';
    UPDATE public.plans SET features = to_jsonb(professional_features) WHERE lower(name) = 'professional';
    UPDATE public.plans SET features = to_jsonb(professional_features) WHERE lower(name) = 'founder';

    INSERT INTO public.plans (name, price, features)
    SELECT 'Basic', 499, to_jsonb(basic_features)
    WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE lower(name) = 'basic');

    INSERT INTO public.plans (name, price, features)
    SELECT 'Professional', 999, to_jsonb(professional_features)
    WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE lower(name) = 'professional');

    INSERT INTO public.plans (name, price, features)
    SELECT 'Founder', 599, to_jsonb(professional_features)
    WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE lower(name) = 'founder');
  ELSE
    UPDATE public.plans
    SET features = array_to_string(basic_features, E'\n')
    WHERE lower(name) = 'basic';

    UPDATE public.plans
    SET features = array_to_string(professional_features, E'\n')
    WHERE lower(name) IN ('professional', 'founder');

    INSERT INTO public.plans (name, price, features)
    SELECT 'Basic', 499, array_to_string(basic_features, E'\n')
    WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE lower(name) = 'basic');

    INSERT INTO public.plans (name, price, features)
    SELECT 'Professional', 999, array_to_string(professional_features, E'\n')
    WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE lower(name) = 'professional');

    INSERT INTO public.plans (name, price, features)
    SELECT 'Founder', 599, array_to_string(professional_features, E'\n')
    WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE lower(name) = 'founder');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4) Doctor/pharmacy linking backfill and sync
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pharmacy_clinic_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, pharmacy_id)
);

ALTER TABLE public.pharmacy_clinic_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic members can read their links" ON public.pharmacy_clinic_links;
CREATE POLICY "Clinic members can read their links"
ON public.pharmacy_clinic_links FOR SELECT
TO authenticated
USING (
  clinic_id IN (
    SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
    UNION
    SELECT id FROM public.clinics WHERE owner_id = auth.uid()
  )
  OR pharmacy_id IN (
    SELECT pharmacy_id FROM public.profiles WHERE id = auth.uid() AND role = 'pharmacy_staff'
  )
);

DROP POLICY IF EXISTS "Clinic members can insert link requests" ON public.pharmacy_clinic_links;
CREATE POLICY "Clinic members can insert link requests"
ON public.pharmacy_clinic_links FOR INSERT
TO authenticated
WITH CHECK (
  clinic_id IN (
    SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
    UNION
    SELECT id FROM public.clinics WHERE owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Participants can update their links" ON public.pharmacy_clinic_links;
CREATE POLICY "Participants can update their links"
ON public.pharmacy_clinic_links FOR UPDATE
TO authenticated
USING (
  clinic_id IN (
    SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
    UNION
    SELECT id FROM public.clinics WHERE owner_id = auth.uid()
  )
  OR pharmacy_id IN (
    SELECT pharmacy_id FROM public.profiles WHERE id = auth.uid() AND role = 'pharmacy_staff'
  )
)
WITH CHECK (true);

INSERT INTO public.pharmacy_clinic_links (clinic_id, pharmacy_id, status, is_primary)
SELECT p.clinic_id, p.id, 'active', true
FROM public.pharmacies p
WHERE p.clinic_id IS NOT NULL
ON CONFLICT (clinic_id, pharmacy_id) DO UPDATE
SET status = EXCLUDED.status,
    updated_at = now();

UPDATE public.profiles pr
SET pharmacy_id = pr.id
WHERE pr.role = 'pharmacy_staff'
  AND pr.pharmacy_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.pharmacies ph
    WHERE ph.id = pr.id
  );

UPDATE public.profiles pr
SET clinic_id = resolved.clinic_id
FROM (
  SELECT DISTINCT ON (pcl.pharmacy_id)
    pcl.pharmacy_id,
    pcl.clinic_id
  FROM public.pharmacy_clinic_links pcl
  WHERE lower(pcl.status) IN ('active', 'approved')
  ORDER BY pcl.pharmacy_id, pcl.is_primary DESC, pcl.created_at DESC
) AS resolved
WHERE pr.id = resolved.pharmacy_id
  AND pr.role = 'pharmacy_staff'
  AND (pr.clinic_id IS DISTINCT FROM resolved.clinic_id);

CREATE OR REPLACE FUNCTION public.sync_pharmacy_clinic_id_on_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status IN ('active', 'approved') THEN
    UPDATE public.pharmacies
    SET clinic_id = NEW.clinic_id
    WHERE id = NEW.pharmacy_id;

    UPDATE public.profiles
    SET clinic_id = NEW.clinic_id,
        pharmacy_id = COALESCE(pharmacy_id, NEW.pharmacy_id)
    WHERE id = NEW.pharmacy_id
      AND role = 'pharmacy_staff';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_pharmacy_clinic_id_on_link ON public.pharmacy_clinic_links;
CREATE TRIGGER sync_pharmacy_clinic_id_on_link
AFTER INSERT OR UPDATE OF status, clinic_id
ON public.pharmacy_clinic_links
FOR EACH ROW
EXECUTE FUNCTION public.sync_pharmacy_clinic_id_on_link();

COMMIT;
