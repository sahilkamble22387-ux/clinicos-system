import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Clock, User, ClipboardList, History, FileText, Send,
  Sparkles, Eye, Banknote, Activity, Heart, Thermometer,
  Stethoscope, Save, X, MessageCircle, Download, Loader2,
  ShieldAlert, AlertTriangle, Info, Store, ChevronLeft,
  ChevronRight, Mic, MicOff, CheckCircle2, PanelLeftClose,
  PanelLeftOpen, Smartphone, Link2, CheckSquare, Square,
  Pill, ArrowRight, Check, RefreshCw,
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

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Could not read audio blob'));
        return;
      }
      const [, base64 = ''] = result.split(',');
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read audio blob'));
    reader.readAsDataURL(blob);
  });
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
  critical: 'Critical Vitals Alert',
  warning: 'Vitals Warning',
  info: 'Vitals Note',
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
  const queueRefreshTimeoutRef = useRef<number | null>(null);

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
  const [loadingAiSummary, setLoadingAiSummary] = useState(false);
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

  // Consultation mode state
  const [queueCollapsed, setQueueCollapsed] = useState(false);
  const [consultTab, setConsultTab] = useState<'scribble' | 'soap' | 'rx'>('scribble');
  const [soapNote, setSoapNote] = useState('');
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeActions, setCompleteActions] = useState({ whatsapp: false, pdf: false, pharmacy: false });
  const [completing, setCompleting] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const vitalsRisk: VitalsRiskResult = analyzeVitals(vitalsForm);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const fetchQueue = useCallback(async () => {
    const { data: appointments, error } = await (supabase as any)
      .from('appointments')
      .select('id, patient_id, created_at')
      .eq('clinic_id', clinicId)
      .eq('status', 'waiting')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching queue:', error);
      return;
    }

    const baseQueue = (appointments ?? []).map((item: any) => ({
      id: item.id,
      patientId: item.patient_id,
      arrivalTime: item.created_at,
      status: VisitStatus.WAITING,
      patientName: 'Loading patient...',
      source: null,
    }));

    setQueue(baseQueue);

    const patientIds = Array.from(
      new Set((appointments ?? []).map((item: any) => item.patient_id).filter(Boolean))
    );

    let patientMap = new Map<string, { full_name: string | null; source: string | null }>();

    if (patientIds.length > 0) {
      const { data: patients, error: patientsError } = await (supabase as any)
        .from('patients')
        .select('id, full_name, source')
        .in('id', patientIds);

      if (patientsError) {
        console.error('Error fetching queue patients:', patientsError);
      } else {
        patientMap = new Map(
          (patients ?? []).map((patient: any) => [
            patient.id,
            { full_name: patient.full_name ?? null, source: patient.source ?? null },
          ])
        );
      }
    }

    setQueue((appointments ?? []).map((item: any) => {
      const patient = patientMap.get(item.patient_id);
      return {
        id: item.id,
        patientId: item.patient_id,
        arrivalTime: item.created_at,
        status: VisitStatus.WAITING,
        patientName: patient?.full_name ?? 'Unknown Patient',
        source: patient?.source ?? null,
      };
    }));
  }, [clinicId]);

  const scheduleQueueRefresh = useCallback(() => {
    if (queueRefreshTimeoutRef.current) {
      window.clearTimeout(queueRefreshTimeoutRef.current);
    }

    queueRefreshTimeoutRef.current = window.setTimeout(() => {
      queueRefreshTimeoutRef.current = null;
      void fetchQueue();
    }, 120);
  }, [fetchQueue]);

  useEffect(() => {
    void fetchQueue();
    const subscription = (supabase as any).channel(`doctor-queue-${clinicId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'appointments',
        filter: `clinic_id=eq.${clinicId}`,
      }, scheduleQueueRefresh)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'patients',
        filter: `clinic_id=eq.${clinicId}`,
      }, scheduleQueueRefresh)
      .subscribe();
    return () => {
      if (queueRefreshTimeoutRef.current) {
        window.clearTimeout(queueRefreshTimeoutRef.current);
        queueRefreshTimeoutRef.current = null;
      }
      (supabase as any).removeChannel(subscription);
    };
  }, [clinicId, fetchQueue, scheduleQueueRefresh]);

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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
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
        frontDeskId: pData.front_desk_id ?? null,
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
      setQueueCollapsed(true);
      setConsultTab('scribble');
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

  const generateAISummary = useCallback(async (frontDeskId?: string | null, hasHistory = history.length > 0) => {
    if (!frontDeskId || !hasHistory) {
      setAiSummary('No history available.');
      return;
    }

    setLoadingAiSummary(true);
    const summary = await summarizePatientHistory(frontDeskId);
    setAiSummary(summary || 'Unable to generate summary.');
    setLoadingAiSummary(false);
  }, [history.length]);

  const handleSmartSuggest = async () => {
    if (!notes) { toast.error('Enter some clinical notes/symptoms first.'); return; }
    setLoadingSuggestions(true);
    const suggestions = await generateClinicalSuggestions(notes, clinicId);
    setAiSuggestions(suggestions);
    setLoadingSuggestions(false);
  };

  useEffect(() => {
    if (!activePatient) return;
    void generateAISummary(activePatient.frontDeskId, history.length > 0);
  }, [activePatient, history.length, generateAISummary]);

  const generateSOAP = async () => {
    const sourceText = transcript.trim() || notes.trim();
    if (!sourceText) { toast.error('Add transcript or notes first'); return; }
    setLoadingSummary(true);
    try {
      const response = await fetch('/api/ai/soap-note', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-clinic-id': clinicId,
        },
        body: JSON.stringify({
          transcript: sourceText,
          visitId: activeVisit?.id,
          frontDeskId: activePatient?.frontDeskId ?? undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('SOAP unavailable');
      }

      const data = await response.json();
      const soap = data.soap ?? {};
      const nextSoapNote = [
        'Subjective',
        soap.subjective ?? '',
        '',
        'Objective',
        soap.objective ?? '',
        '',
        'Assessment',
        soap.assessment ?? '',
        '',
        'Plan',
        soap.plan ?? '',
      ].join('\n');

      setSoapNote(nextSoapNote);
      if (soap.assessment && !diagnosis.trim()) {
        setDiagnosis(soap.assessment);
      }
      setConsultTab('soap');
      toast.success('SOAP note generated');
    } catch (error) {
      console.error('SOAP generation failed:', error);
      toast.error('AI SOAP is unavailable right now.');
    } finally {
      setLoadingSummary(false);
    }
  };

  const stopRecordingTracks = () => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
  };

  const handleRecordToggle = async () => {
    if (isTranscribing) return;

    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error('Audio recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      recordedChunksRef.current = [];

      const mimeTypeCandidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      const mimeType = mimeTypeCandidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        stopRecordingTracks();
        setIsRecording(false);
        setIsTranscribing(false);
        toast.error('Recording failed.');
      };

      recorder.onstop = async () => {
        setIsRecording(false);
        const chunks = recordedChunksRef.current;
        recordedChunksRef.current = [];
        stopRecordingTracks();

        if (!chunks.length) return;

        setIsTranscribing(true);
        try {
          const audioBlob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          const audioBase64 = await blobToBase64(audioBlob);
          const response = await fetch('/api/ai/transcribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-clinic-id': clinicId,
            },
            body: JSON.stringify({
              audioBase64,
              mimeType: audioBlob.type || 'audio/webm',
              filename: `voice-note-${Date.now()}.webm`,
            }),
          });

          if (!response.ok) {
            throw new Error('Transcription unavailable');
          }

          const data = await response.json();
          if (data.transcript) {
            setTranscript((current) => current ? `${current.trim()}\n${data.transcript}` : data.transcript);
            toast.success('Transcript added.');
          } else {
            toast.error('No transcript returned.');
          }
        } catch (error) {
          console.error('Transcription failed:', error);
          toast.error('Could not transcribe audio.');
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Microphone access failed:', error);
      stopRecordingTracks();
      setIsRecording(false);
      toast.error('Microphone permission is required to record.');
    }
  };

  const handleCompleteVisit = async () => {
    if (!activeVisit || !activePatient) return;
    if (!diagnosis.trim()) { toast.error('Please enter a diagnosis first'); return; }
    if (prescription.length === 0) { toast.error('Add at least one medicine first'); return; }
    setCompleting(true);
    try {
      const doctorName = clinicProfile?.doctor_name ?? profile?.full_name ?? 'Doctor';
      const medicalRecord = await createMedicalRecord(activePatient);
      const result = await savePrescriptionAndGetLink({
        clinicId, patientId: activePatient.id, patientName: activePatient.name,
        patientPhone: activePatient.phone,
        patientAge: activePatient.dob ? (new Date().getFullYear() - new Date(activePatient.dob).getFullYear()).toString() : null,
        patientGender: activePatient.gender,
        clinicName: clinicProfile?.clinic_name_override ?? (clinicProfile as any)?.name ?? 'Clinic',
        doctorName, doctorQualification: getDoctorQualification(),
        doctorRegistrationNo: clinicProfile?.registration_number ?? null,
        clinicAddress: clinicProfile?.clinic_address ?? null,
        clinicPhone: clinicProfile?.phone_number ?? null,
        doctorSignatureBase64: clinicProfile?.signature_base64 ?? null,
        medicalRecordId: medicalRecord.id,
        targetPharmacyId: completeActions.pharmacy ? resolvedPharmacyId : null,
        diagnosis, doctorNotes: notes, feeCollected: consultationFee, paymentMethod,
        medicines: prescription, vitals: getVitalsPayload(),
      });
      if (!result.success) throw new Error(result.error || 'Failed to save');
      await finalizeConsultation(activeVisit.id, activePatient.id);
      if (completeActions.whatsapp && activePatient.phone && result.publicUrl) {
        openWhatsAppWithPrescription(activePatient.phone, activePatient.name,
          clinicProfile?.clinic_name_override ?? (clinicProfile as any)?.name ?? 'Clinic',
          doctorName, result.publicUrl);
      }
      if (completeActions.pdf) {
        const data = await buildPrescriptionData();
        if (data) await downloadPrescriptionAndPrompt(data);
      }
      toast.success('Visit completed!');
      setShowCompleteModal(false);
      resetConsultationWorkspace();
      setQueueCollapsed(false);
      setSoapNote('');
      setTranscript('');
      setConsultTab('scribble');
      fetchQueue();
    } catch (err: any) {
      toast.error('Failed: ' + err.message);
    } finally { setCompleting(false); }
  };

  const hasVitals = vitalsForm.bp_systolic || vitalsForm.heart_rate || vitalsForm.temperature_f || vitalsForm.weight_kg;

  return (
    <>
      <div className="flex h-full flex-col md:flex-row">

        {/* ── Queue Sidebar (collapsible) ── */}
        <aside className={`flex-shrink-0 bg-white border-r border-slate-200 flex flex-col h-full transition-all duration-300 ease-in-out
          ${activeVisit && queueCollapsed ? 'w-[56px]' : 'w-full md:w-[300px]'}
          ${activeVisit ? 'hidden md:flex' : 'flex'}`}>

          {/* Collapsed indicator */}
          {activeVisit && queueCollapsed ? (
            <div className="flex flex-col items-center py-4 gap-4 flex-1">
              <button onClick={() => setQueueCollapsed(false)}
                className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 hover:bg-indigo-100 transition">
                <PanelLeftOpen size={16} />
              </button>
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                <span className="text-xs font-black text-amber-700">{queue.length}</span>
              </div>
              <div className="flex flex-col gap-1 mt-2">
                {queue.slice(0, 4).map((v, i) => (
                  <div key={v.id} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                    <User size={12} className="text-slate-500" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
          <div className="px-4 py-3 border-b border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">Patient Queue</h2>
                <p className="text-xs text-slate-500">{queue.length} waiting</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${queue.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {queue.length > 0 ? 'Active' : 'Clear'}
                </span>
                {activeVisit && (
                  <button onClick={() => setQueueCollapsed(true)}
                    className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition">
                    <PanelLeftClose size={14} />
                  </button>
                )}
              </div>
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
                {visit.source === 'QR_Checkin' && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-semibold rounded-full"><Smartphone size={9} /> QR</span>}
                    {visit.source === 'Front_Desk' && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-semibold rounded-full"><User size={9} /> Desk</span>}
                    <WaitTime createdAt={visit.arrivalTime} />
                  </div>
                </div>
              ))
            )}
          </div>
            </>
          )}
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

                  {/* Tabbed Consultation Card */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex border-b border-slate-200">
                      {(['scribble', 'soap', 'rx'] as const).map(tab => {
                        const labels = { scribble: 'Scribble', soap: 'SOAP Note', rx: 'Prescription' };
                        const icons = { scribble: <Mic size={13} />, soap: <Sparkles size={13} />, rx: <Pill size={13} /> };
                        return (
                          <button key={tab} onClick={() => setConsultTab(tab)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold transition ${consultTab === tab ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-500' : 'text-slate-500 hover:bg-slate-50'}`}>
                            {icons[tab]}{labels[tab]}
                          </button>
                        );
                      })}
                    </div>
                    <div className="p-4">
                      {consultTab === 'scribble' && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500 font-semibold">Notes or transcript</span>
                          <button onClick={handleRecordToggle} disabled={isTranscribing}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition disabled:opacity-60 ${isRecording ? 'bg-red-100 text-red-600 border border-red-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                              {isTranscribing ? <><Loader2 size={11} className="animate-spin" /> Transcribing</> : isRecording ? <><MicOff size={11} /> Stop</> : <><Mic size={11} /> Record</>}
                            </button>
                          </div>
                          <textarea style={{ fontSize: '16px' }} value={transcript} onChange={e => setTranscript(e.target.value)}
                            placeholder="Paste or type visit transcript..." rows={4}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-900 placeholder:text-slate-400 font-medium resize-none" />
                          <textarea style={{ fontSize: '16px' }} value={notes} onChange={e => setNotes(e.target.value)}
                            placeholder="Doctor's internal notes..." rows={3}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-900 placeholder:text-slate-400 font-medium resize-none" />
                          <button onClick={generateSOAP} disabled={loadingSummary}
                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition disabled:opacity-60">
                            {loadingSummary ? <><Loader2 size={14} className="animate-spin" /> Generating…</> : <><Sparkles size={14} /> Generate SOAP Note</>}
                          </button>
                        </div>
                      )}
                      {consultTab === 'soap' && (
                        <div className="space-y-3">
                          {soapNote ? (
                            <textarea value={soapNote} onChange={e => setSoapNote(e.target.value)} rows={12}
                              className="w-full p-3 bg-indigo-50 border border-indigo-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-indigo-900 font-medium text-sm resize-none" />
                          ) : (
                            <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                              <Sparkles size={28} className="text-indigo-300" />
                              <p className="text-sm text-slate-500">No SOAP note yet.<br />Go to <strong>Scribble</strong> tab and click Generate SOAP.</p>
                            </div>
                          )}
                        </div>
                      )}
                      {consultTab === 'rx' && (
                        <div data-tour="medicine-search">
                          <PrescriptionForm clinicId={clinicId} lines={prescription} onChange={setPrescription} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Billing */}
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

                  {/* ── Pharmacy Routing (Fix 3) ── */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Store size={14} className="text-amber-500" /> Pharmacy</h4>
                      <button onClick={refreshPharmacyNetwork} className="text-slate-400 hover:text-slate-700 transition"><RefreshCw size={13} /></button>
                    </div>
                    {loadingPharmacies ? (
                      <div className="flex items-center gap-2 text-xs text-slate-400"><Loader2 size={12} className="animate-spin" /> Loading...</div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => {
                            if (defaultPharmacy) {
                              setPharmacyRoutingMode('default');
                              return;
                            }
                            if (directoryPharmacies.length > 0) {
                              setPharmacyRoutingMode('manual');
                              toast('No primary pharmacy linked. Choose a store instead.');
                              return;
                            }
                            setPharmacyRoutingMode('none');
                            toast('No linked pharmacy is available yet.');
                          }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition ${pharmacyRoutingMode === 'default' ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-slate-100 border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                            {defaultPharmacy ? <CheckCircle2 size={11} /> : <X size={11} />}
                            {defaultPharmacy ? defaultPharmacy.name : 'No Primary'}
                          </button>
                          <button type="button" onClick={() => {
                            if (directoryPharmacies.length === 0) {
                              toast('No signed-in pharmacies are available yet.');
                              return;
                            }
                            setPharmacyRoutingMode('manual');
                          }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition ${pharmacyRoutingMode === 'manual' ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-slate-100 border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                            <Store size={11} /> Select Store
                          </button>
                          <button type="button" onClick={() => setPharmacyRoutingMode('none')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition ${pharmacyRoutingMode === 'none' ? 'bg-slate-200 border-slate-400 text-slate-700' : 'bg-slate-100 border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                            <Smartphone size={11} /> Patient Only
                          </button>
                        </div>
                        {pharmacyRoutingMode === 'manual' && directoryPharmacies.length > 0 && (
                          <select value={selectedPharmacyId} onChange={e => setSelectedPharmacyId(e.target.value)}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:ring-2 focus:ring-amber-500/20">
                            {directoryPharmacies.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        )}
                        {resolvedPharmacy && <div className="flex items-center gap-1.5 text-xs text-amber-700 font-semibold"><ArrowRight size={11} /> Routes to {resolvedPharmacy.name}</div>}
                      </div>
                    )}
                  </div>

                  {/* ── Complete Visit button (Fix 4) ── */}
                  <div className="pb-4" data-tour="send-prescription">
                    <button onClick={() => setShowCompleteModal(true)}
                      className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white py-4 px-6 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 transition">
                      <CheckCircle2 size={16} /> Complete Visit · ₹{consultationFee}
                    </button>
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
                      <button onClick={() => void generateAISummary(activePatient?.frontDeskId, history.length > 0)} disabled={loadingAiSummary} className="text-indigo-600 p-2 hover:bg-indigo-50 rounded-lg">
                        <Sparkles size={16} className={loadingAiSummary ? 'animate-pulse' : ''} />
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

      {/* ── Complete Visit Modal (Fix 4) ── */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCompleteModal(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center">
                <CheckCircle2 size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">Complete Visit</h3>
                <p className="text-xs text-slate-500">What would you like to do after saving?</p>
              </div>
              <button onClick={() => setShowCompleteModal(false)} className="ml-auto text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>
            <div className="space-y-2 mb-5">
              {([
                { key: 'whatsapp', label: 'Send via WhatsApp', icon: <MessageCircle size={15} className="text-green-600" />, sub: activePatient?.phone || 'No phone' },
                { key: 'pdf', label: 'Download PDF', icon: <Download size={15} className="text-indigo-600" />, sub: 'Prescription PDF' },
                { key: 'pharmacy', label: 'Route to Pharmacy', icon: <Store size={15} className="text-amber-600" />, sub: resolvedPharmacy?.name || 'No pharmacy selected' },
              ] as const).map(({ key, label, icon, sub }) => (
                <button key={key} onClick={() => setCompleteActions(a => ({ ...a, [key]: !a[key] }))}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition text-left ${completeActions[key] ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}>
                  <div className="w-8 h-8 bg-white rounded-xl border border-slate-200 flex items-center justify-center flex-shrink-0">{icon}</div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-slate-900">{label}</div>
                    <div className="text-xs text-slate-500">{sub}</div>
                  </div>
                  {completeActions[key] ? <CheckSquare size={18} className="text-indigo-600 flex-shrink-0" /> : <Square size={18} className="text-slate-300 flex-shrink-0" />}
                </button>
              ))}
            </div>
            <button onClick={handleCompleteVisit} disabled={completing}
              className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition disabled:opacity-60">
              {completing ? <><Loader2 size={16} className="animate-spin" /> Completing…</> : <><Check size={16} /> Confirm & Complete</>}
            </button>
          </div>
        </div>
      )}

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
  return <span className={`text-[10px] font-bold flex items-center gap-0.5 ${color}`}><Clock size={9} /> {mins}m</span>;
}

export default DoctorDashboard;
