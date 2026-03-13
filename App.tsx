import React, { useState, useEffect } from 'react';
import { AppLoader } from './components/AppLoader';
import { ViewMode, Clinic } from './types';
import FrontDesk from './components/FrontDesk/FrontDesk';
import DoctorDashboard from './components/Doctor/DoctorDashboard';
import LoginPage from './components/LoginPage';
import AnalyticsDashboard from './components/Analytics/AnalyticsDashboard';
import DashboardHome from './components/DashboardHome';
import PatientHistory from './components/PatientHistory';
import CheckinPage from './components/CheckinPage';
import QRModal from './components/QRModal';
import {
  Users, UserRound, BarChart3, Home,
  QrCode, DollarSign, Settings as SettingsIcon,
} from 'lucide-react';
import { supabase } from './services/db';
import { Toaster } from 'react-hot-toast';
import { Link, Routes, Route } from 'react-router-dom';
import { SubscriptionGate } from './components/SubscriptionGate';
import { FeatureGate } from './components/FeatureGate';
import { AuthProvider } from './context/AuthContext';
import { OnboardingGuard } from './components/OnboardingGuard';
import OnboardingForm from './pages/OnboardingForm';
import EditProfile from './pages/EditProfile';
import { MobileHeader } from './components/MobileHeader';
import { MobileBottomNav } from './components/MobileBottomNav';
import PatientDetailPage from './components/FrontDesk/PatientDetailPage';

// ── PHARMACY IMPORTS (NEW) ────────────────────────────────────────
import PharmacyPortal from '@/pages/PharmacyPortal';
import PharmacyLogin from '@/pages/PharmacyLogin';
import PharmacySignup from '@/pages/PharmacySignup';

// ── LOCAL STORAGE MIGRATION FOR REBRAND ──────────────────────────
const legacyStorageKeys = [
  ['clinicos_welcome_popup_done', 'nirogos_welcome_popup_done'],
  ['clinicos_tutorial_done_v2', 'nirogos_tutorial_done_v2'],
  ['clinicos_pending_plan', 'nirogos_pending_plan'],
  ['clinicos_trial_banner_dismissed_until', 'nirogos_trial_banner_dismissed_until']
];
legacyStorageKeys.forEach(([oldKey, newKey]) => {
  try {
    const val = localStorage.getItem(oldKey);
    if (val !== null) {
      localStorage.setItem(newKey, val);
      localStorage.removeItem(oldKey);
    }
  } catch (e) {
    // Ignore permissions issues with localStorage in edge cases
  }
});

// ── Parse /checkin/<uuid> from URL ───────────────────────────────
function getCheckinClinicId(): string | null {
  const match = window.location.pathname.match(/^\/checkin\/([a-f0-9-]{36})$/i);
  return match ? match[1] : null;
}

const Toast = ({ message, onClose }: { message: string; onClose: () => void }) => (
  <div className="fixed top-4 right-4 bg-slate-800 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-2 fade-in duration-300 z-50 max-w-sm border border-slate-700">
    <div className="bg-amber-500/10 p-2 rounded-lg">
      <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    </div>
    <div className="flex-1">
      <h4 className="font-bold text-sm">Notice</h4>
      <p className="text-xs text-slate-300 mt-0.5">{message}</p>
    </div>
    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
);

const NirogOSLogo = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 36 30" fill="none">
    <path d="M2 28V4L18 20L34 4V28" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const App: React.FC = () => {
  // ── PHARMACY BYPASSES — MUST BE FIRST, before any hooks ──────────
  const pathname = window.location.pathname;
  if (pathname === '/pharmacy-portal') return <PharmacyPortal />;
  if (pathname === '/pharmacy-login') return <PharmacyLogin />;
  if (pathname === '/pharmacy-signup') return <PharmacySignup />;
  // ─────────────────────────────────────────────────────────────────

  const [checkinClinicId] = useState<string | null>(getCheckinClinicId);
  const [view, setView] = useState<ViewMode>('HOME');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [waitingCount, setWaitingCount] = useState(0);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 5000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  useEffect(() => {
    if (checkinClinicId) { setLoading(false); return; }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        if (newSession) {
          fetchClinic(newSession.user.id);
        } else {
          setClinic(null);
          setLoading(false);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!clinic?.id) return;
    const fetchWaiting = async () => {
      const { count } = await supabase
        .from('patients').select('*', { count: 'exact', head: true })
        .eq('clinic_id', clinic.id).eq('status', 'waiting');
      setWaitingCount(count ?? 0);
    };
    fetchWaiting();
    const channel = supabase
      .channel(`sidebar-badge-${clinic.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients', filter: `clinic_id=eq.${clinic.id}` }, fetchWaiting)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `clinic_id=eq.${clinic.id}` }, fetchWaiting)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clinic?.id]);

  if (checkinClinicId) return <CheckinPage clinicId={checkinClinicId} />;

  const fetchClinic = async (userId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const meta = user?.user_metadata;
      const firstName = meta?.first_name || meta?.full_name?.split(' ')[0] || (user?.email?.split('@')[0] ?? 'Doctor');
      const lastName = meta?.last_name ?? '';
      const derivedName = lastName ? `${firstName} ${lastName}` : firstName;
      const personalClinicName = `Dr. ${firstName}'s Clinic`;

      const { data: profile } = await supabase
        .from('profiles').select('clinic_id, role').eq('id', userId).single();

      // ── PHARMACY STAFF: redirect them away from doctor app ───────
      if (profile?.role === 'pharmacy_staff') {
        window.location.href = '/pharmacy-portal';
        return;
      }

      if (profile?.clinic_id) {
        const { data: clinicData } = await supabase
          .from('clinics').select('*').eq('id', profile.clinic_id).single();
        if (clinicData) {
          const resolved = normalizeClinic(clinicData, personalClinicName);
          if (clinicData.name === 'My Clinic') {
            await supabase.from('clinics').update({ name: personalClinicName }).eq('id', clinicData.id);
          }
          setClinic(resolved);
          setLoading(false);
          return;
        }
      }

      const { data: ownedClinic } = await supabase
        .from('clinics').select('*').eq('owner_id', userId).single();

      if (ownedClinic) {
        const resolved = normalizeClinic(ownedClinic, personalClinicName);
        if (ownedClinic.name === 'My Clinic') {
          await supabase.from('clinics').update({ name: personalClinicName }).eq('id', ownedClinic.id);
        }
        setClinic(resolved);
      } else {
        const { data: newClinic, error: createError } = await supabase
          .from('clinics').insert([{ id: userId, name: personalClinicName, owner_id: userId }]).select().single();
        if (!createError && newClinic) {
          setClinic(newClinic);
          await supabase.from('profiles').insert([
            { id: userId, clinic_id: newClinic.id, role: 'doctor', full_name: derivedName },
          ]);
        }
      }
    } catch (err) {
      console.error('[App] fetchClinic error:', err);
      setToastMessage('Failed to load clinic profile. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); setClinic(null); };

  if (loading) return <AppLoader message="Starting NirogOS..." />;
  if (!session) return <LoginPage onNavigate={(v: any) => setView(v)} />;

  const navItems: { key: ViewMode; icon: React.ReactNode; label: string; badge?: number }[] = [
    { key: 'HOME', icon: <Home size={18} />, label: 'Home' },
    { key: 'FRONT_DESK', icon: <Users size={18} />, label: 'Front Desk' },
    { key: 'DOCTOR', icon: <UserRound size={18} />, label: 'Doctor Portal', badge: waitingCount },
    { key: 'ANALYTICS', icon: <BarChart3 size={18} />, label: 'Analytics' },
    { key: 'SETTINGS', icon: <SettingsIcon size={18} />, label: 'Edit Profile' },
  ];

  const doctorDisplayName = (() => {
    const meta = session.user.user_metadata;
    if (meta?.first_name) return `${meta.first_name}${meta.last_name ? ' ' + meta.last_name : ''}`;
    return meta?.full_name ?? session.user.email?.split('@')[0] ?? 'Doctor';
  })();

  return (
    <AuthProvider user={session.user} session={session} profile={clinic} clinicId={clinic?.id} loading={loading} clinicProfile={clinic} refreshClinicProfile={() => fetchClinic(session.user.id)}>
      <Routes>
        <Route path="/onboarding" element={<OnboardingForm />} />
        <Route path="/*" element={
          <OnboardingGuard>
            <SubscriptionGate clinicId={clinic?.id} clinicName={clinic?.name} authResolved={!loading} onSignOut={handleLogout}>
              <div className="h-screen flex overflow-hidden bg-slate-50" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                <Toaster position="top-right" toastOptions={{ style: { borderRadius: '12px', fontSize: '13px', fontWeight: 500 }, success: { iconTheme: { primary: '#6366f1', secondary: '#fff' } } }} />
                {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}

                <nav className="hidden md:flex w-[260px] flex-shrink-0 text-white flex-col border-r border-slate-800 h-full" style={{ background: 'linear-gradient(to bottom, #0f172a, #1e1b4b)' }}>
                  <button onClick={() => { setView('HOME'); setSelectedPatient(null); }} className="p-6 flex items-center gap-3 border-b border-slate-800/60 w-full text-left hover:bg-white/5 transition-colors group">
                    <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:bg-indigo-400 transition-all">
                      <NirogOSLogo size={22} />
                    </div>
                    <span className="font-bold text-xl tracking-tight text-slate-100">Medi<span className="text-indigo-400">Flow</span></span>
                  </button>

                  <div className="flex-1 p-4 space-y-1 overflow-y-auto">
                    <div className="px-4 py-2 mb-4">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Current Clinic</p>
                      <p className="text-sm font-bold text-indigo-400 truncate mt-0.5">{clinic?.name ?? 'Demo Clinic'}</p>
                    </div>
                    <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Main Menu</p>
                    {navItems.map(item => {
                      const btn = (
                        <button key={item.key} onClick={() => { setView(item.key); setSelectedPatient(null); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 relative ${view === item.key ? 'bg-indigo-500/20 text-indigo-300 shadow-lg shadow-indigo-500/10 border border-indigo-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'}`}>
                          {view === item.key && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-indigo-400 rounded-r-full" />}
                          {item.icon}
                          <span className="font-medium text-sm">{item.label}</span>
                          {item.badge && item.badge > 0 ? <span className="ml-auto bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center animate-pulse">{item.badge}</span> : null}
                        </button>
                      );
                      if (item.key === 'ANALYTICS') {
                        return <FeatureGate key={item.key} feature="analytics" clinicId={clinic?.id} clinicName={clinic?.name} authResolved={!loading}>{btn}</FeatureGate>;
                      }
                      return btn;
                    })}
                  </div>

                  <div className="p-4 border-t border-slate-800/60">
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-sm font-bold shadow-md shadow-indigo-500/30 flex-shrink-0">
                        {doctorDisplayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm font-bold text-slate-100 truncate leading-tight">Dr.&nbsp;{doctorDisplayName}</span>
                        <span className="text-[11px] text-slate-400 truncate leading-tight mt-0.5">{clinic?.name ?? session.user.email}</span>
                        <button onClick={handleLogout} className="text-[10px] text-slate-600 hover:text-rose-400 text-left transition-colors mt-1 font-medium">Sign Out</button>
                      </div>
                    </div>
                  </div>
                </nav>

                <main className="flex-1 h-full flex flex-col overflow-hidden bg-slate-50">
                  <div className="hidden md:flex flex-shrink-0 items-center justify-between px-8 py-3 border-b border-slate-200 bg-white shadow-sm">
                    <div className="text-sm font-bold text-slate-900">
                      {view === 'HOME' && 'Dashboard'}
                      {view === 'FRONT_DESK' && (selectedPatient ? selectedPatient.full_name || selectedPatient.name : 'Front Desk')}
                      {view === 'DOCTOR' && 'Doctor Portal'}
                      {view === 'ANALYTICS' && 'Analytics'}
                      {view === 'HISTORY' && 'Patient History'}
                      {view === 'SETTINGS' && 'Edit Profile'}
                    </div>
                    <div className="flex items-center gap-3">
                      <Link to="/pricing" className="flex items-center gap-2 px-3 py-1.5 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 rounded-full transition-colors font-semibold">
                        <DollarSign size={16} /><span className="hidden sm:inline text-sm">Pricing</span>
                      </Link>
                      {view === 'FRONT_DESK' ? (
                        <button onClick={() => setIsQRModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-full border border-indigo-200 transition-colors shadow-sm">
                          <QrCode size={16} /><span className="hidden sm:inline text-xs font-bold">QR Check-in</span>
                        </button>
                      ) : (
                        <FeatureGate feature="qr_checkin" clinicId={clinic?.id} clinicName={clinic?.name} authResolved={!loading}>
                          <button onClick={() => setIsQRModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-full border border-indigo-200 transition-colors shadow-sm">
                            <QrCode size={16} /><span className="hidden sm:inline text-xs font-bold">QR Check-in</span>
                          </button>
                        </FeatureGate>
                      )}
                      <div className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200 hidden sm:block">
                        {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  </div>

                  <MobileHeader session={session} clinic={clinic} onSignOut={handleLogout} authResolved={!loading} onNavigate={(v) => { setView(v); setSelectedPatient(null); }} />

                  <div className="flex-1 overflow-y-auto w-full">
                    {view === 'DOCTOR' ? (
                      <DoctorDashboard clinicId={clinic?.id ?? '00000000-0000-0000-0000-000000000000'} />
                    ) : view === 'SETTINGS' ? (
                      <EditProfile />
                    ) : (
                      <div className="w-full">
                        {view === 'HOME' && <DashboardHome clinic={clinic} onNavigate={(v) => { setView(v); setSelectedPatient(null); }} session={session} />}
                        {view === 'FRONT_DESK' && !selectedPatient && <FrontDesk clinicId={clinic?.id ?? '00000000-0000-0000-0000-000000000000'} clinicName={clinic?.name ?? ''} onPatientClick={(patient) => setSelectedPatient(patient)} />}
                        {view === 'FRONT_DESK' && selectedPatient && <PatientDetailPage patient={selectedPatient} onBack={() => setSelectedPatient(null)} />}
                        {view === 'ANALYTICS' && <AnalyticsDashboard clinicId={clinic?.id} />}
                        {view === 'HISTORY' && (
                          <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8">
                            <PatientHistory clinic={clinic} onBack={() => setView('HOME')} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </main>

                <MobileBottomNav view={view} onNavigate={(v) => { setView(v); setSelectedPatient(null); }} waitingCount={waitingCount} clinic={clinic} authResolved={!loading} />
                <QRModal isOpen={isQRModalOpen} onClose={() => setIsQRModalOpen(false)} clinicId={clinic?.id ?? ''} clinicName={clinic?.name ?? 'My Clinic'} />
              </div>
            </SubscriptionGate>
          </OnboardingGuard>
        } />
      </Routes>
    </AuthProvider>
  );
};

function normalizeClinic(data: any, fallbackName: string): Clinic {
  return {
    ...data,
    name: data.name === 'My Clinic' ? fallbackName : data.name,
    qualifications: Array.isArray(data.qualifications) ? data.qualifications.join(', ') : data.qualifications,
  };
}

export default App;