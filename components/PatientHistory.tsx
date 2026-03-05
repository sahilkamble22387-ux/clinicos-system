import React, { useState, useEffect } from 'react';
import { Clinic, Patient } from '../types';
import { supabase } from '../services/db';
import { FileText, Calendar, Search, ArrowLeft, X, Phone, MapPin, User, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface PatientHistoryProps {
    clinic: Clinic | null;
    onBack?: () => void;
}

const PatientHistory: React.FC<PatientHistoryProps> = ({ clinic, onBack }) => {
    const [patients, setPatients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
    const [patientRecords, setPatientRecords] = useState<any[]>([]);
    const [loadingRecords, setLoadingRecords] = useState(false);

    useEffect(() => {
        fetchHistory();
    }, [clinic]);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            // Use clinic ID or fallback dummy ID for Test Mode
            const clinicId = clinic?.id || '00000000-0000-0000-0000-000000000000';

            const { data, error } = await supabase
                .from('patients')
                .select('*')
                .eq('clinic_id', clinicId)
                .eq('status', 'completed')
                .order('updated_at', { ascending: false });

            if (error) {
                // Surface only the message — not raw Supabase error object
                console.error('[PatientHistory] fetch failed:', error.message);
            } else {
                setPatients(data || []);
            }
        } catch (err: any) {
            console.error('[PatientHistory] unexpected error:', err?.message ?? 'unknown');
        } finally {
            setLoading(false);
        }
    };

    const fetchPatientRecords = async (patientId: string) => {
        try {
            setLoadingRecords(true);
            const { data, error } = await supabase
                .from('medical_records')
                .select('*')
                .eq('patient_id', patientId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPatientRecords(data || []);
        } catch (err: any) {
            console.error('[PatientHistory] records fetch failed:', err?.message ?? 'unknown');
        } finally {
            setLoadingRecords(false);
        }
    };

    const handlePatientClick = (patient: any) => {
        setSelectedPatient(patient);
        fetchPatientRecords(patient.id);
    };

    const filteredPatients = patients.filter(p =>
        p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.phone?.includes(searchTerm) ||
        (p.updated_at && new Date(p.updated_at).toLocaleDateString().includes(searchTerm))
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500 min-h-screen pb-24 md:pb-8 max-w-7xl mx-auto px-4 md:px-6 pt-4 md:pt-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                            <ArrowLeft className="w-6 h-6 text-slate-600" />
                        </button>
                    )}
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Patient History</h2>
                        <p className="text-slate-500">View treated patients and medical records</p>
                    </div>
                </div>

                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search by name, phone, date..."
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                    <p className="text-slate-500 font-medium">Loading history...</p>
                </div>
            ) : filteredPatients.length === 0 ? (
                <div className="bg-white rounded-2xl p-16 text-center border border-dashed border-slate-300">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <FileText className="w-10 h-10 text-slate-300" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">No records found</h3>
                    <p className="text-slate-500 max-w-sm mx-auto">
                        {searchTerm ? 'Try adjusting your search terms.' : 'Competed visits will appear here automatically.'}
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 font-semibold text-slate-700">Date</th>
                                    <th className="px-6 py-4 font-semibold text-slate-700">Patient</th>
                                    <th className="px-6 py-4 font-semibold text-slate-700">Contact</th>
                                    <th className="px-6 py-4 font-semibold text-slate-700 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredPatients.map((patient) => (
                                    <tr key={patient.id} className="hover:bg-slate-50/80 transition-colors group cursor-pointer" onClick={() => handlePatientClick(patient)}>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <div className="flex items-center gap-2 font-medium text-slate-700">
                                                <Calendar className="w-4 h-4 text-indigo-500" />
                                                {new Date(patient.updated_at || patient.created_at).toLocaleDateString()}
                                            </div>
                                            <div className="text-xs text-slate-400 ml-6 mt-0.5">
                                                {new Date(patient.updated_at || patient.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-bold text-sm">
                                                    {(patient.full_name || 'U').charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-900">{patient.full_name || 'Unknown'}</div>
                                                    <div className="text-xs text-slate-500">{patient.gender}, {patient.dob ? `${new Date().getFullYear() - new Date(patient.dob).getFullYear()} yrs` : 'N/A'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="text-sm text-slate-600 flex items-center gap-2">
                                                <Phone className="w-3 h-3 text-slate-400" /> {patient.phone}
                                            </div>
                                            <div className="text-xs text-slate-400 mt-1 truncate max-w-[150px] flex items-center gap-2">
                                                <MapPin className="w-3 h-3 text-slate-400" /> {patient.address}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <button className="text-indigo-600 hover:text-indigo-800 font-medium text-sm flex items-center justify-end gap-1 ml-auto group-hover:underline">
                                                View Records <ChevronRight size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Patient Details Modal */}
            {selectedPatient && (
                <PatientHistoryModal patient={selectedPatient} onClose={() => setSelectedPatient(null)} />
            )}
</div>
    );
};


// ── Types ──
interface VisitRecord {
  id: string
  created_at: string
  diagnosis: string
  prescription: string | null
  doctor_notes: string | null
  fee_collected: number
  payment_method: string
  vitals: {
    bp_systolic: number | null
    bp_diastolic: number | null
    heart_rate: number | null
    weight_kg: number | null
    temperature_f: number | null
  } | null
  medicines: {
    id: string
    medicine_name: string
    strength: string | null
    form: string | null
    dosage: string
    duration: string
    instructions: string | null
  }[]
}

async function fetchPatientHistory(patientId: string): Promise<VisitRecord[]> {
  const { data: records, error } = await supabase
    .from('medical_records')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })

  if (error || !records) return []

  const { data: appointments } = await supabase
    .from('appointments')
    .select('id, patient_id, bp_systolic, bp_diastolic, heart_rate, weight_kg, temperature_f, created_at')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })

  const recordIds = records.map(r => r.id)
  let prescriptionItems: any[] = []
  if (recordIds.length > 0) {
    const { data: items } = await supabase
      .from('prescription_items')
      .select('*')
      .in('medical_record_id', recordIds)
      .order('sort_order', { ascending: true })
    prescriptionItems = items ?? []
  }

  return records.map(record => {
    const recordDate = new Date(record.created_at).toDateString()
    const matchedAppt = appointments?.find(a =>
      new Date(a.created_at).toDateString() === recordDate
    )
    const meds = prescriptionItems.filter(item => item.medical_record_id === record.id)

    return {
      id: record.id,
      created_at: record.created_at,
      diagnosis: record.diagnosis ?? 'Not specified',
      prescription: record.prescription ?? null,
      doctor_notes: record.doctor_notes ?? null,
      fee_collected: record.fee_collected ?? 0,
      payment_method: record.payment_method ?? 'Cash',
      vitals: matchedAppt ? {
        bp_systolic:  matchedAppt.bp_systolic  ?? null,
        bp_diastolic: matchedAppt.bp_diastolic ?? null,
        heart_rate:   matchedAppt.heart_rate   ?? null,
        weight_kg:    matchedAppt.weight_kg    ?? null,
        temperature_f: matchedAppt.temperature_f ?? null,
      } : null,
      medicines: meds.map(m => ({
        id: m.id,
        medicine_name: m.medicine_name,
        strength: m.strength ?? null,
        form: m.form ?? null,
        dosage: m.dosage,
        duration: m.duration,
        instructions: m.instructions ?? null,
      })),
    }
  })
}

function VisitCard({ visit }: { visit: VisitRecord }) {
  const [expanded, setExpanded] = useState(false)
  const hasVitals = visit.vitals && Object.values(visit.vitals).some(v => v !== null)
  const hasMeds = visit.medicines.length > 0

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden mb-3 bg-white">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left px-4 py-3.5 flex items-start justify-between hover:bg-slate-50 transition"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              {new Date(visit.created_at).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric'
              })}
            </span>
            <span className="text-xs text-slate-400">
              {new Date(visit.created_at).toLocaleTimeString('en-IN', {
                hour: '2-digit', minute: '2-digit'
              })}
            </span>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">DIAGNOSIS</p>
          <p className="font-bold text-slate-900 text-sm">{visit.diagnosis}</p>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {hasMeds && (
              <span className="text-[10px] font-bold px-2 py-0.5 bg-violet-50 text-violet-700 rounded-full border border-violet-100">
                💊 {visit.medicines.length} medicine{visit.medicines.length !== 1 ? 's' : ''}
              </span>
            )}
            {hasVitals && (
              <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                🩺 Vitals recorded
              </span>
            )}
            {visit.fee_collected > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
                💰 Rs.{visit.fee_collected.toLocaleString('en-IN')}
              </span>
            )}
          </div>
        </div>
        <div className={`flex-shrink-0 ml-3 mt-1 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
          <ChevronDown size={16} className="text-slate-400" />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100">
          {hasVitals && (
            <div className="px-4 py-3 bg-blue-50/50 border-b border-slate-100">
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2.5">
                🩺 Vitals
              </p>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {[
                  {
                    label: 'Blood Pressure',
                    value: (visit.vitals?.bp_systolic && visit.vitals?.bp_diastolic)
                      ? `${visit.vitals.bp_systolic}/${visit.vitals.bp_diastolic}`
                      : null,
                    unit: 'mmHg',
                    icon: '❤️',
                    normal: visit.vitals?.bp_systolic
                      ? visit.vitals.bp_systolic < 120 ? 'normal' : visit.vitals.bp_systolic < 140 ? 'warning' : 'high'
                      : 'normal',
                  },
                  {
                    label: 'Heart Rate',
                    value: visit.vitals?.heart_rate?.toString() ?? null,
                    unit: 'bpm',
                    icon: '💓',
                    normal: visit.vitals?.heart_rate
                      ? visit.vitals.heart_rate >= 60 && visit.vitals.heart_rate <= 100 ? 'normal' : 'warning'
                      : 'normal',
                  },
                  {
                    label: 'Temperature',
                    value: visit.vitals?.temperature_f?.toString() ?? null,
                    unit: '°F',
                    icon: '🌡️',
                    normal: visit.vitals?.temperature_f
                      ? visit.vitals.temperature_f < 99 ? 'normal' : visit.vitals.temperature_f < 101 ? 'warning' : 'high'
                      : 'normal',
                  },
                  {
                    label: 'Weight',
                    value: visit.vitals?.weight_kg?.toString() ?? null,
                    unit: 'kg',
                    icon: '⚖️',
                    normal: 'normal',
                  },
                  {
                    label: 'SpO2',
                    value: null,
                    unit: '%',
                    icon: '🫁',
                    normal: 'normal',
                  },
                ].filter(v => v.value !== null).map(vital => (
                    <div
                      key={vital.label}
                      className={`rounded-xl p-2.5 text-center border ${
                        vital.normal === 'high' ? 'bg-red-50 border-red-200' :
                        vital.normal === 'warning' ? 'bg-amber-50 border-amber-200' :
                        'bg-white border-slate-200'
                      }`}
                    >
                      <p className="text-base mb-0.5">{vital.icon}</p>
                      <p className={`font-black text-base leading-none ${
                        vital.normal === 'high' ? 'text-red-600' :
                        vital.normal === 'warning' ? 'text-amber-600' :
                        'text-slate-900'
                      }`}>
                        {vital.value}
                      </p>
                      <p className="text-slate-400 text-[9px] font-medium mt-0.5">{vital.unit}</p>
                      <p className="text-slate-500 text-[9px] leading-tight mt-1">{vital.label}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {hasMeds && (
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-[10px] font-black text-violet-600 uppercase tracking-widest mb-2.5">
                💊 Prescription
              </p>
              <div className="space-y-2">
                {visit.medicines.map((med, i) => (
                  <div key={med.id} className="flex items-start gap-3 p-2.5 bg-violet-50/50 rounded-xl border border-violet-100">
                    <div className="w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-[9px] font-black">{i + 1}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">{med.medicine_name}</span>
                        {med.strength && (
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                            {med.strength}
                          </span>
                        )}
                        {med.form && (
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md capitalize">
                            {med.form}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-slate-600 font-semibold">{med.dosage}</span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-600">{med.duration}</span>
                        {med.instructions && (
                          <>
                            <span className="text-xs text-slate-400">·</span>
                            <span className="text-xs text-slate-500 italic">{med.instructions}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {visit.doctor_notes && (
            <div className="px-4 py-3 bg-amber-50/50 border-b border-slate-100">
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1.5">
                📝 Doctor's Notes
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">{visit.doctor_notes}</p>
            </div>
          )}

          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center">
                <span className="text-sm">💰</span>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Fee Collected</p>
                <p className="text-sm font-black text-emerald-700">
                  {visit.fee_collected > 0 ? `Rs.${visit.fee_collected.toLocaleString('en-IN')}` : 'No fee recorded'}
                </p>
              </div>
            </div>
            {visit.fee_collected > 0 && (
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                {visit.payment_method}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function PatientHistoryModal({ patient, onClose }: { patient: any; onClose: () => void }) {
  const [visits, setVisits] = useState<VisitRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPatientHistory(patient.id).then(data => {
      setVisits(data)
      setLoading(false)
    })
  }, [patient.id])

  const totalFee = visits.reduce((s, v) => s + v.fee_collected, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
      <motion.div
        className="bg-white rounded-3xl w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl"
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      >
        <div className="flex items-start gap-3 p-5 border-b border-slate-100">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center flex-shrink-0">
            <span className="text-indigo-700 font-black text-lg">
              {patient.full_name?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-black text-slate-900 text-lg leading-tight">{patient.full_name || 'Unknown'}</h2>
            <p className="text-slate-400 text-sm mt-0.5">
              {patient.gender ?? 'Unknown'} · {patient.phone}
            </p>
          </div>
          <div className="flex items-center gap-3 mr-8">
            <div className="text-center">
              <p className="text-xl font-black text-indigo-600">{visits.length}</p>
              <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Visits</p>
            </div>
            {totalFee > 0 && (
              <div className="text-center">
                <p className="text-sm font-black text-emerald-600">Rs.{totalFee.toLocaleString('en-IN')}</p>
                <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Total</p>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center hover:bg-slate-200 transition"
          >
            <X size={14} className="text-slate-600" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-indigo-500 w-6 h-6" />
            </div>
          ) : visits.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-bold text-slate-700">No visit history yet</p>
              <p className="text-slate-400 text-sm mt-1">
                Complete a consultation to see it here
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                {visits.length} Visit{visits.length !== 1 ? 's' : ''} · Tap to expand
              </p>
              {visits.map(visit => (
                <VisitCard key={visit.id} visit={visit} />
              ))}
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default PatientHistory;
