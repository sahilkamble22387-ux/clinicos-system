// components/EmergencyQueueControls.tsx
// Emergency queue controls for Doctor Portal header.
// Uses Supabase Realtime for live FrontDesk sync.

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldAlert, X, Users, Activity } from 'lucide-react'
import { supabase } from '../services/db'
import toast from 'react-hot-toast'

interface EmergencyQueueControlsProps {
    clinicId: string
}

interface ClinicQueueState {
    queue_accepting_patients: boolean
    emergency_mode: boolean
    emergency_triggered_at: string | null
}

// ── Confirmation Dialog (no window.confirm) ──────────────────────
function ConfirmDialog({
    title,
    body,
    confirmLabel,
    confirmClass,
    onConfirm,
    onCancel,
}: {
    title: string
    body: string
    confirmLabel: string
    confirmClass: string
    onConfirm: () => void
    onCancel: () => void
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onCancel}
            />
            <motion.div
                className="relative bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6"
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
            >
                <button
                    onClick={onCancel}
                    className="absolute top-4 right-4 w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center"
                >
                    <X size={13} className="text-slate-500" />
                </button>
                <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
                    <ShieldAlert size={22} className="text-red-600" />
                </div>
                <h3 className="font-black text-slate-900 text-lg mb-2">{title}</h3>
                <p className="text-slate-500 text-sm font-medium mb-6">{body}</p>
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`flex-1 py-3 rounded-xl text-white font-bold text-sm transition ${confirmClass}`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </motion.div>
        </div>
    )
}

// ── Main Component ────────────────────────────────────────────────
export function EmergencyQueueControls({ clinicId }: EmergencyQueueControlsProps) {
    const [state, setState] = useState<ClinicQueueState>({
        queue_accepting_patients: true,
        emergency_mode: false,
        emergency_triggered_at: null,
    })
    const [confirmDialog, setConfirmDialog] = useState<'emergency' | 'clear' | null>(null)
    const [loading, setLoading] = useState(false)

    // Fetch current state
    useEffect(() => {
        if (!clinicId) return
        supabase
            .from('clinics')
            .select('queue_accepting_patients, emergency_mode, emergency_triggered_at')
            .eq('id', clinicId)
            .single()
            .then(({ data, error }) => {
                if (!error && data) setState(data as ClinicQueueState)
            })

        // Realtime subscription for self-reflection (in case another tab changes it)
        const channel = supabase
            .channel(`clinic-controls-${clinicId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'clinics',
                filter: `id=eq.${clinicId}`,
            }, (payload) => {
                const n = payload.new as ClinicQueueState
                setState(prev => ({
                    ...prev,
                    queue_accepting_patients: n.queue_accepting_patients ?? prev.queue_accepting_patients,
                    emergency_mode: n.emergency_mode ?? prev.emergency_mode,
                    emergency_triggered_at: n.emergency_triggered_at ?? prev.emergency_triggered_at,
                }))
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [clinicId])

    async function toggleQueue(accepting: boolean) {
        setLoading(true)
        const { error } = await supabase
            .from('clinics')
            .update({ queue_accepting_patients: accepting })
            .eq('id', clinicId)
        setLoading(false)

        if (error) {
            toast.error('Failed to update queue status')
            return
        }
        setState(prev => ({ ...prev, queue_accepting_patients: accepting }))
        toast.success(accepting ? 'Queue re-opened ✅' : 'Queue paused 🔒')
    }

    async function triggerEmergency() {
        setConfirmDialog(null)
        setLoading(true)
        const { error } = await supabase
            .from('clinics')
            .update({
                emergency_mode: true,
                emergency_triggered_at: new Date().toISOString(),
                queue_accepting_patients: false,
            })
            .eq('id', clinicId)
        setLoading(false)

        if (error) { toast.error('Failed to trigger emergency'); return }
        setState({
            emergency_mode: true,
            emergency_triggered_at: new Date().toISOString(),
            queue_accepting_patients: false,
        })
        toast.error('🚨 Emergency mode activated — queue paused', { duration: 5000 })
    }

    async function clearEmergency() {
        setConfirmDialog(null)
        setLoading(true)
        const { error } = await supabase
            .from('clinics')
            .update({
                emergency_mode: false,
                emergency_triggered_at: null,
                queue_accepting_patients: true,
            })
            .eq('id', clinicId)
        setLoading(false)

        if (error) { toast.error('Failed to clear emergency'); return }
        setState({
            emergency_mode: false,
            emergency_triggered_at: null,
            queue_accepting_patients: true,
        })
        toast.success('✅ Emergency cleared — queue re-opened')
    }

    const { queue_accepting_patients, emergency_mode } = state

    return (
        <>
            {/* ── Emergency Confirmation Dialogs ── */}
            <AnimatePresence>
                {confirmDialog === 'emergency' && (
                    <ConfirmDialog
                        title="Declare Emergency Pause?"
                        body="This will immediately lock the patient queue and pause new check-ins. The front desk and QR check-in page will show an emergency notice."
                        confirmLabel="🚨 Declare Emergency"
                        confirmClass="bg-red-600 hover:bg-red-700"
                        onConfirm={triggerEmergency}
                        onCancel={() => setConfirmDialog(null)}
                    />
                )}
                {confirmDialog === 'clear' && (
                    <ConfirmDialog
                        title="Clear Emergency Mode?"
                        body="This will re-open the patient queue and remove the emergency banner from all screens."
                        confirmLabel="✅ Clear Emergency"
                        confirmClass="bg-emerald-600 hover:bg-emerald-700"
                        onConfirm={clearEmergency}
                        onCancel={() => setConfirmDialog(null)}
                    />
                )}
            </AnimatePresence>

            {/* ── Controls ── */}
            <div className="flex items-center gap-2">
                {/* Accept queue toggle */}
                {!emergency_mode && (
                    <button
                        onClick={() => toggleQueue(!queue_accepting_patients)}
                        disabled={loading}
                        title={queue_accepting_patients ? 'Pause new check-ins' : 'Re-open check-ins'}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition border ${queue_accepting_patients
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                            }`}
                    >
                        <Users size={12} />
                        {queue_accepting_patients ? 'Accepting' : 'Paused'}
                    </button>
                )}

                {/* Emergency Pause / Clear button */}
                {emergency_mode ? (
                    <button
                        onClick={() => setConfirmDialog('clear')}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-red-600 text-white border border-red-600 hover:bg-red-700 animate-pulse transition"
                    >
                        <Activity size={12} />
                        Emergency Active
                    </button>
                ) : (
                    <button
                        onClick={() => setConfirmDialog('emergency')}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition"
                    >
                        <ShieldAlert size={12} />
                        Emergency
                    </button>
                )}
            </div>
        </>
    )
}

// ── FrontDesk Emergency Banner (to be embedded in FrontDesk component) ──
export function EmergencyBanner({
    clinicId,
}: {
    clinicId: string
}) {
    const [state, setState] = useState<Pick<ClinicQueueState, 'emergency_mode' | 'queue_accepting_patients'>>({
        emergency_mode: false,
        queue_accepting_patients: true,
    })

    useEffect(() => {
        if (!clinicId) return

        // Initial fetch
        supabase
            .from('clinics')
            .select('emergency_mode, queue_accepting_patients')
            .eq('id', clinicId)
            .single()
            .then(({ data, error }) => {
                if (!error && data) {
                    setState({
                        emergency_mode: (data as ClinicQueueState).emergency_mode,
                        queue_accepting_patients: (data as ClinicQueueState).queue_accepting_patients,
                    })
                }
            })

        // Realtime listener
        const channel = supabase
            .channel(`front-desk-emergency-${clinicId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'clinics',
                filter: `id=eq.${clinicId}`,
            }, (payload) => {
                const n = payload.new as ClinicQueueState
                setState({
                    emergency_mode: n.emergency_mode ?? false,
                    queue_accepting_patients: n.queue_accepting_patients ?? true,
                })
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [clinicId])

    if (!state.emergency_mode && state.queue_accepting_patients) return null

    return (
        <AnimatePresence>
            {(state.emergency_mode || !state.queue_accepting_patients) && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold border-b flex-shrink-0 ${state.emergency_mode
                            ? 'bg-red-600 text-white border-red-700'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                >
                    {state.emergency_mode ? (
                        <>
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse flex-shrink-0" />
                            <span>🚨 Emergency mode active — new patient check-ins are paused. Doctor is attending an emergency.</span>
                        </>
                    ) : (
                        <>
                            <Users size={16} className="text-amber-600 flex-shrink-0" />
                            <span>Queue is currently paused — new check-ins are disabled.</span>
                        </>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    )
}
