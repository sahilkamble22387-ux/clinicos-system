import React, { useState, useEffect } from 'react';
import {
ArrowLeft, Phone, MapPin, Mail, Calendar, User,
ChevronDown, Loader2, Activity, Heart, Thermometer,
Pill, FileText, ClipboardList, FlaskConical, X,
Weight, Droplets, AlertCircle, Ruler,
} from 'lucide-react';
import { supabase } from '../../services/db';
import { Patient } from '../../types';

// ─── Avatar palette (matches FrontDesk) ──────────────────────────────────────
const AVATAR_PALETTE = [
{ bg: '#FEE2E2', text: '#DC2626', light: '#FEF2F2' },
{ bg: '#FFEDD5', text: '#EA580C', light: '#FFF7ED' },
{ bg: '#FEF3C7', text: '#D97706', light: '#FFFBEB' },
{ bg: '#D1FAE5', text: '#059669', light: '#ECFDF5' },
{ bg: '#CCFBF1', text: '#0D9488', light: '#F0FDFA' },
{ bg: '#CFFAFE', text: '#0891B2', light: '#ECFEFF' },
{ bg: '#DBEAFE', text: '#2563EB', light: '#EFF6FF' },
{ bg: '#E0E7FF', text: '#4F46E5', light: '#EEF2FF' },
{ bg: '#EDE9FE', text: '#7C3AED', light: '#F5F3FF' },
{ bg: '#F3E8FF', text: '#9333EA', light: '#FAF5FF' },
{ bg: '#FCE7F3', text: '#DB2777', light: '#FDF2F8' },
{ bg: '#FFF1F2', text: '#E11D48', light: '#FFF1F2' },
{ bg: '#DCFCE7', text: '#16A34A', light: '#F0FDF4' },
{ bg: '#D1FAE5', text: '#059669', light: '#ECFDF5' },
{ bg: '#E0F2FE', text: '#0284C7', light: '#F0F9FF' },
{ bg: '#F5F3FF', text: '#8B5CF6', light: '#F5F3FF' },
{ bg: '#FDF4FF', text: '#C026D3', light: '#FDF4FF' },
];
function avatarColor(name: string) {
const code = (name || 'U').toUpperCase().charCodeAt(0);
return AVATAR_PALETTE[code % AVATAR_PALETTE.length];
}
function formatPtId(id: string) {
const num = parseInt(id.replace(/-/g, '').slice(-4), 16) % 9000 + 1000;
return `PT-${num}`;
}
function getAge(dob?: string | null) {
  if (!dob) return null;
  const age = new Date().getFullYear() - new Date(dob).getFullYear();
  return age > 0 && age < 130 ? age : null;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface VisitRecord {
  id: string;
  created_at: string;
  diagnosis: string;
  doctor_notes: string | null;
  fee_collected: number;
  payment_method: string;
  vitals: {
    bp_systolic: number | null;
    bp_diastolic: number | null;
    heart_rate: number | null;
    weight_kg: number | null;
    temperature_f: number | null;
  } | null;
  medicines: {
    id: string;
    medicine_name: string;
    strength: string | null;
    form: string | null;
    dosage: string;
    duration: string;
    instructions: string | null;
  }[];
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function statusConfig(status: string) {
  switch ((status || '').toLowerCase()) {
    case 'waiting': return { label: 'Checked-in', bg: '#DCFCE7', text: '#16A34A' };
    case 'in_consultation': return { label: 'In Consultation', bg: '#EDE9FE', text: '#7C3AED' };
    case 'completed': return { label: 'Completed', bg: '#F1F5F9', text: '#64748B' };
    default: return { label: status || 'Unknown', bg: '#F1F5F9', text: '#64748B' };
  }
}

// ─── Fetch full visit history ─────────────────────────────────────────────────
async function fetchVisits(patientId: string): Promise<VisitRecord[]> {
    const [{ data: records }, { data: appts }] = await Promise.all([
    supabase.from('medical_records').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }),
    supabase.from('appointments').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }),
    ]);
    if (!records) return [];
    const recordIds = records.map(r => r.id);
    let items: any[] = [];
    if (recordIds.length > 0) {
    const { data } = await supabase.from('prescription_items').select('*').in('medical_record_id',
    recordIds).order('sort_order', { ascending: true });
    items = data ?? [];
    }
    return records.map(record => {
    const dayStr = new Date(record.created_at).toDateString();
    const appt = appts?.find(a => new Date(a.created_at).toDateString() === dayStr);
    const meds = items.filter(i => i.medical_record_id === record.id);
    return {
    id: record.id, created_at: record.created_at,
    diagnosis: record.diagnosis ?? 'Not specified',
    doctor_notes: record.doctor_notes ?? null,
    fee_collected: record.fee_collected ?? 0,
    payment_method: record.payment_method ?? 'Cash',
    vitals: appt ? {
    bp_systolic: appt.bp_systolic ?? null,
    bp_diastolic: appt.bp_diastolic ?? null,
    heart_rate: appt.heart_rate ?? null,
    weight_kg: appt.weight_kg ?? null,
    temperature_f: appt.temperature_f ?? null,
    } : null,
    medicines: meds.map(m => ({
    id: m.id, medicine_name: m.medicine_name,
    strength: m.strength ?? null, form: m.form ?? null,
    dosage: m.dosage, duration: m.duration, instructions: m.instructions ?? null,
    })),
    };
    });
    }

    // ─── Expandable Visit Card ────────────────────────────────────────────────────
    const VisitCard: React.FC<{ visit: VisitRecord }> = ({ visit }) => {
        const [expanded, setExpanded] = useState(false);
        const hasVitals = visit.vitals && Object.values(visit.vitals).some(v => v !== null);
        const hasMeds = visit.medicines.length > 0;
        const badge = visit.fee_collected > 0 ? 'Completed' : 'Completed';

        return (
        <div className="relative">
            {/* Timeline dot */}
            <div
                className="absolute left-0 top-5 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white shadow z-10" />

            <div className="ml-6 mb-4">
                {/* Visit header */}
                <button onClick={()=> setExpanded(e => !e)}
                    className="w-full text-left"
                    >
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-700">
                                {new Date(visit.created_at).toLocaleDateString('en-IN', {
                                month: 'short', day: 'numeric', year: 'numeric',
                                })}
                                {' - '}
                                <span className="text-slate-900">{visit.diagnosis}</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{
                                background: '#DCFCE7' , color: '#16A34A' }}>
                                Completed
                            </span>
                            <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200
                                ${expanded ? 'rotate-180' : '' }`} />
                        </div>
                    </div>
                </button>

                {/* Collapsed summary */}
                {!expanded && (
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs font-bold text-slate-400 mb-0.5">Diagnosis</p>
                            <p className="text-sm font-bold text-slate-800">{visit.diagnosis}</p>
                        </div>
                        {visit.doctor_notes && (
                        <div>
                            <p className="text-xs font-bold text-slate-400 mb-0.5">Doctor</p>
                            <p className="text-sm text-slate-600 truncate">{visit.doctor_notes}</p>
                        </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {hasMeds && (
                        <span
                            className="text-[10px] font-bold px-2 py-0.5 bg-violet-50 text-violet-700 rounded-full border border-violet-100">
                            💊 {visit.medicines.length} medicine{visit.medicines.length !== 1 ? 's' : ''}
                        </span>
                        )}
                        {hasVitals && (
                        <span
                            className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                            🩺 Vitals recorded
                        </span>
                        )}
                        {visit.fee_collected > 0 && (
                        <span
                            className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
                            ₹{visit.fee_collected.toLocaleString('en-IN')}
                        </span>
                        )}
                    </div>
                </div>
                )}

                {/* Expanded detail */}
                {expanded && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* Vitals */}
                    {hasVitals && (
                    <div className="px-4 py-3 bg-blue-50/60 border-b border-slate-100">
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">🩺 Vitals</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {visit.vitals?.bp_systolic && visit.vitals?.bp_diastolic && (
                            <div className="bg-white rounded-xl p-2.5 text-center border border-slate-200">
                                <p className="font-black text-rose-700">
                                    {visit.vitals.bp_systolic}/{visit.vitals.bp_diastolic}</p>
                                <p className="text-[9px] text-slate-400 mt-0.5">BP mmHg</p>
                            </div>
                            )}
                            {visit.vitals?.heart_rate && (
                            <div className="bg-white rounded-xl p-2.5 text-center border border-slate-200">
                                <p className="font-black text-pink-700">{visit.vitals.heart_rate}</p>
                                <p className="text-[9px] text-slate-400 mt-0.5">BPM</p>
                            </div>
                            )}
                            {visit.vitals?.temperature_f && (
                            <div className="bg-white rounded-xl p-2.5 text-center border border-slate-200">
                                <p className="font-black text-amber-700">{visit.vitals.temperature_f}°F</p>
                                <p className="text-[9px] text-slate-400 mt-0.5">Temp</p>
                            </div>
                            )}
                            {visit.vitals?.weight_kg && (
                            <div className="bg-white rounded-xl p-2.5 text-center border border-slate-200">
                                <p className="font-black text-blue-700">{visit.vitals.weight_kg}</p>
                                <p className="text-[9px] text-slate-400 mt-0.5">kg</p>
                            </div>
                            )}
                        </div>
                    </div>
                    )}

                    {/* Medicines */}
                    {hasMeds && (
                    <div className="px-4 py-3 border-b border-slate-100">
                        <p className="text-[10px] font-black text-violet-600 uppercase tracking-widest mb-2">💊
                            Prescription</p>
                        <div className="space-y-2">
                            {visit.medicines.map((med, i) => (
                            <div key={med.id}
                                className="flex items-start gap-3 p-2.5 bg-violet-50/50 rounded-xl border border-violet-100">
                                <div
                                    className="w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center shrink-0 mt-0.5">
                                    <span className="text-white text-[9px] font-black">{i + 1}</span>
                                </div>
                                <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-bold text-slate-900 text-sm">{med.medicine_name}</span>
                                        {med.strength && <span
                                            className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{med.strength}</span>}
                                        {med.form && <span
                                            className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded capitalize">{med.form}</span>}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-0.5">{med.dosage} ·
                                        {med.duration}{med.instructions ? ` · ${med.instructions}` : ''}</p>
                                </div>
                            </div>
                            ))}
                        </div>
                    </div>
                    )}

                    {/* Doctor notes */}
                    {visit.doctor_notes && (
                    <div className="px-4 py-3 bg-amber-50/50 border-b border-slate-100">
                        <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">📝 Notes</p>
                        <p className="text-sm text-slate-700 leading-relaxed">{visit.doctor_notes}</p>
                    </div>
                    )}

                    {/* Fee */}
                    <div className="px-4 py-3 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] text-slate-400 font-medium">Fee Collected</p>
                            <p className="text-sm font-black text-emerald-700">
                                {visit.fee_collected > 0 ? `₹${visit.fee_collected.toLocaleString('en-IN')}` : 'No fee recorded'}
                            </p>
                        </div>
                        {visit.fee_collected > 0 && (
                        <span
                            className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">{visit.payment_method}</span>
                        )}
                    </div>
                </div>
                )}
            </div>
        </div>
        );
        };

        // ─── Tab definitions ──────────────────────────────────────────────────────────
        type Tab = 'history' | 'appointments' | 'prescriptions' | 'lab';
        const TABS: { key: Tab; label: string }[] = [
        { key: 'history', label: 'Medical History' },
        { key: 'appointments', label: 'Appointments' },
        { key: 'prescriptions', label: 'Prescriptions' },
        { key: 'lab', label: 'Lab Results' },
        ];

        // ─── Health overview row ──────────────────────────────────────────────────────
        const HealthRow: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) =>
            (
            <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">{icon}</div>
                    <span className="text-sm text-slate-600 font-medium">{label}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">{value}</span>
            </div>
            );

            // ─── Main PatientDetailPage ───────────────────────────────────────────────────
            interface PatientDetailPageProps {
            patient: any; // raw DB row from patients table
            onBack: () => void;
            }

            const PatientDetailPage: React.FC<PatientDetailPageProps> = ({ patient, onBack }) => {
                const [activeTab, setActiveTab] = useState<Tab>('history');
                    const [visits, setVisits] = useState<VisitRecord[]>([]);
                        const [loadingVisits, setLoadingVisits] = useState(true);
                        const [lastVitals, setLastVitals] = useState<any>(null);

                            const color = avatarColor(patient.full_name || patient.name || '');
                            const name = patient.full_name || patient.name || 'Unknown';
                            const age = getAge(patient.dob);
                            const ptId = formatPtId(patient.id);
                            const badge = statusConfig(patient.status || '');

                            useEffect(() => {
                            const load = async () => {
                            setLoadingVisits(true);
                            const data = await fetchVisits(patient.id);
                            setVisits(data);

                            // Find last recorded vitals from any appointment
                            const { data: appts } = await supabase
                            .from('appointments')
                            .select('*')
                            .eq('patient_id', patient.id)
                            .order('created_at', { ascending: false })
                            .limit(10);

                            const withVitals = (appts ?? []).find(a =>
                            a.bp_systolic || a.heart_rate || a.weight_kg || a.temperature_f
                            );
                            setLastVitals(withVitals ?? null);
                            setLoadingVisits(false);
                            };
                            load();
                            }, [patient.id]);

                            const totalFee = visits.reduce((s, v) => s + v.fee_collected, 0);

                            // Prescriptions tab — flatten all medicines across visits
                            const allMeds = visits.flatMap(v =>
                            v.medicines.map(m => ({ ...m, visitDate: v.created_at, diagnosis: v.diagnosis }))
                            );

                            return (
                            <div className="min-h-full bg-slate-50 animate-in fade-in duration-300">
                                {/* ── Mobile back header ── */}
                                <div
                                    className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-10">
                                    <button onClick={onBack}
                                        className="p-2 rounded-full hover:bg-slate-100 transition-colors">
                                        <ArrowLeft size={20} className="text-slate-700" />
                                    </button>
                                    <span className="font-black text-slate-900 truncate">{name}</span>
                                </div>

                                <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-6 pb-28 md:pb-10">
                                    {/* Desktop back */}
                                    <button onClick={onBack}
                                        className="hidden md:flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 mb-5 transition-colors">
                                        <ArrowLeft size={16} /> Back to Patient List
                                    </button>

                                    <div className="flex flex-col lg:flex-row gap-5">

                                        {/* ── LEFT: Profile card ── */}
                                        <div className="w-full lg:w-[280px] shrink-0 space-y-4">

                                            {/* Main profile card */}
                                            <div
                                                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                                {/* Avatar section */}
                                                <div className="flex flex-col items-center py-7 px-5" style={{
                                                    background: color.light }}>
                                                    <div className="w-24 h-24 rounded-full flex items-center justify-center font-black text-4xl mb-3 shadow-md"
                                                        style={{ background: color.bg, color: color.text, border: `3px
                                                        solid ${color.text}25` }}>
                                                        {name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <h2
                                                        className="font-black text-slate-900 text-xl text-center leading-tight">
                                                        {name}</h2>
                                                    <p className="text-sm font-bold mt-1" style={{ color: color.text }}>
                                                        Patient ID {ptId}</p>
                                                    <div
                                                        className="flex items-center gap-2 mt-2 flex-wrap justify-center">
                                                        {age && (
                                                        <span
                                                            className="text-xs font-bold text-slate-500 bg-white/80 px-2.5 py-0.5 rounded-full border border-slate-200">
                                                            {age} yrs
                                                        </span>
                                                        )}
                                                        {patient.gender && (
                                                        <span
                                                            className="text-xs font-bold text-slate-500 bg-white/80 px-2.5 py-0.5 rounded-full border border-slate-200">
                                                            {patient.gender}
                                                        </span>
                                                        )}
                                                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                                                            style={{ background: badge.bg, color: badge.text }}>
                                                            {badge.label}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Contact details */}
                                                <div className="px-5 py-4 space-y-3">
                                                    {patient.phone && (
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                                            style={{ background: color.bg }}>
                                                            <Phone size={14} style={{ color: color.text }} />
                                                        </div>
                                                        <span
                                                            className="text-sm text-slate-700 font-medium">{patient.phone}</span>
                                                    </div>
                                                    )}
                                                    {patient.address && (
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                                                            style={{ background: color.bg }}>
                                                            <MapPin size={14} style={{ color: color.text }} />
                                                        </div>
                                                        <span
                                                            className="text-sm text-slate-600 leading-snug">{patient.address}</span>
                                                    </div>
                                                    )}
                                                    {patient.dob && (
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                                            style={{ background: color.bg }}>
                                                            <Calendar size={14} style={{ color: color.text }} />
                                                        </div>
                                                        <span className="text-sm text-slate-600">
                                                            {new Date(patient.dob).toLocaleDateString('en-IN', { day:
                                                            'numeric', month: 'long', year: 'numeric' })}
                                                        </span>
                                                    </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Health Overview card */}
                                            <div
                                                className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
                                                <h3 className="font-black text-slate-900 text-base mb-1" style={{ color:
                                                    color.text }}>
                                                    Health Overview
                                                </h3>
                                                <div className="mt-2">
                                                    <HealthRow icon={<Activity size={15} className="text-rose-500" />}
                                                    label="Last BP"
                                                    value={lastVitals?.bp_systolic && lastVitals?.bp_diastolic
                                                    ? `${lastVitals.bp_systolic}/${lastVitals.bp_diastolic} mmHg`
                                                    : '—'}
                                                    />
                                                    <HealthRow icon={<Heart size={15} className="text-pink-500" />}
                                                    label="Heart Rate"
                                                    value={lastVitals?.heart_rate ? `${lastVitals.heart_rate} bpm` :
                                                    '—'}
                                                    />
                                                    <HealthRow icon={<Thermometer size={15}
                                                        className="text-amber-500" />}
                                                    label="Temperature"
                                                    value={lastVitals?.temperature_f ? `${lastVitals.temperature_f}°F` :
                                                    '—'}
                                                    />
                                                    <HealthRow icon={<Weight size={15} className="text-blue-500" />}
                                                    label="Weight"
                                                    value={lastVitals?.weight_kg ? `${lastVitals.weight_kg} kg` : '—'}
                                                    />
                                                    <HealthRow icon={<ClipboardList size={15}
                                                        className="text-indigo-500" />}
                                                    label="Total Visits"
                                                    value={String(visits.length)}
                                                    />
                                                    {totalFee > 0 && (
                                                    <HealthRow icon={<FileText size={15} className="text-emerald-500" />
                                                    }
                                                    label="Total Fees"
                                                    value={`₹${totalFee.toLocaleString('en-IN')}`}
                                                    />
                                                    )}
                                                </div>
                                            </div>

                                        </div>

                                        {/* ── RIGHT: Tabbed content ── */}
                                        <div className="flex-1 min-w-0">
                                            {/* Header row */}
                                            <div className="flex items-center justify-between mb-4">
                                                <h1 className="text-2xl font-black text-slate-900">{name}</h1>
                                            </div>

                                            {/* Tabs */}
                                            <div className="flex gap-1 border-b border-slate-200 mb-5 overflow-x-auto">
                                                {TABS.map(tab => (
                                                <button key={tab.key} onClick={()=> setActiveTab(tab.key)}
                                                    className={`px-4 py-2.5 text-sm font-bold whitespace-nowrap
                                                    transition-colors border-b-2 -mb-px ${
                                                    activeTab === tab.key
                                                    ? 'border-indigo-600 text-indigo-600'
                                                    : 'border-transparent text-slate-500 hover:text-slate-800'
                                                    }`}
                                                    >
                                                    {tab.label}
                                                </button>
                                                ))}
                                            </div>

                                            {/* ── Tab: Medical History ── */}
                                            {activeTab === 'history' && (
                                            <div>
                                                {loadingVisits ? (
                                                <div className="flex items-center justify-center py-16">
                                                    <Loader2 size={24} className="animate-spin text-indigo-500" />
                                                </div>
                                                ) : visits.length === 0 ? (
                                                <div
                                                    className="flex flex-col items-center justify-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-200">
                                                    <ClipboardList size={32} className="text-slate-200 mb-3" />
                                                    <p className="font-bold text-slate-500">No visit history yet</p>
                                                    <p className="text-sm mt-1">Records will appear after consultation
                                                    </p>
                                                </div>
                                                ) : (
                                                <div className="relative">
                                                    {/* Timeline line */}
                                                    <div
                                                        className="absolute left-[5px] top-5 bottom-0 w-0.5 bg-slate-200" />
                                                    <div className="space-y-1">
                                                        {visits.map(visit => (
                                                        <VisitCard key={visit.id} visit={visit} />
                                                        ))}
                                                    </div>
                                                </div>
                                                )}
                                            </div>
                                            )}

                                            {/* ── Tab: Appointments ── */}
                                            {activeTab === 'appointments' && (
                                            <div className="space-y-3">
                                                {loadingVisits ? (
                                                <div className="flex items-center justify-center py-16">
                                                    <Loader2 size={24} className="animate-spin text-indigo-500" />
                                                </div>
                                                ) : visits.length === 0 ? (
                                                <EmptyTab label="No appointments recorded" />
                                                ) : (
                                                visits.map(visit => (
                                                <div key={visit.id}
                                                    className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-start justify-between gap-4">
                                                    <div className="flex items-start gap-3">
                                                        <div
                                                            className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                                                            <Calendar size={16} className="text-indigo-600" />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-900 text-sm">
                                                                {new Date(visit.created_at).toLocaleDateString('en-IN',
                                                                { day: 'numeric', month: 'long', year: 'numeric' })}
                                                            </p>
                                                            <p className="text-xs text-slate-500 mt-0.5">
                                                                {visit.diagnosis}</p>
                                                            {visit.vitals && (
                                                            <div className="flex gap-2 mt-1.5 flex-wrap">
                                                                {visit.vitals.bp_systolic && (
                                                                <span
                                                                    className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                                                                    BP
                                                                    {visit.vitals.bp_systolic}/{visit.vitals.bp_diastolic}
                                                                </span>
                                                                )}
                                                                {visit.vitals.heart_rate && (
                                                                <span
                                                                    className="text-[10px] font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full">
                                                                    {visit.vitals.heart_rate} bpm
                                                                </span>
                                                                )}
                                                            </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <span
                                                        className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
                                                        style={{ background: '#DCFCE7' , color: '#16A34A' }}>
                                                        Completed
                                                    </span>
                                                </div>
                                                ))
                                                )}
                                            </div>
                                            )}

                                            {/* ── Tab: Prescriptions ── */}
                                            {activeTab === 'prescriptions' && (
                                            <div className="space-y-3">
                                                {loadingVisits ? (
                                                <div className="flex items-center justify-center py-16">
                                                    <Loader2 size={24} className="animate-spin text-indigo-500" />
                                                </div>
                                                ) : allMeds.length === 0 ? (
                                                <EmptyTab label="No prescriptions found" />
                                                ) : (
                                                allMeds.map((med, i) => (
                                                <div key={`${med.id}-${i}`}
                                                    className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex items-start gap-3">
                                                            <div
                                                                className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                                                                <Pill size={15} className="text-violet-600" />
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <p className="font-black text-slate-900 text-sm">
                                                                        {med.medicine_name}</p>
                                                                    {med.strength && <span
                                                                        className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{med.strength}</span>}
                                                                    {med.form && <span
                                                                        className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded capitalize">{med.form}</span>}
                                                                </div>
                                                                <p className="text-xs text-slate-500 mt-0.5">
                                                                    {med.dosage} · {med.duration}</p>
                                                                {med.instructions && <p
                                                                    className="text-xs text-slate-400 italic mt-0.5">
                                                                    {med.instructions}</p>}
                                                                <p
                                                                    className="text-[10px] text-indigo-500 font-bold mt-1.5">
                                                                    {new Date(med.visitDate).toLocaleDateString('en-IN',
                                                                    { day: 'numeric', month: 'short', year: 'numeric'
                                                                    })}
                                                                    {' · '}
                                                                    {med.diagnosis}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                ))
                                                )}
                                            </div>
                                            )}

                                            {/* ── Tab: Lab Results ── */}
                                            {activeTab === 'lab' && (
                                            <EmptyTab label="No lab results uploaded yet"
                                                sub="Upload lab reports from the Front Desk to see them here" />
                                            )}
                                        </div>

                                    </div>
                                </div>
                            </div>
                            );
                            };

                            const EmptyTab: React.FC<{ label: string; sub?: string }> = ({ label, sub }) => (
                                <div
                                    className="flex flex-col items-center justify-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-200">
                                    <FileText size={32} className="text-slate-200 mb-3" />
                                    <p className="font-bold text-slate-500">{label}</p>
                                    {sub && <p className="text-sm text-slate-400 mt-1 text-center max-w-xs">{sub}</p>}
                                </div>
                                );

                                export default PatientDetailPage;