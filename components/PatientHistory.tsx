import React, { useState, useEffect } from 'react';
import { Clinic, Patient } from '../types';
import { supabase } from '../services/db';
import { FileText, Calendar, Search, ArrowLeft, X, Phone, MapPin, User, ChevronRight } from 'lucide-react';

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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-start">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center">
                                    <User size={32} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-900">{selectedPatient.full_name}</h3>
                                    <p className="text-slate-500">{selectedPatient.gender} • {selectedPatient.phone}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedPatient(null)}
                                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 custom-scrollbar">
                            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <FileText size={16} /> Medical History
                            </h4>

                            {loadingRecords ? (
                                <div className="flex justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                </div>
                            ) : patientRecords.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
                                    <p className="text-slate-500">No medical records found for this patient.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {patientRecords.map((record) => (
                                        <div key={record.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                                                    {new Date(record.created_at).toLocaleDateString()}
                                                </div>
                                                <div className="text-xs text-slate-400">
                                                    {new Date(record.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <div>
                                                    <span className="text-xs font-bold text-slate-400 uppercase">Diagnosis</span>
                                                    <p className="text-lg font-semibold text-slate-800">{record.diagnosis}</p>
                                                </div>

                                                {record.prescription && (
                                                    <div>
                                                        <span className="text-xs font-bold text-slate-400 uppercase">Prescription</span>
                                                        <p className="text-slate-600 bg-slate-50 p-3 rounded-lg mt-1 text-sm border border-slate-100 font-mono">
                                                            {record.prescription}
                                                        </p>
                                                    </div>
                                                )}

                                                {record.doctor_notes && (
                                                    <div>
                                                        <span className="text-xs font-bold text-slate-400 uppercase">Doctor's Notes</span>
                                                        <p className="text-slate-600 text-sm mt-1 italic">
                                                            "{record.doctor_notes}"
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PatientHistory;
