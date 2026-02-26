-- ═══════════════════════════════════════════════════════════════════════════
--  ClinicOS — Subscriptions: HARDENED RLS SETUP
--  Run this in: Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 0: Add is_locked column if it doesn't exist yet
-- (The frontend now explicitly checks this column)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Enable RLS on the subscriptions table
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Drop any broken old policies before recreating them
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Clinic can view own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Only service role can update subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Clinic owner can read own subscription" ON public.subscriptions;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: SELECT policy — allows an authenticated user to read their OWN row.
--
-- Matching logic (tries both patterns):
--   A) clinic_id = auth.uid()
--      → For clinics where the clinic ID equals the user's auth ID (common in this app)
--   B) clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid())
--      → For clinics where the user's profile points to a different clinic_id
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "Clinic owner can read own subscription"
ON public.subscriptions
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    clinic_id = auth.uid()
    OR
    clinic_id IN (
      SELECT clinic_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
    )
  )
);


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: BLOCK all client-side writes — only YOU (via service role or dashboard) can update
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "Block all client inserts on subscriptions"
ON public.subscriptions
FOR INSERT
WITH CHECK (false);

CREATE POLICY "Block all client updates on subscriptions"
ON public.subscriptions
FOR UPDATE
USING (false);

CREATE POLICY "Block all client deletes on subscriptions"
ON public.subscriptions
FOR DELETE
USING (false);


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: Add is_locked column to subscriptions table (safe if already exists)
-- Create subscriptions table if it was never created
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id               uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  plan_name               text NOT NULL DEFAULT 'trial',
  status                  text NOT NULL DEFAULT 'trial',
  is_locked               boolean NOT NULL DEFAULT false,
  is_paid                 boolean NOT NULL DEFAULT false,
  trial_starts_at         timestamptz NOT NULL DEFAULT now(),
  trial_ends_at           timestamptz NOT NULL DEFAULT (now() + interval '5 days'),
  subscription_starts_at  timestamptz,
  subscription_ends_at    timestamptz,
  grace_period_ends_at    timestamptz,
  amount_paid             numeric DEFAULT 0,
  currency                text DEFAULT 'INR',
  payment_method          text DEFAULT 'UPI',
  utr_number              text,
  payment_screenshot_url  text,
  payment_verified_at     timestamptz,
  payment_verified_by     text,
  admin_notes             text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6: Trigger — auto-create trial when a new clinic is created
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_trial_subscription()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.subscriptions (clinic_id, plan_name, status, trial_starts_at, trial_ends_at)
  VALUES (NEW.id, 'trial', 'trial', now(), now() + interval '5 days')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_clinic_created_create_trial ON public.clinics;
CREATE TRIGGER on_clinic_created_create_trial
AFTER INSERT ON public.clinics
FOR EACH ROW EXECUTE FUNCTION public.create_trial_subscription();


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 7: Backfill — ensure existing clinics all have a subscription row
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.subscriptions (clinic_id, plan_name, status, trial_starts_at, trial_ends_at)
SELECT c.id, 'trial', 'trial', now(), now() + interval '5 days'
FROM public.clinics c
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscriptions s WHERE s.clinic_id = c.id
);


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 8: ADMIN SHORTCUTS
-- ─────────────────────────────────────────────────────────────────────────────

-- Hard-lock a clinic immediately (app locks on next refresh):
-- UPDATE public.subscriptions SET is_locked = true, status = 'expired', updated_at = now() WHERE clinic_id = 'CLINIC_ID_HERE';

-- Activate after payment:
-- UPDATE public.subscriptions SET status = 'active', is_paid = true, is_locked = false, plan_name = 'professional', amount_paid = 2499, utr_number = 'UTR_HERE', payment_verified_at = now(), payment_verified_by = 'Sahil', subscription_starts_at = now(), subscription_ends_at = now() + interval '30 days', grace_period_ends_at = now() + interval '33 days', updated_at = now() WHERE clinic_id = 'CLINIC_ID_HERE';

-- View all subscriptions:
SELECT
  c.name AS clinic_name,
  s.plan_name,
  s.status,
  s.is_locked,
  s.is_paid,
  s.utr_number,
  CASE
    WHEN s.status = 'trial' THEN ROUND(EXTRACT(EPOCH FROM (s.trial_ends_at - now())) / 86400)::text || ' days left in trial'
    WHEN s.status = 'active' THEN ROUND(EXTRACT(EPOCH FROM (s.subscription_ends_at - now())) / 86400)::text || ' days until renewal'
    ELSE 'EXPIRED / BLOCKED'
  END AS access_info,
  s.updated_at
FROM public.subscriptions s
JOIN public.clinics c ON c.id = s.clinic_id
ORDER BY s.updated_at DESC;
