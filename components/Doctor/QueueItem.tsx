import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/db';
import { Visit } from '../../types';

// Helper component for Queue Item to fetch patient name
const QueueItem = ({ visit, onClick }: { visit: Visit, onClick: () => void }) => {
    const [patientName, setPatientName] = useState('Loading...');

    useEffect(() => {
        const fetchName = async () => {
            const { data } = await supabase.from('patients').select('full_name').eq('id', visit.patientId).single();
            if (data) setPatientName(data.full_name);
        };
        fetchName();
    }, [visit.patientId]);

    return (
        <button
            onClick={onClick}
            className="w-full text-left p-4 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all group"
        >
            <div className="font-bold text-slate-900 group-hover:text-indigo-700">{patientName}</div>
            <div className="text-xs text-slate-500 mt-1">
                Checked in: {new Date(visit.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
        </button>
    );
};

export default QueueItem;
