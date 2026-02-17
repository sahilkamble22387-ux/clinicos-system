
import React, { useState, useEffect } from 'react';
import { Clock, User, ClipboardList, History, FileText, Send, Sparkles, Eye } from 'lucide-react';
import { supabase } from '../../services/db';
import { Visit, Patient, VisitStatus, Document, MedicalRecord } from '../../types';
import { summarizePatientHistory } from '../../services/geminiService';
import QueueItem from './QueueItem';

interface DoctorDashboardProps {
  clinicId: string;
}

const DoctorDashboard: React.FC<DoctorDashboardProps> = ({ clinicId }) => {
  const [queue, setQueue] = useState<Visit[]>([]);
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const [activePatient, setActivePatient] = useState<Patient | null>(null);
  const [history, setHistory] = useState<MedicalRecord[]>([]);
  const [docs, setDocs] = useState<Document[]>([]);
  const [notes, setNotes] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);

  useEffect(() => {
    // Initial fetch
    const fetchQueue = async () => {
      const { data } = await supabase
        .from('appointments')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('status', 'waiting')
        .order('created_at', { ascending: true });
      if (data) {
        // Map Supabase appointments to Visit type (adapter)
        const visits: Visit[] = data.map((d: any) => ({
          id: d.id,
          patientId: d.patient_id,
          arrivalTime: d.created_at,
          status: d.status as VisitStatus
        }));
        setQueue(visits);
      }
    };
    fetchQueue();

    // Subscribe to realtime changes
    const subscription = supabase
      .channel('appointments-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'appointments', filter: `clinic_id=eq.${clinicId}` }, payload => {
        const newVisit = payload.new as any;
        if (newVisit.status === 'waiting') {
          setQueue(prev => [...prev, {
            id: newVisit.id,
            patientId: newVisit.patient_id,
            arrivalTime: newVisit.created_at,
            status: VisitStatus.WAITING
          }]);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'appointments', filter: `clinic_id=eq.${clinicId}` }, payload => {
        // Handle removals from queue if status changes from waiting
        const updatedVisit = payload.new as any;
        if (updatedVisit.status !== 'waiting') {
          setQueue(prev => prev.filter(v => v.id !== updatedVisit.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [clinicId]);

  // Helper to fetch patient details on demand if not in state
  const getPatientDetails = async (patientId: string) => {
    const { data } = await supabase.from('patients').select('*').eq('id', patientId).single();
    return data ? {
      id: data.id,
      name: data.full_name,
      gender: data.gender as any,
      dob: data.dob,
      phone: data.phone,
      address: data.address,
      createdAt: data.created_at
    } as Patient : null;
  };

  const startConsultation = async (visit: Visit) => {
    const patient = await getPatientDetails(visit.patientId);
    if (patient) {
      setActiveVisit(visit);
      setActivePatient(patient);
      const { data: records } = await supabase
        .from('medical_records')
        .select('*')
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false });

      if (records) {
        setHistory(records as MedicalRecord[]);
      }

      // TODO: Fetch docs from Supabase in future
      // setHistory([]); // Removed placeholder
      setDocs([]);
      setNotes('');
      setDiagnosis('');
      setPrescription('');
      setAiSummary(null);

      // Update status in Supabase
      await supabase.from('appointments').update({ status: 'consulting' }).eq('id', visit.id);
    }
  };



  const generateAISummary = async () => {
    if (!activePatient) return;
    setLoadingSummary(true);
    const summary = await summarizePatientHistory(history.map(h => ({
      visit: { ...h, arrivalTime: h.createdAt, status: 'completed' } as any, // Adapt to Visit type
      diagnosis: h.diagnosis
    })));
    setAiSummary(summary || "No history to summarize.");
    setLoadingSummary(false);
  };

  const [prescription, setPrescription] = useState('');

  const completeVisit = async () => {
    if (activeVisit && activePatient) {
      try {
        // 1. Save Medical Record
        const { error: recordError } = await supabase.from('medical_records').insert([{
          patient_id: activePatient.id,
          diagnosis: diagnosis,
          prescription: prescription,
          doctor_notes: notes,
          clinic_id: clinicId
        }]);

        if (recordError) throw recordError;

        // 2. Update Appointment Status
        const { error: apptError } = await supabase.from('appointments').update({
          status: 'completed'
        }).eq('id', activeVisit.id);

        if (apptError) throw apptError;

        setActiveVisit(null);
        setActivePatient(null);
        setNotes('');
        setPrescription('');
        setDiagnosis('');
        alert("Consultation Completed & Record Saved!");
      } catch (err: any) {
        console.error('Error completing visit:', err);
        alert('Failed to save record: ' + err.message);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Left Panel: Queue */}
      <div className="w-80 bg-white border-r border-slate-200 p-6 flex flex-col">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Patient Queue</h2>
        <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar">
          {queue.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No patients in queue.</p>
          ) : (
            queue.map(visit => (
              <QueueItem key={visit.id} visit={visit} onClick={() => { startConsultation(visit); }} />
            ))
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        {!activeVisit ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <Clock size={64} className="mb-4 text-indigo-400" />
            <p className="text-xl font-semibold">Select a patient from the queue to start a consultation.</p>
            <p className="text-sm mt-2">Patients will appear here as they check in.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-8">
            {/* Main Consultation Area */}
            <div className="md:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                  <User size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">{activePatient?.name}</h3>
                  <p className="text-sm text-slate-500">
                    {activePatient?.gender}, {activePatient?.dob ? new Date().getFullYear() - new Date(activePatient.dob).getFullYear() : 'N/A'} yrs
                  </p>
                </div>
              </div>

              <div className="flex-1 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <FileText size={16} /> Diagnosis
                  </label>
                  <input
                    value={diagnosis}
                    onChange={e => setDiagnosis(e.target.value)}
                    placeholder="Enter primary diagnosis..."
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <ClipboardList size={16} /> Prescription
                  </label>
                  <textarea
                    value={prescription}
                    onChange={e => setPrescription(e.target.value)}
                    placeholder="List medications, dosage, and frequency..."
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 min-h-[120px]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <FileText size={16} /> Clinical Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Type clinical observations and symptoms..."
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 min-h-[150px] leading-relaxed"
                  />
                </div>
              </div>

              <button
                onClick={completeVisit}
                className="mt-8 w-full bg-indigo-600 text-white py-3 px-6 rounded-xl text-lg font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
              >
                <Send size={20} /> Complete Visit
              </button>
            </div>

            {/* Side Panel: History & ONH */}
            <div className="md:col-span-4 space-y-6">
              {/* ONH - One Click History (Digital Files) */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Eye className="text-indigo-600" size={18} /> ONH: Digital Files
                </h3>
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                  {docs.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No uploaded documents</p>
                  ) : (
                    docs.map(doc => (
                      <button
                        key={doc.id}
                        onClick={() => setViewingDoc(doc)}
                        className="w-full flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-indigo-50 transition-colors text-left"
                      >
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-slate-100 shadow-sm text-indigo-600">
                          <FileText size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold truncate text-slate-800">{doc.label}</div>
                          <div className="text-[10px] text-slate-500">{new Date(doc.uploadedAt).toLocaleDateString()}</div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div >

              {/* History Timeline */}
              < div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6" >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <History className="text-indigo-600" size={18} /> Visit History
                  </h3>
                  <button
                    onClick={generateAISummary}
                    disabled={loadingSummary}
                    className="text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                  >
                    <Sparkles size={18} />
                  </button>
                </div>

                {
                  aiSummary && (
                    <div className="mb-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                      <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                        <Sparkles size={10} /> AI Summary
                      </div>
                      <p className="text-sm text-indigo-900 leading-relaxed whitespace-pre-wrap">{aiSummary}</p>
                    </div>
                  )
                }

                <div className="space-y-4 relative before:absolute before:left-[11px] before:top-2 before:bottom-0 before:w-0.5 before:bg-slate-100">
                  {history.length === 0 ? (
                    <p className="text-xs text-slate-400 italic pl-6">New patient (no history)</p>
                  ) : (
                    history.map(h => (
                      <div key={h.id} className="relative pl-8">
                        <div className="absolute left-0 top-1 w-[24px] h-[24px] bg-white border-2 border-slate-200 rounded-full flex items-center justify-center">
                          <div className="w-2 h-2 bg-indigo-400 rounded-full"></div>
                        </div>
                        <div className="text-xs font-bold text-slate-500 mb-1">{new Date(h.createdAt).toLocaleDateString()}</div>
                        <div className="text-sm font-semibold text-slate-800">{h.diagnosis || 'General Checkup'}</div>
                        <div className="text-xs text-slate-500 mt-0.5 italic line-clamp-2">{h.doctorNotes}</div>
                      </div>
                    ))
                  )}
                </div>
              </div >
            </div >
          </div >
        )}
      </div >

      {/* Document Viewer Modal */}
      {
        viewingDoc && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in duration-200">
              <div className="flex justify-between items-center p-6 border-b border-slate-100">
                <h3 className="text-xl font-bold flex items-center gap-3">
                  <FileText className="text-indigo-600" />
                  {viewingDoc.label}
                </h3>
                <button onClick={() => setViewingDoc(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={24} />
                </button>
              </div>
              <div className="flex-1 overflow-auto bg-slate-100 p-8 flex items-center justify-center">
                <div className="bg-white shadow-lg w-full max-w-2xl aspect-[1/1.41] p-12 border border-slate-200 flex flex-col items-center justify-center">
                  <div className="w-32 h-32 bg-indigo-50 text-indigo-200 rounded-full flex items-center justify-center mb-6">
                    <Eye size={64} />
                  </div>
                  <p className="text-slate-500 font-medium">Simulation of Document View: {viewingDoc.label}</p>
                  <div className="mt-8 space-y-4 w-full opacity-20">
                    <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                    <div className="h-4 bg-slate-200 rounded w-full"></div>
                    <div className="h-4 bg-slate-200 rounded w-2/3"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

// Utility to close modals
const X = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);

export default DoctorDashboard;
