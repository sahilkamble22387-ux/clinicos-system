
import React, { useState, useEffect } from 'react';
import { Search, UserPlus, LogIn, FileUp, X, Check } from 'lucide-react';
import { supabase } from '../../services/db';
import { Patient, Gender } from '../../types';

interface FrontDeskProps {
  clinicId: string;
}

const FrontDesk: React.FC<FrontDeskProps> = ({ clinicId }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRegModal, setShowRegModal] = useState(false);
  const [newPatient, setNewPatient] = useState({ name: '', gender: Gender.MALE, dob: '', phone: '', address: '' });
  const [selectedPatientForUpload, setSelectedPatientForUpload] = useState<Patient | null>(null);

  // Fetch patients for search (optional, or rely on search)
  useEffect(() => {
    const fetchPatients = async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) {
        // Map Supabase 'full_name' to app's 'name' and ensure defaults
        const mappedPatients = data.map((p: any) => ({
          ...p,
          name: p.full_name || '', // Default to empty string if null
          address: p.address || '',
          phone: p.phone || ''
        }));
        setPatients(mappedPatients as any);
      }
    };
    fetchPatients();
  }, [showRegModal]); // Refresh on new registration

  const filteredPatients = patients.filter(p =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.phone?.includes(searchQuery) ||
    p.id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // 1. Create Patient
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .insert([{
          full_name: newPatient.name,
          gender: newPatient.gender,
          dob: newPatient.dob,
          phone: newPatient.phone,
          address: newPatient.address,
          full_name: newPatient.name,
          gender: newPatient.gender,
          dob: newPatient.dob,
          phone: newPatient.phone,
          address: newPatient.address,
          clinic_id: (await supabase.auth.getUser()).data.user?.id // Use user ID as clinic_id per request
        }])
        .select()
        .single();

      if (patientError) throw patientError;

      // 2. Create Waiting Appointment
      const { error: apptError } = await supabase
        .from('appointments')
        .insert([{
          patient_id: patientData.id,
          status: 'waiting'
        }]);

      if (apptError) throw apptError;

      // Reset
      setShowRegModal(false);
      setNewPatient({ name: '', gender: Gender.MALE, dob: '', phone: '', address: '' });
      alert(`Patient ${patientData.full_name} Registered & Checked In!`);

      // Refresh list
      const { data } = await supabase.from('patients').select('*').eq('clinic_id', clinicId).order('created_at', { ascending: false }).limit(50);
      if (data) setPatients(data as any);

    } catch (err: any) {
      console.error('Registration failed:', err);
      console.error('Error details:', {
        message: err.message,
        hint: err.hint,
        details: err.details
      });
      alert('Registration failed: ' + (err.message || 'Unknown error'));
    }
  };

  const handleCheckIn = async (patientId: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .insert([{
          patient_id: patientId,
          status: 'waiting'
        }]);

      if (error) throw error;
      alert("Patient Added to Doctor's Queue!");
    } catch (err: any) {
      alert('Check-in failed: ' + err.message);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (selectedPatientForUpload && e.target.files?.[0]) {
      const file = e.target.files[0];
      // MockDB.addDocument({
      //   patientId: selectedPatientForUpload.id,
      //   type: 'Prescription',
      //   label: file.name,
      //   url: 'blob:mock-url'
      // });
      alert(`File "${file.name}" uploaded for ${selectedPatientForUpload.name} (Storage Not Connected Yet)`);
      setSelectedPatientForUpload(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Front Desk</h1>
          <p className="text-slate-500 mt-1">Manage patient registration and arrival queue.</p>
        </div>
        <button
          onClick={() => setShowRegModal(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all"
        >
          <UserPlus size={18} />
          New Registration
        </button>
      </header>

      {/* Smart Search */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
          <Search size={20} />
        </div>
        <input
          type="text"
          placeholder="Smart Patient Search (Name, Phone, ID, or Address...)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
        />
      </div>

      {/* Patient Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Patient Info</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Age/Gender</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPatients.map(patient => (
                <tr key={patient.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-bold">
                        {(patient?.name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{patient.name}</div>
                        <div className="text-xs text-slate-500">ID: {patient.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-slate-700">{patient.phone}</div>
                    <div className="text-xs text-slate-500 truncate max-w-[150px]">{patient.address}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium">{patient.gender}</div>
                    <div className="text-xs text-slate-500">{new Date().getFullYear() - new Date(patient.dob).getFullYear()} Years</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setSelectedPatientForUpload(patient)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        title="Upload Records"
                      >
                        <FileUp size={18} />
                      </button>
                      <button
                        onClick={() => handleCheckIn(patient.id)}
                        className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-emerald-100 transition-all border border-emerald-100"
                      >
                        <Check size={16} />
                        Check-In
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Registration Modal */}
      {showRegModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl animate-in zoom-in duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold">Quick Patient Registration</h3>
              <button onClick={() => setShowRegModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>
            <form onSubmit={handleRegister} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Full Name</label>
                  <input required value={newPatient.name} onChange={e => setNewPatient({ ...newPatient, name: e.target.value })} type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Gender</label>
                  <select value={newPatient.gender} onChange={e => setNewPatient({ ...newPatient, gender: e.target.value as Gender })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20">
                    <option value={Gender.MALE}>Male</option>
                    <option value={Gender.FEMALE}>Female</option>
                    <option value={Gender.OTHER}>Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Date of Birth</label>
                  <input required value={newPatient.dob} onChange={e => setNewPatient({ ...newPatient, dob: e.target.value })} type="date" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Phone Number</label>
                  <input required value={newPatient.phone} onChange={e => setNewPatient({ ...newPatient, phone: e.target.value })} type="tel" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Address</label>
                  <textarea value={newPatient.address} onChange={e => setNewPatient({ ...newPatient, address: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 min-h-[80px]" />
                </div>
              </div>
              <button type="submit" className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all mt-4">
                Save & Register Patient
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Upload Modal (Scanner Sim) */}
      {selectedPatientForUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
              <FileUp size={40} />
            </div>
            <div>
              <h3 className="text-xl font-bold">Upload Digital Records</h3>
              <p className="text-slate-500 mt-2">Scan or upload files for <b>{selectedPatientForUpload.name}</b></p>
            </div>
            <label className="block w-full cursor-pointer group">
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-10 group-hover:border-indigo-500 group-hover:bg-indigo-50 transition-all">
                <span className="text-slate-400 group-hover:text-indigo-600 font-semibold">Click to select files</span>
                <input type="file" className="hidden" onChange={handleFileUpload} />
              </div>
            </label>
            <button onClick={() => setSelectedPatientForUpload(null)} className="text-slate-500 font-medium hover:text-slate-800 underline decoration-slate-300">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FrontDesk;
