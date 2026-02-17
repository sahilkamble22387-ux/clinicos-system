import React, { useState, useEffect } from 'react';
import { ViewMode, Clinic } from './types';
import FrontDesk from './components/FrontDesk/FrontDesk';
import DoctorDashboard from './components/Doctor/DoctorDashboard';
import AnalyticsDashboard from './components/Analytics/AnalyticsDashboard';
import { LayoutDashboard, Users, UserRound, BarChart3, Pill } from 'lucide-react';
import { supabase } from './services/db';

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>('FRONT_DESK');
  const [session, setSession] = useState<any>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);

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
      // 1. Check if user has a clinic
      let { data, error } = await supabase
        .from('clinics')
        .select('*')
        .eq('owner_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found"
        console.error('Error fetching clinic:', error);
      }

      if (data) {
        setClinic(data);
      } else {
        // 2. If not, create a default clinic
        const { data: newClinic, error: createError } = await supabase
          .from('clinics')
          .insert([{ name: 'My Clinic', owner_id: userId }])
          .select()
          .single();

        if (createError) {
          console.error('Error creating clinic:', createError);
        } else {
          setClinic(newClinic);
        }
      }
    } catch (err) {
      console.error('Unexpected error handling clinic:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    // For simplicity, we'll just try to sign in with Google if configured,
    // or just show a message since we might not have OAuth set up in the backend yet.
    // However, the prompt asked to use Supabase MCP, implying a real backend connection exists.
    // Let's assume Google auth is desired or we can use a dummy login if allowed, but better to try real auth.
    // Since I don't know the exact auth config, I'll attempt OAuth.

    // NOTE: If OAuth isn't configured, this will fail. For development speed, maybe I should also support email/pass?
    // Given the previous "Simulated Login", I'll stick to a simple action.

    // Triggering Google Login
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    });

    if (error) alert('Error logging in: ' + error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setClinic(null);
  };


  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">Loading ClinicOS...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar Navigation */}
      <nav className="w-full md:w-64 bg-slate-900 text-white flex flex-col border-r border-slate-800">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Pill className="text-white w-6 h-6" />
          </div>
          <span className="font-bold text-xl tracking-tight">ClinicOS</span>
        </div>

        <div className="flex-1 p-4 space-y-2 overflow-y-auto">
          {session && clinic ? (
            <>
              <div className="px-4 py-2 mb-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Current Clinic</p>
                <p className="text-sm font-bold text-indigo-400 truncate">{clinic.name}</p>
              </div>

              <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Main Menu</p>

              <button
                onClick={() => setView('FRONT_DESK')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${view === 'FRONT_DESK' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
              >
                <Users size={20} />
                <span className="font-medium">Front Desk</span>
              </button>

              <button
                onClick={() => setView('DOCTOR')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${view === 'DOCTOR' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
              >
                <UserRound size={20} />
                <span className="font-medium">Doctor Portal</span>
              </button>

              <button
                onClick={() => setView('ANALYTICS')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${view === 'ANALYTICS' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
              >
                <BarChart3 size={20} />
                <span className="font-medium">Analytics</span>
              </button>
            </>
          ) : (
            <div className="px-4 text-slate-400 text-sm">Please sign in to access clinic data.</div>
          )}

        </div>

        <div className="p-4 border-t border-slate-800">
          {!session ? (
            <button
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-2 bg-white text-slate-900 px-4 py-2.5 rounded-lg font-medium text-sm hover:bg-slate-100 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Sign in
            </button>
          ) : (
            <div className="flex items-center gap-3 px-4 py-2 animate-in fade-in duration-300">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">
                {session.user.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-semibold truncate">{session.user.email}</span>
                <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-white text-left transition-colors">Sign Out</button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {!session ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 mt-20">
              <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mb-6 text-indigo-600">
                <Pill size={40} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Welcome to ClinicOS</h2>
              <p className="mt-2">Please sign in to access your clinic dashboard.</p>
            </div>
          ) : !clinic ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 mt-20">
              <p>Setting up your clinic workspace...</p>
            </div>
          ) : (
            <>
              {view === 'FRONT_DESK' && <FrontDesk clinicId={clinic.id} />}
              {view === 'DOCTOR' && <DoctorDashboard clinicId={clinic.id} />}
              {view === 'ANALYTICS' && <AnalyticsDashboard />}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
