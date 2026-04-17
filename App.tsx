/**
 * App.tsx
 *
 * ROOT BUG FIX: The top-level <Route path="/onboarding"> was rendering
 * OnboardingForm OUTSIDE AuthProvider. useAuth() returned null defaults,
 * so handleSave() always hit "Session expired" and the form never completed.
 *
 * Fix: /onboarding route removed from top-level App entirely.
 * It lives ONLY inside DoctorApp's nested Routes, where AuthProvider is active.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useParams, useNavigate, Navigate } from 'react-router-dom';
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
  QrCode, DollarSign, Settings as SettingsIcon, Pill,
} from 'lucide-react';
import { supabase } from './services/db';
import { Toaster } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { SubscriptionGate } from './components/SubscriptionGate';
import { FeatureGate } from './components/FeatureGate';
import { AuthProvider } from './context/AuthContext';
import { LogoProvider } from './src/context/LogoContext';
import { Logo } from './src/components/Logo';
import { OnboardingGuard } from './components/OnboardingGuard';
import OnboardingForm from './pages/OnboardingForm';
import EditProfile from './pages/EditProfile';
import { MobileHeader } from './components/MobileHeader';
import { MobileBottomNav } from './components/MobileBottomNav';
import PatientDetailPage from './components/FrontDesk/PatientDetailPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import PharmacyPortal from './pages/PharmacyPortal';
import PharmacySignup from './src/pages/pharmacy/PharmacySignup';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import SupportPage from './pages/SupportPage';
import RefundPolicyPage from './pages/RefundPolicyPage';
import RxPage from './pages/RxPage';
import { ensureDoctorClinicSetup } from './services/doctorService';
import { syncAndFetchPharmacyProfile } from './services/pharmacyService';

// ── Rebrand localStorage migration ───────────────────────────────
const legacyStorageKeys: [string, string][] = [
  ['clinicos_welcome_popup_done', 'nirogos_welcome_popup_done'],
  ['clinicos_tutorial_done_v2', 'nirogos_tutorial_done_v2'],
  ['clinicos_pending_plan', 'nirogos_pending_plan'],
  ['clinicos_trial_banner_dismissed_until', 'nirogos_trial_banner_dismissed_until'],
];
legacyStorageKeys.forEach(([oldKey, newKey]) => {
  try {
    const val = localStorage.getItem(oldKey);
    if (val !== null) { localStorage.setItem(newKey, val); localStorage.removeItem(oldKey); }
  } catch { /* ignore */ }
});

const Toast = ({ message, onClose }: { message: string; onClose: () => void }) => (
  <div className="fixed top-4 right-4 bg-slate-800 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 z-50 max-w-sm border border-slate-700">
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

const CheckinRoute: React.FC = () => {
  const { clinicId } = useParams<{ clinicId: string }>();
  return <CheckinPage clinicId={clinicId ?? ''} />;
};

// ── App shell — pure routing, zero hooks ──────────────────────────
const App: React.FC = () => (
  <LogoProvider>
    <Routes>
      {/* Public kiosk — no auth needed */}
      <Route path="/checkin/:clinicId" element={<CheckinRoute />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/pharmacy-login" element={<Navigate to="/login?portal=pharmacy" replace />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/support" element={<SupportPage />} />
      <Route path="/refund-policy" element={<RefundPolicyPage />} />
      <Route path="/rx/:prescriptionId" element={<RxPage />} />

      {/* Pharmacy portal — role-gated */}
      <Route
        path="/pharmacy-portal"
        element={
          <ProtectedRoute allowedRoles={['pharmacy_staff']} redirectTo="/login?portal=pharmacy">
            <PharmacyPortal />
          </ProtectedRoute>
        }
      />

      {/* Pharmacy signup */}
      <Route path="/pharmacy/signup" element={<PharmacySignup />} />
      <Route path="/pharmacy-signup" element={<PharmacySignup />} />

      {/*
        ALL other routes (including /onboarding) → DoctorApp.

        CRITICAL: /onboarding is NOT listed here at the top level.
        It is handled by DoctorApp's nested Routes (see below),
        which means it renders INSIDE AuthProvider where useAuth()
        returns the real session/clinicId.

        The old top-level <Route path="/onboarding"> was the root
        cause of the "stuck on onboarding" bug: OnboardingForm rendered
        outside AuthProvider, useAuth() returned null defaults, and
        handleSave() always bailed with "Session expired".
      */}
      <Route path="/*" element={<DoctorApp />} />
    </Routes>
  </LogoProvider>
);

// ── Doctor App ────────────────────────────────────────────────────
const DoctorApp: React.FC = () => {
  const navigate = useNavigate();

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

  const fetchClinic = useCallback(async (authUser: any) => {
    if (!authUser?.id) {
      setClinic(null);
      setLoading(false);
      return;
    }

    try {
      const metaRole = authUser?.user_metadata?.role;
      const profile = metaRole === 'pharmacy_staff'
        ? await syncAndFetchPharmacyProfile(authUser.id)
        : await ensureDoctorClinicSetup(authUser);

      if (profile?.role === 'pharmacy_staff') {
        navigate('/pharmacy-portal', { replace: true });
        return;
      }

      if (profile?.clinic) {
        setClinic(profile.clinic as Clinic);
        return;
      }

      setToastMessage('We could not find your clinic profile yet. Please refresh.');
    } catch (err) {
      console.error('[DoctorApp] fetchClinic error:', err);
      setToastMessage('Failed to load clinic profile. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    let active = true;

    const applySession = async (newSession: any) => {
      if (!active) return;

      setSession(newSession);

      if (newSession?.user) {
        setLoading(true);
        await fetchClinic(newSession.user);
      } else {
        setClinic(null);
        setLoading(false);
      }
    };

    void supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      void applySession(currentSession);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      void applySession(newSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [fetchClinic]);

  useEffect(() => {
    if (!clinic?.id) return;
    const fetchWaiting = async () => {
      const { count } = await supabase
        .from('patients').select('*', { count: 'exact', head: true })
        .eq('clinic_id', clinic.id).eq('status', 'waiting');
      setWaitingCount(count ?? 0);
    };
    fetchWaiting();
    const channel = supabase.channel(`sidebar-badge-${clinic.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients', filter: `clinic_id=eq.${clinic.id}` }, fetchWaiting)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `clinic_id=eq.${clinic.id}` }, fetchWaiting)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clinic?.id]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setClinic(null);
    setSession(null);
  };

  // Auth loading / no session — handle before Routes render
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
    // AuthProvider wraps everything below — useAuth() works correctly for
    // both OnboardingForm and all main app components.
    <AuthProvider
      user={session.user}
      session={session}
      profile={clinic}
      clinicId={clinic?.id ?? null}
      loading={loading}
      clinicProfile={clinic}
      refreshClinicProfile={() => fetchClinic(session.user.id)}
    >
      <Routes>
        {/*
          /onboarding lives HERE — inside AuthProvider.
          useAuth() in OnboardingForm now returns the real user + clinicId.
          handleSave() can write to the DB and refreshClinicProfile() works.
        */}
        <Route path="/onboarding" element={<OnboardingForm />} />

        <Route path="/*" element={
          <OnboardingGuard>
            <SubscriptionGate clinicId={clinic?.id} clinicName={clinic?.name} authResolved={!loading} onSignOut={handleLogout}>
              <div className="h-screen flex overflow-hidden bg-slate-50">
                <Toaster position="top-right" toastOptions={{ style: { borderRadius: '12px', fontSize: '13px', fontWeight: 500 }, success: { iconTheme: { primary: '#6366f1', secondary: '#fff' } } }} />
                {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}

                {/* Desktop sidebar */}
                <nav className="hidden md:flex w-[260px] flex-shrink-0 text-white flex-col border-r border-slate-800 h-full"
                  style={{ background: 'linear-gradient(to bottom, #0f172a, #1e1b4b)' }}>
                  <button
                    onClick={() => {
                      setView('HOME');
                      setSelectedPatient(null);
                    }}
                    className="p-6 flex items-center gap-3 border-b border-slate-800/60 w-full text-left hover:bg-white/5 transition-colors group"
                  >
                    <Logo
                      variant="full"
                      usage="sidebarExpanded"
                      theme="light"
                      className="drop-shadow-lg"
                    />
                  </button>

                  <div className="flex-1 p-4 space-y-1 overflow-y-auto">
                    <div className="px-4 py-2 mb-4">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Current Clinic</p>
                      <p className="text-sm font-bold text-indigo-400 truncate mt-0.5">{clinic?.name ?? 'Demo Clinic'}</p>
                    </div>
                    <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Main Menu</p>
                    {navItems.map(item => {
                      const btn = (
                        <button key={item.key}
                          onClick={() => { setView(item.key); setSelectedPatient(null); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 relative ${view === item.key
                              ? 'bg-indigo-500/20 text-indigo-300 shadow-lg shadow-indigo-500/10 border border-indigo-500/20'
                              : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                            }`}>
                          {view === item.key && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-indigo-400 rounded-r-full" />
                          )}
                          {item.icon}
                          <span className="font-medium text-sm">{item.label}</span>
                          {item.badge && item.badge > 0
                            ? <span className="ml-auto bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center animate-pulse">{item.badge}</span>
                            : null}
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
                        <button onClick={handleLogout} className="text-[10px] text-slate-600 hover:text-rose-400 text-left transition-colors mt-1 font-medium">
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </div>
                </nav>

                {/* Main content */}
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

                  <MobileHeader session={session} clinic={clinic} onSignOut={handleLogout} authResolved={!loading}
                    onNavigate={v => { setView(v); setSelectedPatient(null); }} />

                  <div className="flex-1 overflow-y-auto w-full">
                    {view === 'DOCTOR' ? (
                      <DoctorDashboard clinicId={clinic?.id ?? '00000000-0000-0000-0000-000000000000'} />
                    ) : view === 'SETTINGS' ? (
                      <EditProfile />
                    ) : (
                      <div className="w-full">
                        {view === 'HOME' && <DashboardHome clinic={clinic} onNavigate={v => { setView(v); setSelectedPatient(null); }} session={session} />}
                        {view === 'FRONT_DESK' && !selectedPatient && <FrontDesk clinicId={clinic?.id ?? '00000000-0000-0000-0000-000000000000'} clinicName={clinic?.name ?? ''} onPatientClick={p => setSelectedPatient(p)} />}
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

                <MobileBottomNav view={view} onNavigate={v => { setView(v); setSelectedPatient(null); }}
                  waitingCount={waitingCount} clinic={clinic} authResolved={!loading} />
                <QRModal isOpen={isQRModalOpen} onClose={() => setIsQRModalOpen(false)}
                  clinicId={clinic?.id ?? ''} clinicName={clinic?.name ?? 'My Clinic'} />
              </div>
            </SubscriptionGate>
          </OnboardingGuard>
        } />
      </Routes>
    </AuthProvider>
  );
};

export default App;
