import React, { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/db'

interface OnboardingGuardProps {
    children: React.ReactNode
}

export function OnboardingGuard({ children }: OnboardingGuardProps) {
    const { user, loading: authLoading, clinicProfile } = useAuth()

    // We do a DIRECT DB fetch instead of trusting context state.
    // This fixes the "stuck on onboarding" bug where context state
    // is stale because the RLS policy blocked the UPDATE silently.
    const [dbChecking, setDbChecking] = useState(true)
    const [canProceed, setCanProceed] = useState(false)

    useEffect(() => {
        // Wait for auth to resolve
        if (authLoading) return

        // Not logged in at all — stop checking
        if (!user?.id) {
            setDbChecking(false)
            return
        }

        setDbChecking(true)

        supabase
            .from('clinics')
            .select('onboarding_completed, registration_number')
            // Support both owner_id (existing) and id=userId (fallback)
            .or(`owner_id.eq.${user.id},id.eq.${user.id}`)
            .limit(1)
            .then(({ data, error }) => {
                if (error) {
                    console.error('[OnboardingGuard] DB check error:', error.message)
                }
                const row = data?.[0]
                const complete = !!(row?.onboarding_completed && row?.registration_number?.trim())
                setCanProceed(complete)
                setDbChecking(false)
            })

        // Re-run whenever:
        // 1. Auth finishes loading
        // 2. User changes (login/logout)
        // 3. clinicProfile changes — this is triggered by refreshClinicProfile()
        //    inside OnboardingForm after a successful save, causing the guard
        //    to re-check the DB and find onboarding_completed = true
    }, [user?.id, authLoading, clinicProfile])

    // ── Loading states ───────────────────────────────────────────────
    if (authLoading || dbChecking) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
                <div className="relative">
                    <div className="w-14 h-14 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-5 h-5 bg-indigo-100 rounded-full" />
                    </div>
                </div>
                <p className="text-slate-500 text-sm font-medium animate-pulse">
                    Loading your clinic…
                </p>
            </div>
        )
    }

    // ── Not authenticated ────────────────────────────────────────────
    if (!user) return <Navigate to="/login" replace />

    // ── Onboarding incomplete — redirect ────────────────────────────
    if (!canProceed) return <Navigate to="/onboarding" replace />

    // ── All good ─────────────────────────────────────────────────────
    return <>{children}</>
}