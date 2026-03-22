import React, { useState, useEffect } from 'react';
import {
  Clock, User, ClipboardList, History, FileText, Send,
  Sparkles, Eye, Banknote, Activity, Heart, Thermometer,
  Stethoscope, Save, X, MessageCircle, Download, Loader2,
  ShieldAlert, AlertTriangle, Info, Store,
} from 'lucide-react';
import { downloadPrescriptionAndPrompt, PrescriptionForWhatsApp } from '../../services/whatsappPrescription';
import { PrescriptionForm, PrescriptionLine } from '../PrescriptionForm';
import { savePrescriptionAndGetLink, openWhatsAppWithPrescription } from '../../services/prescriptionService';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/db';
import { Visit, Patient, VisitStatus, Document, MedicalRecord } from '../../types';
import { summarizePatientHistory, generateClinicalSuggestions } from '../../services/geminiService';
import { analyzeVitals, VitalsRiskResult, RiskLevel, VitalFlag } from '../../services/vitalRiskEngine';
import { DoctorPharmacyNetwork, PharmacyDirectoryItem, fetchDoctorPharmacyNetwork } from '../../services/pharmacyService';
import QueueItem from './QueueItem';
import { toast } from 'react-hot-toast';
import { EmergencyQueueControls } from '../EmergencyQueueControls';
import Tutorial, { TUTORIAL_DONE_KEY } from '../Tutorial';
import WelcomePopup from '../WelcomePopup';

interface DoctorDashboardProps {
  clinicId: string;
}

const VitalInput: React.FC<{
  label: string; unit: string; value: string;
  onChange: (v: string) => void; color?: string;
}> = ({ label, unit, value, onChange, color = 'indigo' }) => (
  <div className="space-y-1">
    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</label>
    <div className="relative">
      <input
        style={{ fontSize: '16px' }}
        type="number" step="any" value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="—"
        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 text-sm font-semibold text-slate-800 placeholder:text-slate-300"
      />
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-semibold pointer-events-none">{unit}</span>
    </div>
  </div>
);

const LEVEL_STYLES = {
  critical: {
    wrap: 'bg-red-50 border-red-300', title: 'text-red-700', header: 'border-red-300',
    badge: 'bg-red-600 text-white', icon: <ShieldAlert size={15} className="text-red-600 flex-shrink-0" />,
    pill: 'bg-red-100 text-red-700', action: 'bg-red-100 text-red-700', combined: 'bg-red-100 border-red-200 text-red-800',
  },
  warning: {
    wrap: 'bg-amber-50 border-amber-300', title: 'text-amber-700', header: 'border-amber-300',
    badge: 'bg-amber-500 text-white', icon: <AlertTriangle size={15} className="text-amber-600 flex-shrink-0" />,
    pill: 'bg-amber-100 text-amber-700', action: 'bg-amber-100 text-amber-700', combined: 'bg-amber-100 border-amber-200 text-amber-800',
  },
  info: {
    wrap: 'bg-blue-50 border-blue-200', title: 'text-blue-700', header: 'border-blue-200',
    badge: 'bg-blue-500 text-white', icon: <Info size={15} className="text-blue-600 flex-shrink-0" />,
    pill: 'bg-blue-100 text-blue-700', action: 'bg-blue-100 text-blue-700', combined: 'bg-blue-100 border-blue-200 text-blue-800',
  },
} satisfies Record<RiskLevel, object>;

const LEVEL_LABELS: Record<RiskLevel, string> = {
  critical: '🚨 Critical Vitals Alert',
  warning: '⚠️ Vitals Warning',
  info: 'ℹ️ Vitals Note',
};

type PharmacyRoutingMode = 'default' | 'manual' | 'none';

const VitalsRiskBanner: React.FC<{ result: VitalsRiskResult }> = ({ result }) => {
  const { flags, highestLevel, combinedAlert } = result;
  if (!highestLevel) return null;
  const s = LEVEL_STYLES[highestLevel];
  return (
    <div className={`mt-4 rounded-2xl border-2 overflow-hidden ${s.wrap}`}>
      <div className={`px-4 py-2.5 flex items-center gap-2 border-b ${s.header}`}>
        {s.icon}
        <span className={`font-black text-sm ${s.title}`}>{LEVEL_LABELS[highestLevel]}</span>
        <span className={`ml-auto text-[10px] font-black px-2 py-0.5 rounded-full ${s.badge}`}>{flags.length} flag{flags.length !== 1 ? 's' : ''}</span>
      </div>
      {combinedAlert && (
        <div className={`mx-3 mt-3 px-3 py-2.5 rounded-xl border text-xs font-bold leading-relaxed ${s.combined}`}>{combinedAlert}</div>
      )}
      <div className="p-3 space-y-2">
        {flags.map((flag, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${s.pill}`}>{flag.vital}</span>
              <span className="text-xs font-black text-slate-700">{flag.value}</span>
            </div>
            <p className="text-xs text-slate-700 font-semibold leading-snug">{flag.message}</p>
            <div className={`mt-2 px-3 py-1.5 rounded-lg ${s.action}`}><p className="text-[11px] font-bold">→ {flag.action}</p></div>
          </div>
        ))}
      </div>
      <p className="px-4 pb-3 text-[9px] text-slate-400 italic">Rule-based clinical flags · Doctor view only · Always apply clinical judgment</p>
    </div>
  );
};

const DoctorDashboard: React.FC<DoctorDashboardProps> = ({ clinicId }) => {
  const [queue, setQueue] = useState<Visit[]>([]);
  const { clinicProfile, profile } = useAuth();

  const WELCOME_DONE_KEY = 'nirogos_welcome_popup_done';
  const [showWelcome, setShowWelcome] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    const welcomeDone = localStorage.getItem(WELCOME_DONE_KEY);
    const tutorialDone = localStorage.getItem(TUTORIAL_DONE_KEY);
    if (!welcomeDone) {
      const timer = setTimeout(() => setShowWelcome(true), 500);
      return () => clearTimeout(timer);
    } else if (!tutorialDone) {
      const timer = setTimeout(() => setShowTutorial(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const [activePatient, setActivePatient] = useState<Patient | null>(null);
  const [history, setHistory] = useState<MedicalRecord[]>([]);
  const [notes, setNotes] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [prescription, setPrescription] = useState<PrescriptionLine[]>([]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [consultationFee, setConsultationFee] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card' | 'Insurance'>('Cash');
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [vitalsForm, setVitalsForm] = useState({ bp_systolic: '', bp_diastolic: '', heart_rate: '', weight_kg: '', temperature_f: '' });
  const [vitalsLoaded, setVitalsLoaded] = useState(false);
  const [savingVitals, setSavingVitals] = useState(false);
  const [sending, setSending] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [sendingWA, setSendingWA] = useState(false);
  const [pharmacyNetwork, setPharmacyNetwork] = useState<DoctorPharmacyNetwork | null>(null);
  const [loadingPharmacies, setLoadingPharmacies] = useState(true);
  const [pharmacyRoutingMode, setPharmacyRoutingMode] = useState<PharmacyRoutingMode>('default');
  const [selectedPharmacyId, setSelectedPharmacyId] = useState('');

  const vitalsRisk: VitalsRiskResult = analyzeVitals(vitalsForm);

  const fetchQueue = async () => {
    const { data, error } = await (supabase as any)
      .from('appointments').select('*, patients(*)')
      .eq('clinic_id', clinicId).eq('status', 'waiting').order('created_at', { ascending: true });
    if (error) { console.error('Error fetching queue:', error); return; }
    if (data) {
      setQueue(data.map((item: any) => ({
        id: item.id, patientId: item.patient_id, arrivalTime: item.created_at,
        status: VisitStatus.WAITING, patientName: item.patients?.full_name, source: item.patients?.source,
      })));
    }
  };

  useEffect(() => {
    fetchQueue();
    const subscription = (supabase as any).channel('doctor-queue-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, fetchQueue)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, fetchQueue)
      .subscribe();
    return () => { (supabase as any).removeChannel(subscription); };
  }, [clinicId]);

  const refreshPharmacyNetwork = async () => {
    setLoadingPharmacies(true);
    try {
      const network = await fetchDoctorPharmacyNetwork(clinicId);
      setPharmacyNetwork(network);
      setSelectedPharmacyId((current) => {
        const selectedStillExists = network.directoryPharmacies.some((pharmacy) => pharmacy.id === current);
        if (selectedStillExists) return current;
        return network.defaultPharmacyId ?? network.directoryPharmacies[0]?.id ?? '';
      });
      setPharmacyRoutingMode((current) => {
        if (current === 'none') return current;
        if (current === 'manual' && network.directoryPharmacies.length > 0) return current;
        return network.defaultPharmacyId ? 'default' : network.directoryPharmacies.length > 0 ? 'manual' : 'none';
      });
    } catch (error) {
      console.error('Error loading pharmacy network:', error);
      toast.error('Could not load pharmacy directory.');
    } finally {
      setLoadingPharmacies(false);
    }
  };

  useEffect(() => {
    refreshPharmacyNetwork();
  }, [clinicId]);

  const directoryPharmacies = pharmacyNetwork?.directoryPharmacies ?? [];
  const linkedPharmacies = pharmacyNetwork?.linkedPharmacies ?? [];
  const defaultPharmacy = linkedPharmacies.find((pharmacy) => pharmacy.id === pharmacyNetwork?.defaultPharmacyId) ?? null;
  const selectedPharmacy = directoryPharmacies.find((pharmacy) => pharmacy.id === selectedPharmacyId) ?? null;
  const resolvedPharmacyId =
    pharmacyRoutingMode === 'none'
      ? null
      : pharmacyRoutingMode === 'manual'
        ? selectedPharmacyId || null
        : pharmacyNetwork?.defaultPharmacyId ?? null;
  const resolvedPharmacy = directoryPharmacies.find((pharmacy) => pharmacy.id === resolvedPharmacyId) ?? null;

  const getDoctorQualification = () => {
    const qualifications = clinicProfile?.qualifications;
    if (!qualifications) return null;
    return Array.isArray(qualifications) ? qualifications.join(', ') : qualifications;
  };

  const getVitalsPayload = () => (
    vitalsForm.bp_systolic || vitalsForm.heart_rate || vitalsForm.temperature_f || vitalsForm.weight_kg
      ? {
        bp_systolic: vitalsForm.bp_systolic ? Number(vitalsForm.bp_systolic) : null,
        bp_diastolic: vitalsForm.bp_diastolic ? Number(vitalsForm.bp_diastolic) : null,
        heart_rate: vitalsForm.heart_rate ? Number(vitalsForm.heart_rate) : null,
        weight_kg: vitalsForm.weight_kg ? Number(vitalsForm.weight_kg) : null,
        temperature_f: vitalsForm.temperature_f ? Number(vitalsForm.temperature_f) : null,
      }
      : null
  );

  const createMedicalRecord = async (patient: Patient) => {
    const { data: newRecord, error: recordError } = await (supabase as any)
      .from('medical_records')
      .insert([{
        patient_id: patient.id,
        diagnosis,
        prescription: JSON.stringify(prescription),
        doctor_notes: notes,
        clinic_id: clinicId,
        fee_collected: consultationFee,
        payment_method: paymentMethod,
      }])
      .select()
      .single();

    if (recordError) throw recordError;
    if (!newRecord) throw new Error('Could not create medical record');

    if (prescription.length > 0) {
      const { error: itemsError } = await (supabase as any).from('prescription_items').insert(
        prescription.map((med, index) => ({
          medical_record_id: newRecord.id,
          clinic_id: clinicId,
          medicine_name: med.medicine_name,
          dosage: `${med.timing[0]}-${med.timing[1]}-${med.timing[2]}`,
          duration: `${med.duration_value} ${med.duration_unit}`,
          sort_order: index,
        }))
      );

      if (itemsError) throw itemsError;
    }

    return newRecord;
  };

  const finalizeConsultation = async (visitId: string, patientId: string) => {
    await Promise.all([
      (supabase as any).from('appointments').update({ status: 'completed' }).eq('id', visitId),
      (supabase as any).from('patients').update({
        status: 'completed',
        consultation_fee: consultationFee,
        is_active: false,
        updated_at: new Date().toISOString(),
      }).eq('id', patientId),
    ]);
  };

  const resetConsultationWorkspace = () => {
    setActiveVisit(null);
    setActivePatient(null);
    setVitalsLoaded(false);
    setDiagnosis('');
    setPrescription([]);
    setNotes('');
  };

  const getRoutingSuccessMessage = (prefix: string) => {
    if (resolvedPharmacy) return `${prefix} ${resolvedPharmacy.name}.`;
    return 'Prescription saved for patient only.';
  };

  const startConsultation = async (visit: Visit) => {
    const { data: pData } = await (supabase as any).from('patients').select('*').eq('id', visit.patientId).single();
    if (pData) {
      const patient: Patient = {
        id: pData.id, name: pData.full_name, gender: pData.gender as any,
        dob: pData.dob, phone: pData.phone, address: pData.address, createdAt: pData.created_at,
      };
      const { data: records } = await (supabase as any).from('medical_records').select('*')
        .eq('patient_id', patient.id).order('created_at', { ascending: false });
      setActiveVisit(visit); setActivePatient(patient); setHistory(records || []);
      setAiSummary(null); setDiagnosis(''); setPrescription([]); setNotes(''); setConsultationFee(0);
      const { data: apptData } = await (supabase as any)
        .from('appointments').select('bp_systolic, bp_diastolic, heart_rate, weight_kg, temperature_f').eq('id', visit.id).single();
      setVitalsForm({
        bp_systolic: apptData?.bp_systolic?.toString() || '', bp_diastolic: apptData?.bp_diastolic?.toString() || '',
        heart_rate: apptData?.heart_rate?.toString() || '', weight_kg: apptData?.weight_kg?.toString() || '',
        temperature_f: apptData?.temperature_f?.toString() || '',
      });
      setVitalsLoaded(true);
    }
  };

  const saveVitals = async () => {
    if (!activeVisit) return;
    setSavingVitals(true);
    try {
      await (supabase as any).from('appointments').update({
        bp_systolic: vitalsForm.bp_systolic ? Number(vitalsForm.bp_systolic) : null,
        bp_diastolic: vitalsForm.bp_diastolic ? Number(vitalsForm.bp_diastolic) : null,
        heart_rate: vitalsForm.heart_rate ? Number(vitalsForm.heart_rate) : null,
        weight_kg: vitalsForm.weight_kg ? Number(vitalsForm.weight_kg) : null,
        temperature_f: vitalsForm.temperature_f ? Number(vitalsForm.temperature_f) : null,
      }).eq('id', activeVisit.id);
    } catch (err) { console.error('Error saving vitals:', err); }
    finally { setSavingVitals(false); }
  };

  // ── Save Only ─────────────────────────────────────────────────────
  const completeVisit = async () => {
    if (!activeVisit || !activePatient) return;
    if (prescription.length === 0) { toast.error('Add at least one medicine first'); return; }
    if (!diagnosis.trim()) { toast.error('Please enter a diagnosis first'); return; }

    const snapshotPatient = activePatient;
    const snapshotVisit = activeVisit;

    setSending(true);
    try {
      const doctorName = clinicProfile?.doctor_name ?? profile?.full_name ?? 'Doctor';
      const medicalRecord = await createMedicalRecord(snapshotPatient);
      const result = await savePrescriptionAndGetLink({
        clinicId,
        patientId: snapshotPatient.id,
        patientName: snapshotPatient.name,
        patientPhone: snapshotPatient.phone,
        patientAge: snapshotPatient.dob ? (new Date().getFullYear() - new Date(snapshotPatient.dob).getFullYear()).toString() : null,
        patientGender: snapshotPatient.gender,
        clinicName: clinicProfile?.clinic_name_override ?? (clinicProfile as any)?.name ?? 'Clinic',
        doctorName,
        doctorQualification: getDoctorQualification(),
        doctorRegistrationNo: clinicProfile?.registration_number ?? null,
        clinicAddress: clinicProfile?.clinic_address ?? null,
        clinicPhone: clinicProfile?.phone_number ?? null,
        doctorSignatureBase64: clinicProfile?.signature_base64 ?? null,
        medicalRecordId: medicalRecord.id,
        targetPharmacyId: resolvedPharmacyId,
        diagnosis,
        doctorNotes: notes,
        feeCollected: consultationFee,
        paymentMethod,
        medicines: prescription,
        vitals: getVitalsPayload(),
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to save prescription');
      }

      await finalizeConsultation(snapshotVisit.id, snapshotPatient.id);

      toast.success(`Saved successfully. ${getRoutingSuccessMessage('Prescription routed to')}`);
      resetConsultationWorkspace();
      fetchQueue();
    } catch (err: any) {
      console.error('Error completing visit:', err);
      toast.error('Failed to save: ' + err.message);
    } finally { setSending(false); }
  };

  const buildPrescriptionData = async (): Promise<PrescriptionForWhatsApp | null> => {
    if (!activeVisit || !activePatient) return null;
    const clinicName = clinicProfile?.clinic_name_override ?? (clinicProfile as any)?.name ?? 'Clinic';
    const doctorName = clinicProfile?.doctor_name ?? profile?.full_name ?? 'Doctor';

    function timingMeaning(t: [number, number, number]): string {
      const [m, a, n] = t;
      if (!m && !a && !n) return 'SOS / As needed';
      if (m && a && n) return '3 times daily';
      if (m && !a && n) return 'Morning & Night';
      if (m && a && !n) return 'Morning & Afternoon';
      if (!m && a && n) return 'Afternoon & Night';
      if (m && !a && !n) return 'Morning only';
      if (!m && a && !n) return 'Afternoon only';
      if (!m && !a && n) return 'Night only';
      return `${m}-${a}-${n}`;
    }

    return {
      clinicName, doctorName,
      doctorQualification: clinicProfile?.qualifications ? (Array.isArray(clinicProfile.qualifications) ? clinicProfile.qualifications.join(', ') : clinicProfile.qualifications) : null,
      doctorRegistrationNo: clinicProfile?.registration_number ?? null,
      clinicAddress: clinicProfile?.clinic_address ?? null,
      clinicPhone: clinicProfile?.phone_number ?? null,
      clinicEmail: clinicProfile?.clinic_email ?? null,
      doctorSignatureBase64: clinicProfile?.signature_base64 ?? null,
      patientName: activePatient.name, patientPhone: activePatient.phone,
      patientAge: activePatient.dob ? (new Date().getFullYear() - new Date(activePatient.dob).getFullYear()).toString() : null,
      patientGender: activePatient.gender, diagnosis,
      medicines: prescription.map(m => ({
        medicine_name: m.medicine_name, strength: m.strength || null, form: m.form || null,
        dosage: `${m.timing[0]}-${m.timing[1]}-${m.timing[2]}`,
        timing_meaning: timingMeaning(m.timing as [number, number, number]),
        food_relation: m.food_relation || null,
        duration: `${m.duration_value} ${m.duration_unit}`, instructions: m.instructions || null,
      })),
      doctorNotes: notes || null, feeCollected: consultationFee, paymentMethod,
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      recordId: activeVisit.id,
    };
  };

  const handleDownloadPDF = async () => {
    if (!diagnosis.trim()) { toast.error('Enter diagnosis before downloading PDF'); return; }
    if (prescription.length === 0) { toast.error('Add medicines before generating PDF'); return; }
    setGeneratingPDF(true);
    try {
      const data = await buildPrescriptionData();
      if (data) await downloadPrescriptionAndPrompt(data);
    } catch (e: any) { toast.error('Failed to download PDF'); }
    finally { setGeneratingPDF(false); }
  };

  // ── WhatsApp + pharmacy push ──────────────────────────────────────
  const handleSendWhatsApp = async () => {
    if (!diagnosis.trim()) { toast.error('Enter diagnosis before sending'); return; }
    if (!activePatient?.phone) { toast.error('Patient has no phone number'); return; }
    if (prescription.length === 0) { toast.error('Add medicines before sending'); return; }
    if (!activeVisit || !activePatient) return;

    const snapshotPatient = activePatient;
    const snapshotVisit = activeVisit;

    setSendingWA(true);
    try {
      const doctorName = clinicProfile?.doctor_name ?? profile?.full_name ?? 'Doctor';
      const medicalRecord = await createMedicalRecord(snapshotPatient);

      const result = await savePrescriptionAndGetLink({
        clinicId, patientId: snapshotPatient.id,
        patientName: snapshotPatient.name, patientPhone: snapshotPatient.phone,
        patientAge: snapshotPatient.dob ? (new Date().getFullYear() - new Date(snapshotPatient.dob).getFullYear()).toString() : null,
        patientGender: snapshotPatient.gender,
        clinicName: clinicProfile?.clinic_name_override ?? (clinicProfile as any)?.name ?? 'Clinic',
        doctorName,
        doctorQualification: getDoctorQualification(),
        doctorRegistrationNo: clinicProfile?.registration_number ?? null,
        clinicAddress: clinicProfile?.clinic_address ?? null,
        clinicPhone: clinicProfile?.phone_number ?? null,
        doctorSignatureBase64: clinicProfile?.signature_base64 ?? null,
        medicalRecordId: medicalRecord.id,
        targetPharmacyId: resolvedPharmacyId,
        diagnosis, doctorNotes: notes, feeCollected: consultationFee, paymentMethod,
        medicines: prescription,
        vitals: getVitalsPayload(),
      });

      if (!result.success || !result.publicUrl) {
        throw new Error(result.error || 'Failed to generate prescription link');
      }

      await finalizeConsultation(snapshotVisit.id, snapshotPatient.id);

      toast.success(`WhatsApp sent. ${getRoutingSuccessMessage('Prescription routed to')}`);
      resetConsultationWorkspace();
      fetchQueue();

      openWhatsAppWithPrescription(
        snapshotPatient.phone, snapshotPatient.name,
        clinicProfile?.clinic_name_override ?? (clinicProfile as any)?.name ?? 'Clinic',
        doctorName, result.publicUrl
      );
    } catch (e: any) {
      console.error('[WhatsApp]', e);
      toast.error('Failed to send: ' + (e.message ?? 'Unknown error'));
    } finally { setSendingWA(false); }
  };

  const generateAISummary = async () => {
    if (!activePatient || history.length === 0) { setAiSummary('No history available.'); return; }
    setLoadingSummary(true);
    const summary = await summarizePatientHistory(
      history.map(h => ({ visit: { ...h, arrivalTime: h.created_at, status: 'completed' } as any, diagnosis: h.diagnosis }))
    );
    setAiSummary(summary || 'Unable to generate summary.');
    setLoadingSummary(false);
  };

  const handleSmartSuggest = async () => {
    if (!notes) { toast.error('Enter some clinical notes/symptoms first.'); return; }
    setLoadingSuggestions(true);
    const suggestions = await generateClinicalSuggestions(notes);
    setAiSuggestions(suggestions);
    setLoadingSuggestions(false);
  };

  const hasVitals = vitalsForm.bp_systolic || vitalsForm.heart_rate || vitalsForm.temperature_f || vitalsForm.weight_kg;

  return (
    <>
      <div className="flex h-full flex-col md:flex-row">

        {/* ── Queue Sidebar ── */}
        <aside className={`w-full md:w-[340px] flex-shrink-0 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col h-full md:max-h-full ${activeVisit ? 'hidden md:flex' : 'flex'}`}>
          <div className="px-4 py-3 border-b border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">Patient Queue</h2>
                <p className="text-xs text-slate-500">{queue.length} waiting</p>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${queue.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {queue.length > 0 ? 'Active' : 'Clear'}
              </span>
            </div>
            <div className="mt-1" data-tour="queue-buttons">
              <EmergencyQueueControls clinicId={clinicId} />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2" data-tour="patient-queue">
            {queue.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-10 px-4">
                <div className="relative mb-6">
                  <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" style={{ animationDuration: '2s' }} />
                  <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500/20 to-violet-600/20 border border-indigo-300/40 flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500" />
                  </div>
                </div>
                <p className="text-sm font-black text-slate-900 tracking-widest uppercase">System Ready</p>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">Awaiting patient<br />check-in from Front Desk</p>
              </div>
            ) : (
              queue.map(visit => (
                <div key={visit.id}>
                  <QueueItem visit={visit} onClick={() => startConsultation(visit)} />
                  <div className="px-3 pb-1 flex items-center gap-2">
                    {visit.source === 'QR_Checkin' && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-semibold rounded-full">📱 QR Check-In</span>}
                    {visit.source === 'Front_Desk' && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-semibold rounded-full">🖥 Front Desk</span>}
                    <WaitTime createdAt={visit.arrivalTime} />
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* ── Consultation Workspace ── */}
        <main className={`flex-1 overflow-y-auto bg-slate-50 ${activeVisit ? 'fixed inset-0 z-50 md:relative md:z-auto md:inset-auto pb-20 md:pb-0' : 'hidden md:block'}`}>
          {!activeVisit ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="relative mb-6">
                <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-indigo-500/15 to-purple-500/15 flex items-center justify-center border border-indigo-200/60">
                  <Stethoscope className="text-indigo-500" size={48} />
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">Ready for Consultation</h3>
              <p className="text-slate-500 max-w-xs leading-relaxed text-sm">Select a patient from the queue to begin their consultation.</p>
              {queue.length > 0 && (
                <div className="mt-6 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl">
                  <p className="text-sm font-bold text-indigo-700">{queue.length} patient{queue.length > 1 ? 's' : ''} waiting →</p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-0 md:p-6 max-w-6xl mx-auto h-full flex flex-col">
              <div className="flex items-center gap-3 md:gap-4 mb-0 md:mb-6 p-4 bg-white md:rounded-2xl border-b md:border border-slate-200 shadow-sm sticky top-0 z-10 md:static flex-shrink-0"
                style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
                <button onClick={() => setActiveVisit(null)} className="md:hidden p-2 -ml-2 text-slate-400 hover:bg-slate-100 rounded-full flex-shrink-0"><X size={24} /></button>
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0"><User size={24} className="text-white" /></div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-slate-900 truncate">{activePatient?.name}</h3>
                  <p className="text-sm text-slate-500">{activePatient?.gender} · {activePatient?.dob ? new Date().getFullYear() - new Date(activePatient.dob).getFullYear() : 'N/A'} yrs · {activePatient?.phone}</p>
                </div>
                <span className="text-xs font-bold px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-full border border-indigo-200 flex-shrink-0">In Consultation</span>
              </div>

              <div className="p-4 md:p-0 grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
                {/* LEFT */}
                <div className="space-y-5">
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-bold text-slate-900 flex items-center gap-2"><FileText size={15} className="text-indigo-500" /> Diagnosis</label>
                      <button onClick={handleSmartSuggest} disabled={loadingSuggestions} className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full font-bold flex items-center gap-1 hover:bg-indigo-100 border border-indigo-200">
                        <Sparkles size={11} />{loadingSuggestions ? 'Analyzing...' : 'Smart Suggest'}
                      </button>
                    </div>
                    {aiSuggestions.length > 0 && (
                      <div className="mb-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl space-y-2">
                        <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">AI Suggestions</div>
                        <div className="flex flex-wrap gap-2">
                          {aiSuggestions.map((s, i) => (
                            <button key={i} onClick={() => { setDiagnosis(s.diagnosis); setNotes(p => p + (p ? '\n' : '') + `Protocol: ${s.protocol}`); setAiSuggestions([]); }}
                              className="text-xs bg-white text-slate-900 border border-slate-200 px-3 py-1.5 rounded-lg hover:border-indigo-500 shadow-sm text-left">
                              <span className="font-bold">{s.diagnosis}</span>
                              <span className="block text-[10px] text-slate-400 truncate max-w-[150px]">{s.protocol}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <input style={{ fontSize: '16px' }} value={diagnosis} onChange={e => setDiagnosis(e.target.value)} placeholder="Enter diagnosis..."
                      className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 text-slate-900 placeholder:text-slate-400 font-medium" />
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm" data-tour="medicine-search">
                    <label className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3"><ClipboardList size={15} className="text-violet-500" /> Prescription</label>
                    <PrescriptionForm clinicId={clinicId} lines={prescription} onChange={setPrescription} />
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <label className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3"><FileText size={15} className="text-slate-400" /> Clinical Notes</label>
                    <textarea style={{ fontSize: '16px' }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Doctor's internal notes..."
                      className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 min-h-[90px] text-slate-900 placeholder:text-slate-400 font-medium resize-none" />
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2"><Banknote size={15} className="text-emerald-500" /> Billing</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Fee (₹)</label>
                        <input style={{ fontSize: '16px' }} type="number" value={consultationFee === 0 ? '' : consultationFee}
                          onChange={e => setConsultationFee(Number(e.target.value))} placeholder="0"
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Method</label>
                        <select style={{ fontSize: '16px' }} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium">
                          <option>Cash</option><option>UPI</option><option>Card</option><option>Insurance</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <Store size={15} className="text-amber-500" />
                          Pharmacy Routing
                        </h4>
                        <p className="text-xs text-slate-500 mt-1">
                          Auto-send to your linked pharmacy, pick another signed-in pharmacy, or keep this digital only.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={refreshPharmacyNetwork}
                        className="text-xs font-bold text-slate-500 hover:text-slate-900"
                      >
                        Refresh
                      </button>
                    </div>

                    {loadingPharmacies ? (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Loader2 size={13} className="animate-spin" />
                        Loading pharmacy directory...
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-2">
                          <button
                            type="button"
                            onClick={() => setPharmacyRoutingMode(defaultPharmacy ? 'default' : (directoryPharmacies.length > 0 ? 'manual' : 'none'))}
                            className={`rounded-xl border px-3.5 py-3 text-left transition ${pharmacyRoutingMode === 'default'
                              ? 'border-indigo-300 bg-indigo-50'
                              : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                              } ${!defaultPharmacy ? 'opacity-60' : ''}`}
                            disabled={!defaultPharmacy && directoryPharmacies.length === 0}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-xs font-black uppercase tracking-wider text-slate-400">Primary</p>
                                <p className="text-sm font-bold text-slate-900">
                                  {defaultPharmacy ? defaultPharmacy.name : 'No primary pharmacy linked'}
                                </p>
                              </div>
                              {defaultPharmacy && (
                                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-indigo-100 text-indigo-700">
                                  Auto route
                                </span>
                              )}
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPharmacyRoutingMode('manual')}
                            className={`rounded-xl border px-3.5 py-3 text-left transition ${pharmacyRoutingMode === 'manual'
                              ? 'border-amber-300 bg-amber-50'
                              : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                              } ${directoryPharmacies.length === 0 ? 'opacity-60' : ''}`}
                            disabled={directoryPharmacies.length === 0}
                          >
                            <p className="text-xs font-black uppercase tracking-wider text-slate-400">Manual</p>
                            <p className="text-sm font-bold text-slate-900">
                              {selectedPharmacy ? `Send this visit to ${selectedPharmacy.name}` : 'Choose from signed-in pharmacies'}
                            </p>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPharmacyRoutingMode('none')}
                            className={`rounded-xl border px-3.5 py-3 text-left transition ${pharmacyRoutingMode === 'none'
                              ? 'border-slate-300 bg-slate-100'
                              : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                              }`}
                          >
                            <p className="text-xs font-black uppercase tracking-wider text-slate-400">Patient only</p>
                            <p className="text-sm font-bold text-slate-900">Keep this as a digital prescription without pharmacy routing</p>
                          </button>
                        </div>

                        {pharmacyRoutingMode === 'manual' && directoryPharmacies.length > 0 && (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                              Send To Pharmacy
                            </label>
                            <select
                              value={selectedPharmacyId}
                              onChange={(e) => setSelectedPharmacyId(e.target.value)}
                              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-slate-900 outline-none focus:ring-2 focus:ring-amber-500/20 font-medium"
                            >
                              {directoryPharmacies.map((pharmacy) => {
                                const suffix = pharmacy.clinic_id === clinicId
                                  ? 'Linked to this clinic'
                                  : pharmacy.clinic_id
                                    ? 'Linked to another clinic'
                                    : 'Signed in, not linked yet';
                                return (
                                  <option key={pharmacy.id} value={pharmacy.id}>
                                    {pharmacy.name} · {suffix}
                                  </option>
                                );
                              })}
                            </select>
                            {selectedPharmacy && (
                              <p className="text-xs text-slate-500 mt-2">
                                {selectedPharmacy.phone || selectedPharmacy.city || 'Signed-in pharmacy account'}.
                              </p>
                            )}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2 text-[11px]">
                          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold">
                            {linkedPharmacies.length} linked
                          </span>
                          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-bold">
                            {directoryPharmacies.length} signed-in pharmacies
                          </span>
                          {resolvedPharmacy && (
                            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-bold">
                              This visit routes to {resolvedPharmacy.name}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2.5 pb-4" data-tour="send-prescription">
                    <button onClick={completeVisit} disabled={sending}
                      className="w-full bg-slate-900 hover:bg-black text-white py-4 px-6 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 transition">
                      {sending ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><Save size={16} /> {resolvedPharmacy ? 'Save & Route Prescription' : 'Save Consultation'} · ₹{consultationFee}</>}
                    </button>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button onClick={handleDownloadPDF} disabled={generatingPDF}
                        className="flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm disabled:opacity-60 transition shadow-sm shadow-indigo-200">
                        {generatingPDF ? <><Loader2 size={14} className="animate-spin" /> Generating…</> : <><Download size={14} /> Download PDF</>}
                      </button>
                      <button onClick={handleSendWhatsApp} disabled={sendingWA}
                        className="flex items-center justify-center gap-2 py-3.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm disabled:opacity-60 transition shadow-sm shadow-green-200">
                        {sendingWA ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : <><MessageCircle size={14} /> WhatsApp</>}
                      </button>
                    </div>
                    <p className="text-center text-slate-400 text-[10px] font-semibold tracking-wider uppercase">
                      Save → clinical record locked in &nbsp;·&nbsp; WhatsApp → patient gets the live prescription link
                    </p>
                  </div>
                </div>

                {/* RIGHT */}
                <div className="space-y-5">
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm"><Activity className="text-rose-500" size={16} /> Vitals</h3>
                      {vitalsLoaded && (
                        <button onClick={saveVitals} disabled={savingVitals}
                          className="text-xs bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full font-bold flex items-center gap-1 hover:bg-emerald-100 border border-emerald-200 disabled:opacity-50">
                          <Save size={11} />{savingVitals ? 'Saving...' : 'Save Vitals'}
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1"><Heart size={10} className="text-rose-400" /> Blood Pressure</label>
                        <div className="flex gap-2 items-center">
                          <input type="number" placeholder="Systolic" style={{ fontSize: '16px' }} value={vitalsForm.bp_systolic}
                            onChange={e => setVitalsForm(v => ({ ...v, bp_systolic: e.target.value }))}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 text-sm font-semibold" />
                          <span className="text-slate-400 font-bold flex-shrink-0">/</span>
                          <input type="number" placeholder="Diastolic" style={{ fontSize: '16px' }} value={vitalsForm.bp_diastolic}
                            onChange={e => setVitalsForm(v => ({ ...v, bp_diastolic: e.target.value }))}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 text-sm font-semibold" />
                        </div>
                      </div>
                      <VitalInput label="Heart Rate" unit="bpm" value={vitalsForm.heart_rate} onChange={v => setVitalsForm(f => ({ ...f, heart_rate: v }))} />
                      <VitalInput label="Temperature" unit="°F" value={vitalsForm.temperature_f} onChange={v => setVitalsForm(f => ({ ...f, temperature_f: v }))} />
                      <div className="col-span-2"><VitalInput label="Weight" unit="kg" value={vitalsForm.weight_kg} onChange={v => setVitalsForm(f => ({ ...f, weight_kg: v }))} /></div>
                    </div>
                    {hasVitals && (
                      <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
                        {vitalsForm.bp_systolic && vitalsForm.bp_diastolic && (
                          <div className="bg-rose-50 border border-rose-100 rounded-lg p-2 text-center">
                            <div className="text-lg font-black text-rose-700">{vitalsForm.bp_systolic}/{vitalsForm.bp_diastolic}</div>
                            <div className="text-[9px] text-rose-400 font-bold">BP mmHg</div>
                          </div>
                        )}
                        {vitalsForm.heart_rate && <div className="bg-pink-50 border border-pink-100 rounded-lg p-2 text-center"><div className="text-lg font-black text-pink-700">{vitalsForm.heart_rate}</div><div className="text-[9px] text-pink-400 font-bold">BPM</div></div>}
                        {vitalsForm.temperature_f && <div className="bg-amber-50 border border-amber-100 rounded-lg p-2 text-center"><div className="text-lg font-black text-amber-700">{vitalsForm.temperature_f}°F</div><div className="text-[9px] text-amber-400 font-bold">{((Number(vitalsForm.temperature_f) - 32) * 5 / 9).toFixed(1)}°C</div></div>}
                        {vitalsForm.weight_kg && <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 text-center"><div className="text-lg font-black text-blue-700">{vitalsForm.weight_kg}</div><div className="text-[9px] text-blue-400 font-bold">kg</div></div>}
                      </div>
                    )}
                    <VitalsRiskBanner result={vitalsRisk} />
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm"><History className="text-indigo-500" size={16} /> Medical History</h3>
                      <button onClick={generateAISummary} disabled={loadingSummary} className="text-indigo-600 p-2 hover:bg-indigo-50 rounded-lg">
                        <Sparkles size={16} className={loadingSummary ? 'animate-pulse' : ''} />
                      </button>
                    </div>
                    {aiSummary && <div className="mb-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl"><div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">AI Summary</div><p className="text-sm text-indigo-900 leading-relaxed">{aiSummary}</p></div>}
                    <div className="space-y-4 relative before:absolute before:left-[11px] before:top-2 before:bottom-0 before:w-0.5 before:bg-slate-200">
                      {history.length === 0 ? <p className="text-xs text-slate-400 italic pl-6">First time visit.</p> : history.map(h => (
                        <div key={h.id} className="relative pl-8">
                          <div className="absolute left-0 top-1 w-6 h-6 bg-white border-2 border-slate-200 rounded-full flex items-center justify-center"><div className="w-2 h-2 bg-indigo-400 rounded-full" /></div>
                          <div className="text-xs font-bold text-slate-500">{new Date(h.created_at).toLocaleDateString()}</div>
                          <div className="text-sm font-semibold text-slate-900">{h.diagnosis}</div>
                          <div className="text-xs text-slate-500 italic">{h.doctor_notes}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2 text-sm"><Eye className="text-indigo-500" size={16} /> Digital Files</h3>
                    <div className="text-xs text-slate-400 italic">No documents available.</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {showWelcome && (
        <WelcomePopup
          doctorName={clinicProfile?.doctor_name ?? profile?.full_name ?? 'Doctor'}
          daysLeft={5}
          onStartTour={() => { localStorage.setItem('nirogos_welcome_popup_done', 'true'); setShowWelcome(false); setTimeout(() => setShowTutorial(true), 350); }}
          onSkip={() => { localStorage.setItem('nirogos_welcome_popup_done', 'true'); localStorage.setItem(TUTORIAL_DONE_KEY, 'true'); setShowWelcome(false); }}
        />
      )}
      {showTutorial && <Tutorial onComplete={() => setShowTutorial(false)} />}
    </>
  );
};

function WaitTime({ createdAt }: { createdAt: string }) {
  const [mins, setMins] = React.useState(0);
  React.useEffect(() => {
    const calc = () => setMins(Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
    calc();
    const iv = setInterval(calc, 30000);
    return () => clearInterval(iv);
  }, [createdAt]);
  const color = mins < 15 ? 'text-green-600' : mins < 30 ? 'text-yellow-600' : 'text-red-600';
  return <span className={`text-[10px] font-bold ${color}`}>⏱ {mins}m wait</span>;
}

export default DoctorDashboard;
