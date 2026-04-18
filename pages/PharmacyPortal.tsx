import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Bell,
    CheckCircle2,
    ChevronDown,
    Clock3,
    Loader2,
    LogOut,
    Package,
    Pill,
    RefreshCw,
    ShieldCheck,
    Sparkles,
    Stethoscope,
    Store,
    UserRound,
} from 'lucide-react';
import { formatDistanceToNowStrict, isToday } from 'date-fns';
import { supabase } from '../services/db';
import { syncAndFetchPharmacyProfile } from '../services/pharmacyService';
import { Logo } from '../src/components/Logo';

type PharmacyStatus = 'not_sent' | 'sent_to_pharmacy' | 'packing' | 'ready' | 'dispensed';

interface MedicineItem {
    medicine_name: string;
    strength?: string | null;
    form?: string | null;
    dosage?: string | null;
    quantity?: string | number | null;
    timing?: [number, number, number] | null;
    duration_value?: number | null;
    duration_unit?: string | null;
    food_relation?: string | null;
    instructions?: string | null;
}

interface Prescription {
    id: string;
    clinic_id: string;
    patient_name: string;
    patient_phone?: string | null;
    doctor_name?: string | null;
    medicines: MedicineItem[] | string | null;
    pharmacy_status: PharmacyStatus;
    created_at: string;
    updated_at?: string | null;
}

interface PharmacyWorkspaceProfile {
    pharmacy_id: string;
    pharmacy_name: string;
    clinic_name: string;
    clinic_status: string | null;
}

type ColumnId = Extract<PharmacyStatus, 'sent_to_pharmacy' | 'packing' | 'ready' | 'dispensed'>;

type ColumnConfig = {
    id: ColumnId;
    label: string;
    headerClassName: string;
    badgeClassName: string;
    accentClassName: string;
    icon: React.ReactNode;
    actionLabel?: string;
};

const COLUMNS: ColumnConfig[] = [
    {
        id: 'sent_to_pharmacy',
        label: 'Incoming',
        headerClassName: 'from-rose-950 via-slate-900 to-slate-800',
        badgeClassName: 'bg-rose-50 text-rose-700 border border-rose-100',
        accentClassName: 'text-rose-500',
        icon: <Bell size={14} />,
        actionLabel: 'Start Packing',
    },
    {
        id: 'packing',
        label: 'Packing',
        headerClassName: 'from-indigo-950 via-slate-900 to-slate-800',
        badgeClassName: 'bg-amber-50 text-amber-700 border border-amber-100',
        accentClassName: 'text-amber-500',
        icon: <Package size={14} />,
        actionLabel: 'Mark Ready',
    },
    {
        id: 'ready',
        label: 'Ready',
        headerClassName: 'from-emerald-950 via-slate-900 to-slate-800',
        badgeClassName: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
        accentClassName: 'text-emerald-500',
        icon: <CheckCircle2 size={14} />,
        actionLabel: 'Dispense',
    },
    {
        id: 'dispensed',
        label: 'Dispensed',
        headerClassName: 'from-slate-900 via-slate-800 to-slate-700',
        badgeClassName: 'bg-slate-100 text-slate-600 border border-slate-200',
        accentClassName: 'text-slate-400',
        icon: <ShieldCheck size={14} />,
    },
];

const NEXT_STATUS: Partial<Record<ColumnId, ColumnId>> = {
    sent_to_pharmacy: 'packing',
    packing: 'ready',
    ready: 'dispensed',
};

const STATUS_LABELS: Record<string, string> = {
    active: 'Linked',
    pending: 'Pending link',
    approved: 'Approved',
};

function parseMedicines(raw: Prescription['medicines']): MedicineItem[] {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}

function formatTimeAgo(dateStr: string) {
    return `${formatDistanceToNowStrict(new Date(dateStr), { roundingMethod: 'floor' })} ago`;
}

function formatTiming(timing?: [number, number, number] | null) {
    if (!timing || !Array.isArray(timing)) return null;
    const labels = ['Morning', 'Afternoon', 'Night'];
    const slots = timing.map((value, index) => value ? labels[index] : null).filter(Boolean);
    return slots.length > 0 ? slots.join(' · ') : null;
}

function getMedicineMeta(medicine: MedicineItem) {
    const dosage = medicine.dosage || [medicine.strength, medicine.form].filter(Boolean).join(' ') || 'Standard dose';
    const quantity = medicine.quantity
        ? String(medicine.quantity)
        : medicine.duration_value
            ? `${medicine.duration_value} ${medicine.duration_unit ?? 'days'}`
            : 'As prescribed';
    const instructions = [formatTiming(medicine.timing), medicine.food_relation, medicine.instructions]
        .filter(Boolean)
        .join(' · ');

    return { dosage, quantity, instructions: instructions || 'No extra instructions' };
}

async function fetchLinkedClinic(pharmacyId: string, fallbackClinicId?: string | null) {
    const linkQuery = await (supabase as any)
        .from('pharmacy_clinic_links')
        .select('status, is_primary, created_at, clinics(name)')
        .eq('pharmacy_id', pharmacyId)
        .in('status', ['active', 'pending', 'approved'])
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!linkQuery.error && linkQuery.data) {
        return {
            clinic_name: linkQuery.data.clinics?.name ?? 'Linked clinic',
            clinic_status: linkQuery.data.status ?? null,
        };
    }

    if (!fallbackClinicId) {
        return {
            clinic_name: 'Unlinked clinic',
            clinic_status: null,
        };
    }

    const clinicQuery = await (supabase as any)
        .from('clinics')
        .select('name')
        .eq('id', fallbackClinicId)
        .maybeSingle();

    return {
        clinic_name: clinicQuery.data?.name ?? 'Linked clinic',
        clinic_status: null,
    };
}

async function fetchPrescriptionRows(pharmacyId: string) {
    const withUpdatedAt = await (supabase as any)
        .from('prescriptions')
        .select('id, clinic_id, patient_name, patient_phone, doctor_name, medicines, pharmacy_status, created_at, updated_at')
        .eq('pharmacy_id', pharmacyId)
        .neq('pharmacy_status', 'not_sent')
        .order('created_at', { ascending: false })
        .limit(150);

    if (!withUpdatedAt.error) {
        return (withUpdatedAt.data ?? []) as Prescription[];
    }

    const fallback = await (supabase as any)
        .from('prescriptions')
        .select('id, clinic_id, patient_name, patient_phone, doctor_name, medicines, pharmacy_status, created_at')
        .eq('pharmacy_id', pharmacyId)
        .neq('pharmacy_status', 'not_sent')
        .order('created_at', { ascending: false })
        .limit(150);

    if (fallback.error) throw fallback.error;
    return (fallback.data ?? []) as Prescription[];
}

function EmptyStage({ label }: { label: string }) {
    return (
        <div className="rounded-[28px] border border-dashed border-slate-200 bg-white px-5 py-10 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400">
                <Pill size={24} />
            </div>
            <p className="text-sm font-bold text-slate-700">No prescriptions in this stage</p>
            <p className="mt-1 text-xs text-slate-400">{label} is clear right now.</p>
        </div>
    );
}

function useTimeAgo(dateStr: string) {
    const [label, setLabel] = useState(() => formatTimeAgo(dateStr));

    useEffect(() => {
        const update = () => setLabel(formatTimeAgo(dateStr));
        update();
        const interval = setInterval(update, 30_000);
        return () => clearInterval(interval);
    }, [dateStr]);

    return label;
}

const PrescriptionCard: React.FC<{
    rx: Prescription;
    actionLabel?: string;
    isBusy: boolean;
    isNew: boolean;
    onAdvance: () => void;
}> = ({ rx, actionLabel, isBusy, isNew, onAdvance }) => {
    const timeAgo = useTimeAgo(rx.created_at);
    const medicines = parseMedicines(rx.medicines);
    const [expanded, setExpanded] = useState(false);

    const minutesOpen = Math.max(0, Math.floor((Date.now() - new Date(rx.created_at).getTime()) / 60_000));
    const urgencyClassName = rx.pharmacy_status === 'sent_to_pharmacy'
        ? minutesOpen > 30
            ? 'border-rose-400 shadow-rose-100'
            : minutesOpen >= 15
                ? 'border-amber-300 shadow-amber-100'
                : 'border-emerald-300 shadow-emerald-100'
        : 'border-slate-200 shadow-slate-100';

    const urgencyLabel = rx.pharmacy_status === 'sent_to_pharmacy'
        ? minutesOpen > 30
            ? 'Urgent'
            : minutesOpen >= 15
                ? 'Watch soon'
                : 'Fresh'
        : null;

    return (
        <div className={`rounded-[26px] border bg-white shadow-lg transition-all ${urgencyClassName} ${isBusy ? 'opacity-60' : ''}`}>
            <div className="border-b border-slate-100 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 px-4 py-3 text-white">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="truncate text-lg font-black leading-tight">{rx.patient_name}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-300">
                            <Stethoscope size={12} />
                            {rx.doctor_name?.trim() || 'Doctor on duty'}
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        {isNew && (
                            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100">
                                New
                            </span>
                        )}
                        {urgencyLabel && (
                            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/90">
                                {urgencyLabel}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-4 px-4 py-4">
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Sent</p>
                        <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                            <Clock3 size={13} className="text-slate-400" />
                            {timeAgo}
                        </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Medicines</p>
                        <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                            <Pill size={13} className="text-indigo-500" />
                            {medicines.length} item{medicines.length === 1 ? '' : 's'}
                        </p>
                    </div>
                </div>

                {medicines.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70">
                        <button
                            type="button"
                            onClick={() => setExpanded(current => !current)}
                            className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left"
                        >
                            <div>
                                <p className="text-sm font-bold text-slate-800">Medicine list</p>
                                <p className="text-xs text-slate-500">
                                    {expanded ? 'Tap to collapse details' : 'Tap to expand dosage, quantity, and instructions'}
                                </p>
                            </div>
                            <ChevronDown size={16} className={`text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        </button>

                        {expanded && (
                            <div className="space-y-3 border-t border-slate-200 px-3.5 py-3">
                                {medicines.map((medicine, index) => {
                                    const meta = getMedicineMeta(medicine);
                                    return (
                                        <div key={`${rx.id}-med-${index}`} className="rounded-2xl bg-white px-3 py-3 shadow-sm">
                                            <p className="text-sm font-bold text-slate-900">{medicine.medicine_name}</p>
                                            <p className="mt-1 text-xs font-medium text-slate-600">{meta.dosage}</p>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                                    Quantity: {meta.quantity}
                                                </span>
                                                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
                                                    {meta.instructions}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <UserRound size={13} className="text-slate-400" />
                        {rx.patient_phone?.trim() || 'Phone not captured'}
                    </div>

                    {actionLabel ? (
                        <button
                            type="button"
                            disabled={isBusy}
                            onClick={onAdvance}
                            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                            {actionLabel}
                        </button>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                            <CheckCircle2 size={12} />
                            Read-only
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

const PharmacyPortal: React.FC = () => {
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [profile, setProfile] = useState<PharmacyWorkspaceProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [initError, setInitError] = useState('');
    const [bellAcknowledged, setBellAcknowledged] = useState(false);
    const [mobileStage, setMobileStage] = useState<ColumnId>('sent_to_pharmacy');
    const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
    const [newIds, setNewIds] = useState<Set<string>>(new Set());
    const cleanupRef = useRef<(() => void) | null>(null);

    const loadPrescriptions = useCallback(async (pharmacyId: string) => {
        const rows = await fetchPrescriptionRows(pharmacyId);
        setPrescriptions(rows);
    }, []);

    const subscribeRealtime = useCallback((pharmacyId: string) => {
        const channel = supabase
            .channel(`pharmacy-portal-${pharmacyId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'prescriptions',
                filter: `pharmacy_id=eq.${pharmacyId}`,
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    const incoming = payload.new as Prescription;
                    if (incoming.pharmacy_status === 'not_sent') return;
                    setPrescriptions(previous => [incoming, ...previous.filter(item => item.id !== incoming.id)]);
                    setBellAcknowledged(false);
                    setNewIds(previous => new Set([...previous, incoming.id]));
                    window.setTimeout(() => {
                        setNewIds(previous => {
                            const next = new Set(previous);
                            next.delete(incoming.id);
                            return next;
                        });
                    }, 4000);
                    return;
                }

                if (payload.eventType === 'UPDATE') {
                    const updated = payload.new as Prescription;
                    setPrescriptions(previous => {
                        if (updated.pharmacy_status === 'not_sent') {
                            return previous.filter(item => item.id !== updated.id);
                        }
                        return previous.some(item => item.id === updated.id)
                            ? previous.map(item => item.id === updated.id ? { ...item, ...updated } : item)
                            : [updated, ...previous];
                    });
                    return;
                }

                if (payload.eventType === 'DELETE') {
                    const removed = payload.old as { id?: string };
                    if (!removed.id) return;
                    setPrescriptions(previous => previous.filter(item => item.id !== removed.id));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    useEffect(() => {
        let active = true;

        const init = async () => {
            try {
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                if (sessionError) throw sessionError;
                if (!session) {
                    window.location.href = '/login?portal=pharmacy';
                    return;
                }

                const profileData = await syncAndFetchPharmacyProfile(session.user.id);
                if (!profileData || profileData.role !== 'pharmacy_staff' || !profileData.pharmacy_id) {
                    throw new Error("Your account isn't linked to a pharmacy yet. Contact your clinic admin.");
                }

                const [pharmacyRow, linkedClinic] = await Promise.all([
                    (supabase as any)
                        .from('pharmacies')
                        .select('name')
                        .eq('id', profileData.pharmacy_id)
                        .maybeSingle(),
                    fetchLinkedClinic(profileData.pharmacy_id, profileData.clinic_id),
                ]);

                if (!active) return;

                setProfile({
                    pharmacy_id: profileData.pharmacy_id,
                    pharmacy_name: pharmacyRow.data?.name ?? profileData.full_name ?? 'NirogOS Pharmacy',
                    clinic_name: linkedClinic.clinic_name,
                    clinic_status: linkedClinic.clinic_status,
                });

                await loadPrescriptions(profileData.pharmacy_id);
                cleanupRef.current = subscribeRealtime(profileData.pharmacy_id);
            } catch (error: any) {
                if (active) {
                    setInitError(error?.message ?? 'Unable to load the pharmacy workspace.');
                }
            } finally {
                if (active) setLoading(false);
            }
        };

        void init();

        return () => {
            active = false;
            cleanupRef.current?.();
        };
    }, [loadPrescriptions, subscribeRealtime]);

    const handleLogout = async () => {
        cleanupRef.current?.();
        await supabase.auth.signOut();
        window.location.href = '/login?portal=pharmacy';
    };

    const advanceStatus = async (prescription: Prescription) => {
        const next = NEXT_STATUS[prescription.pharmacy_status as ColumnId];
        if (!next || updatingIds.has(prescription.id)) return;

        setUpdatingIds(previous => new Set([...previous, prescription.id]));
        setPrescriptions(previous => previous.map(item => item.id === prescription.id ? { ...item, pharmacy_status: next, updated_at: new Date().toISOString() } : item));

        const { error } = await (supabase as any)
            .from('prescriptions')
            .update({ pharmacy_status: next })
            .eq('id', prescription.id);

        if (error) {
            setPrescriptions(previous => previous.map(item => item.id === prescription.id ? prescription : item));
        }

        setUpdatingIds(previous => {
            const nextIds = new Set(previous);
            nextIds.delete(prescription.id);
            return nextIds;
        });
    };

    const stats = useMemo(() => {
        const incoming = prescriptions.filter(item => item.pharmacy_status === 'sent_to_pharmacy').length;
        const packing = prescriptions.filter(item => item.pharmacy_status === 'packing').length;
        const ready = prescriptions.filter(item => item.pharmacy_status === 'ready').length;
        const dispensedToday = prescriptions.filter(item => (
            item.pharmacy_status === 'dispensed' &&
            isToday(new Date(item.updated_at ?? item.created_at))
        )).length;

        return { incoming, packing, ready, dispensedToday };
    }, [prescriptions]);

    const columnData = useMemo(() => COLUMNS.map(column => ({
        ...column,
        items: prescriptions.filter(item => item.pharmacy_status === column.id),
    })), [prescriptions]);

    const allClear = stats.incoming === 0 && stats.packing === 0 && stats.ready === 0;

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
                <div className="flex flex-col items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-[28px] bg-gradient-to-br from-indigo-600 to-slate-900 text-white shadow-xl shadow-indigo-200">
                        <Pill size={28} />
                    </div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                        <Loader2 size={16} className="animate-spin" />
                        Loading pharmacy workspace...
                    </div>
                </div>
            </div>
        );
    }

    if (initError) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4">
                <div className="w-full max-w-md rounded-[32px] border border-rose-100 bg-white p-8 text-center shadow-2xl shadow-slate-200/70">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[22px] bg-rose-50 text-rose-500">
                        <Store size={22} />
                    </div>
                    <h2 className="text-xl font-black text-slate-900">Access unavailable</h2>
                    <p className="mt-2 text-sm text-slate-500">{initError}</p>
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                    >
                        Back to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC]" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
            <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
                    <div className="flex min-w-0 items-center gap-3">
                        <Logo variant="full" usage="navbar" theme="dark" />
                    </div>

                    <div className="hidden min-w-0 items-center justify-center md:flex">
                        <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-center shadow-sm">
                            <p className="truncate text-sm font-black text-slate-900">{profile?.pharmacy_name}</p>
                            <div className="mt-1 flex items-center justify-center gap-2">
                                <span className="rounded-full bg-indigo-950 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-100">
                                    {profile?.clinic_name}
                                </span>
                                <span className="text-[11px] font-semibold text-slate-500">
                                    {STATUS_LABELS[profile?.clinic_status ?? ''] ?? 'Linked'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className={`hidden rounded-full px-3 py-1.5 text-xs font-bold sm:inline-flex ${allClear ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                            {allClear ? 'All Clear' : `${stats.incoming + stats.packing + stats.ready} in progress`}
                        </span>
                        <button
                            type="button"
                            onClick={() => setBellAcknowledged(true)}
                            className={`relative flex h-11 w-11 items-center justify-center rounded-2xl border transition ${stats.incoming > 0 && !bellAcknowledged ? 'border-amber-200 bg-amber-50 text-amber-700 shadow-lg shadow-amber-100' : 'border-slate-200 bg-white text-slate-500'}`}
                            aria-label="Notifications"
                        >
                            <Bell size={18} />
                            {stats.incoming > 0 && (
                                <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">
                                    {stats.incoming}
                                </span>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                        >
                            <LogOut size={16} />
                            <span className="hidden sm:inline">Sign Out</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white shadow-2xl shadow-indigo-100/70">
                    <div className="grid gap-6 px-6 py-7 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
                        <div>
                            <p className="text-xs font-black uppercase tracking-[0.35em] text-indigo-200">Pharmacy Workspace</p>
                            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Prescription Operations Board</h1>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                                Linked clinic: <span className="font-bold text-white">{profile?.clinic_name}</span>. Every stage updates live as prescriptions move from incoming to dispensing.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: 'Incoming', value: stats.incoming, icon: <Bell size={14} />, tone: 'bg-rose-400/10 text-rose-100' },
                                { label: 'Packing', value: stats.packing, icon: <Package size={14} />, tone: 'bg-amber-400/10 text-amber-100' },
                                { label: 'Ready', value: stats.ready, icon: <CheckCircle2 size={14} />, tone: 'bg-emerald-400/10 text-emerald-100' },
                                { label: 'Dispensed Today', value: stats.dispensedToday, icon: <ShieldCheck size={14} />, tone: 'bg-cyan-400/10 text-cyan-100' },
                            ].map(stat => (
                                <div key={stat.label} className={`rounded-[24px] border border-white/10 px-4 py-4 ${stat.tone}`}>
                                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em]">
                                        {stat.icon}
                                        {stat.label}
                                    </div>
                                    <p className="mt-3 text-3xl font-black">{stat.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <div className="sticky top-[73px] z-30 mt-5 rounded-[28px] border border-slate-200 bg-white/95 p-3 shadow-lg shadow-slate-200/60 backdrop-blur">
                    <div className="flex flex-wrap items-center gap-3">
                        {[
                            { label: 'Incoming', value: stats.incoming },
                            { label: 'Packing', value: stats.packing },
                            { label: 'Ready', value: stats.ready },
                            { label: 'Dispensed today', value: stats.dispensedToday },
                        ].map(stat => (
                            <div key={stat.label} className="min-w-[140px] rounded-2xl bg-slate-50 px-4 py-3">
                                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">{stat.label}</p>
                                <p className="mt-1 text-2xl font-black text-slate-900">{stat.value}</p>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={() => profile && loadPrescriptions(profile.pharmacy_id)}
                            className="ml-auto inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                        >
                            <RefreshCw size={15} />
                            Refresh queue
                        </button>
                    </div>
                </div>

                <div className="mt-6 md:hidden">
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {columnData.map(column => (
                            <button
                                key={column.id}
                                type="button"
                                onClick={() => setMobileStage(column.id)}
                                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${mobileStage === column.id ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' : 'bg-white text-slate-500 border border-slate-200'}`}
                            >
                                {column.label} ({column.items.length})
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-6 grid gap-5 md:hidden">
                    {columnData.filter(column => column.id === mobileStage).map(column => (
                        <section key={column.id} className="space-y-4">
                            <div className={`rounded-[28px] bg-gradient-to-r ${column.headerClassName} px-5 py-4 text-white shadow-xl shadow-slate-200`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="flex items-center gap-2 text-sm font-bold">
                                            {column.icon}
                                            {column.label}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-300">Live prescriptions in this stage</p>
                                    </div>
                                    <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-black">{column.items.length}</span>
                                </div>
                            </div>
                            {column.items.length === 0 ? (
                                <EmptyStage label={column.label} />
                            ) : (
                                column.items.map(item => (
                                    <PrescriptionCard
                                        key={item.id}
                                        rx={item}
                                        actionLabel={column.actionLabel}
                                        isBusy={updatingIds.has(item.id)}
                                        isNew={newIds.has(item.id)}
                                        onAdvance={() => advanceStatus(item)}
                                    />
                                ))
                            )}
                        </section>
                    ))}
                </div>

                <div className="mt-6 hidden gap-5 md:grid md:grid-cols-2 xl:grid-cols-4">
                    {columnData.map(column => (
                        <section key={column.id} className="min-h-[420px] rounded-[30px] border border-slate-200 bg-white p-3 shadow-lg shadow-slate-200/60">
                            <div className={`rounded-[24px] bg-gradient-to-r ${column.headerClassName} px-4 py-4 text-white`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="flex items-center gap-2 text-sm font-bold">
                                            {column.icon}
                                            {column.label}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-300">Live prescriptions in this stage</p>
                                    </div>
                                    <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-black">{column.items.length}</span>
                                </div>
                            </div>

                            <div className="mt-3 space-y-3">
                                <AnimatePresence initial={false}>
                                    {column.items.length === 0 ? (
                                        <motion.div
                                            key={`${column.id}-empty`}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -8 }}
                                        >
                                            <EmptyStage label={column.label} />
                                        </motion.div>
                                    ) : (
                                        column.items.map(item => (
                                            <motion.div
                                                key={item.id}
                                                layout
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                            >
                                                <PrescriptionCard
                                                    rx={item}
                                                    actionLabel={column.actionLabel}
                                                    isBusy={updatingIds.has(item.id)}
                                                    isNew={newIds.has(item.id)}
                                                    onAdvance={() => advanceStatus(item)}
                                                />
                                            </motion.div>
                                        ))
                                    )}
                                </AnimatePresence>
                            </div>
                        </section>
                    ))}
                </div>
            </main>
        </div>
    );
};

export default PharmacyPortal;
