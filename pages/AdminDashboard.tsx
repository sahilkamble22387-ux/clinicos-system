import React, { useEffect, useMemo, useState } from 'react';
import {
    Activity,
    Building2,
    CalendarDays,
    CreditCard,
    Database,
    Download,
    LayoutDashboard,
    Loader2,
    LogOut,
    Search,
    ShieldAlert,
    SlidersHorizontal,
    Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminDb, adminDbConfig } from '../services/adminDb';

type AdminTab = 'dashboard' | 'clinics' | 'patients' | 'subscriptions' | 'plans' | 'system';

interface AdminClinicRow {
    id: string;
    name: string;
    doctor_name: string | null;
    clinic_email: string | null;
    clinic_name_override?: string | null;
    created_at: string;
}

interface AdminPatientRow {
    id: string;
    full_name: string;
    phone: string | null;
    clinic_id: string;
    status: string | null;
    created_at: string;
}

interface AdminMedicalRecordRow {
    id: string;
    patient_id: string;
    clinic_id: string;
    created_at: string;
}

interface AdminSubscriptionRow {
    id: string;
    clinic_id: string;
    plan_name: string;
    status: string;
    trial_ends_at: string | null;
    subscription_starts_at: string | null;
    subscription_ends_at: string | null;
    amount_paid: number | null;
    is_paid?: boolean | null;
    is_locked?: boolean | null;
}

interface AdminPlanRow {
    id: string;
    name: string;
    price: number | null;
    features: string[] | string | null;
    created_at?: string | null;
    updated_at?: string | null;
}

interface EnrichedPatient extends AdminPatientRow {
    clinic_name: string;
    last_visit_at: string | null;
    total_visits: number;
}

interface EnrichedClinic extends AdminClinicRow {
    display_name: string;
    patient_count: number;
    plan_name: string;
    subscription_status: string;
    trial_end_date: string | null;
    patients: EnrichedPatient[];
}

interface EnrichedSubscription extends AdminSubscriptionRow {
    clinic_name: string;
}

interface AdminSystemStats {
    totalClinics: number;
    totalPatients: number;
    totalPrescriptions: number;
}

const ADMIN_AUTH_KEY = 'admin_auth';
const FALLBACK_ADMIN_PASSWORD = 'nirogos_admin_2025';

const NAV_ITEMS: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={17} /> },
    { id: 'clinics', label: 'Clinics', icon: <Building2 size={17} /> },
    { id: 'patients', label: 'Patients', icon: <Users size={17} /> },
    { id: 'subscriptions', label: 'Subscriptions', icon: <CreditCard size={17} /> },
    { id: 'plans', label: 'Plans', icon: <SlidersHorizontal size={17} /> },
    { id: 'system', label: 'System', icon: <Database size={17} /> },
];

function formatDate(value?: string | null) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function formatDateTime(value?: string | null) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function csvEscape(value: string | number | null | undefined) {
    const raw = value == null ? '' : String(value);
    return `"${raw.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
    const csv = [
        headers.map(csvEscape).join(','),
        ...rows.map(row => row.map(csvEscape).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function statusPillClass(status?: string | null) {
    switch ((status ?? '').toLowerCase()) {
        case 'active':
        case 'trialing':
        case 'approved':
            return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
        case 'trial':
        case 'pending':
            return 'bg-amber-50 text-amber-700 border border-amber-100';
        case 'cancelled':
        case 'inactive':
        case 'expired':
            return 'bg-rose-50 text-rose-700 border border-rose-100';
        default:
            return 'bg-slate-100 text-slate-600 border border-slate-200';
    }
}

function planFeaturesToLines(features: AdminPlanRow['features']) {
    if (Array.isArray(features)) return features;
    if (typeof features === 'string') {
        return features.split('\n').map(line => line.trim()).filter(Boolean);
    }
    return [];
}

const AdminDashboard: React.FC = () => {
    const [isAuthed, setIsAuthed] = useState(() => sessionStorage.getItem(ADMIN_AUTH_KEY) === 'true');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [shakeGate, setShakeGate] = useState(false);
    const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [expandedClinicId, setExpandedClinicId] = useState<string | null>(null);
    const [patientSearch, setPatientSearch] = useState('');
    const [patientClinicFilter, setPatientClinicFilter] = useState('all');
    const [plansError, setPlansError] = useState('');

    const [clinics, setClinics] = useState<EnrichedClinic[]>([]);
    const [patients, setPatients] = useState<EnrichedPatient[]>([]);
    const [subscriptions, setSubscriptions] = useState<EnrichedSubscription[]>([]);
    const [plans, setPlans] = useState<AdminPlanRow[]>([]);
    const [planDrafts, setPlanDrafts] = useState<Record<string, { name: string; price: string; features: string }>>({});
    const [stats, setStats] = useState<AdminSystemStats>({ totalClinics: 0, totalPatients: 0, totalPrescriptions: 0 });

    const currentDate = useMemo(() => new Date().toLocaleDateString('en-IN', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    }), []);

    const passwordToCheck = import.meta.env.VITE_ADMIN_PASSWORD || FALLBACK_ADMIN_PASSWORD;

    const refreshAdminData = async () => {
        if (!adminDb) {
            setLoadError('Admin mode needs VITE_SUPABASE_SERVICE_KEY and VITE_SUPABASE_URL configured.');
            return;
        }

        setLoading(true);
        setLoadError('');
        setPlansError('');

        try {
            const [clinicsRes, patientsRes, recordsRes, subscriptionsRes, prescriptionCountRes, plansRes] = await Promise.all([
                adminDb.from('clinics').select('id, name, doctor_name, clinic_email, clinic_name_override, created_at').order('created_at', { ascending: false }),
                adminDb.from('patients').select('id, full_name, phone, clinic_id, status, created_at').order('created_at', { ascending: false }),
                adminDb.from('medical_records').select('id, patient_id, clinic_id, created_at').order('created_at', { ascending: false }),
                adminDb.from('subscriptions').select('id, clinic_id, plan_name, status, trial_ends_at, subscription_starts_at, subscription_ends_at, amount_paid, is_paid, is_locked').order('trial_ends_at', { ascending: true }),
                adminDb.from('prescriptions').select('id', { count: 'exact', head: true }),
                adminDb.from('plans').select('id, name, price, features, created_at, updated_at').order('created_at', { ascending: false }),
            ]);

            if (clinicsRes.error) throw clinicsRes.error;
            if (patientsRes.error) throw patientsRes.error;
            if (recordsRes.error) throw recordsRes.error;
            if (subscriptionsRes.error) throw subscriptionsRes.error;
            if (prescriptionCountRes.error) throw prescriptionCountRes.error;

            if (plansRes.error) {
                setPlans([]);
                setPlansError(plansRes.error.message);
            } else {
                const planRows = (plansRes.data ?? []) as AdminPlanRow[];
                setPlans(planRows);
                setPlanDrafts(Object.fromEntries(planRows.map(plan => [
                    plan.id,
                    {
                        name: plan.name ?? '',
                        price: plan.price == null ? '' : String(plan.price),
                        features: planFeaturesToLines(plan.features).join('\n'),
                    },
                ])));
            }

            const clinicRows = (clinicsRes.data ?? []) as AdminClinicRow[];
            const patientRows = (patientsRes.data ?? []) as AdminPatientRow[];
            const recordRows = (recordsRes.data ?? []) as AdminMedicalRecordRow[];
            const subscriptionRows = (subscriptionsRes.data ?? []) as AdminSubscriptionRow[];

            const clinicMap = new Map(clinicRows.map(clinic => [clinic.id, clinic]));
            const visitMap = new Map<string, { totalVisits: number; lastVisitAt: string | null }>();

            recordRows.forEach(record => {
                const current = visitMap.get(record.patient_id);
                const nextLastVisit = !current?.lastVisitAt || new Date(record.created_at) > new Date(current.lastVisitAt)
                    ? record.created_at
                    : current.lastVisitAt;
                visitMap.set(record.patient_id, {
                    totalVisits: (current?.totalVisits ?? 0) + 1,
                    lastVisitAt: nextLastVisit,
                });
            });

            const enrichedPatients = patientRows.map(patient => ({
                ...patient,
                clinic_name: clinicMap.get(patient.clinic_id)?.clinic_name_override || clinicMap.get(patient.clinic_id)?.name || 'Unknown clinic',
                last_visit_at: visitMap.get(patient.id)?.lastVisitAt ?? null,
                total_visits: visitMap.get(patient.id)?.totalVisits ?? 0,
            }));

            const patientsByClinic = enrichedPatients.reduce<Record<string, EnrichedPatient[]>>((accumulator, patient) => {
                if (!accumulator[patient.clinic_id]) accumulator[patient.clinic_id] = [];
                accumulator[patient.clinic_id].push(patient);
                return accumulator;
            }, {});

            const subscriptionMap = new Map(subscriptionRows.map(subscription => [subscription.clinic_id, subscription]));

            const enrichedClinics = clinicRows.map(clinic => {
                const subscription = subscriptionMap.get(clinic.id);
                return {
                    ...clinic,
                    display_name: clinic.clinic_name_override || clinic.name || 'Clinic',
                    patient_count: patientsByClinic[clinic.id]?.length ?? 0,
                    plan_name: subscription?.plan_name ?? 'trial',
                    subscription_status: subscription?.status ?? 'trial',
                    trial_end_date: subscription?.trial_ends_at ?? null,
                    patients: (patientsByClinic[clinic.id] ?? []).sort((left, right) => left.full_name.localeCompare(right.full_name)),
                };
            });

            const enrichedSubscriptions = subscriptionRows.map(subscription => ({
                ...subscription,
                clinic_name: clinicMap.get(subscription.clinic_id)?.clinic_name_override || clinicMap.get(subscription.clinic_id)?.name || 'Unknown clinic',
            }));

            setClinics(enrichedClinics);
            setPatients(enrichedPatients);
            setSubscriptions(enrichedSubscriptions);
            setStats({
                totalClinics: clinicRows.length,
                totalPatients: patientRows.length,
                totalPrescriptions: prescriptionCountRes.count ?? 0,
            });
        } catch (error: any) {
            console.error('Admin dashboard load failed:', error);
            setLoadError(error?.message ?? 'Failed to load admin data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthed) {
            void refreshAdminData();
        }
    }, [isAuthed]);

    const filteredPatients = useMemo(() => {
        return patients.filter(patient => {
            const matchesClinic = patientClinicFilter === 'all' || patient.clinic_id === patientClinicFilter;
            const query = patientSearch.trim().toLowerCase();
            const matchesQuery = query.length === 0
                || patient.full_name.toLowerCase().includes(query)
                || patient.phone?.toLowerCase().includes(query)
                || patient.clinic_name.toLowerCase().includes(query);
            return matchesClinic && matchesQuery;
        });
    }, [patientClinicFilter, patientSearch, patients]);

    const handleUnlock = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (password === passwordToCheck) {
            sessionStorage.setItem(ADMIN_AUTH_KEY, 'true');
            setIsAuthed(true);
            setPassword('');
            setAuthError('');
            return;
        }

        setAuthError('Incorrect password');
        setShakeGate(true);
        window.setTimeout(() => setShakeGate(false), 500);
    };

    const handleExitAdmin = () => {
        sessionStorage.removeItem(ADMIN_AUTH_KEY);
        setIsAuthed(false);
        setPassword('');
        window.location.href = '/';
    };

    const updateSubscriptionStatus = async (subscriptionId: string, status: string) => {
        if (!adminDb) return;
        const previous = subscriptions;
        setSubscriptions(current => current.map(subscription => subscription.id === subscriptionId ? { ...subscription, status } : subscription));

        const { error } = await adminDb
            .from('subscriptions')
            .update({ status, updated_at: new Date().toISOString() } as any)
            .eq('id', subscriptionId);

        if (error) {
            setSubscriptions(previous);
            toast.error(`Could not update subscription: ${error.message}`);
            return;
        }

        setClinics(current => current.map(clinic => {
            const subscription = subscriptions.find(item => item.id === subscriptionId);
            if (!subscription || clinic.id !== subscription.clinic_id) return clinic;
            return { ...clinic, subscription_status: status };
        }));
        toast.success('Subscription status updated.');
    };

    const updateClinicPlan = async (clinicId: string, planName: string) => {
        if (!adminDb) return;
        const targetSubscription = subscriptions.find(subscription => subscription.clinic_id === clinicId);
        if (!targetSubscription) {
            toast.error('No subscription row found for this clinic.');
            return;
        }

        const { error } = await adminDb
            .from('subscriptions')
            .update({ plan_name: planName, updated_at: new Date().toISOString() } as any)
            .eq('id', targetSubscription.id);

        if (error) {
            toast.error(`Could not update plan: ${error.message}`);
            return;
        }

        setSubscriptions(current => current.map(subscription => subscription.id === targetSubscription.id ? { ...subscription, plan_name: planName } : subscription));
        setClinics(current => current.map(clinic => clinic.id === clinicId ? { ...clinic, plan_name: planName } : clinic));
        toast.success('Plan updated.');
    };

    const toggleClinicSubscription = async (clinic: EnrichedClinic) => {
        const targetSubscription = subscriptions.find(subscription => subscription.clinic_id === clinic.id);
        if (!targetSubscription) {
            toast.error('No subscription row found for this clinic.');
            return;
        }
        const nextStatus = targetSubscription.status === 'active' ? 'expired' : 'active';
        await updateSubscriptionStatus(targetSubscription.id, nextStatus);
    };

    const downloadClinicPatients = (clinic: EnrichedClinic) => {
        downloadCsv(
            `${clinic.display_name.replace(/\s+/g, '_')}_patients.csv`,
            ['Patient Name', 'Phone', 'Clinic', 'Last Visit', 'Total Visits', 'Created'],
            clinic.patients.map(patient => [
                patient.full_name,
                patient.phone,
                clinic.display_name,
                formatDate(patient.last_visit_at),
                patient.total_visits,
                formatDate(patient.created_at),
            ]),
        );
    };

    const downloadAllPatients = () => {
        downloadCsv(
            'nirogos_all_patients.csv',
            ['Patient Name', 'Phone', 'Clinic', 'Last Visit', 'Total Visits', 'Created'],
            filteredPatients.map(patient => [
                patient.full_name,
                patient.phone,
                patient.clinic_name,
                formatDate(patient.last_visit_at),
                patient.total_visits,
                formatDate(patient.created_at),
            ]),
        );
    };

    const updatePlanDraft = (planId: string, field: 'name' | 'price' | 'features', value: string) => {
        setPlanDrafts(current => ({
            ...current,
            [planId]: {
                name: current[planId]?.name ?? '',
                price: current[planId]?.price ?? '',
                features: current[planId]?.features ?? '',
                [field]: value,
            },
        }));
    };

    const savePlan = async (planId: string) => {
        if (!adminDb) return;
        const draft = planDrafts[planId];
        if (!draft) return;

        const payload = {
            name: draft.name.trim(),
            price: draft.price === '' ? null : Number(draft.price),
            features: draft.features.split('\n').map(line => line.trim()).filter(Boolean),
            updated_at: new Date().toISOString(),
        };

        const { error } = await adminDb.from('plans').update(payload as any).eq('id', planId);
        if (error) {
            toast.error(`Could not save plan: ${error.message}`);
            return;
        }

        setPlans(current => current.map(plan => plan.id === planId ? { ...plan, ...payload } : plan));
        toast.success('Plan saved.');
    };

    const addPlan = async () => {
        if (!adminDb) return;
        const payload = {
            name: 'New Plan',
            price: 0,
            features: ['New feature'],
        };

        const { data, error } = await adminDb
            .from('plans')
            .insert(payload as any)
            .select('id, name, price, features, created_at, updated_at')
            .single();

        if (error) {
            toast.error(`Could not create plan: ${error.message}`);
            return;
        }

        const created = data as AdminPlanRow;
        setPlans(current => [created, ...current]);
        setPlanDrafts(current => ({
            ...current,
            [created.id]: {
                name: created.name ?? 'New Plan',
                price: created.price == null ? '' : String(created.price),
                features: planFeaturesToLines(created.features).join('\n'),
            },
        }));
        setActiveTab('plans');
        toast.success('New plan added.');
    };

    const flushTrialBanners = () => {
        [
            'nirogos_trial_banner_dismissed_until',
            'nirogos_pending_plan',
            'nirogos_welcome_popup_done',
            'nirogos_tutorial_done_v2',
            'clinicos_trial_banner_dismissed_until',
            'clinicos_pending_plan',
            'clinicos_welcome_popup_done',
            'clinicos_tutorial_done_v2',
        ].forEach(key => localStorage.removeItem(key));
        toast.success('Local trial-banner keys cleared in this browser. Other sessions still need manual clearing.');
    };

    if (!isAuthed) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
                <style>{`
                    @keyframes admin-shake {
                        0%, 100% { transform: translateX(0); }
                        20% { transform: translateX(-10px); }
                        40% { transform: translateX(10px); }
                        60% { transform: translateX(-8px); }
                        80% { transform: translateX(8px); }
                    }
                `}</style>
                <form
                    onSubmit={handleUnlock}
                    className={`w-full max-w-md rounded-[32px] border border-slate-800 bg-slate-900 p-8 shadow-2xl shadow-black/40 ${shakeGate ? '[animation:admin-shake_0.45s_ease-in-out]' : ''}`}
                >
                    <h1 className="text-center text-2xl font-black text-white">Admin Access</h1>
                    <p className="mt-2 text-center text-sm text-slate-400">Enter the admin password to continue.</p>
                    <div className="mt-6">
                        <input
                            type="password"
                            value={password}
                            onChange={event => setPassword(event.target.value)}
                            placeholder="Password"
                            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/20"
                        />
                    </div>
                    {authError && (
                        <p className="mt-3 text-center text-sm font-semibold text-rose-400">{authError}</p>
                    )}
                    <button
                        type="submit"
                        className="mt-6 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-900 transition hover:bg-slate-200"
                    >
                        Unlock
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-[#F8FAFC]" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
            <aside className="hidden w-72 shrink-0 border-r border-slate-800 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 p-5 text-white lg:block">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-400">Admin Menu</p>
                    <div className="mt-4 space-y-1">
                        {NAV_ITEMS.map(item => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setActiveTab(item.id)}
                                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition ${activeTab === item.id ? 'bg-indigo-500/20 text-white border border-indigo-400/20' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
                            >
                                {item.icon}
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>
            </aside>

            <div className="flex min-h-screen flex-1 flex-col">
                <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
                    <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Admin Workspace</p>
                                <h1 className="mt-1 text-2xl font-black text-slate-900">NirogOS Admin</h1>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="hidden rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600 sm:inline-flex">
                                    {currentDate}
                                </span>
                                <button
                                    type="button"
                                    onClick={handleExitAdmin}
                                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                                >
                                    <LogOut size={15} />
                                    Exit Admin
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-2 overflow-x-auto lg:hidden">
                            {NAV_ITEMS.map(item => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setActiveTab(item.id)}
                                    className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${activeTab === item.id ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-500'}`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </header>

                <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
                    {!adminDbConfig.enabled && (
                        <div className="mb-5 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
                            `VITE_SUPABASE_SERVICE_KEY` is not configured locally, so admin queries cannot run yet.
                        </div>
                    )}

                    {loading && (
                        <div className="mb-5 flex items-center gap-2 rounded-3xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-500 shadow-sm">
                            <Loader2 size={16} className="animate-spin" />
                            Loading admin data...
                        </div>
                    )}

                    {loadError && (
                        <div className="mb-5 flex items-start gap-3 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
                            <ShieldAlert size={17} className="mt-0.5 shrink-0" />
                            <span>{loadError}</span>
                        </div>
                    )}

                    {activeTab === 'dashboard' && (
                        <div className="space-y-5">
                            <div className="grid gap-4 md:grid-cols-3">
                                {[
                                    { label: 'Total Clinics', value: stats.totalClinics, icon: <Building2 size={18} />, tone: 'from-indigo-950 via-slate-900 to-slate-900' },
                                    { label: 'Total Patients', value: stats.totalPatients, icon: <Users size={18} />, tone: 'from-emerald-950 via-slate-900 to-slate-900' },
                                    { label: 'Total Prescriptions', value: stats.totalPrescriptions, icon: <Activity size={18} />, tone: 'from-amber-950 via-slate-900 to-slate-900' },
                                ].map(card => (
                                    <div key={card.label} className={`rounded-[30px] bg-gradient-to-br ${card.tone} p-5 text-white shadow-xl`}>
                                        <div className="flex items-center gap-3 text-sm font-bold">
                                            {card.icon}
                                            {card.label}
                                        </div>
                                        <p className="mt-4 text-4xl font-black">{card.value}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="grid gap-5 xl:grid-cols-2">
                                <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                                    <h2 className="text-lg font-black text-slate-900">Recently Created Clinics</h2>
                                    <div className="mt-4 space-y-3">
                                        {clinics.slice(0, 5).map(clinic => (
                                            <div key={clinic.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                                                <div>
                                                    <p className="font-bold text-slate-900">{clinic.display_name}</p>
                                                    <p className="text-xs text-slate-500">{clinic.doctor_name || 'Doctor not set'}</p>
                                                </div>
                                                <span className="text-xs font-semibold text-slate-500">{formatDate(clinic.created_at)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                                    <h2 className="text-lg font-black text-slate-900">Latest Patient Activity</h2>
                                    <div className="mt-4 space-y-3">
                                        {patients.slice(0, 5).map(patient => (
                                            <div key={patient.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                                                <div>
                                                    <p className="font-bold text-slate-900">{patient.full_name}</p>
                                                    <p className="text-xs text-slate-500">{patient.clinic_name}</p>
                                                </div>
                                                <span className="text-xs font-semibold text-slate-500">{formatDate(patient.created_at)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </div>
                        </div>
                    )}

                    {activeTab === 'clinics' && (
                        <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                            <h2 className="text-lg font-black text-slate-900">Clinics</h2>
                            <div className="mt-5 space-y-4">
                                {clinics.map(clinic => (
                                    <div key={clinic.id} className="rounded-[26px] border border-slate-200 bg-slate-50/70 p-4">
                                        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_1fr_auto] xl:items-center">
                                            <div>
                                                <p className="font-black text-slate-900">{clinic.display_name}</p>
                                                <p className="text-xs text-slate-500">{clinic.doctor_name || 'Doctor name missing'}</p>
                                            </div>
                                            <div className="text-sm text-slate-600">{clinic.clinic_email || '—'}</div>
                                            <div className="text-sm font-semibold text-slate-700">{clinic.plan_name}</div>
                                            <div className="text-sm text-slate-600">{formatDate(clinic.trial_end_date)}</div>
                                            <div className="text-sm font-semibold text-slate-700">{clinic.patient_count}</div>
                                            <div className="text-sm text-slate-600">{formatDate(clinic.created_at)}</div>
                                            <div className="flex flex-wrap gap-2">
                                                <select
                                                    value={clinic.plan_name}
                                                    onChange={event => void updateClinicPlan(clinic.id, event.target.value)}
                                                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none"
                                                >
                                                    {['trial', 'essential', 'professional', 'elite'].map(option => (
                                                        <option key={option} value={option}>{option}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={() => void toggleClinicSubscription(clinic)}
                                                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
                                                >
                                                    {clinic.subscription_status === 'active' ? 'Set inactive' : 'Set active'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => downloadClinicPatients(clinic)}
                                                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
                                                >
                                                    <Download size={12} />
                                                    CSV
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedClinicId(current => current === clinic.id ? null : clinic.id)}
                                                    className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white"
                                                >
                                                    {expandedClinicId === clinic.id ? 'Hide patients' : 'View patients'}
                                                </button>
                                            </div>
                                        </div>

                                        {expandedClinicId === clinic.id && (
                                            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                                                <div className="grid grid-cols-4 gap-4 border-b border-slate-100 px-4 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                                                    <span>Patient</span>
                                                    <span>Phone</span>
                                                    <span>Last Visit</span>
                                                    <span>Total Visits</span>
                                                </div>
                                                {clinic.patients.length === 0 ? (
                                                    <p className="px-4 py-4 text-sm text-slate-500">No patients found for this clinic.</p>
                                                ) : (
                                                    clinic.patients.map(patient => (
                                                        <div key={patient.id} className="grid grid-cols-4 gap-4 px-4 py-3 text-sm text-slate-600">
                                                            <span className="font-semibold text-slate-900">{patient.full_name}</span>
                                                            <span>{patient.phone || '—'}</span>
                                                            <span>{formatDate(patient.last_visit_at)}</span>
                                                            <span>{patient.total_visits}</span>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'patients' && (
                        <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <h2 className="text-lg font-black text-slate-900">Patients</h2>
                                    <p className="mt-1 text-sm text-slate-500">Search every patient across clinics and export the filtered result set.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={downloadAllPatients}
                                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"
                                >
                                    <Download size={15} />
                                    Download all patients as CSV
                                </button>
                            </div>

                            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_240px]">
                                <div className="relative">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                        <Search size={15} className="text-slate-300" />
                                    </div>
                                    <input
                                        type="text"
                                        value={patientSearch}
                                        onChange={event => setPatientSearch(event.target.value)}
                                        placeholder="Search by patient name, phone, or clinic"
                                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                                    />
                                </div>
                                <select
                                    value={patientClinicFilter}
                                    onChange={event => setPatientClinicFilter(event.target.value)}
                                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                                >
                                    <option value="all">All clinics</option>
                                    {clinics.map(clinic => (
                                        <option key={clinic.id} value={clinic.id}>{clinic.display_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
                                <div className="grid grid-cols-5 gap-4 border-b border-slate-100 bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                                    <span>Patient</span>
                                    <span>Phone</span>
                                    <span>Clinic</span>
                                    <span>Last Visit</span>
                                    <span>Total Visits</span>
                                </div>
                                {filteredPatients.map(patient => (
                                    <div key={patient.id} className="grid grid-cols-5 gap-4 px-4 py-3 text-sm text-slate-600">
                                        <span className="font-semibold text-slate-900">{patient.full_name}</span>
                                        <span>{patient.phone || '—'}</span>
                                        <span>{patient.clinic_name}</span>
                                        <span>{formatDate(patient.last_visit_at)}</span>
                                        <span>{patient.total_visits}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'subscriptions' && (
                        <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                            <h2 className="text-lg font-black text-slate-900">Subscriptions</h2>
                            <div className="mt-5 space-y-3">
                                {subscriptions.map(subscription => (
                                    <div key={subscription.id} className="grid gap-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4 xl:grid-cols-[1.2fr_0.8fr_0.7fr_0.8fr_0.8fr_0.7fr] xl:items-center">
                                        <div>
                                            <p className="font-black text-slate-900">{subscription.clinic_name}</p>
                                            <p className="text-xs text-slate-500">{subscription.plan_name}</p>
                                        </div>
                                        <div>
                                            <select
                                                value={subscription.status}
                                                onChange={event => void updateSubscriptionStatus(subscription.id, event.target.value)}
                                                className={`rounded-xl px-3 py-2 text-xs font-bold capitalize outline-none ${statusPillClass(subscription.status)}`}
                                            >
                                                {['active', 'trialing', 'expired', 'cancelled'].map(option => (
                                                    <option key={option} value={option}>{option}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="text-sm text-slate-600">{formatDate(subscription.subscription_starts_at)}</div>
                                        <div className="text-sm text-slate-600">{formatDate(subscription.subscription_ends_at || subscription.trial_ends_at)}</div>
                                        <div className="text-sm text-slate-600">₹{subscription.amount_paid?.toLocaleString('en-IN') ?? '0'}</div>
                                        <div className="text-sm text-slate-500">{subscription.is_locked ? 'Locked' : subscription.is_paid ? 'Paid' : 'Unpaid'}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'plans' && (
                        <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <h2 className="text-lg font-black text-slate-900">Plans</h2>
                                    <p className="mt-1 text-sm text-slate-500">Edit plan name, price, and features inline.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => void addPlan()}
                                    className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"
                                >
                                    Add new plan
                                </button>
                            </div>

                            {plansError && (
                                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                    The `plans` table could not be confirmed in this environment: {plansError}
                                </div>
                            )}

                            <div className="mt-5 space-y-4">
                                {plans.map(plan => (
                                    <div key={plan.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                                        <div className="grid gap-4 lg:grid-cols-[1fr_180px_1.2fr_auto] lg:items-start">
                                            <input
                                                type="text"
                                                value={planDrafts[plan.id]?.name ?? plan.name}
                                                onChange={event => updatePlanDraft(plan.id, 'name', event.target.value)}
                                                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none"
                                            />
                                            <input
                                                type="number"
                                                value={planDrafts[plan.id]?.price ?? String(plan.price ?? '')}
                                                onChange={event => updatePlanDraft(plan.id, 'price', event.target.value)}
                                                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none"
                                            />
                                            <textarea
                                                rows={4}
                                                value={planDrafts[plan.id]?.features ?? planFeaturesToLines(plan.features).join('\n')}
                                                onChange={event => updatePlanDraft(plan.id, 'features', event.target.value)}
                                                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => void savePlan(plan.id)}
                                                className="rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white"
                                            >
                                                Save
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'system' && (
                        <div className="space-y-5">
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Total Clinics</p>
                                    <p className="mt-2 text-3xl font-black text-slate-900">{stats.totalClinics}</p>
                                </div>
                                <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Total Patients</p>
                                    <p className="mt-2 text-3xl font-black text-slate-900">{stats.totalPatients}</p>
                                </div>
                                <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Total Prescriptions</p>
                                    <p className="mt-2 text-3xl font-black text-slate-900">{stats.totalPrescriptions}</p>
                                </div>
                            </div>

                            <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
                                <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                                    <h2 className="text-lg font-black text-slate-900">Environment Info</h2>
                                    <div className="mt-4 space-y-3 text-sm text-slate-600">
                                        <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                                            <span>Supabase URL</span>
                                            <span className="font-semibold text-slate-900">{adminDbConfig.url || 'Not set'}</span>
                                        </div>
                                        <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                                            <span>Service role configured</span>
                                            <span className="font-semibold text-slate-900">{adminDbConfig.hasServiceRoleKey ? 'Yes' : 'No'}</span>
                                        </div>
                                        <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                                            <span>Admin auth state</span>
                                            <span className="font-semibold text-slate-900">{isAuthed ? 'Unlocked in this browser' : 'Locked'}</span>
                                        </div>
                                    </div>
                                </section>

                                <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                                    <h2 className="text-lg font-black text-slate-900">Trial Banner Reset</h2>
                                    <p className="mt-2 text-sm text-slate-500">
                                        This clears the known trial-banner keys in the current browser only. Other devices or sessions still need to clear their local storage manually.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={flushTrialBanners}
                                        className="mt-4 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"
                                    >
                                        Flush all trial banners
                                    </button>
                                </section>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default AdminDashboard;
