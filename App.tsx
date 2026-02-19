import React, { useState, useEffect, useRef } from 'react';
import { ViewMode, Clinic } from './types';
import FrontDesk from './components/FrontDesk/FrontDesk';
import DoctorDashboard from './components/Doctor/DoctorDashboard';
import LoginPage from './components/LoginPage';
import AnalyticsDashboard from './components/Analytics/AnalyticsDashboard';
import DashboardHome from './components/DashboardHome';
import PatientHistory from './components/PatientHistory';
import { Users, UserRound, BarChart3, Pill, Home } from 'lucide-react';
import { supabase } from './services/db';

// Simple Toast Component
const Toast = ({ message, onClose }: { message: string; onClose: () => void }) => (
  <div className="fixed top-4 right-4 bg-slate-800 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-2 fade-in duration-300 z-50 max-w-sm border border-slate-700">
    <div className="bg-amber-500/10 p-2 rounded-lg">
      <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    </div>
    <div className="flex-1">
      <h4 className="font-bold text-sm">Authentication Notice</h4>
      <p className="text-xs text-slate-300 mt-0.5">{message}</p>
    </div>
    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
);

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>('HOME');
  const [session, setSession] = useState<any>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchClinic(session.user.id);
      else setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchClinic(session.user.id);
      else {
        setClinic(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchClinic = async (userId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const firstName = user?.user_metadata?.first_name
        || user?.user_metadata?.full_name?.split(' ')[0]
        || (user?.email?.split('@')[0] || 'Doctor').charAt(0).toUpperCase() + (user?.email?.split('@')[0] || 'doctor').slice(1);
      const lastName = user?.user_metadata?.last_name || '';
      const derivedName = lastName ? `${firstName} ${lastName}` : firstName;
      const personalClinicName = `Dr. ${firstName}'s Clinic`;

      let { data: profile } = await supabase
        .from('profiles')
        .select('clinic_id, full_name')
        .eq('id', userId)
        .single();

      if (profile?.clinic_id) {
        const { data: clinicData } = await supabase
          .from('clinics')
          .select('*')
          .eq('id', profile.clinic_id)
          .single();
        if (clinicData) {
          if (clinicData.name === 'My Clinic') {
            await supabase.from('clinics').update({ name: personalClinicName }).eq('id', clinicData.id);
            setClinic({ ...clinicData, name: personalClinicName });
          } else {
            setClinic(clinicData);
          }
          setLoading(false);
          return;
        }
      }

      let { data } = await supabase
        .from('clinics')
        .select('*')
        .eq('owner_id', userId)
        .single();

      if (data) {
        if (data.name === 'My Clinic') {
          await supabase.from('clinics').update({ name: personalClinicName }).eq('id', data.id);
          setClinic({ ...data, name: personalClinicName });
        } else {
          setClinic(data);
        }
      } else {
        const { data: newClinic, error: createError } = await supabase
          .from('clinics')
          .insert([{ id: userId, name: personalClinicName, owner_id: userId }])
          .select()
          .single();

        if (!createError && newClinic) {
          setClinic(newClinic);
          await supabase.from('profiles').insert([
            { id: userId, clinic_id: newClinic.id, role: 'admin', full_name: derivedName }
          ]);
        }
      }
    } catch (err) {
      console.error('Unexpected error handling clinic:', err);
    } finally {
      setLoading(false);
    }
  };



  const handleLogout = async () => {
    await supabase.auth.signOut();
    setClinic(null);
  };

  // Animated progress bar while loading
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 92) { clearInterval(interval); return p; }
        return p + Math.random() * 8;
      });
    }, 120);
    return () => clearInterval(interval);
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <style>{`
          @keyframes pulse-glow {
            0%   { box-shadow: 0 0 5px rgba(139,92,246,0.2), 0 0 0px rgba(139,92,246,0); }
            50%  { box-shadow: 0 0 25px rgba(139,92,246,0.6), 0 0 60px rgba(139,92,246,0.15); }
            100% { box-shadow: 0 0 5px rgba(139,92,246,0.2), 0 0 0px rgba(139,92,246,0); }
          }
          @keyframes fill-bar {
            from { width: 0%; } to { width: var(--prog); }
          }
          .system-loader { animation: pulse-glow 2s ease-in-out infinite; border: 1px solid rgba(139,92,246,0.3); }
          @keyframes blink { 0%,100%{opacity:1;} 50%{opacity:0;} }
          .cursor-blink { animation: blink 1s step-end infinite; }
        `}</style>

        {/* Glow Logo */}
        <div className="system-loader w-24 h-24 rounded-3xl bg-white flex items-center justify-center mb-8 relative">
          <div className="absolute inset-0 rounded-3xl" style={{ background: 'radial-gradient(circle at center, rgba(139,92,246,0.12) 0%, transparent 70%)' }} />
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)', boxShadow: '0 4px 20px rgba(139,92,246,0.45)' }}>
            <Pill className="text-white" size={28} />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-black tracking-tight mb-1" style={{ color: '#0F172A' }}>ClinicOS</h1>
        <p className="text-sm font-semibold mb-8" style={{ color: '#8B5CF6', letterSpacing: '0.18em' }}>
          SYSTEM INITIALIZING<span className="cursor-blink">_</span>
        </p>

        {/* Progress Bar */}
        <div className="w-64">
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-150 ease-out"
              style={{ width: `${Math.min(progress, 100)}%`, background: 'linear-gradient(90deg, #8B5CF6, #C4B5FD)' }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[11px] font-bold" style={{ color: '#8B5CF6' }}>LEVELING UP...</span>
            <span className="text-[11px] font-mono text-slate-400">{Math.min(Math.round(progress), 100)}%</span>
          </div>
        </div>
      </div>
    );
  }

  // Always enforce login — no bypass
  if (!session) {
    return <LoginPage />;
  }

  return (
    <div className="h-screen flex overflow-hidden bg-slate-50" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}

      {/* ── Sidebar: fixed 260px, never shrinks ── */}
      <nav className="w-[260px] flex-shrink-0 text-white flex flex-col border-r border-slate-800 h-full bg-slate-900">
        <button
          onClick={() => setView('HOME')}
          className="p-6 flex items-center gap-3 border-b border-slate-800/60 w-full text-left hover:bg-white/5 transition-colors group"
        >
          <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:bg-indigo-400 transition-all">
            <Pill className="text-white w-6 h-6" />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-100">ClinicOS</span>
        </button>

        <div className="flex-1 p-4 space-y-1 overflow-y-auto">
          <>
            <div className="px-4 py-2 mb-4">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Current Clinic</p>
              <p className="text-sm font-bold text-indigo-400 truncate mt-0.5">{clinic?.name || 'Demo Clinic'}</p>
            </div>

            <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Main Menu</p>

            <button
              onClick={() => setView('HOME')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${view === 'HOME'
                ? 'bg-indigo-500/20 text-indigo-300 shadow-lg shadow-indigo-500/10 border border-indigo-500/20'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                }`}
            >
              <Home size={18} />
              <span className="font-medium text-sm">Home</span>
            </button>

            <button
              onClick={() => setView('FRONT_DESK')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${view === 'FRONT_DESK'
                ? 'bg-indigo-500/20 text-indigo-300 shadow-lg shadow-indigo-500/10 border border-indigo-500/20'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                }`}
            >
              <Users size={18} />
              <span className="font-medium text-sm">Front Desk</span>
            </button>

            <button
              onClick={() => setView('DOCTOR')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${view === 'DOCTOR'
                ? 'bg-indigo-500/20 text-indigo-300 shadow-lg shadow-indigo-500/10 border border-indigo-500/20'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                }`}
            >
              <UserRound size={18} />
              <span className="font-medium text-sm">Doctor Portal</span>
            </button>

            <button
              onClick={() => setView('ANALYTICS')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${view === 'ANALYTICS'
                ? 'bg-indigo-500/20 text-indigo-300 shadow-lg shadow-indigo-500/10 border border-indigo-500/20'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                }`}
            >
              <BarChart3 size={18} />
              <span className="font-medium text-sm">Analytics</span>
            </button>
          </>
        </div>

        {/* ── Sidebar Footer ── */}
        <div className="p-4 border-t border-slate-800/60">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-sm font-bold shadow-md shadow-indigo-500/30 flex-shrink-0">
              {(session.user.user_metadata?.first_name || session.user.user_metadata?.full_name || session.user.email)?.charAt(0).toUpperCase() || 'D'}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-bold text-slate-100 truncate leading-tight">
                Dr.&nbsp;{session.user.user_metadata?.first_name
                  ? `${session.user.user_metadata.first_name}${session.user.user_metadata.last_name ? ' ' + session.user.user_metadata.last_name : ''}`
                  : session.user.user_metadata?.full_name
                  || session.user.email?.split('@')[0]}
              </span>
              <span className="text-[11px] text-slate-400 truncate leading-tight mt-0.5">
                {clinic?.name || session.user.email}
              </span>
              <button onClick={handleLogout} className="text-[10px] text-slate-600 hover:text-rose-400 text-left transition-colors mt-1 font-medium">Sign Out</button>
            </div>
          </div>
        </div>

      </nav>

      {/* ── Main Content ── */}
      <main className="flex-1 h-full flex flex-col overflow-hidden bg-slate-50">
        {/* Sticky header */}
        <div className="flex-shrink-0 flex items-center justify-between px-8 py-3 border-b border-slate-200 bg-white shadow-sm">
          <div className="text-sm font-bold text-slate-900">
            {view === 'HOME' && 'Dashboard'}
            {view === 'FRONT_DESK' && 'Front Desk'}
            {view === 'DOCTOR' && 'Doctor Portal'}
            {view === 'ANALYTICS' && 'Analytics'}
            {view === 'HISTORY' && 'Patient History'}
          </div>
          <div className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          {view === 'DOCTOR' ? (
            <DoctorDashboard clinicId={clinic?.id || '00000000-0000-0000-0000-000000000000'} />
          ) : (
            <div className="max-w-7xl mx-auto px-8 py-8">
              {view === 'HOME' && <DashboardHome clinic={clinic} onNavigate={setView} session={session} />}
              {view === 'FRONT_DESK' && <FrontDesk clinicId={clinic?.id || '00000000-0000-0000-0000-000000000000'} />}
              {view === 'ANALYTICS' && <AnalyticsDashboard clinicId={clinic?.id} />}
              {view === 'HISTORY' && <PatientHistory clinic={clinic} onBack={() => setView('HOME')} />}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
