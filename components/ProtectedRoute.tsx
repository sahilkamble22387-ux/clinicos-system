/**
 * ProtectedRoute.tsx
 * Role-aware route guard. Wrap any <Route> element with this to enforce
 * that only users with the correct role can access it.
 *
 * Usage:
 *   <Route path="/pharmacy-portal" element={
 *     <ProtectedRoute allowedRoles={['pharmacy_staff']} redirectTo="/pharmacy-login">
 *       <PharmacyPortal />
 *     </ProtectedRoute>
 *   } />
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ShieldX } from 'lucide-react';
import { supabase } from '../services/db';

export type AppRole = 'admin' | 'doctor' | 'pharmacy_staff';

interface ProtectedRouteProps {
    /** Roles allowed to view this route */
    allowedRoles: AppRole[];
    /** Where to send the user if they fail the role check */
    redirectTo: string;
    children: React.ReactNode;
}

type CheckState = 'checking' | 'allowed' | 'denied' | 'unauthenticated';

export function ProtectedRoute({ allowedRoles, redirectTo, children }: ProtectedRouteProps) {
    const navigate = useNavigate();
    const [state, setState] = useState<CheckState>('checking');

    useEffect(() => {
        let cancelled = false;

        const check = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) {
                    if (!cancelled) {
                        setState('unauthenticated');
                        navigate(redirectTo, { replace: true });
                    }
                    return;
                }

                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single();

                if (cancelled) return;

                if (error || !profile) {
                    setState('denied');
                    navigate(redirectTo, { replace: true });
                    return;
                }

                if (!allowedRoles.includes(profile.role as AppRole)) {
                    setState('denied');
                    // Route wrong-role users to their correct home
                    const roleHome: Record<AppRole, string> = {
                        admin: '/',
                        doctor: '/',
                        pharmacy_staff: '/pharmacy-portal',
                    };
                    navigate(roleHome[profile.role as AppRole] ?? redirectTo, { replace: true });
                    return;
                }

                setState('allowed');
            } catch {
                if (!cancelled) {
                    setState('denied');
                    navigate(redirectTo, { replace: true });
                }
            }
        };

        check();
        return () => { cancelled = true; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    if (state === 'checking') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 size={24} className="text-indigo-500 animate-spin" />
                    <p className="text-sm text-slate-400 font-medium">Verifying access…</p>
                </div>
            </div>
        );
    }

    if (state === 'denied' || state === 'unauthenticated') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl border border-rose-200 p-8 max-w-sm w-full text-center shadow-xl">
                    <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <ShieldX size={22} className="text-rose-500" />
                    </div>
                    <h2 className="font-bold text-slate-900 text-base mb-2">Access Denied</h2>
                    <p className="text-sm text-slate-500">Redirecting you to the correct portal…</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}