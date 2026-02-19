import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/db';
import { Visit } from '../../types';
import { Clock, Activity, User } from 'lucide-react';

interface QueueItemProps {
    visit: Visit;
    onClick: () => void | Promise<void>;
}

const formatWaitTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s < 10 ? '0' + s : s}s`;
};

const getWaitColor = (seconds: number) => {
    if (seconds < 300) return { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' };
    if (seconds < 900) return { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' };
    return { text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' };
};

const QueueItem: React.FC<QueueItemProps> = ({ visit, onClick }) => {
    const [patientName, setPatientName] = useState('Loading...');
    const [waitSeconds, setWaitSeconds] = useState(0);

    useEffect(() => {
        const fetchName = async () => {
            const { data } = await supabase.from('patients').select('full_name').eq('id', visit.patientId).single();
            if (data) setPatientName(data.full_name);
        };
        fetchName();
    }, [visit.patientId]);

    useEffect(() => {
        const arrivalMs = new Date(visit.arrivalTime).getTime();
        const tick = () => {
            const elapsed = Math.floor((Date.now() - arrivalMs) / 1000);
            setWaitSeconds(elapsed > 0 ? elapsed : 0);
        };
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [visit.arrivalTime]);

    const waitColor = getWaitColor(waitSeconds);

    return (
        <button
            onClick={onClick}
            className="w-full text-left p-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40 transition-all group shadow-sm hover:shadow-md"
        >
            <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/15 to-purple-500/15 border border-indigo-200/60 flex items-center justify-center flex-shrink-0 group-hover:from-indigo-500/25 group-hover:to-purple-500/25 transition-all">
                    <User size={16} className="text-indigo-600" />
                </div>

                <div className="flex-1 min-w-0">
                    {/* Name + status badge */}
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-900 text-sm truncate group-hover:text-indigo-700 transition-colors">
                            {patientName}
                        </span>
                        <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full border border-amber-200">
                            Waiting
                        </span>
                    </div>

                    {/* Arrival time */}
                    <div className="text-xs text-slate-500 flex items-center gap-1 mb-1.5">
                        <Clock size={10} />
                        {new Date(visit.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>

                    {/* Live wait timer */}
                    <div className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${waitColor.bg} ${waitColor.text} ${waitColor.border}`}>
                        <Activity size={10} />
                        {formatWaitTime(waitSeconds)}
                    </div>
                </div>
            </div>
        </button>
    );
};

export default QueueItem;
