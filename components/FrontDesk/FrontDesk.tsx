
import React, { useState, useEffect } from 'react';
import { Search, UserPlus, FileUp, X, Check, User, Phone, MapPin, Calendar, Users, Smartphone, Activity, Thermometer, Heart } from 'lucide-react';
import { supabase } from '../../services/db';
import { Patient, Gender } from '../../types';
import { toast } from 'react-hot-toast';

interface FrontDeskProps {
  clinicId: string;
}

const FrontDesk: React.FC<FrontDeskProps> = ({ clinicId }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRegModal, setShowRegModal] = useState(false);
  const [newPatient, setNewPatient] = useState({
    name: '', gender: Gender.MALE, dob: '', phone: '', address: '',
    bp_systolic: '', bp_diastolic: '', heart_rate: '', weight_kg: '', temperature_f: ''
  });
  const [selectedPatientForUpload, setSelectedPatientForUpload] = useState<Patient | null>(null);

  useEffect(() => {
    const fetchPatients = async () => {
      const { data } = await supabase
        .from('patients')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (data) {
        setPatients(data.map((p: any) => ({ ...p, name: p.full_name || '', address: p.address || '', phone: p.phone || '' })) as any);
      }
    };

    fetchPatients();

    const channel = supabase
      .channel('frontdesk-patients')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients', filter: `clinic_id=eq.${clinicId}` }, () => fetchPatients())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [clinicId]);

  const filteredPatients = patients.filter(p =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.phone?.includes(searchQuery) ||
    p.id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .insert([{
          full_name: newPatient.name,
          gender: newPatient.gender,
          dob: newPatient.dob || null,
          phone: newPatient.phone,
          address: newPatient.address || null,
          clinic_id: clinicId,
          status: 'waiting',
          is_active: true,
          source: 'Front_Desk',
          consultation_fee: 0,
        }])
        .select()
        .single();

      if (patientError) throw patientError;

      const { error: apptError } = await supabase
        .from('appointments')
        .insert([{
          patient_id: patientData.id,
          clinic_id: clinicId,
          status: 'waiting',
          bp_systolic: newPatient.bp_systolic ? Number(newPatient.bp_systolic) : null,
          bp_diastolic: newPatient.bp_diastolic ? Number(newPatient.bp_diastolic) : null,
          heart_rate: newPatient.heart_rate ? Number(newPatient.heart_rate) : null,
          weight_kg: newPatient.weight_kg ? Number(newPatient.weight_kg) : null,
          temperature_f: newPatient.temperature_f ? Number(newPatient.temperature_f) : null,
        }]);

      if (apptError) throw apptError;

      setShowRegModal(false);
      setNewPatient({ name: '', gender: Gender.MALE, dob: '', phone: '', address: '', bp_systolic: '', bp_diastolic: '', heart_rate: '', weight_kg: '', temperature_f: '' });
      toast.success(`✅ ${patientData.full_name} registered & added to queue!`);

      const { data } = await supabase.from('patients').select('*').eq('clinic_id', clinicId).order('created_at', { ascending: false }).limit(50);
      if (data) setPatients(data as any);

    } catch (err: any) {
      console.error('Registration failed:', err);
      toast.error('Registration failed: ' + (err.message || 'Unknown error'));
    }
  };

  const handleCheckIn = async (patientId: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .insert([{ patient_id: patientId, clinic_id: clinicId, status: 'waiting' }]);
      if (error) throw error;
      await supabase.from('patients').update({ status: 'waiting', is_active: true }).eq('id', patientId);
      toast.success("Patient added to Doctor's queue!");
    } catch (err: any) {
      toast.error('Check-in failed: ' + err.message);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (selectedPatientForUpload && e.target.files?.[0]) {
      const file = e.target.files[0];
      alert(`File "${file.name}" uploaded for ${selectedPatientForUpload.name} (Storage Not Connected Yet)`);
      setSelectedPatientForUpload(null);
    }
  };

  const inputCls = "w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700 placeholder:text-slate-400";
  const labelCls = "text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2";

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Front Desk</h1>
          <p className="text-slate-500 mt-1 text-sm">Manage patient registration and arrival queue.</p>
        </div>
        <button
          onClick={() => setShowRegModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-indigo-500/25 hover:scale-[1.01] transition-all"
        >
          <UserPlus size={18} /> New Registration
        </button>
      </header>

      {/* Smart Search */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
          <Search size={20} />
        </div>
        <input
          type="text"
          placeholder="Smart Patient Search (Name, Phone, ID...)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-slate-900 placeholder:text-slate-400"
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
                <th className="px-6 py-4">Age / Gender</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-sm italic">
                    No patients found. Register a new patient to get started.
                  </td>
                </tr>
              ) : (
                filteredPatients.map(patient => (
                  <tr key={patient.id} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500/15 to-violet-500/15 text-indigo-600 rounded-full flex items-center justify-center font-bold border border-indigo-200/60">
                          {(patient?.name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{patient.name}</div>
                          <div className="text-xs text-slate-400 font-mono">#{patient.id?.slice(0, 8)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-700">{patient.phone}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[150px]">{patient.address}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-700">{patient.gender}</div>
                      <div className="text-xs text-slate-500">{patient.dob ? new Date().getFullYear() - new Date(patient.dob).getFullYear() : '—'} yrs</div>
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
                          <Check size={16} /> Check-In
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Registration Modal */}
      {showRegModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">

            {/* Sticky Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/80 flex-shrink-0">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">New Patient Registration</h3>
                <p className="text-slate-500 text-sm mt-0.5 font-medium">Enter patient details to create a digital record.</p>
              </div>
              <button
                onClick={() => setShowRegModal(false)}
                className="p-2 bg-white rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 border border-slate-200 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form id="reg-form" onSubmit={handleRegister} className="overflow-y-auto flex-1 p-6 space-y-4">

              {/* Full Name */}
              <div className="space-y-1.5">
                <label className={labelCls}><User size={13} className="text-indigo-500" /> Full Name</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-500"><User size={17} /></div>
                  <input
                    required value={newPatient.name}
                    onChange={e => setNewPatient({ ...newPatient, name: e.target.value })}
                    type="text" placeholder="e.g. Rajesh Kumar"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700 placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Gender + DOB */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={labelCls}><Users size={13} className="text-indigo-500" /> Gender</label>
                  <select
                    value={newPatient.gender}
                    onChange={e => setNewPatient({ ...newPatient, gender: e.target.value as Gender })}
                    className={inputCls + " appearance-none cursor-pointer"}
                  >
                    <option value={Gender.MALE}>Male</option>
                    <option value={Gender.FEMALE}>Female</option>
                    <option value={Gender.OTHER}>Other</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}><Calendar size={13} className="text-indigo-500" /> Date of Birth</label>
                  <input
                    required value={newPatient.dob}
                    onChange={e => setNewPatient({ ...newPatient, dob: e.target.value })}
                    type="date" className={inputCls}
                  />
                </div>
              </div>

              {/* Phone + Address */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={labelCls}><Phone size={13} className="text-indigo-500" /> Phone Number</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-500"><Smartphone size={17} /></div>
                    <input
                      required value={newPatient.phone}
                      onChange={e => setNewPatient({ ...newPatient, phone: e.target.value })}
                      type="tel" placeholder="+91 98765 43210"
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700 placeholder:text-slate-400"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}><MapPin size={13} className="text-indigo-500" /> Address</label>
                  <textarea
                    value={newPatient.address}
                    onChange={e => setNewPatient({ ...newPatient, address: e.target.value })}
                    placeholder="Enter full residential address..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700 min-h-[80px] resize-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Vitals Section */}
              <div>
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                  <Activity size={14} className="text-rose-500" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vitals (Optional)</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Blood Pressure */}
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                      <Heart size={11} className="text-rose-400" /> Blood Pressure (mmHg)
                    </label>
                    <div className="flex gap-2 items-center">
                      <input type="number" placeholder="Systolic (120)"
                        value={newPatient.bp_systolic}
                        onChange={e => setNewPatient({ ...newPatient, bp_systolic: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 text-sm text-slate-700"
                      />
                      <span className="text-slate-400 font-bold text-lg flex-shrink-0">/</span>
                      <input type="number" placeholder="Diastolic (80)"
                        value={newPatient.bp_diastolic}
                        onChange={e => setNewPatient({ ...newPatient, bp_diastolic: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 text-sm text-slate-700"
                      />
                    </div>
                  </div>

                  {/* Heart Rate */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                      <Activity size={11} className="text-rose-400" /> Heart Rate (bpm)
                    </label>
                    <input type="number" placeholder="72"
                      value={newPatient.heart_rate}
                      onChange={e => setNewPatient({ ...newPatient, heart_rate: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 text-sm text-slate-700"
                    />
                  </div>

                  {/* Temperature */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                      <Thermometer size={11} className="text-amber-400" /> Temp (°F)
                    </label>
                    <input type="number" step="0.1" placeholder="98.6"
                      value={newPatient.temperature_f}
                      onChange={e => setNewPatient({ ...newPatient, temperature_f: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 text-sm text-slate-700"
                    />
                  </div>

                  {/* Weight */}
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                      <Activity size={11} className="text-blue-400" /> Weight (kg)
                    </label>
                    <input type="number" step="0.1" placeholder="65.5"
                      value={newPatient.weight_kg}
                      onChange={e => setNewPatient({ ...newPatient, weight_kg: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-sm text-slate-700"
                    />
                  </div>
                </div>
              </div>

            </form>

            {/* Sticky Footer */}
            <div className="flex-shrink-0 flex gap-3 p-5 border-t border-slate-100 bg-white">
              <button
                type="button"
                onClick={() => setShowRegModal(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="reg-form"
                className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/25 hover:bg-indigo-700 hover:scale-[1.01] transition-all flex items-center justify-center gap-2"
              >
                <UserPlus size={18} /> Register Patient
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Upload Modal */}
      {selectedPatientForUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
              <FileUp size={40} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Upload Digital Records</h3>
              <p className="text-slate-500 mt-2">Scan or upload files for <b>{selectedPatientForUpload.name}</b></p>
            </div>
            <label className="block w-full cursor-pointer group">
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-10 group-hover:border-indigo-500 group-hover:bg-indigo-50 transition-all">
                <span className="text-slate-400 group-hover:text-indigo-600 font-semibold">Click to select files</span>
                <input type="file" className="hidden" onChange={handleFileUpload} />
              </div>
            </label>
            <button onClick={() => setSelectedPatientForUpload(null)} className="text-slate-500 font-medium hover:text-slate-800 underline">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FrontDesk;
