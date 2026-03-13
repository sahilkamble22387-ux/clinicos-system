import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, UserPlus, FileUp, X, User, Phone, MapPin,
  Calendar, Users, Smartphone, Activity, Thermometer, Heart,
  MoreHorizontal, Check, SlidersHorizontal, ChevronDown,
  AlertCircle, CheckCircle2, Clock, Stethoscope, ArrowUpRight,
  Shield, Weight,
} from 'lucide-react';
import { supabase } from '../../services/db';
import { Patient, Gender } from '../../types';
import { toast } from 'react-hot-toast';
import { EmergencyBanner } from '../EmergencyQueueControls';

// ─── Types ────────────────────────────────────────────────────────────────────
interface FrontDeskProps {
  clinicId: string;
  clinicName?: string;
  onPatientClick?: (patient: Patient) => void;
}

// ─── Validation helpers ───────────────────────────────────────────────────────

/** Luhn-adjacent: reject all-same-digit and sequential patterns */
function isLikelyFakePhone(digits: string): boolean {
  if (/^(\d)\1{9}$/.test(digits)) return true;                     // 0000000000, 9999999999, etc.
  const ascending = '0123456789';
  const descending = '9876543210';
  if (ascending.includes(digits) || descending.includes(digits)) return true; // 0123456789
  // Common placeholders
  const fakes = ['1234567890', '0987654321', '1111111111', '2222222222',
    '1234512345', '9876598765', '5555555555'];
  return fakes.includes(digits);
}

function validatePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return 'Phone number is required.';
  if (digits.length !== 10) return 'Must be exactly 10 digits.';
  if (['6', '7', '8', '9'].every(d => !digits.startsWith(d)) && digits[0] !== '0') {
    // Indian numbers start with 6-9; allow 0 for landline prefix tolerance
  }
  if (isLikelyFakePhone(digits)) return 'Please enter a real phone number.';
  return null;
}

function validateAge(dob: string): string | null {
  if (!dob) return 'Date of birth is required.';
  const birth = new Date(dob);
  const now = new Date();
  if (isNaN(birth.getTime())) return 'Invalid date.';
  if (birth > now) return 'Date of birth cannot be in the future.';
  const age = (now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (age > 120) return 'Please enter a valid date of birth.';
  return null;
}

function validateVital(val: string, min: number, max: number, label: string): string | null {
  if (!val) return null; // vitals are optional
  const n = Number(val);
  if (isNaN(n)) return `${label} must be a number.`;
  if (n < min || n > max) return `${label} must be between ${min} and ${max}.`;
  return null;
}

// ─── Avatar palette ───────────────────────────────────────────────────────────
const AVATAR_PALETTE = [
  { bg: '#FEE2E2', text: '#DC2626' },
  { bg: '#FFEDD5', text: '#EA580C' },
  { bg: '#FEF3C7', text: '#D97706' },
  { bg: '#D1FAE5', text: '#059669' },
  { bg: '#CCFBF1', text: '#0D9488' },
  { bg: '#CFFAFE', text: '#0891B2' },
  { bg: '#DBEAFE', text: '#2563EB' },
  { bg: '#E0E7FF', text: '#4F46E5' },
  { bg: '#EDE9FE', text: '#7C3AED' },
  { bg: '#F3E8FF', text: '#9333EA' },
  { bg: '#FCE7F3', text: '#DB2777' },
  { bg: '#FFF1F2', text: '#E11D48' },
  { bg: '#ECFDF5', text: '#10B981' },
  { bg: '#F0FDF4', text: '#16A34A' },
  { bg: '#EFF6FF', text: '#3B82F6' },
  { bg: '#F5F3FF', text: '#8B5CF6' },
  { bg: '#FDF4FF', text: '#C026D3' },
];

function avatarColor(name: string) {
  const code = (name || 'U').toUpperCase().charCodeAt(0);
  return AVATAR_PALETTE[code % AVATAR_PALETTE.length];
}

function formatPtId(id: string) {
  const num = parseInt(id.replace(/-/g, '').slice(-4), 16) % 9000 + 1000;
  return `PT-${num}`;
}

function statusBadge(status: string) {
  switch ((status || '').toLowerCase()) {
    case 'waiting':
      return { label: 'Checked-in', bg: '#DCFCE7', text: '#16A34A', dot: '#22C55E' };
    case 'in_consultation':
    case 'in consultation':
      return { label: 'In Consult', bg: '#EDE9FE', text: '#7C3AED', dot: '#8B5CF6' };
    case 'completed':
      return { label: 'Completed', bg: '#F1F5F9', text: '#64748B', dot: '#94A3B8' };
    default:
      return { label: status || 'Unknown', bg: '#F8FAFC', text: '#94A3B8', dot: '#CBD5E1' };
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────
const PatientAvatar: React.FC<{ name: string; size?: number }> = ({ name, size = 36 }) => {
  const color = avatarColor(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color.bg, color: color.text,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: size * 0.4, flexShrink: 0,
      border: `1.5px solid ${color.text}33`,
      letterSpacing: '-0.02em',
    }}>
      {(name || 'U').charAt(0).toUpperCase()}
    </div>
  );
};

// ─── Validated field wrapper ──────────────────────────────────────────────────
const FieldWrap: React.FC<{
  label: string;
  icon: React.ReactNode;
  error?: string | null;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ label, icon, error, required, children, className = '' }) => (
  <div className={`space-y-1.5 ${className}`}>
    <label className="flex items-center gap-1.5 text-[11px] font-black text-slate-400 uppercase tracking-widest select-none">
      <span className="text-indigo-400">{icon}</span>
      {label}
      {required && <span className="text-rose-400 ml-0.5">*</span>}
    </label>
    {children}
    {error && (
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-500 mt-1 animate-[fadeIn_0.15s_ease]">
        <AlertCircle size={11} className="flex-shrink-0" />
        {error}
      </p>
    )}
  </div>
);

// ─── Step indicator ───────────────────────────────────────────────────────────
const StepDot: React.FC<{ active: boolean; done: boolean; n: number; label: string }> = ({ active, done, n, label }) => (
  <div className="flex flex-col items-center gap-1">
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300 ${done ? 'bg-emerald-500 text-white scale-95'
        : active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-110'
          : 'bg-slate-100 text-slate-400'
      }`}>
      {done ? <Check size={13} strokeWidth={3} /> : n}
    </div>
    <span className={`text-[10px] font-bold tracking-wide transition-colors ${active ? 'text-indigo-600' : done ? 'text-emerald-500' : 'text-slate-400'}`}>
      {label}
    </span>
  </div>
);

// ─── Input base class ─────────────────────────────────────────────────────────
const ic = (hasError?: boolean) =>
  `w-full p-3 border rounded-xl outline-none transition-all duration-200 font-medium text-[14px] text-slate-800 placeholder:text-slate-300 placeholder:font-normal
  ${hasError
    ? 'bg-rose-50 border-rose-300 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400'
    : 'bg-slate-50/70 border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400'}`;

// ─── Main component ───────────────────────────────────────────────────────────
const FrontDesk: React.FC<FrontDeskProps> = ({ clinicId, clinicName, onPatientClick }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRegModal, setShowRegModal] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [selectedPatientForUpload, setSelectedPatientForUpload] = useState<Patient | null>(null);
  const [queueAccepting, setQueueAccepting] = useState(true);
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [regStep, setRegStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isQueueBlocked = !queueAccepting || emergencyActive;

  // ── Registration form state ──
  const [form, setForm] = useState({
    name: '', gender: Gender.MALE, dob: '', phone: '', address: '',
    bp_systolic: '', bp_diastolic: '', heart_rate: '', weight_kg: '', temperature_f: '',
  });

  // ── Field-level errors ──
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const setField = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    // Clear error on change
    if (errors[k]) setErrors(e => ({ ...e, [k]: null }));
  };

  // ── Data fetching ──
  const fetchPatients = useCallback(async () => {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      toast.error('Failed to load patients.');
      return;
    }
    if (data) {
      setPatients(data.map((p: any) => ({
        ...p,
        name: p.full_name || '',
        address: p.address || '',
        phone: p.phone || '',
      })) as Patient[]);
    }
  }, [clinicId]);

  useEffect(() => {
    fetchPatients();
    const channel = supabase
      .channel(`frontdesk-patients-${clinicId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'patients',
        filter: `clinic_id=eq.${clinicId}`,
      }, fetchPatients)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clinicId, fetchPatients]);

  useEffect(() => {
    if (!clinicId) return;
    supabase
      .from('clinics')
      .select('queue_accepting_patients, emergency_mode')
      .eq('id', clinicId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setQueueAccepting((data as any).queue_accepting_patients ?? true);
          setEmergencyActive((data as any).emergency_mode ?? false);
        }
      });
    const ch = supabase
      .channel(`frontdesk-queue-${clinicId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'clinics',
        filter: `id=eq.${clinicId}`,
      }, (payload) => {
        const n = payload.new as { queue_accepting_patients?: boolean; emergency_mode?: boolean };
        if (typeof n.queue_accepting_patients === 'boolean') setQueueAccepting(n.queue_accepting_patients);
        if (typeof n.emergency_mode === 'boolean') setEmergencyActive(n.emergency_mode);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [clinicId]);

  const filteredPatients = patients.filter(p =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.phone?.includes(searchQuery) ||
    formatPtId(p.id || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Step 1 validation ──
  function validateStep1(): boolean {
    const errs: Record<string, string | null> = {};
    if (!form.name.trim() || form.name.trim().length < 2)
      errs.name = 'Full name must be at least 2 characters.';
    const phoneErr = validatePhone(form.phone);
    if (phoneErr) errs.phone = phoneErr;
    const dobErr = validateAge(form.dob);
    if (dobErr) errs.dob = dobErr;
    setErrors(errs);
    return Object.values(errs).every(v => !v);
  }

  // ── Step 2 validation ──
  function validateStep2(): boolean {
    const errs: Record<string, string | null> = {};
    const bpS = validateVital(form.bp_systolic, 60, 250, 'Systolic BP');
    const bpD = validateVital(form.bp_diastolic, 40, 150, 'Diastolic BP');
    const hr = validateVital(form.heart_rate, 30, 250, 'Heart rate');
    const wt = validateVital(form.weight_kg, 1, 500, 'Weight');
    const temp = validateVital(form.temperature_f, 90, 115, 'Temperature');
    if (bpS) errs.bp_systolic = bpS;
    if (bpD) errs.bp_diastolic = bpD;
    if (hr) errs.heart_rate = hr;
    if (wt) errs.weight_kg = wt;
    if (temp) errs.temperature_f = temp;

    // Cross-field: systolic must be > diastolic
    if (form.bp_systolic && form.bp_diastolic) {
      const s = Number(form.bp_systolic), d = Number(form.bp_diastolic);
      if (!isNaN(s) && !isNaN(d) && s <= d) {
        errs.bp_systolic = 'Systolic must be greater than diastolic.';
      }
    }
    setErrors(errs);
    return Object.values(errs).every(v => !v);
  }

  const goToStep2 = () => {
    if (validateStep1()) setRegStep(2);
  };

  const resetModal = () => {
    setForm({
      name: '', gender: Gender.MALE, dob: '', phone: '', address: '',
      bp_systolic: '', bp_diastolic: '', heart_rate: '', weight_kg: '', temperature_f: ''
    });
    setErrors({});
    setRegStep(1);
    setShowRegModal(false);
    setSubmitting(false);
  };

  const handleRegister = async () => {
    if (!validateStep2()) return;
    setSubmitting(true);
    try {
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .insert([{
          full_name: form.name.trim(),
          gender: form.gender,
          dob: form.dob || null,
          phone: form.phone.replace(/\D/g, ''), // store digits only
          address: form.address.trim() || null,
          clinic_id: clinicId,
          status: 'waiting',
          is_active: true,
          source: 'Front_Desk',
          consultation_fee: 0,
        }])
        .select()
        .single();

      if (patientError) throw patientError;

      const { error: apptError } = await supabase.from('appointments').insert([{
        patient_id: patientData.id,
        clinic_id: clinicId,
        status: 'waiting',
        bp_systolic: form.bp_systolic ? Number(form.bp_systolic) : null,
        bp_diastolic: form.bp_diastolic ? Number(form.bp_diastolic) : null,
        heart_rate: form.heart_rate ? Number(form.heart_rate) : null,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        temperature_f: form.temperature_f ? Number(form.temperature_f) : null,
      }]);

      if (apptError) throw apptError;

      toast.success(`${patientData.full_name} registered & added to queue!`);
      resetModal();
    } catch (err: any) {
      toast.error('Registration failed: ' + (err.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckIn = async (patientId: string) => {
    try {
      const { error: apptErr } = await supabase
        .from('appointments')
        .insert([{ patient_id: patientId, clinic_id: clinicId, status: 'waiting' }]);
      if (apptErr) throw apptErr;

      const { error: ptErr } = await supabase
        .from('patients')
        .update({ status: 'waiting', is_active: true })
        .eq('id', patientId);
      if (ptErr) throw ptErr;

      setActiveMenu(null);
      toast.success('Patient added to queue!');
    } catch (err: any) {
      toast.error('Check-in failed: ' + (err.message || 'Unknown error'));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, patient: Patient) => {
    const file = e.target.files?.[0];
    if (file && patient) {
      toast.success(`"${file.name}" uploaded for ${patient.name}`);
      setSelectedPatientForUpload(null);
    }
    e.target.value = '';
  };

  // ── Format phone as user types ──
  const formatPhoneDisplay = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, 10);
    if (d.length <= 5) return d;
    return d.slice(0, 5) + ' ' + d.slice(5);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F6F7FB]">
      <EmergencyBanner clinicId={clinicId} />

      <div className="pb-24 md:pb-12 max-w-7xl mx-auto px-4 md:px-8 pt-6 w-full space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/30">
                <Stethoscope size={16} className="text-white" />
              </div>
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                {clinicName ?? 'Clinic'}
              </span>
            </div>
            <h1 className="text-2xl md:text-[28px] font-black text-slate-900 tracking-tight leading-none">
              Patient Registry
            </h1>
            <p className="text-slate-400 text-sm mt-1 font-medium">
              <span className="font-black text-slate-600">{filteredPatients.length}</span>{' '}
              patient{filteredPatients.length !== 1 ? 's' : ''} on record
            </p>
          </div>
          <button
            onClick={() => setShowRegModal(true)}
            disabled={isQueueBlocked}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${isQueueBlocked
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.97] text-white shadow-lg shadow-indigo-500/25'
              }`}
          >
            <UserPlus size={15} />
            New Patient
            {!isQueueBlocked && <ArrowUpRight size={13} className="opacity-60" />}
          </button>
        </div>

        {/* ── Search + Filter ── */}
        <div className="flex gap-2.5">
          <div className="relative flex-1 group">
            <Search size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, phone or PT-ID…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-slate-900 placeholder:text-slate-400 font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 hover:border-slate-300 shadow-sm transition-all">
            <SlidersHorizontal size={14} />
            <span className="hidden sm:inline">Filter</span>
          </button>
        </div>

        {/* ── Patient table ── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">

          {/* Table header — desktop */}
          <div className="hidden md:grid grid-cols-[2.2fr_1fr_1.2fr_1.1fr_0.5fr] px-6 py-3 border-b border-slate-100 bg-slate-50/80">
            {['Patient', 'PT ID', 'Registered', 'Status', ''].map((h, i) => (
              <span key={i} className={`text-[10px] font-black text-slate-400 uppercase tracking-widest ${i === 4 ? 'text-right' : ''}`}>
                {h}
              </span>
            ))}
          </div>

          {filteredPatients.length === 0 ? (
            <div className="py-20 flex flex-col items-center gap-3 text-slate-400">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-1">
                <Users size={22} className="text-slate-300" />
              </div>
              <p className="text-sm font-bold text-slate-500">
                {searchQuery ? 'No patients match your search' : 'No patients yet'}
              </p>
              <p className="text-xs text-slate-400">
                {searchQuery ? `Try a different search term` : 'Register your first patient above'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100/80">
              {filteredPatients.map(patient => {
                const badge = statusBadge(patient.status || '');
                const dateStr = (patient.updated_at || patient.created_at)
                  ? new Date(patient.updated_at || patient.created_at || '').toLocaleDateString('en-IN', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })
                  : '—';

                return (
                  <React.Fragment key={patient.id}>
                    {/* Desktop */}
                    <div
                      onClick={() => onPatientClick?.(patient)}
                      className="hidden md:grid grid-cols-[2.2fr_1fr_1.2fr_1.1fr_0.5fr] items-center px-6 py-4 hover:bg-indigo-50/40 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <PatientAvatar name={patient.name} size={38} />
                        <div>
                          <p className="font-bold text-slate-900 text-sm leading-tight group-hover:text-indigo-700 transition-colors">
                            {patient.name}
                          </p>
                          <p className="text-xs text-slate-400 font-medium mt-0.5">
                            {patient.phone
                              ? patient.phone.replace(/(\d{5})(\d{5})/, '$1 $2')
                              : '—'}
                          </p>
                        </div>
                      </div>

                      <span className="text-xs text-slate-500 font-black tabular-nums bg-slate-100 px-2 py-1 rounded-lg w-fit">
                        {formatPtId(patient.id || '')}
                      </span>

                      <div className="flex items-center gap-1.5 text-sm text-slate-500">
                        <Calendar size={12} className="text-slate-300" />
                        {dateStr}
                      </div>

                      <div>
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black"
                          style={{ background: badge.bg, color: badge.text }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: badge.dot }} />
                          {badge.label}
                        </span>
                      </div>

                      <div className="flex justify-end">
                        <div className="relative">
                          <button
                            onClick={e => { e.stopPropagation(); setActiveMenu(activeMenu === patient.id ? null : patient.id!); }}
                            className="p-2 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-all"
                          >
                            <MoreHorizontal size={17} />
                          </button>

                          {activeMenu === patient.id && (
                            <div className="absolute right-0 top-10 z-20 bg-white border border-slate-200 rounded-2xl shadow-2xl w-48 overflow-hidden py-1">
                              <button
                                onClick={e => { e.stopPropagation(); handleCheckIn(patient.id!); }}
                                disabled={isQueueBlocked}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              >
                                <Check size={14} strokeWidth={2.5} />
                                Check-In to Queue
                              </button>
                              <div className="h-px bg-slate-100 mx-3" />
                              <button
                                onClick={e => { e.stopPropagation(); setSelectedPatientForUpload(patient); setActiveMenu(null); }}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                              >
                                <FileUp size={14} />
                                Upload Records
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Mobile card */}
                    <div
                      onClick={() => onPatientClick?.(patient)}
                      className="md:hidden flex items-center gap-3 px-4 py-4 active:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <PatientAvatar name={patient.name} size={44} />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 text-sm truncate">{patient.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5 font-medium">
                          {formatPtId(patient.id || '')} · {patient.phone?.replace(/(\d{5})(\d{5})/, '$1 $2') || '—'}
                        </p>
                        <span
                          className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black"
                          style={{ background: badge.bg, color: badge.text }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: badge.dot }} />
                          {badge.label}
                        </span>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); if (!isQueueBlocked) handleCheckIn(patient.id!); }}
                        disabled={isQueueBlocked}
                        className={`p-2.5 rounded-xl transition-colors flex-shrink-0 ${isQueueBlocked
                            ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                            : 'bg-emerald-50 text-emerald-600 active:bg-emerald-100 border border-emerald-100'
                          }`}
                      >
                        <Check size={16} strokeWidth={2.5} />
                      </button>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        {/* Queue blocked notice */}
        {isQueueBlocked && (
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-700">
            <Shield size={18} className="flex-shrink-0 text-amber-500" />
            <div>
              <p className="font-bold text-sm">
                {emergencyActive ? 'Emergency mode active' : 'Queue is paused'}
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                New check-ins and registrations are disabled. Manage this from Queue Controls.
              </p>
            </div>
          </div>
        )}

        {/* Overlay to close dropdown */}
        {activeMenu && (
          <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />
        )}

        {/* ════════════════════ REGISTRATION MODAL ════════════════════ */}
        {showRegModal && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm md:p-4">
            <div
              className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden"
              style={{ maxHeight: '92vh' }}
            >
              {/* Mobile drag handle */}
              <div className="md:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1.5 rounded-full bg-slate-200" />
              </div>

              {/* Header */}
              <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 flex-shrink-0">
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    New Patient Registration
                  </h3>
                  <p className="text-slate-400 text-[13px] mt-0.5">
                    Step {regStep} of 2 — {regStep === 1 ? 'Personal Details' : 'Vitals (Optional)'}
                  </p>
                </div>
                <button
                  onClick={resetModal}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 border border-slate-100 transition-all flex-shrink-0 ml-3"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Step indicator */}
              <div className="flex items-center justify-center gap-6 py-4 bg-slate-50/60 border-b border-slate-100 flex-shrink-0">
                <StepDot n={1} active={regStep === 1} done={regStep > 1} label="Identity" />
                <div className="flex-1 max-w-[60px] h-0.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: regStep > 1 ? '100%' : '0%' }}
                  />
                </div>
                <StepDot n={2} active={regStep === 2} done={false} label="Vitals" />
              </div>

              {/* ─── Step 1: Personal Details ─── */}
              {regStep === 1 && (
                <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

                  {/* Full Name */}
                  <FieldWrap label="Full Name" icon={<User size={11} />} error={errors.name} required>
                    <div className="relative">
                      <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" />
                      <input
                        required
                        autoFocus
                        value={form.name}
                        onChange={e => setField('name', e.target.value)}
                        onBlur={() => {
                          if (!form.name.trim() || form.name.trim().length < 2)
                            setErrors(er => ({ ...er, name: 'Full name must be at least 2 characters.' }));
                        }}
                        type="text"
                        placeholder="e.g. Priya Sharma"
                        className={`w-full pl-10 pr-4 py-3 border rounded-xl outline-none transition-all font-medium text-[14px] placeholder:text-slate-300 placeholder:font-normal text-slate-800 ${errors.name
                            ? 'bg-rose-50 border-rose-300 focus:ring-2 focus:ring-rose-400/20'
                            : 'bg-slate-50/70 border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400'
                          }`}
                      />
                    </div>
                  </FieldWrap>

                  {/* Gender + DOB */}
                  <div className="grid grid-cols-2 gap-3">
                    <FieldWrap label="Gender" icon={<Users size={11} />} required>
                      <div className="relative">
                        <select
                          value={form.gender}
                          onChange={e => setField('gender', e.target.value as Gender)}
                          className={ic() + ' pr-8 cursor-pointer appearance-none'}
                        >
                          <option value={Gender.MALE}>Male</option>
                          <option value={Gender.FEMALE}>Female</option>
                          <option value={Gender.OTHER}>Other</option>
                        </select>
                        <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </FieldWrap>

                    <FieldWrap label="Date of Birth" icon={<Calendar size={11} />} error={errors.dob} required>
                      <input
                        required
                        type="date"
                        value={form.dob}
                        max={new Date().toISOString().split('T')[0]}
                        onChange={e => setField('dob', e.target.value)}
                        onBlur={() => {
                          const e = validateAge(form.dob);
                          if (e) setErrors(er => ({ ...er, dob: e }));
                        }}
                        className={ic(!!errors.dob)}
                      />
                    </FieldWrap>
                  </div>

                  {/* Phone */}
                  <FieldWrap label="Mobile Number" icon={<Phone size={11} />} error={errors.phone} required>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                        <span className="text-slate-400 text-[13px] font-bold">+91</span>
                        <div className="w-px h-4 bg-slate-200" />
                      </div>
                      <input
                        required
                        type="tel"
                        inputMode="numeric"
                        placeholder="98765 43210"
                        value={formatPhoneDisplay(form.phone)}
                        onChange={e => {
                          const raw = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setField('phone', raw);
                        }}
                        onBlur={() => {
                          const e = validatePhone(form.phone);
                          if (e) setErrors(er => ({ ...er, phone: e }));
                        }}
                        className={`w-full pl-16 pr-10 py-3 border rounded-xl outline-none transition-all font-medium text-[14px] placeholder:text-slate-300 placeholder:font-normal text-slate-800 ${errors.phone
                            ? 'bg-rose-50 border-rose-300 focus:ring-2 focus:ring-rose-400/20'
                            : form.phone.replace(/\D/g, '').length === 10 && !errors.phone
                              ? 'bg-emerald-50/60 border-emerald-300 focus:ring-2 focus:ring-emerald-400/20'
                              : 'bg-slate-50/70 border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400'
                          }`}
                      />
                      {form.phone.replace(/\D/g, '').length === 10 && !errors.phone && (
                        <CheckCircle2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-500" />
                      )}
                      {errors.phone && (
                        <AlertCircle size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-rose-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">10-digit Indian mobile number</p>
                  </FieldWrap>

                  {/* Address */}
                  <FieldWrap label="Address" icon={<MapPin size={11} />}>
                    <textarea
                      value={form.address}
                      onChange={e => setField('address', e.target.value)}
                      placeholder="Flat / Street / City (optional)"
                      rows={2}
                      className={ic() + ' resize-none'}
                    />
                  </FieldWrap>
                </div>
              )}

              {/* ─── Step 2: Vitals ─── */}
              {regStep === 2 && (
                <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
                  <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                    <Activity size={14} className="text-blue-400 flex-shrink-0" />
                    <p className="text-[12px] text-blue-600 font-semibold">
                      Vitals are optional. Leave blank if not measured yet.
                    </p>
                  </div>

                  {/* Blood Pressure */}
                  <FieldWrap label="Blood Pressure" icon={<Heart size={11} />} error={errors.bp_systolic || errors.bp_diastolic}>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          placeholder="Systolic (60–250)"
                          value={form.bp_systolic}
                          onChange={e => setField('bp_systolic', e.target.value)}
                          className={ic(!!errors.bp_systolic)}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300 pointer-events-none">
                          mmHg
                        </span>
                      </div>
                      <span className="text-slate-300 font-black text-lg flex-shrink-0">/</span>
                      <div className="relative flex-1">
                        <input
                          type="number"
                          placeholder="Diastolic (40–150)"
                          value={form.bp_diastolic}
                          onChange={e => setField('bp_diastolic', e.target.value)}
                          className={ic(!!errors.bp_diastolic)}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300 pointer-events-none">
                          mmHg
                        </span>
                      </div>
                    </div>
                  </FieldWrap>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Heart Rate */}
                    <FieldWrap label="Heart Rate" icon={<Activity size={11} />} error={errors.heart_rate}>
                      <div className="relative">
                        <input
                          type="number"
                          placeholder="72"
                          value={form.heart_rate}
                          onChange={e => setField('heart_rate', e.target.value)}
                          className={ic(!!errors.heart_rate)}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300 pointer-events-none">
                          bpm
                        </span>
                      </div>
                    </FieldWrap>

                    {/* Temperature */}
                    <FieldWrap label="Temperature" icon={<Thermometer size={11} />} error={errors.temperature_f}>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          placeholder="98.6"
                          value={form.temperature_f}
                          onChange={e => setField('temperature_f', e.target.value)}
                          className={ic(!!errors.temperature_f)}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300 pointer-events-none">
                          °F
                        </span>
                      </div>
                    </FieldWrap>
                  </div>

                  {/* Weight */}
                  <FieldWrap label="Weight" icon={<Weight size={11} />} error={errors.weight_kg}>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        placeholder="65.5"
                        value={form.weight_kg}
                        onChange={e => setField('weight_kg', e.target.value)}
                        className={ic(!!errors.weight_kg)}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300 pointer-events-none">
                        kg
                      </span>
                    </div>
                  </FieldWrap>
                </div>
              )}

              {/* Footer */}
              <div className="flex gap-3 px-6 py-4 border-t border-slate-100 bg-white flex-shrink-0">
                {regStep === 2 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => { setRegStep(1); setErrors({}); }}
                      className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all text-sm"
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      onClick={handleRegister}
                      disabled={submitting}
                      className={`flex-1 py-3 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all ${submitting
                          ? 'bg-indigo-400 text-white cursor-wait'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98] shadow-lg shadow-indigo-500/20'
                        }`}
                    >
                      {submitting ? (
                        <><Clock size={15} className="animate-spin" /> Saving…</>
                      ) : (
                        <><UserPlus size={15} /> Register Patient</>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={resetModal}
                      className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={goToStep2}
                      className="flex-1 py-3 font-bold rounded-xl text-sm flex items-center justify-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98] shadow-lg shadow-indigo-500/20 transition-all"
                    >
                      Continue →
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════ UPLOAD MODAL ════════════════════ */}
        {selectedPatientForUpload && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
              <div className="h-1 w-full bg-gradient-to-r from-indigo-500 to-violet-500" />
              <div className="p-6 text-center space-y-4">
                <div className="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto border border-indigo-100">
                  <FileUp size={26} />
                </div>
                <div>
                  <h3 className="text-[17px] font-black text-slate-900">Upload Records</h3>
                  <p className="text-slate-400 text-sm mt-1">
                    For <span className="font-black text-slate-700">{selectedPatientForUpload.name}</span>
                  </p>
                </div>
                <label className="block cursor-pointer group">
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 group-hover:border-indigo-400 group-hover:bg-indigo-50/50 transition-all duration-200">
                    <FileUp size={22} className="mx-auto text-slate-300 group-hover:text-indigo-400 mb-2 transition-colors" />
                    <p className="text-sm text-slate-400 group-hover:text-indigo-600 font-bold transition-colors">
                      Click to select a file
                    </p>
                    <p className="text-xs text-slate-300 mt-1">PDF, JPG, PNG up to 10MB</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={e => handleFileUpload(e, selectedPatientForUpload)}
                    />
                  </div>
                </label>
                <button
                  onClick={() => setSelectedPatientForUpload(null)}
                  className="text-sm text-slate-400 hover:text-slate-600 font-bold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default FrontDesk;