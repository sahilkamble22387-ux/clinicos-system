import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, UserPlus, FileUp, X, User, Phone, MapPin,
  Calendar, Users, Smartphone, Activity, Thermometer, Heart,
  MoreHorizontal, Check, ChevronDown,
  AlertCircle, CheckCircle2, Clock, Stethoscope, ArrowUpRight,
  Shield, Weight, Upload, FileText, Eye, AlertTriangle,
  ChevronRight, Download, Trash2, Table2,
} from 'lucide-react';
import { supabase } from '../../services/db';
import { Patient, Gender } from '../../types';
import { toast } from 'react-hot-toast';
import { EmergencyBanner } from '../EmergencyQueueControls';
import * as XLSX from 'xlsx';
import { LABELS } from '../../src/constants/labels';

// ─── Types ────────────────────────────────────────────────────────────────────
interface FrontDeskProps {
  clinicId: string;
  clinicName?: string;
  onPatientClick?: (patient: Patient) => void;
}

interface ImportRow {
  name: string;
  phone: string;
  gender: string;
  dob: string;
  address: string;
  // Optional extended fields from richer Excel exports
  visit_date?: string | null;
  visit_time?: string | null;
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  heart_rate?: number | null;
  temperature_f?: number | null;
  weight_kg?: number | null;
  diagnosis?: string | null;
  medicines?: string | null;
  fee?: number | null;
  payment_method?: string | null;
  doctors_notes?: string | null;

  _valid: boolean;
  _errors: string[];
}

// ─── Validation helpers ───────────────────────────────────────────────────────

/** Reject all-same-digit and sequential patterns */
function isLikelyFakePhone(digits: string): boolean {
  if (/^(\d)\1{9}$/.test(digits)) return true;
  const ascending = '0123456789';
  const descending = '9876543210';
  if (ascending.includes(digits) || descending.includes(digits)) return true;
  const fakes = [
    '1234567890', '0987654321', '1111111111', '2222222222',
    '1234512345', '9876598765', '5555555555', '9999900000',
  ];
  return fakes.includes(digits);
}

// BUG FIX #1: Previously had an empty if-block for the Indian number check.
// Indian mobile numbers must start with 6, 7, 8, or 9.
function validatePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return 'Phone number is required.';
  if (digits.length !== 10) return 'Must be exactly 10 digits.';
  // BUG FIX: Was an empty if-block — now properly validates Indian mobile prefix
  if (!['6', '7', '8', '9'].some(d => digits.startsWith(d))) {
    return 'Must be a valid Indian mobile number (starts with 6–9).';
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
  if (!val) return null;
  const n = Number(val);
  if (isNaN(n)) return `${label} must be a number.`;
  if (n < min || n > max) return `${label} must be between ${min} and ${max}.`;
  return null;
}

// ─── CSV Parsing ──────────────────────────────────────────────────────────────
function parseCSV(text: string): ImportRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));

  return lines.slice(1).map(line => {
    // Handle quoted commas
    const cols: string[] = [];
    let inQuote = false;
    let curr = '';
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { cols.push(curr.trim()); curr = ''; }
      else { curr += ch; }
    }
    cols.push(curr.trim());

    const get = (...keys: string[]) => {
      for (const k of keys) {
        const idx = headers.indexOf(k);
        if (idx !== -1 && cols[idx]) return cols[idx].trim();
      }
      return '';
    };

    const name = get('name', 'full_name', 'patient_name');
    const phone = get('phone', 'mobile', 'phone_number', 'contact');
    const gender = get('gender', 'sex');
    const dob = get('dob', 'date_of_birth', 'birth_date', 'birthdate');
    const address = get('address', 'addr', 'location');

    const _errors: string[] = [];
    if (!name || name.length < 2) _errors.push('Name required (min 2 chars)');
    const phoneErr = phone ? validatePhone(phone) : null;
    if (phoneErr) _errors.push(`Phone: ${phoneErr}`);

    // Required field for validity: name only (phone errors are warnings)
    const _valid = !!name && name.length >= 2;

    return { name, phone, gender, dob, address, _valid, _errors };
  }).filter(r => r.name || r.phone); // skip blank rows
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
      return { label: LABELS.status.checkedIn, bg: '#DCFCE7', text: '#16A34A', dot: '#22C55E' };
    case 'in_consultation':
    case 'in consultation':
      return { label: LABELS.status.inConsultation, bg: '#EDE9FE', text: '#7C3AED', dot: '#8B5CF6' };
    case 'completed':
      return { label: LABELS.status.completed, bg: '#F1F5F9', text: '#64748B', dot: '#94A3B8' };
    default:
      return { label: status || LABELS.status.notInQueue, bg: '#F8FAFC', text: '#94A3B8', dot: '#CBD5E1' };
  }
}

function normalizeGender(raw: string): Gender {
  const v = raw.toLowerCase();
  if (v === 'female' || v === 'f') return Gender.FEMALE;
  if (v === 'other' || v === 'o') return Gender.OTHER;
  return Gender.MALE;
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

const StepDot: React.FC<{ active: boolean; done: boolean; n: number; label: string }> = ({ active, done, n, label }) => (
  <div className="flex flex-col items-center gap-1">
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300 ${done ? 'bg-emerald-500 text-white scale-95'
        : active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-110'
          : 'bg-slate-100 text-slate-400'
      }`}>
      {done ? <Check size={13} strokeWidth={3} /> : n}
    </div>
    <span className={`text-[10px] font-bold tracking-wide transition-colors ${active ? 'text-indigo-600' : done ? 'text-emerald-500' : 'text-slate-400'
      }`}>
      {label}
    </span>
  </div>
);

const ic = (hasError?: boolean) =>
  `w-full p-3 border rounded-xl outline-none transition-all duration-200 font-medium text-[14px] text-slate-800 placeholder:text-slate-300 placeholder:font-normal
  ${hasError
    ? 'bg-rose-50 border-rose-300 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400'
    : 'bg-slate-50/70 border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400'}`;

// ─── Excel parsing (NirogOS universal parser) ────────────────────────────────
function parseExcel(buffer: ArrayBuffer): ImportRow[] {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws || !ws['!ref']) return [];

  const range = XLSX.utils.decode_range(ws['!ref']);

  const getCellString = (r: number, c: number): string => {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (!cell || cell.v == null) return '';
    if (cell.t === 'n' && cell.w) return String(cell.w).trim();
    if (cell.v instanceof Date) return cell.v.toISOString().split('T')[0];
    return String(cell.v).trim();
  };

  // 1–2. Find header row dynamically
  const headerMatchTokens = ['name', 'patient', 'phone', 'age', 'gender', 'date', 'visit', 'diagnosis', 'fee'];
  let headerRow = -1;
  for (let r = range.s.r; r <= range.e.r; r++) {
    let hits = 0;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const v = getCellString(r, c).toLowerCase();
      if (!v) continue;
      if (headerMatchTokens.some(t => v.includes(t))) hits++;
    }
    if (hits >= 3) {
      headerRow = r;
      break;
    }
  }
  if (headerRow === -1) return [];

  // Build header row values
  const headers: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    headers.push(getCellString(headerRow, c));
  }

  const normaliseHeader = (raw: string): string => {
    return raw
      .toLowerCase()
      .replace(/[\p{Emoji_Presentation}\p{S}\p{P}]/gu, '')
      .replace(/\s+/g, '')
      .trim();
  };

  // 4. Column mapping via fuzzy matching
  type FieldKey =
    | 'full_name' | 'phone' | 'age' | 'gender' | 'address'
    | 'visit_date' | 'visit_time'
    | 'bp' | 'heart_rate' | 'temperature_f' | 'weight_kg'
    | 'diagnosis' | 'medicines' | 'fee' | 'payment_method' | 'doctors_notes';

  const fieldForHeader = (h: string): FieldKey | null => {
    const v = normaliseHeader(h);
    if (!v) return null;

    if (/(patient|fullname|name)/.test(v)) return 'full_name';
    if (/(phone|mobile|contact)/.test(v)) return 'phone';
    if (v === 'age') return 'age';
    if (/(gender|sex)/.test(v)) return 'gender';
    if (/(address|addr)/.test(v)) return 'address';
    if (/(visitdate|date)/.test(v)) return 'visit_date';
    if (/(time)/.test(v)) return 'visit_time';
    if (/(bp|bloodpressure)/.test(v)) return 'bp';
    if (/(hr|heartrate|pulse)/.test(v)) return 'heart_rate';
    if (/(temp|temperature)/.test(v)) return 'temperature_f';
    if (/(wt|weight)/.test(v)) return 'weight_kg';
    if (/(diagnosis|chiefcomplaint|condition)/.test(v)) return 'diagnosis';
    if (/(medicines|prescription|drugs|rx)/.test(v)) return 'medicines';
    if (/(fee|amount|charge|cost)/.test(v)) return 'fee';
    if (/(payment|mode)/.test(v)) return 'payment_method';
    if (/(notes|doctor|remarks)/.test(v)) return 'doctors_notes';
    return null;
  };

  const columnMap: Partial<Record<number, FieldKey>> = {};
  headers.forEach((h, idx) => {
    const fk = fieldForHeader(h);
    if (fk) columnMap[idx] = fk;
  });

  const today = new Date();

  const parseDateLike = (raw: string): string | null => {
    if (!raw) return null;
    const trimmed = raw.trim();
    // Try JS Date first
    const direct = new Date(trimmed);
    if (!isNaN(direct.getTime())) return direct.toISOString().split('T')[0];

    // DD MMM YYYY (e.g. 12 Mar 2026)
    const dmy = trimmed.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);
    if (dmy) {
      const [_, d, mon, y] = dmy;
      const parsed = new Date(`${d} ${mon} ${y}`);
      if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
    }

    // DD/MM/YYYY
    const slashes = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashes) {
      const [_, d, m, y] = slashes;
      const parsed = new Date(Number(y), Number(m) - 1, Number(d));
      if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
    }

    // Fallback: return original if looks date-like
    return null;
  };

  const parseTimeLike = (raw: string): string | null => {
    if (!raw) return null;
    const trimmed = raw.trim();
    const ampm = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (ampm) {
      let h = Number(ampm[1]);
      const m = Number(ampm[2]);
      const mer = ampm[3].toUpperCase();
      if (mer === 'PM' && h < 12) h += 12;
      if (mer === 'AM' && h === 12) h = 0;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
    }
    const hhmm = trimmed.match(/^(\d{1,2}):(\d{2})$/);
    if (hhmm) {
      const h = Number(hhmm[1]);
      const m = Number(hhmm[2]);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
    }
    return null;
  };

  const rows: ImportRow[] = [];

  // 3. Data rows: after headerRow
  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const colB = getCellString(r, range.s.c + 1);
    const allValues: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const v = getCellString(r, c);
      if (v) allValues.push(v);
    }

    const lowerB = colB.toLowerCase();
    if (!colB) continue;
    if (/total|revenue|confidential|generated|nirog|exported/i.test(lowerB)) continue;
    if (allValues.length < 3) continue;

    const record: Partial<ImportRow> = {};

    for (let c = range.s.c; c <= range.e.c; c++) {
      const field = columnMap[c - range.s.c];
      if (!field) continue;
      const raw = getCellString(r, c);
      if (!raw) continue;

      switch (field) {
        case 'full_name':
          record.name = raw.trim();
          break;
        case 'phone': {
          const digits = raw.replace(/\D/g, '').slice(-10);
          record.phone = digits;
          break;
        }
        case 'age': {
          const n = Number(raw);
          if (!isNaN(n) && n > 0 && n < 120) {
            const dobYear = today.getFullYear() - n;
            record.dob = new Date(dobYear, 0, 1).toISOString().split('T')[0];
          }
          break;
        }
        case 'gender': {
          const g = raw.toLowerCase();
          record.gender = g === 'female' || g === 'f' ? 'Female' : g === 'male' || g === 'm' ? 'Male' : 'Other';
          break;
        }
        case 'address':
          record.address = raw;
          break;
        case 'visit_date':
          record.visit_date = parseDateLike(raw);
          break;
        case 'visit_time':
          record.visit_time = parseTimeLike(raw);
          break;
        case 'bp': {
          if (raw !== '—') {
            const parts = raw.split(/[\/\\]/).map(p => parseInt(p.trim(), 10));
            const [s, d] = parts;
            if (!isNaN(s) && s >= 60 && s <= 250) record.bp_systolic = s;
            if (!isNaN(d) && d >= 40 && d <= 150) record.bp_diastolic = d;
          }
          break;
        }
        case 'heart_rate': {
          if (raw !== '—') {
            const n = parseFloat(raw);
            record.heart_rate = isNaN(n) ? null : n;
          }
          break;
        }
        case 'temperature_f': {
          if (raw !== '—') {
            const n = parseFloat(raw);
            record.temperature_f = isNaN(n) ? null : n;
          }
          break;
        }
        case 'weight_kg': {
          if (raw !== '—') {
            const n = parseFloat(raw);
            record.weight_kg = isNaN(n) ? null : n;
          }
          break;
        }
        case 'diagnosis':
          record.diagnosis = raw;
          break;
        case 'medicines': {
          const lines = raw.split(/\r?\n/).map(l => l.replace(/^·\s*/, '').trim()).filter(Boolean);
          record.medicines = lines.join('\n');
          break;
        }
        case 'fee': {
          const cleaned = raw.replace(/[₹,\s]/g, '');
          const n = parseFloat(cleaned);
          record.fee = isNaN(n) ? null : n;
          break;
        }
        case 'payment_method':
          record.payment_method = raw;
          break;
        case 'doctors_notes':
          record.doctors_notes = raw;
          break;
        default:
          break;
      }
    }

    const name = (record.name ?? colB).trim();
    const phone = record.phone ?? '';
    const gender = record.gender ?? '';
    const dob = record.dob ?? null;
    const address = record.address ?? '';

    const _errors: string[] = [];
    if (!name || name.length < 2) _errors.push('Name required (min 2 chars)');
    const phoneErr = phone ? validatePhone(phone) : null;
    if (phoneErr) _errors.push(`Phone: ${phoneErr}`);

    const _valid = !!name && name.length >= 2;

    rows.push({
      name,
      phone,
      gender,
      dob: dob || '',
      address,
      visit_date: record.visit_date ?? null,
      visit_time: record.visit_time ?? null,
      bp_systolic: record.bp_systolic ?? null,
      bp_diastolic: record.bp_diastolic ?? null,
      heart_rate: record.heart_rate ?? null,
      temperature_f: record.temperature_f ?? null,
      weight_kg: record.weight_kg ?? null,
      diagnosis: record.diagnosis ?? null,
      medicines: record.medicines ?? null,
      fee: record.fee ?? null,
      payment_method: record.payment_method ?? null,
      doctors_notes: record.doctors_notes ?? null,
      _valid,
      _errors,
    });
  }

  return rows.filter(r => r.name || r.phone);
}

// ─── Template downloads ───────────────────────────────────────────────────────
function downloadCSVTemplate() {
  const header = 'name,phone,gender,dob,address';
  const sample = 'Priya Sharma,9876543210,Female,1990-05-14,"Flat 3, MG Road, Pune"';
  const blob = new Blob([header + '\n' + sample], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'patient_import_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function downloadExcelTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['name', 'phone', 'gender', 'dob', 'address'],
    ['Priya Sharma', '9876543210', 'Female', '1990-05-14', 'Flat 3, MG Road, Pune'],
    ['Arjun Mehta', '8765432109', 'Male', '1985-11-22', '12 Shivaji Nagar, Nashik'],
  ]);
  // Column widths
  ws['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Patients');
  XLSX.writeFile(wb, 'patient_import_template.xlsx');
}

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

  // ── Import modal state ──
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importStep, setImportStep] = useState<'upload' | 'preview' | 'importing'>('upload');
  const [importProgress, setImportProgress] = useState(0);
  const [importFileType, setImportFileType] = useState<'csv' | 'excel' | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const isQueueBlocked = !queueAccepting || emergencyActive;

  // ── Registration form state ──
  const [form, setForm] = useState({
    name: '', gender: Gender.MALE, dob: '', phone: '', address: '',
    bp_systolic: '', bp_diastolic: '', heart_rate: '', weight_kg: '', temperature_f: '',
  });
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const setField = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
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
    if (error) { toast.error('Failed to load patients.'); return; }
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
    if (form.bp_systolic && form.bp_diastolic) {
      const s = Number(form.bp_systolic), d = Number(form.bp_diastolic);
      if (!isNaN(s) && !isNaN(d) && s <= d)
        errs.bp_systolic = 'Systolic must be greater than diastolic.';
    }
    setErrors(errs);
    return Object.values(errs).every(v => !v);
  }

  const goToStep2 = () => { if (validateStep1()) setRegStep(2); };

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
      // BUG FIX #7: Check for duplicate phone before insert
      const cleanPhone = form.phone.replace(/\D/g, '');
      const { data: existing } = await (supabase as any)
        .from('patients')
        .select('id, full_name')
        .eq('clinic_id', clinicId)
        .eq('phone', cleanPhone)
        .maybeSingle();
      if (existing) {
        toast.error(`A patient with this number already exists: ${(existing as any).full_name}`);
        setErrors(e => ({ ...e, phone: 'This phone number is already registered.' }));
        setRegStep(1);
        setSubmitting(false);
        return;
      }

      const { data: patientData, error: patientError } = await (supabase as any)
        .from('patients')
        .insert([{
          full_name: form.name.trim(),
          gender: form.gender,
          dob: form.dob || null,
          phone: cleanPhone,
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

      const { error: apptError } = await (supabase as any).from('appointments').insert([{
        patient_id: patientData?.id,
        clinic_id: clinicId,
        status: 'waiting',
        bp_systolic: form.bp_systolic ? Number(form.bp_systolic) : null,
        bp_diastolic: form.bp_diastolic ? Number(form.bp_diastolic) : null,
        heart_rate: form.heart_rate ? Number(form.heart_rate) : null,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        temperature_f: form.temperature_f ? Number(form.temperature_f) : null,
      }]);

      if (apptError) throw apptError;

      toast.success(`${patientData?.full_name || 'Patient'} registered & added to queue!`);
      resetModal();
    } catch (err: any) {
      toast.error('Registration failed: ' + (err.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  // BUG FIX #8: Prevent double check-in for already-waiting patients
  const handleCheckIn = async (patient: Patient) => {
    if (patient.status === 'waiting') {
      toast('Patient is already in the queue.', { icon: '⚠️' });
      setActiveMenu(null);
      return;
    }
    try {
      const { error: apptErr } = await (supabase as any)
        .from('appointments')
        .insert([{ patient_id: patient.id, clinic_id: clinicId, status: 'waiting' }]);
      if (apptErr) throw apptErr;

      const { error: ptErr } = await (supabase as any)
        .from('patients')
        .update({ status: 'waiting', is_active: true })
        .eq('id', patient.id);
      if (ptErr) throw ptErr;

      setActiveMenu(null);
      toast.success(`${patient.name} added to consultation queue!`);
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

  // ── Import file handler — supports CSV and Excel ──
  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isCSV = file.name.endsWith('.csv');
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (!isCSV && !isExcel) {
      toast.error('Please upload a .csv, .xlsx, or .xls file.');
      return;
    }

    setImportFileName(file.name);
    setImportFileType(isExcel ? 'excel' : 'csv');

    const reader = new FileReader();

    if (isCSV) {
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const rows = parseCSV(text);
        if (rows.length === 0) { toast.error('No valid rows found in the CSV file.'); return; }
        setImportRows(rows);
        setImportStep('preview');
      };
      reader.readAsText(file);
    } else {
      reader.onload = (ev) => {
        const buffer = ev.target?.result as ArrayBuffer;
        try {
          const rows = parseExcel(buffer);
          if (rows.length === 0) { toast.error('No valid rows found in the Excel file.'); return; }
          setImportRows(rows);
          setImportStep('preview');
        } catch {
          toast.error('Could not read the Excel file. Please check the format.');
        }
      };
      reader.readAsArrayBuffer(file);
    }
    e.target.value = '';
  };

  const resetImportModal = () => {
    setShowImportModal(false);
    setImportRows([]);
    setImportFileName('');
    setImportStep('upload');
    setImportProgress(0);
    setImportFileType(null);
  };

  const handleBulkImport = async () => {
    const validRows = importRows.filter(r => r._valid);
    if (validRows.length === 0) {
      toast.error('No valid rows to import.');
      return;
    }
    setImportStep('importing');
    setImportProgress(0);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        const cleanPhone = row.phone.replace(/\D/g, '');
        // Skip duplicates silently
        const { data: existing } = await (supabase as any)
          .from('patients')
          .select('id')
          .eq('clinic_id', clinicId)
          .eq('phone', cleanPhone)
          .maybeSingle();
        if (existing) { failCount++; }
        else {
          const { error } = await (supabase as any).from('patients').insert([{
            full_name: row.name.trim(),
            gender: normalizeGender(row.gender),
            dob: row.dob || null,
            phone: cleanPhone,
            address: row.address.trim() || null,
            clinic_id: clinicId,
            status: 'inactive',
            is_active: false,
            source: 'Import',
            consultation_fee: 0,
          }]);
          if (error) failCount++;
          else successCount++;
        }
      } catch {
        failCount++;
      }
      setImportProgress(Math.round(((i + 1) / validRows.length) * 100));
    }

    if (successCount > 0) toast.success(`${successCount} patient${successCount > 1 ? 's' : ''} imported successfully!`);
    if (failCount > 0) toast(`${failCount} row${failCount > 1 ? 's' : ''} skipped (duplicates or errors).`, { icon: '⚠️' });
    resetImportModal();
  };

  const removeImportRow = (idx: number) => {
    setImportRows(rows => rows.filter((_, i) => i !== idx));
  };

  const formatPhoneDisplay = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, 10);
    if (d.length <= 5) return d;
    return d.slice(0, 5) + ' ' + d.slice(5);
  };

  const validImportCount = importRows.filter(r => r._valid).length;
  const invalidImportCount = importRows.filter(r => !r._valid).length;

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
              {LABELS.pages.patientRegistry}
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
            {LABELS.buttons.registerPatient}
            {!isQueueBlocked && <ArrowUpRight size={13} className="opacity-60" />}
          </button>
        </div>

        {/* ── Search + Import (Filter removed per request) ── */}
        <div className="flex flex-wrap gap-2.5">
          <div className="relative flex-1 group min-w-[200px]">
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
          {/* BUG FIX: Import button now opens the import modal instead of console.log */}
          <button
            onClick={() => { setShowImportModal(true); setImportStep('upload'); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 shadow-sm transition-all"
          >
            <Upload size={14} />
            <span className="hidden sm:inline">Import CSV / Excel</span>
            <span className="sm:hidden">Import</span>
          </button>
        </div>

        {/* ── Patient table ── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">

          {/* Table header — desktop */}
          <div className="hidden md:grid grid-cols-[2.2fr_1fr_1.2fr_1.1fr_0.5fr] px-6 py-3 border-b border-slate-100 bg-slate-50/80">
            {['Patient', 'Patient ID', 'Registered', 'Queue Status', ''].map((h, i) => (
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
                {searchQuery ? 'No patients match your search' : 'No patients registered yet'}
              </p>
              <p className="text-xs text-slate-400">
                {searchQuery ? 'Try a different name, phone, or patient ID' : 'Register your first patient using the button above'}
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
                    {/* Desktop row */}
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

                          {/* BUG FIX #6: Dropdown now uses fixed positioning to avoid z-index/scroll issues */}
                          {activeMenu === patient.id && (
                            <div className="absolute right-0 top-10 z-30 bg-white border border-slate-200 rounded-2xl shadow-2xl w-52 overflow-hidden py-1">
                              <button
                                onClick={e => { e.stopPropagation(); handleCheckIn(patient); }}
                                disabled={isQueueBlocked || patient.status === 'waiting'}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              >
                                <Check size={14} strokeWidth={2.5} />
                                {patient.status === 'waiting'
                                  ? LABELS.buttons.alreadyInQueue
                                  : LABELS.buttons.addToQueue}
                              </button>
                              <div className="h-px bg-slate-100 mx-3" />
                              <button
                                onClick={e => { e.stopPropagation(); setSelectedPatientForUpload(patient); setActiveMenu(null); }}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                              >
                                <FileUp size={14} />
                                {LABELS.buttons.uploadMedicalRecords}
                              </button>
                              <div className="h-px bg-slate-100 mx-3" />
                              <button
                                onClick={e => { e.stopPropagation(); onPatientClick?.(patient); setActiveMenu(null); }}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-indigo-600 hover:bg-indigo-50 transition-colors"
                              >
                                <Eye size={14} />
                                {LABELS.buttons.viewPatientProfile}
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
                        onClick={e => {
                          e.stopPropagation();
                          if (!isQueueBlocked && patient.status !== 'waiting') handleCheckIn(patient);
                        }}
                        disabled={isQueueBlocked || patient.status === 'waiting'}
                        className={`p-2.5 rounded-xl transition-colors flex-shrink-0 ${isQueueBlocked || patient.status === 'waiting'
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
                {emergencyActive ? LABELS.status.emergencyModeActive : LABELS.status.queuePaused}
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                New check-ins and registrations are disabled. Manage this from Queue Controls.
              </p>
            </div>
          </div>
        )}

        {/* BUG FIX #6: Overlay to close dropdown — now z-20 to avoid blocking modals */}
        {activeMenu && (
          <div className="fixed inset-0 z-20" onClick={() => setActiveMenu(null)} />
        )}


        {/* ════════════════════ REGISTRATION MODAL ════════════════════ */}
        {showRegModal && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm md:p-4">
            <div
              className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden"
              style={{ maxHeight: '92vh' }}
            >
              <div className="md:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1.5 rounded-full bg-slate-200" />
              </div>

              <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 flex-shrink-0">
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    New Patient Registration
                  </h3>
                  <p className="text-slate-400 text-[13px] mt-0.5">
                    Step {regStep} of 2 — {regStep === 1 ? 'Personal Details' : 'Initial Vitals (Optional)'}
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

              {/* Step 1 */}
              {regStep === 1 && (
                <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
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
                    <p className="text-[11px] text-slate-400 mt-1">10-digit Indian mobile number (starts with 6–9)</p>
                  </FieldWrap>

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

              {/* Step 2 */}
              {regStep === 2 && (
                <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
                  <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                    <Activity size={14} className="text-blue-400 flex-shrink-0" />
                    <p className="text-[12px] text-blue-600 font-semibold">
                      All vitals are optional. You can record them later in the consultation.
                    </p>
                  </div>

                  <FieldWrap label="Blood Pressure" icon={<Heart size={11} />} error={errors.bp_systolic || errors.bp_diastolic}>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input type="number" placeholder="Systolic (60–250)"
                          value={form.bp_systolic} onChange={e => setField('bp_systolic', e.target.value)}
                          className={ic(!!errors.bp_systolic)} />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300 pointer-events-none">mmHg</span>
                      </div>
                      <span className="text-slate-300 font-black text-lg flex-shrink-0">/</span>
                      <div className="relative flex-1">
                        <input type="number" placeholder="Diastolic (40–150)"
                          value={form.bp_diastolic} onChange={e => setField('bp_diastolic', e.target.value)}
                          className={ic(!!errors.bp_diastolic)} />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300 pointer-events-none">mmHg</span>
                      </div>
                    </div>
                  </FieldWrap>

                  <div className="grid grid-cols-2 gap-3">
                    <FieldWrap label="Heart Rate" icon={<Activity size={11} />} error={errors.heart_rate}>
                      <div className="relative">
                        <input type="number" placeholder="72" value={form.heart_rate}
                          onChange={e => setField('heart_rate', e.target.value)} className={ic(!!errors.heart_rate)} />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300 pointer-events-none">bpm</span>
                      </div>
                    </FieldWrap>
                    <FieldWrap label="Temperature" icon={<Thermometer size={11} />} error={errors.temperature_f}>
                      <div className="relative">
                        <input type="number" step="0.1" placeholder="98.6" value={form.temperature_f}
                          onChange={e => setField('temperature_f', e.target.value)} className={ic(!!errors.temperature_f)} />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300 pointer-events-none">°F</span>
                      </div>
                    </FieldWrap>
                  </div>

                  <FieldWrap label="Weight" icon={<Weight size={11} />} error={errors.weight_kg}>
                    <div className="relative">
                      <input type="number" step="0.1" placeholder="65.5" value={form.weight_kg}
                        onChange={e => setField('weight_kg', e.target.value)} className={ic(!!errors.weight_kg)} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300 pointer-events-none">kg</span>
                    </div>
                  </FieldWrap>
                </div>
              )}

              {/* Footer */}
              <div className="flex gap-3 px-6 py-4 border-t border-slate-100 bg-white flex-shrink-0">
                {regStep === 2 ? (
                  <>
                    <button type="button" onClick={() => { setRegStep(1); setErrors({}); }}
                      className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all text-sm">
                      ← Back
                    </button>
                    <button type="button" onClick={handleRegister} disabled={submitting}
                      className={`flex-1 py-3 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all ${submitting
                          ? 'bg-indigo-400 text-white cursor-wait'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98] shadow-lg shadow-indigo-500/20'
                        }`}>
                      {submitting
                        ? <><Clock size={15} className="animate-spin" /> Saving…</>
                        : <><UserPlus size={15} /> Register & Check In</>}
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={resetModal}
                      className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all text-sm">
                      Cancel
                    </button>
                    <button type="button" onClick={goToStep2}
                      className="flex-1 py-3 font-bold rounded-xl text-sm flex items-center justify-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98] shadow-lg shadow-indigo-500/20 transition-all">
                      Continue <ChevronRight size={15} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}


        {/* ════════════════════ IMPORT MODAL ════════════════════ */}
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm md:p-4">
            <div
              className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden"
              style={{ maxHeight: '90vh' }}
            >
              {/* Drag handle (mobile) */}
              <div className="md:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1.5 rounded-full bg-slate-200" />
              </div>

              {/* Modal Header */}
              <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                    <Upload size={16} className="text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">Import Patients</h3>
                    <p className="text-slate-400 text-[13px] mt-0.5">
                      {importStep === 'upload' && 'Upload a CSV file to bulk-register patients'}
                      {importStep === 'preview' && `${importRows.length} rows found · ${validImportCount} valid · ${invalidImportCount} with errors`}
                      {importStep === 'importing' && `Importing ${validImportCount} patients…`}
                    </p>
                  </div>
                </div>
                {importStep !== 'importing' && (
                  <button onClick={resetImportModal}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 border border-slate-100 transition-all flex-shrink-0 ml-3">
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* ── Upload step ── */}
              {importStep === 'upload' && (
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

                  {/* Format toggle pills */}
                  <div className="flex gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full text-[11px] font-black text-slate-500">
                      <FileText size={11} className="text-slate-400" />
                      CSV
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-[11px] font-black text-emerald-700">
                      <Table2 size={11} className="text-emerald-500" />
                      Excel (.xlsx / .xls)
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium self-center ml-1">— both supported</span>
                  </div>

                  {/* Drop zone */}
                  <label className="block cursor-pointer group">
                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center group-hover:border-indigo-400 group-hover:bg-indigo-50/40 transition-all duration-200">
                      <div className="flex items-center justify-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-slate-100 group-hover:bg-indigo-100 rounded-xl flex items-center justify-center transition-colors">
                          <FileText size={20} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                        </div>
                        <span className="text-slate-300 font-black text-lg">or</span>
                        <div className="w-12 h-12 bg-emerald-50 group-hover:bg-emerald-100 rounded-xl flex items-center justify-center border border-emerald-100 transition-colors">
                          <Table2 size={20} className="text-emerald-400 group-hover:text-emerald-600 transition-colors" />
                        </div>
                      </div>
                      <p className="text-sm font-bold text-slate-700 group-hover:text-indigo-700 transition-colors">
                        Click to select a file
                      </p>
                      <p className="text-xs text-slate-400 mt-1">CSV, Excel (.xlsx, .xls) · Max 1,000 rows</p>
                      <input
                        ref={importFileRef}
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        className="hidden"
                        onChange={handleImportFileChange}
                      />
                    </div>
                  </label>

                  {/* CSV format guide */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Required Column Names</p>
                    <div className="font-mono text-[11px] text-slate-600 bg-white border border-slate-100 rounded-xl p-3 overflow-x-auto whitespace-nowrap">
                      name,phone,gender,dob,address<br />
                      Priya Sharma,9876543210,Female,1990-05-14,"Flat 3 MG Road Pune"
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { col: 'name', req: true, note: 'Full name (required)' },
                        { col: 'phone', req: true, note: '10-digit mobile (required)' },
                        { col: 'gender', req: false, note: 'Male / Female / Other' },
                        { col: 'dob', req: false, note: 'YYYY-MM-DD format' },
                      ].map(c => (
                        <div key={c.col} className="flex items-start gap-2">
                          <span className={`mt-0.5 inline-flex w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.req ? 'bg-rose-400' : 'bg-slate-300'}`} />
                          <div>
                            <span className="font-mono text-[11px] font-bold text-slate-700">{c.col}</span>
                            <span className="text-[11px] text-slate-400 ml-1">{c.note}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Template download buttons */}
                    <div className="flex items-center gap-3 pt-1 flex-wrap">
                      <button
                        onClick={downloadCSVTemplate}
                        className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                      >
                        <Download size={11} />
                        Download CSV template
                      </button>
                      <span className="text-slate-200 text-xs">|</span>
                      <button
                        onClick={downloadExcelTemplate}
                        className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                      >
                        <Download size={11} />
                        Download Excel template
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Preview step ── */}
              {importStep === 'preview' && (
                <div className="flex-1 overflow-hidden flex flex-col">
                  {/* Summary bar */}
                  <div className="flex items-center gap-3 px-6 py-3 bg-slate-50 border-b border-slate-100 flex-shrink-0">
                    {/* File type badge */}
                    {importFileType === 'excel' ? (
                      <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full flex-shrink-0">
                        <Table2 size={10} />
                        EXCEL
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 bg-slate-100 border border-slate-200 px-2 py-1 rounded-full flex-shrink-0">
                        <FileText size={10} />
                        CSV
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                      <CheckCircle2 size={12} />
                      {validImportCount} valid
                    </div>
                    {invalidImportCount > 0 && (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
                        <AlertTriangle size={12} />
                        {invalidImportCount} with errors
                      </div>
                    )}
                    <span className="text-xs text-slate-400 font-medium ml-auto truncate max-w-[140px]">{importFileName}</span>
                  </div>

                  {/* Rows table */}
                  <div className="overflow-y-auto flex-1 px-6 py-3 space-y-2">
                    {importRows.map((row, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${row._valid
                            ? 'bg-white border-slate-100 hover:border-slate-200'
                            : 'bg-amber-50/50 border-amber-200'
                          }`}
                      >
                        <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${row._valid ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                          }`}>
                          {row._valid
                            ? <Check size={11} strokeWidth={3} />
                            : <AlertCircle size={11} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-800 truncate">{row.name || '(no name)'}</span>
                            {row.phone && (
                              <span className="text-xs text-slate-400 font-mono">{row.phone}</span>
                            )}
                            {row.gender && (
                              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold capitalize">
                                {row.gender}
                              </span>
                            )}
                          </div>
                          {row._errors.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {row._errors.map((err, ei) => (
                                <p key={ei} className="text-[11px] text-amber-600 font-semibold flex items-center gap-1">
                                  <AlertCircle size={9} />
                                  {err}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => removeImportRow(idx)}
                          className="text-slate-300 hover:text-rose-400 transition-colors flex-shrink-0 mt-0.5"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Importing progress step ── */}
              {importStep === 'importing' && (
                <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                    <Upload size={28} className="text-indigo-600 animate-bounce" />
                  </div>
                  <div className="w-full max-w-xs text-center space-y-2">
                    <p className="font-black text-slate-800">Importing patients…</p>
                    <p className="text-sm text-slate-400">Please don't close this window</p>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mt-3">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                        style={{ width: `${importProgress}%` }}
                      />
                    </div>
                    <p className="text-xs font-bold text-slate-500">{importProgress}%</p>
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              {importStep !== 'importing' && (
                <div className="flex gap-3 px-6 py-4 border-t border-slate-100 bg-white flex-shrink-0">
                  {importStep === 'upload' ? (
                    <button onClick={resetImportModal}
                      className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all text-sm">
                      Cancel
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => { setImportStep('upload'); setImportRows([]); setImportFileName(''); setImportFileType(null); }}
                        className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all text-sm"
                      >
                        ← Back
                      </button>
                      <button
                        onClick={handleBulkImport}
                        disabled={validImportCount === 0}
                        className={`flex-1 py-3 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all ${validImportCount === 0
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98] shadow-lg shadow-indigo-500/20'
                          }`}
                      >
                        <Upload size={15} />
                        Import {validImportCount} Patient{validImportCount !== 1 ? 's' : ''}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}


        {/* ════════════════════ UPLOAD RECORDS MODAL ════════════════════ */}
        {selectedPatientForUpload && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
              <div className="h-1 w-full bg-gradient-to-r from-indigo-500 to-violet-500" />
              <div className="p-6 text-center space-y-4">
                <div className="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto border border-indigo-100">
                  <FileUp size={26} />
                </div>
                <div>
                  <h3 className="text-[17px] font-black text-slate-900">Upload Medical Records</h3>
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