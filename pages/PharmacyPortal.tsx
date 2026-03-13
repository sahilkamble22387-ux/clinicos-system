/**
 * PharmacyPortal.tsx  (add to your pages/ folder)
 * ─────────────────────────────────────────────────────────────────
 * Route: /pharmacy-portal
 * 
 * This is the COMPLETE isolated environment for pharmacy staff.
 * - Shows only prescriptions sent to their specific pharmacy
 * - Realtime: new prescriptions appear instantly (no refresh)
 * - Kanban: staff drag prescriptions through packing → ready → dispensed
 * - Zero access to doctor queue, analytics, or patient history
 *
 * Add to App.tsx Routes:
 *   import PharmacyPortal from './pages/PharmacyPortal';
 *   <Route path="/pharmacy-portal" element={<PharmacyPortal />} />
 *   <Route path="/pharmacy-login" element={<PharmacyLogin />} />
 * ─────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/db';
import {
    Pill, Package, CheckCircle, LogOut, Bell,
    Clock, User, Hash, ChevronRight, Store, Loader,
    AlertTriangle, Stethoscope,
} from 'lucide-react';

// ── Types ──

type PharmacyStatus = 'sent_to_pharmacy' | 'packing' | 'ready' | 'dispensed';

interface PrescriptionItem {
    name: string;
    dosage?: string;
    quantity?: string;
    instructions?: string;
}

interface Prescription {
    id: string;
    patient_name: string;
    patient_phone?: string;
    items: PrescriptionItem[];
    pharmacy_status: PharmacyStatus;
    created_at: string;
    clinic_id: string;
}

interface PharmacyProfile {
    pharmacy_id: string;
    pharmacy_name: string;
    clinic_name: string;
}

// ── Column config ──
const COLUMNS: { id: PharmacyStatus; label: string; icon: React.ReactNode; color: string; bg: string; border: string }[] = [
    {
        id: 'sent_to_pharmacy',
        label: 'New',
        icon: <Bell size={14} />,
        color: 'text-amber-700',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
    },
    {
        id: 'packing',
        label: 'Packing',
        icon: <Package size={14} />,
        color: 'text-blue-700',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
    },
    {
        id: 'ready',
        label: 'Ready',
        icon: <CheckCircle size={14} />,
        color: 'text-emerald-700',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
    },
    {
        id: 'dispensed',
        label: 'Dispensed',
        icon: <Stethoscope size={14} />,
        color: 'text-slate-500',
        bg: 'bg-slate-50',
        border: 'border-slate-200',
    },
];

const NEXT_STATUS: Record<PharmacyStatus, PharmacyStatus | null> = {
    sent_to_pharmacy: 'packing',
    packing: 'ready',
    ready: 'dispensed',
    dispensed: null,
};

// ── Main Component ──

const PharmacyPortal: React.FC = () => {
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [profile, setProfile] = useState<PharmacyProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState('');
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [newIds, setNewIds] = useState<Set<string>>(new Set()); // for flash animation

    // ── Auth check ──
    useEffect(() => {
        initPortal();
    }, []);

    const initPortal = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            window.location.href = '/pharmacy-login';
            return;
        }

        const { data: profileData } = await supabase
            .from('profiles')
            .select('role, pharmacy_id, clinic_id')
            .eq('id', session.user.id)
            .single();

        if (!profileData || profileData.role !== 'pharmacy_staff') {
            setAuthError("You don't have pharmacy access. Please use the correct login.");
            setLoading(false);
            return;
        }

        if (!profileData.pharmacy_id) {
            setAuthError("Your account isn't linked to a pharmacy yet. Contact your doctor.");
            setLoading(false);
            return;
        }

        // Load pharmacy + clinic names
        const [pharmacyRes, clinicRes] = await Promise.all([
            supabase.from('pharmacies').select('name').eq('id', profileData.pharmacy_id).single(),
            supabase.from('clinics').select('name').eq('id', profileData.clinic_id).single(),
        ]);

        setProfile({
            pharmacy_id: profileData.pharmacy_id,
            pharmacy_name: pharmacyRes.data?.name || 'My Pharmacy',
            clinic_name: clinicRes.data?.name || 'Linked Clinic',
        });

        await loadPrescriptions(profileData.pharmacy_id);
        subscribeRealtime(profileData.pharmacy_id);
        setLoading(false);
    };

    const loadPrescriptions = async (pharmacyId: string) => {
        const { data, error } = await supabase
            .from('prescriptions')
            .select('id, patient_name, patient_phone, items, pharmacy_status, created_at, clinic_id')
            .eq('pharmacy_id', pharmacyId)
            .neq('pharmacy_status', 'dispensed') // hide old dispensed after 24h optionally
            .order('created_at', { ascending: false })
            .limit(100);

        if (!error && data) {
            setPrescriptions(data as Prescription[]);
        }
    };

    const subscribeRealtime = useCallback((pharmacyId: string) => {
        const channel = supabase
            .channel('pharmacy-prescriptions-' + pharmacyId)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'prescriptions',
                    filter: `pharmacy_id=eq.${pharmacyId}`,
                },
                (payload) => {
                    const newRx = payload.new as Prescription;
                    setPrescriptions(prev => [newRx, ...prev]);
                    // Flash animation for new arrivals
                    setNewIds(prev => new Set([...prev, newRx.id]));
                    setTimeout(() => {
                        setNewIds(prev => {
                            const next = new Set(prev);
                            next.delete(newRx.id);
                            return next;
                        });
                    }, 3000);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'prescriptions',
                    filter: `pharmacy_id=eq.${pharmacyId}`,
                },
                (payload) => {
                    setPrescriptions(prev =>
                        prev.map(rx => rx.id === payload.new.id ? { ...rx, ...payload.new } as Prescription : rx)
                    );
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const advanceStatus = async (prescription: Prescription) => {
        const next = NEXT_STATUS[prescription.pharmacy_status];
        if (!next) return;
        setUpdatingId(prescription.id);
        const { error } = await supabase
            .from('prescriptions')
            .update({ pharmacy_status: next })
            .eq('id', prescription.id);
        if (!error) {
            setPrescriptions(prev =>
                prev.map(rx => rx.id === prescription.id ? { ...rx, pharmacy_status: next } : rx)
            );
        }
        setUpdatingId(null);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/pharmacy-login';
    };

    // ── Loading / Error ──

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center animate-pulse">
                        <Pill size={24} className="text-white" />
                    </div>
                    <p className="text-sm text-slate-500 font-medium">Loading pharmacy dashboard…</p>
                </div>
            </div>
        );
    }

    if (authError) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl border border-rose-200 p-8 max-w-sm w-full text-center shadow-xl">
                    <div className="w-14 h-14 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle size={28} className="text-rose-500" />
                    </div>
                    <h2 className="font-bold text-slate-900 text-lg mb-2">Access Denied</h2>
                    <p className="text-sm text-slate-500 mb-6">{authError}</p>
                    <button
                        onClick={handleLogout}
                        className="w-full py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-700 transition-colors"
                    >
                        Back to Login
                    </button>
                </div>
            </div>
        );
    }

    const columnData = COLUMNS.map(col => ({
        ...col,
        items: prescriptions.filter(rx => rx.pharmacy_status === col.id),
    }));

    const newCount = prescriptions.filter(rx => rx.pharmacy_status === 'sent_to_pharmacy').length;

    return (
        <div className="min-h-screen flex flex-col" style={{ background: '#F8FAFC', fontFamily: 'Inter, system-ui, sans-serif' }}>

            {/* ── Header ── */}
            <header className="bg-white border-b border-slate-200 shadow-sm flex-shrink-0">
                <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-indigo-500 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
                            <Pill size={18} className="text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-black text-slate-900 text-base tracking-tight">NirogOS</span>
                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">PHARMACY</span>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-none">{profile?.pharmacy_name}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {newCount > 0 && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full animate-pulse">
                                <Bell size={12} className="text-amber-600" />
                                <span className="text-xs font-bold text-amber-700">{newCount} new</span>
                            </div>
                        )}
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-200">
                            <Store size={12} className="text-slate-400" />
                            <span className="text-xs text-slate-500 font-medium">{profile?.clinic_name}</span>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors border border-slate-200 font-medium"
                        >
                            <LogOut size={12} />
                            <span className="hidden sm:inline">Sign Out</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Kanban ── */}
            <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-8 py-6">
                <div className="mb-6">
                    <h1 className="font-black text-slate-900 text-xl">Prescription Queue</h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                        Live prescriptions from {profile?.clinic_name} · Updates in real-time
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {columnData.map(col => (
                        <div key={col.id} className="flex flex-col gap-3">
                            {/* Column header */}
                            <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${col.bg} ${col.border}`}>
                                <div className={`flex items-center gap-2 font-bold text-sm ${col.color}`}>
                                    {col.icon}
                                    {col.label}
                                </div>
                                {col.items.length > 0 && (
                                    <span className={`text-xs font-black px-2 py-0.5 rounded-full ${col.color} ${col.bg} border ${col.border}`}>
                                        {col.items.length}
                                    </span>
                                )}
                            </div>

                            {/* Cards */}
                            <div className="flex flex-col gap-2 min-h-[120px]">
                                {col.items.length === 0 ? (
                                    <div className="flex items-center justify-center py-8 text-xs text-slate-300 font-medium rounded-xl border border-dashed border-slate-200">
                                        Empty
                                    </div>
                                ) : (
                                    col.items.map(rx => (
                                        <PrescriptionCard
                                            key={rx.id}
                                            rx={rx}
                                            isNew={newIds.has(rx.id)}
                                            isUpdating={updatingId === rx.id}
                                            onAdvance={() => advanceStatus(rx)}
                                            nextLabel={NEXT_STATUS[rx.pharmacy_status]
                                                ? COLUMNS.find(c => c.id === NEXT_STATUS[rx.pharmacy_status])?.label
                                                : null}
                                        />
                                    ))
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
};

// ── Prescription Card ──

const PrescriptionCard: React.FC<{
    rx: Prescription;
    isNew: boolean;
    isUpdating: boolean;
    onAdvance: () => void;
    nextLabel: string | null | undefined;
}> = ({ rx, isNew, isUpdating, onAdvance, nextLabel }) => {
    const timeAgo = (() => {
        const diff = Date.now() - new Date(rx.created_at).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        return `${Math.floor(mins / 60)}h ago`;
    })();

    const items: PrescriptionItem[] = Array.isArray(rx.items) ? rx.items : [];

    return (
        <div
            className={`
        bg-white rounded-xl border shadow-sm transition-all duration-300
        ${isNew ? 'border-amber-300 shadow-amber-100 scale-[1.02]' : 'border-slate-200'}
        ${isUpdating ? 'opacity-60' : ''}
      `}
        >
            <div className="p-3.5 space-y-2.5">
                {/* Patient */}
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <User size={13} className="text-indigo-600" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate leading-tight">{rx.patient_name}</p>
                            {rx.patient_phone && (
                                <p className="text-[11px] text-slate-400 font-mono">{rx.patient_phone}</p>
                            )}
                        </div>
                    </div>
                    {isNew && (
                        <span className="flex-shrink-0 text-[9px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full border border-amber-200 animate-pulse">
                            NEW
                        </span>
                    )}
                </div>

                {/* Medicines */}
                {items.length > 0 && (
                    <div className="space-y-1">
                        {items.slice(0, 4).map((item, i) => (
                            <div key={i} className="flex items-start gap-1.5">
                                <Hash size={10} className="text-slate-300 flex-shrink-0 mt-1" />
                                <div className="min-w-0">
                                    <span className="text-xs font-semibold text-slate-700 block truncate">{item.name}</span>
                                    {item.dosage && (
                                        <span className="text-[10px] text-slate-400">{item.dosage}{item.quantity ? ` · Qty: ${item.quantity}` : ''}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                        {items.length > 4 && (
                            <p className="text-[10px] text-slate-400 pl-4">+{items.length - 4} more items</p>
                        )}
                    </div>
                )}

                {/* Time + Action */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                        <Clock size={10} />
                        {timeAgo}
                    </div>
                    {nextLabel && (
                        <button
                            onClick={onAdvance}
                            disabled={isUpdating}
                            className="flex items-center gap-1 px-2.5 py-1 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg text-[11px] font-bold transition-colors"
                        >
                            {isUpdating ? <Loader size={10} className="animate-spin" /> : <ChevronRight size={10} />}
                            {nextLabel}
                        </button>
                    )}
                    {!nextLabel && (
                        <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                            <CheckCircle size={10} /> Done
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PharmacyPortal;