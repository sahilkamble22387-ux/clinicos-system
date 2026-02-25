import React, { useState, useEffect, useRef } from 'react';
import { ViewMode, Clinic } from './types';
import FrontDesk from './components/FrontDesk/FrontDesk';
import DoctorDashboard from './components/Doctor/DoctorDashboard';
import LoginPage from './components/LoginPage';
import AnalyticsDashboard from './components/Analytics/AnalyticsDashboard';
import DashboardHome from './components/DashboardHome';
import PatientHistory from './components/PatientHistory';
import CheckinPage from './components/CheckinPage';
import QRModal from './components/QRModal';
import { Users, UserRound, BarChart3, Pill, Home, QrCode, DollarSign } from 'lucide-react';
import { supabase } from './services/db';
import { Toaster } from 'react-hot-toast';
import { Link, useLocation } from 'react-router-dom';

// ── URL Route Parser ──
function getCheckinClinicId(): string | null {
  const match = window.location.pathname.match(/^\/checkin\/([a-f0-9-]{36})$/i);
  return match ? match[1] : null;
}

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
  // ── QR Check-in route bypass — no auth needed ──
  const [checkinClinicId] = useState(getCheckinClinicId);
  if (checkinClinicId) {
    return <CheckinPage clinicId={checkinClinicId} />;
  }

  const [view, setView] = useState<ViewMode>('HOME');
  const [session, setSession] = useState<any>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [waitingCount, setWaitingCount] = useState(0);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

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

  // Fetch waiting count for sidebar badge
  useEffect(() => {
    if (!clinic?.id) return;
    const fetchWaiting = async () => {
      const { count } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', clinic.id)
        .eq('status', 'waiting');
      setWaitingCount(count || 0);
    };
    fetchWaiting();
    const channel = supabase
      .channel('sidebar-waiting-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients', filter: `clinic_id=eq.${clinic.id}` }, fetchWaiting)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `clinic_id=eq.${clinic.id}` }, fetchWaiting)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clinic?.id]);

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
      setToastMessage('Failed to load clinic profile. Please refresh.');
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
          .system-loader { animation: pulse-glow 2s ease-in-out infinite; border: 1px solid rgba(139,92,246,0.3); }
          @keyframes blink { 0%,100%{opacity:1;} 50%{opacity:0;} }
          .cursor-blink { animation: blink 1s step-end infinite; }
        `}</style>
        <div className="system-loader w-24 h-24 rounded-3xl bg-white flex items-center justify-center mb-8 relative">
          <div className="absolute inset-0 rounded-3xl" style={{ background: 'radial-gradient(circle at center, rgba(139,92,246,0.12) 0%, transparent 70%)' }} />
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)', boxShadow: '0 4px 20px rgba(139,92,246,0.45)' }}>
            <Pill className="text-white" size={28} />
          </div>
        </div>
        <h1 className="text-2xl font-black tracking-tight mb-1" style={{ color: '#0F172A' }}>ClinicOS</h1>
        <p className="text-sm font-semibold mb-8" style={{ color: '#8B5CF6', letterSpacing: '0.18em' }}>
          SYSTEM INITIALIZING<span className="cursor-blink">_</span>
        </p>
        <div className="w-64">
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-150 ease-out" style={{ width: `${Math.min(progress, 100)}%`, background: 'linear-gradient(90deg, #8B5CF6, #C4B5FD)' }} />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[11px] font-bold" style={{ color: '#8B5CF6' }}>LEVELING UP...</span>
            <span className="text-[11px] font-mono text-slate-400">{Math.min(Math.round(progress), 100)}%</span>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  const navItems: { key: ViewMode; icon: React.ReactNode; label: string; badge?: number }[] = [
    { key: 'HOME', icon: <Home size={18} />, label: 'Home' },
    { key: 'FRONT_DESK', icon: <Users size={18} />, label: 'Front Desk' },
    { key: 'DOCTOR', icon: <UserRound size={18} />, label: 'Doctor Portal', badge: waitingCount },
    { key: 'ANALYTICS', icon: <BarChart3 size={18} />, label: 'Analytics' },
  ];

  return (
    <div className="h-screen flex overflow-hidden bg-slate-50" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { borderRadius: '12px', fontSize: '13px', fontWeight: 500 },
          success: { iconTheme: { primary: '#6366f1', secondary: '#fff' } },
        }}
      />
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}

      {/* ── Sidebar: desktop only ── */}
      <nav className="hidden md:flex w-[260px] flex-shrink-0 text-white flex-col border-r border-slate-800 h-full" style={{ background: 'linear-gradient(to bottom, #0f172a, #1e1b4b)' }}>
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
          <div className="px-4 py-2 mb-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Current Clinic</p>
            <p className="text-sm font-bold text-indigo-400 truncate mt-0.5">{clinic?.name || 'Demo Clinic'}</p>
          </div>

          <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Main Menu</p>

          {navItems.map(item => (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 relative ${view === item.key
                ? 'bg-indigo-500/20 text-indigo-300 shadow-lg shadow-indigo-500/10 border border-indigo-500/20'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                }`}
            >
              {/* Animated pill indicator */}
              {view === item.key && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-indigo-400 rounded-r-full" />
              )}
              {item.icon}
              <span className="font-medium text-sm">{item.label}</span>
              {/* Notification badge */}
              {item.badge && item.badge > 0 ? (
                <span className="ml-auto bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center animate-pulse">
                  {item.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Sidebar Footer */}
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
        <div className="flex-shrink-0 flex items-center justify-between px-4 md:px-8 py-3 border-b border-slate-200 bg-white shadow-sm">
          {/* Mobile: Logo */}
          <div className="flex md:hidden items-center gap-2">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
              <Pill className="text-white w-4 h-4" />
            </div>
            <span className="font-bold text-sm text-slate-900">ClinicOS</span>
          </div>
          <div className="hidden md:block text-sm font-bold text-slate-900">
            {view === 'HOME' && 'Dashboard'}
            {view === 'FRONT_DESK' && 'Front Desk'}
            {view === 'DOCTOR' && 'Doctor Portal'}
            {view === 'ANALYTICS' && 'Analytics'}
            {view === 'HISTORY' && 'Patient History'}
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/pricing"
              className="flex items-center gap-2 px-3 py-1.5 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 hover:underline active:bg-indigo-100 rounded-full transition-colors font-semibold"
              title="View our flexible pricing plans"
              aria-label="Pricing Plans"
            >
              <DollarSign size={16} />
              <span className="hidden sm:inline text-sm">Pricing</span>
            </Link>
            <button
              onClick={() => setIsQRModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-full border border-indigo-200 transition-colors shadow-sm"
              title="Show check-in QR Code"
              aria-label="Patient Check-In QR"
            >
              <QrCode size={16} />
              <span className="hidden sm:inline text-xs font-bold">QR Check-in</span>
            </button>
            <div className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200 hidden sm:block">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {view === 'DOCTOR' ? (
            <DoctorDashboard clinicId={clinic?.id || '00000000-0000-0000-0000-000000000000'} />
          ) : (
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8">
              {view === 'HOME' && <DashboardHome clinic={clinic} onNavigate={setView} session={session} />}
              {view === 'FRONT_DESK' && <FrontDesk clinicId={clinic?.id || '00000000-0000-0000-0000-000000000000'} />}
              {view === 'ANALYTICS' && <AnalyticsDashboard clinicId={clinic?.id} />}
              {view === 'HISTORY' && <PatientHistory clinic={clinic} onBack={() => setView('HOME')} />}
            </div>
          )}
        </div>
      </main>

      {/* ── Mobile Bottom Tab Bar ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center px-2 py-1 z-40 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        {navItems.map(item => (
          <button
            key={item.key}
            onClick={() => setView(item.key)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg transition-colors relative ${view === item.key ? 'text-indigo-600' : 'text-slate-400'
              }`}
          >
            {view === item.key && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] bg-indigo-500 rounded-b-full" />
            )}
            <div className="relative">
              {item.icon}
              {item.badge && item.badge > 0 ? (
                <span className="absolute -top-1 -right-2 bg-amber-500 text-white text-[8px] font-black px-1 py-0 rounded-full min-w-[14px] text-center">
                  {item.badge}
                </span>
              ) : null}
            </div>
            <span className="text-[10px] font-semibold">{item.label}</span>
          </button>
        ))}
      </div>

      <QRModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        clinicId={clinic?.id || ''}
        clinicName={clinic?.name || 'My Clinic'}
      />
    </div>
  );
};

export default App;
