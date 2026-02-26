import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../services/db'

// ─────────────────────────────────────────────────────────────────────────────
// PLAN‑TIER FEATURE MAP
// ─────────────────────────────────────────────────────────────────────────────
export type PlanTier = 'trial' | 'basic' | 'pro' | 'enterprise'

export type FeatureKey =
    | 'front_desk'
    | 'doctor_portal'
    | 'analytics'
    | 'qr_checkin'
    | 'download_report'
    | 'medical_records'
    | 'advanced_analytics'
    | 'data_export'

/** Maps each plan tier to the features it unlocks */
export const PLAN_FEATURES: Record<PlanTier, FeatureKey[]> = {
    trial: [
        'front_desk', 'doctor_portal', 'analytics', 'qr_checkin',
        'medical_records', 'download_report', 'advanced_analytics', 'data_export',
    ],
    basic: [
        'front_desk', 'doctor_portal', 'medical_records',
    ],
    pro: [
        'front_desk', 'doctor_portal', 'analytics', 'qr_checkin',
        'medical_records', 'download_report', 'advanced_analytics',
    ],
    enterprise: [
        'front_desk', 'doctor_portal', 'analytics', 'qr_checkin',
        'medical_records', 'download_report', 'advanced_analytics', 'data_export',
    ],
}

/** Human-readable metadata for each feature (used by UpgradeModal / FeatureGate) */
export const FEATURE_LABELS: Record<FeatureKey, { name: string; description: string; icon: string }> = {
    front_desk: { name: 'Front Desk', description: 'Register and manage patients', icon: '🖥️' },
    doctor_portal: { name: 'Doctor Portal', description: 'Patient queue and consultations', icon: '👨‍⚕️' },
    analytics: { name: 'Analytics Hub', description: 'Revenue charts and patient insights', icon: '📊' },
    qr_checkin: { name: 'QR Check-In', description: 'Mobile patient self check-in via QR', icon: '📱' },
    download_report: { name: 'Download Reports', description: 'Export patient data as PDF/CSV', icon: '📥' },
    medical_records: { name: 'Medical Records', description: 'Full patient history and prescriptions', icon: '🗂️' },
    advanced_analytics: { name: 'Advanced Analytics', description: 'Diagnosis trends and forecasting', icon: '📈' },
    data_export: { name: 'Data Export', description: 'Bulk data export and integrations', icon: '💾' },
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
export type SubscriptionStatus =
    | 'loading'   // still fetching — NEVER render children
    | 'trial'     // free trial, within date window
    | 'active'    // paid & verified by admin
    | 'expired'   // trial or subscription has ended
    | 'locked'    // hard kill-switch: is_locked = true      ← NEW
    | 'error'     // fetch failed or no row found — LOCK app, never fail open

export interface Subscription {
    id: string
    clinic_id: string
    plan_name: string
    status: string         // raw DB column value
    is_paid: boolean
    is_locked: boolean     // admin hard-lock switch
    trial_starts_at: string
    trial_ends_at: string
    subscription_starts_at: string | null
    subscription_ends_at: string | null
    grace_period_ends_at: string | null
    amount_paid: number | null
    utr_number: string | null
    admin_notes: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK — prop-based clinicId (no AuthContext in this codebase)
// authResolved: must be TRUE before the hook fetches anything.
//               Pass `!authLoading` from App.tsx so the hook waits for auth.
// ─────────────────────────────────────────────────────────────────────────────
export function useSubscription(clinicId: string | null | undefined, authResolved: boolean) {
    const [subscription, setSubscription] = useState<Subscription | null>(null)
    const [status, setStatus] = useState<SubscriptionStatus>('loading')
    const [daysLeft, setDaysLeft] = useState<number>(0)
    const [fetchError, setFetchError] = useState<string | null>(null)

    const fetchSubscription = useCallback(async () => {
        // ── CRITICAL: do not fetch until auth has fully resolved ──
        if (!authResolved) return

        // If auth resolved but still no clinicId — lock, don't fail open
        if (!clinicId) {
            console.error('[useSubscription] clinicId is null after auth resolved. Locking app.')
            setStatus('error')
            setFetchError('No clinic linked to this account. Please contact support.')
            return
        }

        setStatus('loading')
        setFetchError(null)

        console.log('[useSubscription] Fetching for clinic_id:', clinicId)

        const { data, error } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('clinic_id', clinicId)   // explicit filter — belt AND suspenders with RLS
            .maybeSingle()               // null when no row, never throws PGRST116

        console.log('[useSubscription] Result → data:', data, '| error:', error)

        // ── Case 1: Supabase returned an actual error ──
        if (error) {
            console.error('[useSubscription] Supabase error:', error.message, error.code)
            setStatus('error')
            setFetchError(`Subscription check failed: ${error.message}`)
            return
        }

        // ── Case 2: Query succeeded but row doesn't exist (or RLS silently blocked it) ──
        // NEVER fail open — a missing row means we can't confirm access.
        if (!data) {
            console.warn('[useSubscription] No subscription row for clinic_id:', clinicId, '— locking app.')
            setStatus('error')
            setFetchError('No subscription found for this clinic. Contact support.')
            return
        }

        // ── Case 3: Row returned — derive status ──
        setSubscription(data)
        const derived = computeStatus(data)
        console.log('[useSubscription] Derived status:', derived)
        setStatus(derived)
        setDaysLeft(computeDaysLeft(data))
    }, [clinicId, authResolved])

    useEffect(() => {
        fetchSubscription()
    }, [fetchSubscription])

    // ─────────────────────────────────────────────────────────────────────────
    // DERIVED BOOLEANS
    // hasAccess is FALSE while loading or on error — never fail open
    // ─────────────────────────────────────────────────────────────────────────
    const hasAccess = status === 'trial' || status === 'active'
    const isLocked = status === 'locked' || status === 'expired' || status === 'error'
    const isLoading = status === 'loading'
    const isTrialEnding = status === 'trial' && daysLeft <= 2

    // ── Feature-level access check (plan-tier aware) ──────────────────────────
    const canUse = (feature: FeatureKey): boolean => {
        if (isLoading) return false         // safe default while fetching
        if (!subscription) return false     // no row → block
        if (isLocked) return false          // expired / hard-locked → block all

        // Normalise: DB stores 'trial', 'active', 'basic', 'pro', 'enterprise', etc.
        // For active paid plans the plan_name column carries the tier name.
        // For trial status we use the 'trial' tier regardless of plan_name.
        const tier: PlanTier =
            status === 'trial'
                ? 'trial'
                : ((subscription.plan_name?.toLowerCase() ?? 'basic') as PlanTier)

        const allowed = PLAN_FEATURES[tier] ?? PLAN_FEATURES['basic']
        return allowed.includes(feature)
    }

    return { subscription, status, daysLeft, fetchError, hasAccess, isLocked, isLoading, isTrialEnding, canUse, refetch: fetchSubscription }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function computeStatus(sub: Subscription): SubscriptionStatus {
    const now = new Date()

    // ── 1. Admin hard kill-switch — highest priority ──
    if (sub.is_locked === true) {
        return 'locked'
    }

    // ── 2. Explicitly expired by admin ──
    if (sub.status === 'expired') {
        return 'expired'
    }

    // ── 3. Paid active subscription ──
    if (sub.status === 'active' && sub.is_paid === true) {
        if (sub.subscription_ends_at) {
            const subEnd = new Date(sub.subscription_ends_at)
            // Grace period check
            if (sub.grace_period_ends_at) {
                const graceEnd = new Date(sub.grace_period_ends_at)
                if (graceEnd > now) return 'active'
            }
            if (subEnd < now) return 'expired'
        }
        return 'active'
    }

    // ── 4. Trial window ──
    if (sub.status === 'trial') {
        const trialEnd = new Date(sub.trial_ends_at)
        if (trialEnd > now) return 'trial'
        return 'expired' // trial date passed
    }

    // ── 5. Catch-all: unknown status → lock ──
    console.warn('[useSubscription] Unknown DB status value:', sub.status, '— locking app.')
    return 'expired'
}

function computeDaysLeft(sub: Subscription): number {
    const now = new Date()
    if (sub.status === 'trial') {
        const end = new Date(sub.trial_ends_at)
        return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000))
    }
    if (sub.status === 'active' && sub.subscription_ends_at) {
        const end = new Date(sub.subscription_ends_at)
        return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000))
    }
    return 0
}
