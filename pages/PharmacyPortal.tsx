/**
 * PharmacyPortal.tsx — Schema-corrected version
 *
 * BUG FIX 8:  Query now selects `medicines` (not `items` — that column doesn't exist)
 * BUG FIX 9:  MedicineItem interface matches the actual DB JSON structure
 *             (medicine_name, strength, form, timing[3], duration_value/unit, food_relation)
 * BUG FIX 10: `not_sent` status is now part of the PharmacyStatus union and is
 *             excluded from the portal query so those cards never appear
 *
 * All other fixes from the previous iteration (subscription leak, error handling,
 * timeAgo refresh, bell ack, double-update prevention) are retained.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../services/db';
import { syncAndFetchPharmacyProfile } from '../services/pharmacyService';
import {
    Pill, Package, CheckCircle, LogOut, Bell, BellOff,
    Clock, User, ChevronRight, Store, Loader2,
    AlertTriangle, Stethoscope, Hash, RefreshCw,
} from 'lucide-react';
import { Logo } from '../src/components/Logo';

// ─── Types ────────────────────────────────────────────────────────

// BUG FIX 10: Include not_sent in the union so TypeScript knows about it
type PharmacyStatus = 'not_sent' | 'sent_to_pharmacy' | 'packing' | 'ready' | 'dispensed';

// BUG FIX 9: Match the actual Supabase `medicines` JSONB structure
interface MedicineItem {
    medicine_name: string;
    strength?: string;
    form?: string;
    timing?: [number, number, number]; // [morning, afternoon, night]
    duration_value?: number;
    duration_unit?: string;
    food_relation?: string;
    instructions?: string;
}

interface Prescription {
    id: string;
    patient_name: string;
    patient_phone?: string;
    // BUG FIX 8: `medicines` is the actual column name in Supabase
    medicines: MedicineItem[] | string;
    pharmacy_status: PharmacyStatus;
    created_at: string;
    clinic_id: string;
}

interface PharmacyProfile {
    pharmacy_id: string;
    pharmacy_name: string;
    clinic_name: string;
}

// BUG FIX 8 & 9: Safe parser for the medicines JSONB column
function parseMedicines(raw: MedicineItem[] | string): MedicineItem[] {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { return []; }
    }
    return [];
}

// ─── Column config (excludes not_sent — portal only shows pharmacy-facing statuses) ──

const COLUMNS: {
    id: PharmacyStatus;
    label: string;
    icon: React.ReactNode;
    accent: string;
    pill: string;
    dot: string;
}[] = [
        { id: 'sent_to_pharmacy', label: 'Incoming', icon: <Bell size={13} />, accent: 'text-amber-600', pill: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
        { id: 'packing', label: 'Packing', icon: <Package size={13} />, accent: 'text-sky-600', pill: 'bg-sky-100 text-sky-700', dot: 'bg-sky-400' },
        { id: 'ready', label: 'Ready', icon: <CheckCircle size={13} />, accent: 'text-violet-600', pill: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
        { id: 'dispensed', label: 'Dispensed', icon: <Stethoscope size={13} />, accent: 'text-slate-400', pill: 'bg-slate-100 text-slate-500', dot: 'bg-slate-300' },
    ];

const NEXT_STATUS: Partial<Record<PharmacyStatus, PharmacyStatus>> = {
    sent_to_pharmacy: 'packing',
    packing: 'ready',
    ready: 'dispensed',
};

// ─── Main Component ───────────────────────────────────────────────

const PharmacyPortal: React.FC = () => {
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [profile, setProfile] = useState<PharmacyProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [initError, setInitError] = useState('');
    const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
    const [newIds, setNewIds] = useState<Set<string>>(new Set());
    const [bellAcknowledged, setBellAcknowledged] = useState(false);
    const realtimeCleanupRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        let cancelled = false;
        const init = async () => {
            try {
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                if (sessionError) throw sessionError;
                if (!session) { window.location.href = '/login?portal=pharmacy'; return; }

                const profileData = await syncAndFetchPharmacyProfile(session.user.id);

                if (!profileData || profileData.role !== 'pharmacy_staff') {
                    setInitError("You don't have pharmacy access. Please use the correct login.");
                    setLoading(false); return;
                }
                if (!profileData.pharmacy_id) {
                    setInitError("Your account isn't linked to a pharmacy yet. Contact your doctor.");
                    setLoading(false); return;
                }

                const pharmacyPromise = (supabase as any)
                    .from('pharmacies')
                    .select('name')
                    .eq('id', profileData.pharmacy_id)
                    .single();

                const clinicPromise = profileData.clinic_id
                    ? (supabase as any)
                        .from('clinics')
                        .select('name')
                        .eq('id', profileData.clinic_id)
                        .single()
                    : Promise.resolve({ data: null });

                const [pharmacyRes, clinicRes] = await Promise.all([pharmacyPromise, clinicPromise]);

                if (cancelled) return;

                setProfile({
                    pharmacy_id: profileData.pharmacy_id,
                    pharmacy_name: pharmacyRes.data?.name ?? profileData.full_name ?? 'My Pharmacy',
                    clinic_name: clinicRes.data?.name ?? 'Clinic link pending',
                });

                await loadPrescriptions(profileData.pharmacy_id);
                realtimeCleanupRef.current = subscribeRealtime(profileData.pharmacy_id);
            } catch (err: any) {
                if (!cancelled) setInitError(err?.message ?? 'Failed to load. Please refresh.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        init();
        return () => {
            cancelled = true;
            realtimeCleanupRef.current?.();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const loadPrescriptions = async (pharmacyId: string) => {
        const { data, error } = await supabase
            .from('prescriptions')
            // BUG FIX 8: Select `medicines` not `items`
            .select('id, patient_name, patient_phone, medicines, pharmacy_status, created_at, clinic_id')
            .eq('pharmacy_id', pharmacyId)
            // BUG FIX 10: Exclude `not_sent` — these haven't been sent to pharmacy yet
            .neq('pharmacy_status', 'not_sent')
            .order('created_at', { ascending: false })
            .limit(120);

        if (!error && data) setPrescriptions(data as Prescription[]);
    };

    const subscribeRealtime = useCallback((pharmacyId: string): (() => void) => {
        const channel = supabase
            .channel(`pharmacy-rx-${pharmacyId}`)
            .on('postgres_changes', {
                event: 'INSERT', schema: 'public', table: 'prescriptions',
                filter: `pharmacy_id=eq.${pharmacyId}`,
            }, (payload) => {
                const newRx = payload.new as Prescription;
                // BUG FIX 10: Skip not_sent inserts in realtime too
                if (newRx.pharmacy_status === 'not_sent') return;
                setPrescriptions(prev => [newRx, ...prev]);
                setBellAcknowledged(false);
                setNewIds(prev => new Set([...prev, newRx.id]));
                setTimeout(() => setNewIds(prev => { const s = new Set(prev); s.delete(newRx.id); return s; }), 4000);
            })
            .on('postgres_changes', {
                event: 'UPDATE', schema: 'public', table: 'prescriptions',
                filter: `pharmacy_id=eq.${pharmacyId}`,
            }, (payload) => {
                const updated = payload.new as Prescription;
                setUpdatingIds(prev => {
                    if (prev.has(updated.id)) return prev;
                    setPrescriptions(p => p.map(rx => rx.id === updated.id ? { ...rx, ...updated } : rx));
                    return prev;
                });
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const advanceStatus = async (rx: Prescription) => {
        const next = NEXT_STATUS[rx.pharmacy_status];
        if (!next || updatingIds.has(rx.id)) return;

        setUpdatingIds(prev => new Set([...prev, rx.id]));
        setPrescriptions(prev => prev.map(r => r.id === rx.id ? { ...r, pharmacy_status: next } : r));

        const { error } = await (supabase as any)
            .from('prescriptions').update({ pharmacy_status: next }).eq('id', rx.id);

        if (error) {
            setPrescriptions(prev => prev.map(r => r.id === rx.id ? { ...r, pharmacy_status: rx.pharmacy_status } : r));
        }
        setUpdatingIds(prev => { const s = new Set(prev); s.delete(rx.id); return s; });
    };

    const handleLogout = async () => {
        realtimeCleanupRef.current?.();
        await supabase.auth.signOut();
        window.location.href = '/login?portal=pharmacy';
    };

    if (loading) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center">
                    <Pill size={22} className="text-white" />
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400 font-medium">
                    <Loader2 size={14} className="animate-spin" />
                    Loading dashboard…
                </div>
            </div>
        </div>
    );

    if (initError) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-rose-200 p-8 max-w-sm w-full text-center shadow-xl">
                <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle size={22} className="text-rose-500" />
                </div>
                <h2 className="font-bold text-slate-900 text-base mb-2">Access Denied</h2>
                <p className="text-sm text-slate-500 mb-6">{initError}</p>
                <button onClick={handleLogout} className="w-full py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-700 transition-colors">
                    Back to Login
                </button>
            </div>
        </div>
    );

    const columnData = COLUMNS.map(col => ({
        ...col,
        items: prescriptions.filter(rx => rx.pharmacy_status === col.id),
    }));

    const newCount = prescriptions.filter(rx => rx.pharmacy_status === 'sent_to_pharmacy').length;
    const totalActive = prescriptions.filter(rx => rx.pharmacy_status !== 'dispensed').length;

    return (
        <div className="min-h-screen flex flex-col bg-slate-50" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

            <header className="bg-white border-b border-slate-200 flex-shrink-0 sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                    <Logo variant="full" usage="navbar" theme="dark" />
                    </div>

                    <div className="flex items-center gap-2">
                        {totalActive > 0 && (
                            <span className="hidden sm:inline-flex text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                                {totalActive} active
                            </span>
                        )}
                        <button
                            onClick={() => setBellAcknowledged(true)}
                            aria-label={`${newCount} new prescriptions`}
                            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all ${newCount > 0 && !bellAcknowledged ? 'bg-amber-50 border-amber-200 text-amber-700 animate-pulse' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                        >
                            {newCount > 0 && !bellAcknowledged ? <Bell size={12} /> : <BellOff size={12} />}
                            <span>{newCount > 0 ? `${newCount} new` : 'All clear'}</span>
                        </button>
                        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 rounded-full border border-slate-200">
                            <Store size={11} className="text-slate-400" />
                            <span className="text-[11px] text-slate-500 font-medium">{profile?.clinic_name}</span>
                        </div>
                        <button onClick={handleLogout} aria-label="Sign out" className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 hover:text-rose-500 hover:bg-rose-50 rounded-full border border-slate-200 transition-colors font-medium">
                            <LogOut size={12} />
                            <span className="hidden sm:inline">Sign Out</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-6 py-5">
                <div className="mb-5 flex items-end justify-between">
                    <div>
                        <h1 className="font-black text-slate-900 text-lg tracking-tight">Prescription Queue</h1>
                        <p className="text-xs text-slate-400 mt-0.5">Live from {profile?.clinic_name} · auto-updating</p>
                    </div>
                    <button onClick={() => profile && loadPrescriptions(profile.pharmacy_id)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 transition-colors">
                        <RefreshCw size={11} />
                        Refresh
                    </button>
                </div>

                {/* Mobile summary strip */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-1 sm:hidden">
                    {columnData.map(col => (
                        <div key={col.id} className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${col.pill}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
                            {col.label} · {col.items.length}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {columnData.map(col => (
                        <div key={col.id} className="flex flex-col gap-2">
                            <div className="hidden sm:flex items-center justify-between px-3 py-2 rounded-xl bg-white border border-slate-200">
                                <div className={`flex items-center gap-2 text-xs font-bold ${col.accent}`}>
                                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                                    {col.label}
                                </div>
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${col.pill}`}>{col.items.length}</span>
                            </div>

                            <div className="flex flex-col gap-2 min-h-[100px]">
                                <AnimatePresence initial={false}>
                                    {col.items.length === 0 ? (
                                        <div className="flex items-center justify-center py-8 text-xs text-slate-300 rounded-xl border border-dashed border-slate-200 bg-white/50">
                                            Empty
                                        </div>
                                    ) : (
                                        col.items.map(rx => (
                                            <motion.div key={rx.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ type: 'spring', stiffness: 400, damping: 32 }}>
                                                <PrescriptionCard
                                                    rx={rx}
                                                    isNew={newIds.has(rx.id)}
                                                    isUpdating={updatingIds.has(rx.id)}
                                                    onAdvance={() => advanceStatus(rx)}
                                                    nextLabel={NEXT_STATUS[rx.pharmacy_status]
                                                        ? COLUMNS.find(c => c.id === NEXT_STATUS[rx.pharmacy_status])?.label
                                                        : undefined}
                                                />
                                            </motion.div>
                                        ))
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
};

// ─── timeAgo hook — live-updating ────────────────────────────────

function useTimeAgo(dateStr: string): string {
    const compute = useCallback(() => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    }, [dateStr]);

    const [label, setLabel] = useState(compute);
    useEffect(() => {
        const id = setInterval(() => setLabel(compute()), 30_000);
        return () => clearInterval(id);
    }, [compute]);
    return label;
}

// ─── Prescription Card ────────────────────────────────────────────

const PrescriptionCard: React.FC<{
    rx: Prescription;
    isNew: boolean;
    isUpdating: boolean;
    onAdvance: () => void;
    nextLabel: string | undefined;
}> = ({ rx, isNew, isUpdating, onAdvance, nextLabel }) => {
    const timeAgo = useTimeAgo(rx.created_at);
    // BUG FIX 8 & 9: Parse medicines (not items)
    const medicines = parseMedicines(rx.medicines);

    // Format timing array → "1-0-1" → "Morning · Night"
    const formatTiming = (timing?: [number, number, number]) => {
        if (!timing) return '';
        const slots = ['Morn', 'Noon', 'Night'];
        return timing.map((v, i) => v ? slots[i] : null).filter(Boolean).join(' · ');
    };

    return (
        <div className={`bg-white rounded-xl border transition-all duration-200 ${isNew ? 'border-amber-300 shadow-md shadow-amber-100/60' : 'border-slate-200 shadow-sm'} ${isUpdating ? 'opacity-60 pointer-events-none' : ''}`}>
            <div className="p-3.5 space-y-2.5">

                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <User size={13} className="text-indigo-500" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate leading-tight">{rx.patient_name}</p>
                            {rx.patient_phone && <p className="text-[10px] text-slate-400 font-mono">{rx.patient_phone}</p>}
                        </div>
                    </div>
                    <AnimatePresence>
                        {isNew && (
                            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="flex-shrink-0 text-[9px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full border border-amber-200">
                                NEW
                            </motion.span>
                        )}
                    </AnimatePresence>
                </div>

                {/* BUG FIX 9: Render medicine_name + strength + timing */}
                {medicines.length > 0 && (
                    <div className="space-y-1 bg-slate-50 rounded-lg p-2">
                        {medicines.slice(0, 3).map((med, i) => (
                            <div key={i} className="flex items-start gap-1.5">
                                <Hash size={9} className="text-slate-300 flex-shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                    <span className="text-[11px] font-semibold text-slate-700 block truncate">{med.medicine_name}</span>
                                    <span className="text-[10px] text-slate-400">
                                        {[med.strength, med.form, formatTiming(med.timing)].filter(Boolean).join(' · ')}
                                        {med.duration_value && ` · ${med.duration_value}${med.duration_unit ?? 'd'}`}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {medicines.length > 3 && <p className="text-[10px] text-slate-400 pl-3.5">+{medicines.length - 3} more</p>}
                    </div>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                        <Clock size={9} />
                        {timeAgo}
                    </div>
                    {nextLabel ? (
                        <button onClick={onAdvance} disabled={isUpdating} className="flex items-center gap-1 px-2.5 py-1 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white rounded-lg text-[11px] font-bold transition-colors">
                            {isUpdating ? <Loader2 size={10} className="animate-spin" /> : <ChevronRight size={10} />}
                            {nextLabel}
                        </button>
                    ) : (
                        <span className="text-[10px] text-violet-600 font-bold flex items-center gap-1">
                            <CheckCircle size={10} /> Done
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PharmacyPortal;
