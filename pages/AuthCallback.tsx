import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '../services/db';
import { ensureDoctorClinicSetup } from '../services/doctorService';
import { syncAndFetchPharmacyProfile } from '../services/pharmacyService';

const AuthCallback: React.FC = () => {
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const finishAuth = async () => {
            try {
                let session: any = null;

                for (let attempt = 0; attempt < 6; attempt += 1) {
                    const { data, error: sessionError } = await supabase.auth.getSession();
                    if (sessionError) throw sessionError;
                    session = data.session;
                    if (session?.user) break;
                    await new Promise(resolve => setTimeout(resolve, 400));
                }

                if (!session?.user) {
                    throw new Error('We could not finish signing you in. Please try logging in again.');
                }

                const metaRole = session.user.user_metadata?.role;

                if (metaRole === 'pharmacy_staff') {
                    const profile = await syncAndFetchPharmacyProfile(session.user.id);
                    if (cancelled) return;
                    navigate(profile?.pharmacy_id ? '/pharmacy-portal' : '/login?portal=pharmacy', { replace: true });
                    return;
                }

                const doctorBootstrap = await ensureDoctorClinicSetup(session.user);
                if (cancelled) return;

                if (doctorBootstrap.role === 'pharmacy_staff') {
                    navigate('/pharmacy-portal', { replace: true });
                    return;
                }

                navigate('/app', { replace: true });
            } catch (err: any) {
                if (cancelled) return;
                setError(err?.message ?? 'Authentication failed. Please try again.');
                setTimeout(() => navigate('/login', { replace: true }), 2200);
            }
        };

        void finishAuth();
        return () => {
            cancelled = true;
        };
    }, [navigate]);

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl text-center">
                <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${error ? 'bg-rose-100' : 'bg-indigo-100'}`}>
                    {error ? (
                        <AlertTriangle size={24} className="text-rose-500" />
                    ) : (
                        <Loader2 size={24} className="animate-spin text-indigo-500" />
                    )}
                </div>
                <h1 className="text-lg font-bold text-slate-900">
                    {error ? 'Sign-in issue' : 'Completing sign-in'}
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                    {error ?? 'Please wait while we finish setting up your portal access.'}
                </p>
            </div>
        </div>
    );
};

export default AuthCallback;
