import React, { useState, useEffect } from 'react';
import { Clock, User, ClipboardList, History, FileText, Send, Sparkles, Eye, Banknote, Activity, Heart, Thermometer, Stethoscope, Save } from 'lucide-react';
import { supabase } from '../../services/db';
import { Visit, Patient, VisitStatus, Document, MedicalRecord } from '../../types';
import { summarizePatientHistory, generateClinicalSuggestions } from '../../services/geminiService';
import QueueItem from './QueueItem';
import { toast } from 'react-hot-toast';

const MEDICINE_LIST = [
  "Paracetamol 500mg", "Paracetamol 650mg", "Azithromycin 500mg",
  "Amoxicillin 500mg", "Cetirizine 10mg", "Metformin 500mg",
  "Amlodipine 5mg", "Pantoprazole 40mg", "Omeprazole 20mg",
  "Ibuprofen 400mg", "Diclofenac 50mg", "Ranitidine 150mg",
  "Atorvastatin 10mg", "Losartan 50mg", "Metoprolol 25mg",
  "Telmisartan 40mg", "Levocetirizine 5mg", "Montelukast 10mg"
];

interface DoctorDashboardProps {
  clinicId: string;
}

// ── Vitals Input Sub-Component ──
const VitalInput: React.FC<{
  label: string; unit: string; value: string;
  onChange: (v: string) => void; color?: string;
}> = ({ label, unit, value, onChange, color = 'indigo' }) => (
  <div className="space-y-1">
    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</label>
    <div className="relative">
      <input
        type="number"
        step="any"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="—"
        className={`w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-${color}-500/20 focus:border-${color}-400 text-sm font-semibold text-slate-800 placeholder:text-slate-300`}
      />
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-semibold">{unit}</span>
    </div>
  </div>
);

const DoctorDashboard: React.FC<DoctorDashboardProps> = ({ clinicId }) => {
  const [queue, setQueue] = useState<Visit[]>([]);
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const [activePatient, setActivePatient] = useState<Patient | null>(null);
  const [history, setHistory] = useState<MedicalRecord[]>([]);
  const [docs, setDocs] = useState<Document[]>([]);
  const [notes, setNotes] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [prescription, setPrescription] = useState('');
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);
  const [consultationFee, setConsultationFee] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card' | 'Insurance'>('Cash');
  const [showMedSuggestions, setShowMedSuggestions] = useState(false);
  const [medQuery, setMedQuery] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Vitals state — editable
  const [vitalsForm, setVitalsForm] = useState({
    bp_systolic: '', bp_diastolic: '', heart_rate: '', weight_kg: '', temperature_f: ''
  });
  const [vitalsLoaded, setVitalsLoaded] = useState(false);
  const [savingVitals, setSavingVitals] = useState(false);

  const fetchQueue = async () => {
    const { data, error } = await supabase
      .from('appointments')
      .select('*, patients(*)')
      .eq('clinic_id', clinicId)
      .eq('status', 'waiting')
      .order('created_at', { ascending: true });

    if (error) { console.error("Error fetching queue:", error); return; }
    if (data) {
      const visits: Visit[] = data.map((item: any) => ({
        id: item.id,
        patientId: item.patient_id,
        arrivalTime: item.created_at,
        status: VisitStatus.WAITING,
        patientName: item.patients?.full_name,
        source: item.patients?.source,
      }));
      setQueue(visits);
    }
  };

  useEffect(() => {
    fetchQueue();
    const subscription = supabase
      .channel('doctor-queue-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, fetchQueue)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, fetchQueue)
      .subscribe();
    return () => { supabase.removeChannel(subscription); };
  }, [clinicId]);

  const startConsultation = async (visit: Visit) => {
    const { data: pData } = await supabase.from('patients').select('*').eq('id', visit.patientId).single();
    if (pData) {
      const patient: Patient = {
        id: pData.id, name: pData.full_name, gender: pData.gender as any,
        dob: pData.dob, phone: pData.phone, address: pData.address, createdAt: pData.created_at
      };
      const { data: records } = await supabase.from('medical_records').select('*').eq('patient_id', patient.id).order('created_at', { ascending: false });
      setActiveVisit(visit); setActivePatient(patient); setHistory(records || []);
      setDocs([]); setAiSummary(null); setDiagnosis(''); setPrescription('');
      setNotes(''); setConsultationFee(0);

      // Load existing vitals
      const { data: apptData } = await supabase.from('appointments').select('bp_systolic, bp_diastolic, heart_rate, weight_kg, temperature_f').eq('id', visit.id).single();
      if (apptData) {
        setVitalsForm({
          bp_systolic: apptData.bp_systolic?.toString() || '',
          bp_diastolic: apptData.bp_diastolic?.toString() || '',
          heart_rate: apptData.heart_rate?.toString() || '',
          weight_kg: apptData.weight_kg?.toString() || '',
          temperature_f: apptData.temperature_f?.toString() || '',
        });
      } else {
        setVitalsForm({ bp_systolic: '', bp_diastolic: '', heart_rate: '', weight_kg: '', temperature_f: '' });
      }
      setVitalsLoaded(true);
    }
  };

  const saveVitals = async () => {
    if (!activeVisit) return;
    setSavingVitals(true);
    try {
      await supabase
        .from('appointments')
        .update({
          bp_systolic: vitalsForm.bp_systolic ? Number(vitalsForm.bp_systolic) : null,
          bp_diastolic: vitalsForm.bp_diastolic ? Number(vitalsForm.bp_diastolic) : null,
          heart_rate: vitalsForm.heart_rate ? Number(vitalsForm.heart_rate) : null,
          weight_kg: vitalsForm.weight_kg ? Number(vitalsForm.weight_kg) : null,
          temperature_f: vitalsForm.temperature_f ? Number(vitalsForm.temperature_f) : null,
        })
        .eq('id', activeVisit.id);
    } catch (err) {
      console.error('Error saving vitals:', err);
    } finally {
      setSavingVitals(false);
    }
  };

  const completeVisit = async () => {
    if (!activeVisit || !activePatient) return;
    try {
      const { error: recordError } = await supabase.from('medical_records').insert([{
        patient_id: activePatient.id, diagnosis, prescription, doctor_notes: notes,
        clinic_id: clinicId, fee_collected: consultationFee, payment_method: paymentMethod
      }]);
      if (recordError) throw recordError;
      const { error: apptError } = await supabase.from('appointments').update({ status: 'completed' }).eq('id', activeVisit.id);
      if (apptError) throw apptError;
      await supabase.from('patients').update({
        status: 'completed',
        consultation_fee: consultationFee,
        is_active: false,
        updated_at: new Date().toISOString()
      }).eq('id', activePatient.id);
      toast.success(`✅ Consultation complete. Fee collected: ₹${consultationFee}`);
      setActiveVisit(null); setActivePatient(null); setVitalsLoaded(false); fetchQueue();
    } catch (err: any) {
      console.error('Error completing visit:', err);
      toast.error('Failed to save record: ' + err.message);
    }
  };

  const generateAISummary = async () => {
    if (!activePatient || history.length === 0) { setAiSummary("No history available to summarize."); return; }
    setLoadingSummary(true);
    const summary = await summarizePatientHistory(history.map(h => ({ visit: { ...h, arrivalTime: h.created_at, status: 'completed' } as any, diagnosis: h.diagnosis })));
    setAiSummary(summary || "Unable to generate summary.");
    setLoadingSummary(false);
  };

  const handleSmartSuggest = async () => {
    if (!notes) { toast.error('Please enter some clinical notes/symptoms first.'); return; }
    setLoadingSuggestions(true);
    const suggestions = await generateClinicalSuggestions(notes);
    setAiSuggestions(suggestions);
    setLoadingSuggestions(false);
  };

  const addMedicine = (med: string) => {
    setPrescription(prev => prev ? `${prev}\n- ${med}` : `- ${med}`);
    setMedQuery(''); setShowMedSuggestions(false);
  };

  const filteredMeds = MEDICINE_LIST.filter(m => m.toLowerCase().includes(medQuery.toLowerCase()));

  const hasVitals = vitalsForm.bp_systolic || vitalsForm.heart_rate || vitalsForm.temperature_f || vitalsForm.weight_kg;

  return (
    <div className="flex h-full flex-col md:flex-row">

      {/* ── Sidebar Queue (fixed width) ── */}
      <aside className="w-full md:w-[350px] flex-shrink-0 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col max-h-[40vh] md:max-h-full">
        {/* Queue header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Patient Queue</h2>
            <p className="text-xs text-slate-500 mt-0.5">{queue.length} waiting</p>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${queue.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {queue.length > 0 ? 'Active' : 'Clear'}
          </span>
        </div>

        {/* Queue list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-10 md:py-16 px-4">
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" style={{ animationDuration: '2s' }} />
                <div className="absolute inset-2 rounded-full bg-violet-500/15 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.3s' }} />
                <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500/20 to-violet-600/20 border border-indigo-300/40 flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.15)]">
                  <div className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.5)]" />
                </div>
              </div>
              <p className="text-sm font-black text-slate-900 tracking-widest uppercase">System Ready</p>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">Awaiting patient<br />check-in from Front Desk</p>
            </div>
          ) : (
            queue.map(visit => (
              <div key={visit.id} className="group">
                <QueueItem visit={visit} onClick={() => startConsultation(visit)} />
                <div className="px-3 pb-1 flex items-center gap-2">
                  {visit.source === 'QR_Checkin' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-semibold rounded-full">
                      📱 QR Check-In
                    </span>
                  )}
                  {visit.source === 'Front_Desk' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-semibold rounded-full">
                      🖥 Front Desk
                    </span>
                  )}
                  <WaitTime createdAt={visit.arrivalTime} />
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ── Consultation Workspace ── */}
      <main className="flex-1 overflow-y-auto bg-slate-50">
        {!activeVisit ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="relative mb-6">
              <div className="absolute -inset-4 rounded-full bg-indigo-500/10 animate-ping" style={{ animationDuration: '3s' }} />
              <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-indigo-500/15 to-purple-500/15 flex items-center justify-center border border-indigo-200/60 shadow-[0_0_40px_rgba(139,92,246,0.1)]">
                <Stethoscope className="text-indigo-500" size={48} />
              </div>
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full border-2 border-white shadow-[0_0_10px_rgba(52,211,153,0.5)] animate-pulse" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Ready for Consultation</h3>
            <p className="text-slate-500 max-w-xs leading-relaxed text-sm">
              Select a patient from the queue on the left to begin their consultation session.
            </p>
            {queue.length > 0 && (
              <div className="mt-6 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl">
                <p className="text-sm font-bold text-indigo-700">
                  {queue.length} patient{queue.length > 1 ? 's' : ''} waiting →
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 md:p-6 max-w-6xl mx-auto">
            {/* Patient header strip */}
            <div className="flex items-center gap-4 mb-6 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 flex-shrink-0">
                <User size={26} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold text-slate-900 truncate">{activePatient?.name}</h3>
                <p className="text-sm text-slate-500">
                  {activePatient?.gender} · {activePatient?.dob ? new Date().getFullYear() - new Date(activePatient.dob).getFullYear() : 'N/A'} yrs · {activePatient?.phone}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Source badge */}
                {(activeVisit as any)?.source === 'QR_Checkin' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full border border-blue-200">
                    📱 QR
                  </span>
                )}
                <span className="text-xs font-bold px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-full border border-indigo-200">
                  In Consultation
                </span>
              </div>
            </div>

            {/* ── 2-Column Workspace Grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* LEFT COL */}
              <div className="space-y-5">

                {/* Diagnosis */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm min-h-[160px]">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <FileText size={15} className="text-indigo-500" /> Diagnosis
                    </label>
                    <button
                      onClick={handleSmartSuggest}
                      disabled={loadingSuggestions}
                      className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full font-bold flex items-center gap-1 hover:bg-indigo-100 transition-colors border border-indigo-200"
                    >
                      <Sparkles size={11} />
                      {loadingSuggestions ? 'Analyzing...' : 'Smart Suggest'}
                    </button>
                  </div>

                  {aiSuggestions.length > 0 && (
                    <div className="mb-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl space-y-2">
                      <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">AI Suggestions</div>
                      <div className="flex flex-wrap gap-2">
                        {aiSuggestions.map((s, i) => (
                          <button key={i} onClick={() => { setDiagnosis(s.diagnosis); setPrescription(prev => prev + (prev ? '\n' : '') + `Protocol: ${s.protocol}`); setAiSuggestions([]); }}
                            className="text-xs bg-white text-slate-900 border border-slate-200 px-3 py-1.5 rounded-lg hover:border-indigo-500 hover:text-indigo-600 transition-all text-left shadow-sm">
                            <span className="font-bold">{s.diagnosis}</span>
                            <span className="block text-[10px] text-slate-400 truncate max-w-[150px]">{s.protocol}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <input
                    value={diagnosis}
                    onChange={e => setDiagnosis(e.target.value)}
                    placeholder="Enter diagnosis..."
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 text-slate-900 placeholder:text-slate-400 transition-all"
                  />
                </div>

                {/* Prescription */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm min-h-[160px]">
                  <label className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
                    <ClipboardList size={15} className="text-violet-500" /> Prescription
                  </label>
                  <div className="mb-2 relative">
                    <input
                      type="text"
                      placeholder="Search medicines (e.g. Para...)"
                      value={medQuery}
                      onChange={e => { setMedQuery(e.target.value); setShowMedSuggestions(true); }}
                      onFocus={() => setShowMedSuggestions(true)}
                      className="w-full p-3 pl-9 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 text-slate-900 placeholder:text-slate-400"
                    />
                    <ClipboardList size={14} className="absolute left-3 top-3.5 text-slate-400" />
                    {showMedSuggestions && medQuery && (
                      <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-xl shadow-md mt-1 max-h-40 overflow-y-auto">
                        {filteredMeds.map((med, idx) => (
                          <div key={idx} onClick={() => addMedicine(med)}
                            className="p-3 hover:bg-indigo-50 cursor-pointer text-sm font-medium text-slate-900 border-b border-slate-100 last:border-0">
                            {med}
                          </div>
                        ))}
                        {filteredMeds.length === 0 && <div className="p-3 text-xs text-slate-400 italic">No matches found</div>}
                      </div>
                    )}
                  </div>
                  <textarea
                    value={prescription}
                    onChange={e => setPrescription(e.target.value)}
                    placeholder="Prescription details..."
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 min-h-[100px] font-mono text-sm text-slate-900 placeholder:text-slate-400"
                  />
                </div>

                {/* Clinical Notes */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm min-h-[160px]">
                  <label className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
                    <FileText size={15} className="text-slate-400" /> Clinical Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Doctor's internal notes..."
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 min-h-[90px] text-slate-900 placeholder:text-slate-400"
                  />
                </div>

                {/* Billing */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm min-h-[160px]">
                  <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Banknote size={15} className="text-emerald-500" /> Billing
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Fee (₹)</label>
                      <input
                        type="number"
                        value={consultationFee === 0 ? '' : consultationFee}
                        onChange={e => setConsultationFee(Number(e.target.value))}
                        placeholder="0"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Method</label>
                      <select
                        value={paymentMethod}
                        onChange={e => setPaymentMethod(e.target.value as any)}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                      >
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="Card">Card</option>
                        <option value="Insurance">Insurance</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Complete button */}
                <button
                  onClick={completeVisit}
                  className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white py-4 px-6 rounded-2xl text-base font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.01] active:scale-[0.99]"
                >
                  <Send size={18} /> Complete &amp; Collect ₹{consultationFee}
                </button>
              </div>

              {/* RIGHT COL */}
              <div className="space-y-5">

                {/* Editable Vitals Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                      <Activity className="text-rose-500" size={16} /> Vitals
                    </h3>
                    {vitalsLoaded && (
                      <button
                        onClick={saveVitals}
                        disabled={savingVitals}
                        className="text-xs bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full font-bold flex items-center gap-1 hover:bg-emerald-100 transition-colors border border-emerald-200 disabled:opacity-50"
                      >
                        <Save size={11} />
                        {savingVitals ? 'Saving...' : 'Save Vitals'}
                      </button>
                    )}
                  </div>

                  {/* Display existing vitals or editable form */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <Heart size={10} className="text-rose-400" /> Blood Pressure (mmHg)
                      </label>
                      <div className="flex gap-2 items-center mt-1">
                        <input type="number" placeholder="Systolic"
                          value={vitalsForm.bp_systolic}
                          onChange={e => setVitalsForm(v => ({ ...v, bp_systolic: e.target.value }))}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 text-sm font-semibold text-slate-800"
                        />
                        <span className="text-slate-400 font-bold text-lg flex-shrink-0">/</span>
                        <input type="number" placeholder="Diastolic"
                          value={vitalsForm.bp_diastolic}
                          onChange={e => setVitalsForm(v => ({ ...v, bp_diastolic: e.target.value }))}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 text-sm font-semibold text-slate-800"
                        />
                      </div>
                    </div>
                    <VitalInput label="Heart Rate" unit="bpm" value={vitalsForm.heart_rate}
                      onChange={v => setVitalsForm(f => ({ ...f, heart_rate: v }))} />
                    <VitalInput label="Temperature" unit="°F" value={vitalsForm.temperature_f}
                      onChange={v => setVitalsForm(f => ({ ...f, temperature_f: v }))} />
                    <div className="col-span-2">
                      <VitalInput label="Weight" unit="kg" value={vitalsForm.weight_kg}
                        onChange={v => setVitalsForm(f => ({ ...f, weight_kg: v }))} />
                    </div>
                  </div>

                  {/* Quick vitals summary if filled */}
                  {hasVitals && (
                    <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
                      {vitalsForm.bp_systolic && vitalsForm.bp_diastolic && (
                        <div className="bg-rose-50 border border-rose-100 rounded-lg p-2 text-center">
                          <div className="text-lg font-black text-rose-700">{vitalsForm.bp_systolic}/{vitalsForm.bp_diastolic}</div>
                          <div className="text-[9px] text-rose-400 font-bold">BP mmHg</div>
                        </div>
                      )}
                      {vitalsForm.heart_rate && (
                        <div className="bg-pink-50 border border-pink-100 rounded-lg p-2 text-center">
                          <div className="text-lg font-black text-pink-700">{vitalsForm.heart_rate}</div>
                          <div className="text-[9px] text-pink-400 font-bold">BPM</div>
                        </div>
                      )}
                      {vitalsForm.temperature_f && (
                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-2 text-center">
                          <div className="text-lg font-black text-amber-700">{vitalsForm.temperature_f}°F</div>
                          <div className="text-[9px] text-amber-400 font-bold">{((Number(vitalsForm.temperature_f) - 32) * 5 / 9).toFixed(1)}°C</div>
                        </div>
                      )}
                      {vitalsForm.weight_kg && (
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 text-center">
                          <div className="text-lg font-black text-blue-700">{vitalsForm.weight_kg}</div>
                          <div className="text-[9px] text-blue-400 font-bold">kg</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* History Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm min-h-[160px]">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                      <History className="text-indigo-500" size={16} /> Medical History
                    </h3>
                    <button onClick={generateAISummary} disabled={loadingSummary}
                      className="text-indigo-600 p-2 hover:bg-indigo-50 rounded-lg transition-colors">
                      <Sparkles size={16} className={loadingSummary ? 'animate-pulse' : ''} />
                    </button>
                  </div>

                  {aiSummary && (
                    <div className="mb-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl animate-in slide-in-from-top-2">
                      <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">AI Summary</div>
                      <p className="text-sm text-indigo-900 leading-relaxed">{aiSummary}</p>
                    </div>
                  )}

                  <div className="space-y-4 relative before:absolute before:left-[11px] before:top-2 before:bottom-0 before:w-0.5 before:bg-slate-200">
                    {history.length === 0 ? (
                      <p className="text-xs text-slate-400 italic pl-6">First time visit.</p>
                    ) : (
                      history.map(h => (
                        <div key={h.id} className="relative pl-8">
                          <div className="absolute left-0 top-1 w-[24px] h-[24px] bg-white border-2 border-slate-200 rounded-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-indigo-400 rounded-full" />
                          </div>
                          <div className="text-xs font-bold text-slate-500">{new Date(h.created_at).toLocaleDateString()}</div>
                          <div className="text-sm font-semibold text-slate-900">{h.diagnosis}</div>
                          <div className="text-xs text-slate-500 italic">{h.doctor_notes}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Digital Files */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm min-h-[160px]">
                  <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2 text-sm">
                    <Eye className="text-indigo-500" size={16} /> Digital Files
                  </h3>
                  <div className="text-xs text-slate-400 italic">No documents available.</div>
                </div>

              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

// ── Wait Time Counter Component ──
function WaitTime({ createdAt }: { createdAt: string }) {
  const [mins, setMins] = React.useState(0);

  React.useEffect(() => {
    const calc = () => {
      const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
      setMins(diff);
    };
    calc();
    const interval = setInterval(calc, 30000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const color = mins < 15 ? 'text-green-600' : mins < 30 ? 'text-yellow-600' : 'text-red-600';

  return (
    <span className={`text-[10px] font-bold ${color}`}>
      ⏱ {mins}m wait
    </span>
  );
}

export default DoctorDashboard;