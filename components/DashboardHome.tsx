import React, { useState, useEffect } from 'react';
import { Clinic, ViewMode } from '../types';
import { Users, UserPlus, Activity, Clock, ChevronRight, QrCode } from 'lucide-react';
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
        todayRevenue: 0,
        qrCheckins: 0,
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
            .on('postgres_changes', { event: '*', schema: 'public', table: 'medical_records', filter: `clinic_id=eq.${clinicId}` }, () => fetchStats())
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [clinic]);

    const fetchStats = async () => {
        const clinicId = clinic?.id || '00000000-0000-0000-0000-000000000000';
        const today = new Date().toISOString().split('T')[0];

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

            const { count: completedCount } = await supabase
                .from('patients')
                .select('*', { count: 'exact', head: true })
                .eq('clinic_id', clinicId)
                .eq('status', 'completed')
                .gte('updated_at', `${today}T00:00:00`)
                .lte('updated_at', `${today}T23:59:59`);

            // Today's revenue from medical_records
            const { data: todayRecords } = await supabase
                .from('medical_records')
                .select('fee_collected')
                .eq('clinic_id', clinicId)
                .gte('created_at', `${today}T00:00:00`)
                .lte('created_at', `${today}T23:59:59`);

            const todayRevenue = todayRecords?.reduce((sum, r) => sum + (Number(r.fee_collected) || 0), 0) || 0;

            // QR check-ins today
            const { count: qrCount } = await supabase
                .from('patients')
                .select('*', { count: 'exact', head: true })
                .eq('clinic_id', clinicId)
                .eq('source', 'QR_Checkin')
                .gte('created_at', `${today}T00:00:00`);

            setStats({
                totalPatients: totalPatients || 0,
                waiting: waitingCount || 0,
                completed: completedCount || 0,
                todayRevenue,
                qrCheckins: qrCount || 0,
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
        <div className="space-y-5 md:space-y-8 animate-in fade-in duration-700 slide-in-from-bottom-4 pb-24 md:pb-8 px-4 md:px-6">
            {/* Identity Card — Gradient Header */}
            <div
                className="rounded-2xl md:rounded-3xl p-4 md:p-6 relative overflow-hidden"
                style={{
                    background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #6D28D9 100%)',
                    boxShadow: '0 8px 32px rgba(99,102,241,0.30)',
                }}
            >
                {/* Background decoration */}
                <div
                    className="absolute right-0 top-0 w-40 h-40 opacity-10 pointer-events-none"
                    style={{
                        background: 'radial-gradient(circle at top right, white 0%, transparent 70%)',
                    }}
                />

                {/* Top row: clinic name + time */}
                <div className="flex items-start justify-between mb-3 relative z-10">
                    <div>
                        <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest mb-0.5">
                            {clinic?.name ?? 'Your Clinic'}
                        </p>
                        <h1 className="text-white font-black text-lg md:text-2xl leading-tight">
                            {getGreeting()}{' '}
                            <span className="bg-gradient-to-r from-white to-indigo-100 bg-clip-text text-transparent">
                                Dr. {doctorName}
                            </span>
                        </h1>
                    </div>
                    {/* Clock — compact on mobile */}
                    <div className="text-right flex-shrink-0 ml-3">
                        <p className="text-white font-black text-xl md:text-3xl leading-none tabular-nums">
                            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-indigo-200 text-[10px] font-medium mt-0.5">
                            {currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                        </p>
                    </div>
                </div>

                {/* Patient status pill */}
                <div className="relative z-10">
                    {stats.waiting > 0 ? (
                        <div className="inline-flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1.5 mb-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-white text-xs font-bold">
                                {stats.waiting} patient{stats.waiting !== 1 ? 's' : ''} ready for consultation
                            </span>
                        </div>
                    ) : (
                        <div className="inline-flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5 mb-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
                            <span className="text-indigo-200 text-xs font-medium">No patients waiting</span>
                        </div>
                    )}
                </div>

                {/* Revenue — inline in banner, not separate card */}
                <div className="flex items-center justify-between relative z-10">
                    <div>
                        <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-wider">
                            Today's Revenue
                        </p>
                        <p className="text-white font-black text-xl leading-tight tabular-nums">
                            ₹{stats.todayRevenue.toLocaleString('en-IN')}
                        </p>
                    </div>
                    {/* Quick action buttons */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => onNavigate('FRONT_DESK')}
                            className="bg-white/20 hover:bg-white/30 active:bg-white/40 text-white text-xs font-bold px-3 py-2 rounded-xl transition"
                        >
                            + Patient
                        </button>
                        <button
                            onClick={() => onNavigate('DOCTOR')}
                            className="bg-white text-indigo-700 text-xs font-bold px-3 py-2 rounded-xl active:bg-indigo-50 transition shadow-sm"
                        >
                            Queue →
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
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
                    trend="Live count"
                    accent="border-amber-500"
                    iconBg="bg-amber-50"
                />
                <StatCard
                    icon={<Activity className="w-6 h-6 text-emerald-600" />}
                    label="Completed Today"
                    value={stats.completed}
                    trend="Today's count"
                    accent="border-emerald-500"
                    iconBg="bg-emerald-50"
                />
                <StatCard
                    icon={<QrCode className="w-6 h-6 text-violet-600" />}
                    label="QR Check-ins"
                    value={stats.qrCheckins}
                    trend="Today via QR"
                    accent="border-violet-500"
                    iconBg="bg-violet-50"
                />
            </div>

            {/* Quick Actions */}
            <div>
                <h2 className="text-xl font-bold text-slate-900 mb-4 px-1">Quick Actions</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
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
    <div className={`relative min-h-[120px] md:min-h-[160px] p-5 md:p-6 rounded-2xl flex flex-col justify-between border border-slate-200 border-l-[4px] ${accent} bg-white hover:scale-[1.02] transition-all duration-200 overflow-hidden`}>
        <div className="flex items-start justify-between">
            <div className={`p-2.5 md:p-3 ${iconBg} rounded-xl`}>{icon}</div>
            <span className="hidden md:inline text-[11px] font-bold px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 tracking-wide">
                {trend}
            </span>
        </div>
        <div className="mt-4">
            <div className="text-2xl md:text-4xl font-black text-slate-900 tabular-nums leading-none mb-1.5">{value}</div>
            <div className="text-xs md:text-sm font-semibold text-slate-500 tracking-wide">{label}</div>
        </div>
    </div>
);

const QuickActionBtn = ({ icon, label, desc, onClick, color, className }: any) => (
    <button
        onClick={onClick}
        className={`group relative overflow-hidden p-5 md:p-6 rounded-2xl text-left transition-all duration-300 shadow-md hover:shadow-xl ${className || color}`}
    >
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-150 transition-transform duration-500">
            {icon}
        </div>
        <div className="relative z-10 text-white">
            <div className="mb-3 p-2 bg-white/20 w-fit rounded-lg backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                {icon}
            </div>
            <div className="font-bold text-base md:text-lg mb-0.5">{label}</div>
            <div className="text-sm text-white/80 font-medium hidden md:block">{desc}</div>
        </div>
        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
            <ChevronRight className="text-white w-5 h-5" />
        </div>
    </button>
);

export default DashboardHome;
