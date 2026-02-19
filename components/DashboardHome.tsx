import React, { useState, useEffect } from 'react';
import { Clinic, ViewMode } from '../types';
import { Users, UserPlus, Calendar, Activity, Clock, ChevronRight } from 'lucide-react';
import { supabase } from '../services/db';

interface DashboardHomeProps {
    clinic: Clinic | null;
    onNavigate: (view: ViewMode) => void;
    session?: any;
}

const DashboardHome: React.FC<DashboardHomeProps> = ({ clinic, onNavigate, session }) => {
    const doctorName = session?.user?.user_metadata?.first_name
        || session?.user?.user_metadata?.full_name?.split(' ')[0]
        || session?.user?.email?.split('@')[0]
        || 'Doctor';
    const [stats, setStats] = useState({
        totalPatients: 0,
        waiting: 0,
        completed: 0,
    });
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        fetchStats();

        const clinicId = clinic?.id || '00000000-0000-0000-0000-000000000000';
        const channel = supabase
            .channel('dashboard_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'patients', filter: `clinic_id=eq.${clinicId}` }, () => fetchStats())
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [clinic]);

    const fetchStats = async () => {
        const clinicId = clinic?.id || '00000000-0000-0000-0000-000000000000';

        try {
            const { count: totalPatients } = await supabase
                .from('patients')
                .select('*', { count: 'exact', head: true })
                .eq('clinic_id', clinicId);

            const { count: waitingCount } = await supabase
                .from('patients')
                .select('*', { count: 'exact', head: true })
                .eq('clinic_id', clinicId)
                .eq('status', 'waiting');

            const today = new Date().toISOString().split('T')[0];
            const { count: completedCount } = await supabase
                .from('patients')
                .select('*', { count: 'exact', head: true })
                .eq('clinic_id', clinicId)
                .eq('status', 'completed')
                .gte('updated_at', `${today}T00:00:00`)
                .lte('updated_at', `${today}T23:59:59`);

            setStats({
                totalPatients: totalPatients || 0,
                waiting: waitingCount || 0,
                completed: completedCount || 0,
            });
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
        }
    };

    const getGreeting = () => {
        const hour = currentTime.getHours();
        if (hour < 6) return 'Burning the midnight oil,';
        if (hour < 12) return 'Rise and shine,';
        if (hour < 17) return 'Good afternoon,';
        if (hour < 21) return 'Evening shift started,';
        return 'Working late,';
    };

    const getSubtext = () => {
        if (stats.waiting > 0) {
            return `You have ${stats.waiting} patient${stats.waiting > 1 ? 's' : ''} ready for consultation.`;
        }
        return 'All caught up! Your queue is currently clear.';
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700 slide-in-from-bottom-4">
            {/* Identity Card — Gradient Header */}
            <div
                className="rounded-3xl p-8 text-white shadow-2xl shadow-violet-900/20 flex flex-col md:flex-row justify-between items-center relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #6D28D9 0%, #4C1D95 100%)' }}
            >
                <div className="absolute inset-0 backdrop-blur-md bg-white/10 rounded-3xl" />
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-purple-500/30 rounded-full blur-3xl" />
                <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-indigo-400/20 rounded-full blur-2xl" />

                <div className="z-10 space-y-1">
                    <p className="text-indigo-200/80 text-sm font-semibold uppercase tracking-widest mb-1">
                        {clinic?.name || 'ClinicOS'}
                    </p>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                        {getGreeting()}{' '}
                        <span className="bg-gradient-to-r from-white to-indigo-100 bg-clip-text text-transparent font-extrabold">
                            Dr. {doctorName}
                        </span>
                    </h1>
                    <p className={`text-base font-medium mt-2 ${stats.waiting > 0 ? 'text-amber-200' : 'text-indigo-100/80'}`}>
                        {getSubtext()}
                    </p>
                </div>

                <div className="z-10 mt-6 md:mt-0 text-right bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/20">
                    <div className="text-3xl font-bold tabular-nums">
                        {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-indigo-200 font-medium">
                        {currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    icon={<Users className="w-6 h-6 text-blue-600" />}
                    label="Total Patients"
                    value={stats.totalPatients}
                    trend="+12% this month"
                    accent="border-blue-500"
                    iconBg="bg-blue-50"
                />
                <StatCard
                    icon={<Clock className="w-6 h-6 text-amber-500" />}
                    label="Waiting Now"
                    value={stats.waiting}
                    trend="Avg wait: 12m"
                    accent="border-amber-500"
                    iconBg="bg-amber-50"
                />
                <StatCard
                    icon={<Activity className="w-6 h-6 text-emerald-600" />}
                    label="Completed Visits"
                    value={stats.completed}
                    trend="Today's goal: 25"
                    accent="border-emerald-500"
                    iconBg="bg-emerald-50"
                />
            </div>

            {/* Quick Actions */}
            <div>
                <h2 className="text-xl font-bold text-slate-900 mb-4 px-1">Quick Actions</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <QuickActionBtn
                        icon={<UserPlus className="w-6 h-6" />}
                        label="New Patient"
                        desc="Register a walk-in"
                        onClick={() => onNavigate('FRONT_DESK')}
                        color="bg-blue-600 hover:bg-blue-700"
                    />
                    <QuickActionBtn
                        icon={<Activity className="w-6 h-6" />}
                        label="Start Consult"
                        desc="Go to Doctor Portal"
                        onClick={() => onNavigate('DOCTOR')}
                        color="bg-violet-600 hover:bg-violet-700"
                    />
                    <QuickActionBtn
                        icon={<Clock className="w-6 h-6" />}
                        label="History"
                        desc="Patient Records"
                        onClick={() => onNavigate('HISTORY')}
                        color="bg-slate-600 hover:bg-slate-700"
                    />
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ icon, label, value, trend, accent, iconBg }: any) => (
    <div className={`
        relative min-h-[160px] p-6 rounded-2xl flex flex-col justify-between
        border border-slate-200 border-l-[3px] ${accent}
        bg-white shadow-sm
        hover:scale-[1.02] hover:shadow-md transition-all duration-200
        overflow-hidden
    `}>
        <div className="flex items-start justify-between">
            <div className={`p-2.5 ${iconBg} rounded-xl`}>{icon}</div>
            <span className="text-[11px] font-bold px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 tracking-wide">
                {trend}
            </span>
        </div>

        <div>
            <div className="text-4xl font-black text-slate-900 tabular-nums leading-none mb-1.5">{value}</div>
            <div className="text-sm font-semibold text-slate-500 tracking-wide">{label}</div>
        </div>
    </div>
);

const QuickActionBtn = ({ icon, label, desc, onClick, color, className }: any) => (
    <button
        onClick={onClick}
        className={`group relative overflow-hidden p-6 rounded-2xl text-left transition-all duration-300 shadow-md hover:shadow-xl ${className || color}`}
    >
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-150 transition-transform duration-500">
            {icon}
        </div>
        <div className="relative z-10 text-white">
            <div className="mb-3 p-2 bg-white/20 w-fit rounded-lg backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                {icon}
            </div>
            <div className="font-bold text-lg mb-0.5">{label}</div>
            <div className="text-sm text-white/80 font-medium">{desc}</div>
        </div>
        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
            <ChevronRight className="text-white w-5 h-5" />
        </div>
    </button>
);

export default DashboardHome;
