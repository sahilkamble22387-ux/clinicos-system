import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/db';
import { Visit } from '../../types';
import { Clock, Activity, User, Smartphone, Building2, AlertCircle } from 'lucide-react';

interface QueueItemProps {
    visit: Visit;
    onClick: () => void | Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatWaitTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s < 10 ? '0' + s : s}s`;
};

const getWaitColor = (seconds: number) => {
    if (seconds < 900) return { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' };
    if (seconds < 1800) return { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' };
    return { text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' };
};

// Avatar initial + color derived from name (stable across re-renders)
function avatarSeed(name: string) {
    const colors = [
        { from: 'from-indigo-500/20', to: 'to-purple-500/20', border: 'border-indigo-200/60', icon: 'text-indigo-600' },
        { from: 'from-emerald-500/20', to: 'to-teal-500/20', border: 'border-emerald-200/60', icon: 'text-emerald-600' },
        { from: 'from-rose-500/20', to: 'to-pink-500/20', border: 'border-rose-200/60', icon: 'text-rose-600' },
        { from: 'from-amber-500/20', to: 'to-orange-500/20', border: 'border-amber-200/60', icon: 'text-amber-600' },
        { from: 'from-sky-500/20', to: 'to-cyan-500/20', border: 'border-sky-200/60', icon: 'text-sky-600' },
    ];
    const idx = name ? name.charCodeAt(0) % colors.length : 0;
    return { initial: (name || 'U').charAt(0).toUpperCase(), ...colors[idx] };
}

// ─── Component ────────────────────────────────────────────────────────────────

const QueueItem: React.FC<QueueItemProps> = ({ visit, onClick }) => {
    const [patientName, setPatientName] = useState<string>(visit.patientName?.trim() || '');
    const [patientSource, setPatientSource] = useState<string | null>(visit.source ?? null);
    const [loadError, setLoadError] = useState(false);
    const [waitSeconds, setWaitSeconds] = useState(0);

    // BUG FIX 1: track mount state to prevent setState after unmount
    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    // BUG FIX 2: handle fetch error — original silently left name as 'Loading...' on failure
    useEffect(() => {
        setPatientName(visit.patientName?.trim() || '');
        setPatientSource(visit.source ?? null);
        setLoadError(false);
    }, [visit.patientId, visit.patientName, visit.source]);

    useEffect(() => {
        if (visit.patientName?.trim()) return;

        if (!visit.patientId) {
            setPatientName('Unknown Patient');
            return;
        }

        let cancelled = false;

        const fetchInfo = async () => {
            const { data, error } = await (supabase as any)
                .from('patients')
                .select('full_name, source')
                .eq('id', visit.patientId)
                .single();

            if (cancelled) return;

            if (error || !data) {
                setPatientName('Unknown Patient');
                setLoadError(true);
                return;
            }
            // BUG FIX 3: guard empty/null full_name from DB
            setPatientName(data.full_name?.trim() || 'Unnamed Patient');
            setPatientSource(data.source ?? null);
        };

        fetchInfo();
        return () => { cancelled = true; };
    }, [visit.patientId, visit.patientName]);

    // BUG FIX 4: arrivalTime could be invalid — guard against NaN elapsed time
    useEffect(() => {
        const arrivalMs = visit.arrivalTime ? new Date(visit.arrivalTime).getTime() : NaN;

        if (isNaN(arrivalMs)) {
            setWaitSeconds(0);
            return;
        }

        const tick = () => {
            const elapsed = Math.floor((Date.now() - arrivalMs) / 1000);
            // BUG FIX 5: original didn't guard against future arrivalTime (negative elapsed)
            setWaitSeconds(Math.max(0, elapsed));
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [visit.arrivalTime]);

    const waitColor = getWaitColor(waitSeconds);
    const avatar = avatarSeed(patientName);
    const isLoading = !patientName && !loadError;

    const arrivalLabel = visit.arrivalTime && !isNaN(new Date(visit.arrivalTime).getTime())
        ? new Date(visit.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '—';

    return (
        <button
            onClick={onClick}
            className="w-full text-left p-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40 transition-all group shadow-sm hover:shadow-md active:scale-[0.99]"
        >
            <div className="flex items-start gap-3">

                {/* Avatar */}
                <div className={`
                    w-9 h-9 rounded-xl bg-gradient-to-br ${avatar.from} ${avatar.to}
                    border ${avatar.border} flex items-center justify-center flex-shrink-0
                    transition-all
                `}>
                    {isLoading ? (
                        <User size={16} className="text-slate-400" />
                    ) : loadError ? (
                        <AlertCircle size={15} className="text-rose-400" />
                    ) : (
                        <span className={`text-xs font-black ${avatar.icon}`}>
                            {avatar.initial}
                        </span>
                    )}
                </div>

                <div className="flex-1 min-w-0">

                    {/* Name + status badges */}
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        {isLoading ? (
                            <span className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
                        ) : (
                            <span className="font-bold text-slate-900 text-sm truncate group-hover:text-indigo-700 transition-colors">
                                {patientName}
                            </span>
                        )}

                        <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full border border-amber-200">
                            Waiting
                        </span>

                        {/* Source badge */}
                        {patientSource === 'QR_Checkin' && (
                            <span className="flex-shrink-0 inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full border border-blue-200">
                                <Smartphone size={9} /> QR
                            </span>
                        )}
                        {patientSource === 'Front_Desk' && (
                            <span className="flex-shrink-0 inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                                <Building2 size={9} /> Desk
                            </span>
                        )}
                    </div>

                    {/* Arrival time */}
                    <div className="text-xs text-slate-400 flex items-center gap-1 mb-1.5">
                        <Clock size={10} className="flex-shrink-0" />
                        Arrived {arrivalLabel}
                    </div>

                    {/* Live wait timer */}
                    <div className={`
                        inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border
                        ${waitColor.bg} ${waitColor.text} ${waitColor.border}
                        transition-colors duration-1000
                    `}>
                        <Activity size={10} />
                        {formatWaitTime(waitSeconds)}
                    </div>
                </div>
            </div>
        </button>
    );
};

export default QueueItem;
