import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../services/db'
import { User, Phone, CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react'

type Step = 'loading' | 'form' | 'success' | 'invalid'

interface ClinicInfo {
    id: string
    name: string
    doctor_name: string | null
    queue_accepting_patients: boolean | null
    emergency_mode: boolean | null
}

interface ActiveCheckinSession {
    clinicId: string
    patientId: string
    appointmentId: string
    patientName: string
    phone: string
    createdAt: string
}

const ACTIVE_CHECKIN_STORAGE_KEY = 'nirogos-active-checkin'

function loadStoredCheckin(clinicId: string): ActiveCheckinSession | null {
    try {
        const raw = localStorage.getItem(ACTIVE_CHECKIN_STORAGE_KEY)
        if (!raw) return null

        const parsed = JSON.parse(raw) as ActiveCheckinSession
        if (parsed?.clinicId !== clinicId) return null
        if (!parsed?.appointmentId || !parsed?.patientId) return null
        return parsed
    } catch {
        return null
    }
}

function persistCheckin(session: ActiveCheckinSession) {
    try {
        localStorage.setItem(ACTIVE_CHECKIN_STORAGE_KEY, JSON.stringify(session))
    } catch {
        // Ignore storage issues on restricted browsers.
    }
}

function clearStoredCheckin(clinicId?: string) {
    try {
        const raw = localStorage.getItem(ACTIVE_CHECKIN_STORAGE_KEY)
        if (!raw) return

        if (!clinicId) {
            localStorage.removeItem(ACTIVE_CHECKIN_STORAGE_KEY)
            return
        }

        const parsed = JSON.parse(raw) as ActiveCheckinSession
        if (!parsed?.clinicId || parsed.clinicId === clinicId) {
            localStorage.removeItem(ACTIVE_CHECKIN_STORAGE_KEY)
        }
    } catch {
        localStorage.removeItem(ACTIVE_CHECKIN_STORAGE_KEY)
    }
}

export default function CheckIn() {
    const { clinicId } = useParams<{ clinicId: string }>()

    const [step, setStep] = useState<Step>('loading')
    const [clinic, setClinic] = useState<ClinicInfo | null>(null)
    const [form, setForm] = useState({
        full_name: '',
        phone: '',
        age: '',
        gender: '',
        chief_complaint: '',
    })
    const [submitting, setSubmitting] = useState(false)
    const [patientPosition, setPatientPosition] = useState<number>(0)
    const [error, setError] = useState('')
    const [queueAccepting, setQueueAccepting] = useState(true)
    const [emergencyMode, setEmergencyMode] = useState(false)
    const [activeCheckin, setActiveCheckin] = useState<ActiveCheckinSession | null>(null)
    const [refreshingPosition, setRefreshingPosition] = useState(false)

    const refreshTimeoutRef = useRef<number | null>(null)

    const restoreActiveCheckin = useCallback(async (nextClinicId: string) => {
        const stored = loadStoredCheckin(nextClinicId)
        if (!stored) {
            setActiveCheckin(null)
            setPatientPosition(0)
            setStep('form')
            return
        }

        const { data: appointment, error: appointmentError } = await (supabase as any)
            .from('appointments')
            .select('id, status, created_at')
            .eq('id', stored.appointmentId)
            .eq('clinic_id', nextClinicId)
            .maybeSingle()

        if (appointmentError || !appointment || appointment.status !== 'waiting') {
            clearStoredCheckin(nextClinicId)
            setActiveCheckin(null)
            setPatientPosition(0)
            setStep('form')
            return
        }

        const hydratedSession: ActiveCheckinSession = {
            ...stored,
            createdAt: appointment.created_at ?? stored.createdAt,
        }

        setActiveCheckin(hydratedSession)
        setForm(current => ({
            ...current,
            full_name: hydratedSession.patientName,
            phone: hydratedSession.phone,
        }))
        setStep('success')
    }, [])

    const refreshQueuePosition = useCallback(async (sessionOverride?: ActiveCheckinSession | null) => {
        const session = sessionOverride ?? activeCheckin
        if (!clinicId || !session) return

        setRefreshingPosition(true)

        try {
            const [{ data: appointment, error: appointmentError }, { data: waitingAppointments, error: waitingError }] = await Promise.all([
                (supabase as any)
                    .from('appointments')
                    .select('id, status, created_at')
                    .eq('id', session.appointmentId)
                    .eq('clinic_id', clinicId)
                    .maybeSingle(),
                (supabase as any)
                    .from('appointments')
                    .select('id, created_at')
                    .eq('clinic_id', clinicId)
                    .eq('status', 'waiting')
                    .order('created_at', { ascending: true }),
            ])

            if (appointmentError || waitingError) {
                throw appointmentError ?? waitingError
            }

            if (!appointment || appointment.status !== 'waiting') {
                clearStoredCheckin(clinicId)
                setActiveCheckin(null)
                setPatientPosition(0)
                setStep('form')
                return
            }

            const queue = waitingAppointments ?? []
            const index = queue.findIndex((item: { id: string }) => item.id === session.appointmentId)

            setActiveCheckin({
                ...session,
                createdAt: appointment.created_at ?? session.createdAt,
            })
            setPatientPosition(index >= 0 ? index + 1 : 1)
            setStep('success')
        } catch (err: any) {
            console.error('Queue refresh error:', err)
            setError(err?.message ?? 'Could not refresh your queue position.')
        } finally {
            setRefreshingPosition(false)
        }
    }, [activeCheckin, clinicId])

    const scheduleQueueRefresh = useCallback((sessionOverride?: ActiveCheckinSession | null) => {
        if (refreshTimeoutRef.current) {
            window.clearTimeout(refreshTimeoutRef.current)
        }

        refreshTimeoutRef.current = window.setTimeout(() => {
            refreshTimeoutRef.current = null
            void refreshQueuePosition(sessionOverride)
        }, 120)
    }, [refreshQueuePosition])

    useEffect(() => {
        async function loadClinic() {
            if (!clinicId) {
                setStep('invalid')
                return
            }

            const { data, error } = await (supabase as any)
                .from('clinics')
                .select('id, name, doctor_name, queue_accepting_patients, emergency_mode')
                .eq('id', clinicId)
                .single()

            if (error || !data) {
                setStep('invalid')
                return
            }

            setClinic(data)
            setQueueAccepting(data.queue_accepting_patients ?? true)
            setEmergencyMode(data.emergency_mode ?? false)
            await restoreActiveCheckin(clinicId)
        }

        void loadClinic()
    }, [clinicId, restoreActiveCheckin])

    useEffect(() => {
        if (!clinicId) return

        const clinicChannel = (supabase as any)
            .channel(`checkin-clinic-${clinicId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'clinics',
                filter: `id=eq.${clinicId}`,
            }, (payload: any) => {
                const next = payload.new as { queue_accepting_patients?: boolean; emergency_mode?: boolean }
                if (typeof next.queue_accepting_patients === 'boolean') setQueueAccepting(next.queue_accepting_patients)
                if (typeof next.emergency_mode === 'boolean') setEmergencyMode(next.emergency_mode)
            })
            .subscribe()

        return () => {
            ;(supabase as any).removeChannel(clinicChannel)
        }
    }, [clinicId])

    useEffect(() => {
        if (!clinicId || !activeCheckin) return

        void refreshQueuePosition(activeCheckin)

        const queueChannel = (supabase as any)
            .channel(`checkin-queue-${clinicId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'appointments',
                filter: `clinic_id=eq.${clinicId}`,
            }, () => {
                scheduleQueueRefresh(activeCheckin)
            })
            .subscribe()

        return () => {
            if (refreshTimeoutRef.current) {
                window.clearTimeout(refreshTimeoutRef.current)
                refreshTimeoutRef.current = null
            }
            ;(supabase as any).removeChannel(queueChannel)
        }
    }, [activeCheckin, clinicId, refreshQueuePosition, scheduleQueueRefresh])

    async function handleSubmit() {
        if (!form.full_name.trim()) {
            setError('Please enter your full name')
            return
        }
        if (!form.phone.trim() || form.phone.trim().length < 10) {
            setError('Please enter a valid 10-digit phone number')
            return
        }
        if (!clinicId || !clinic) return
        if (!queueAccepting || emergencyMode) {
            setError('The queue is currently paused. Please wait for the doctor to reopen it.')
            return
        }

        setError('')
        setSubmitting(true)

        try {
            const cleanPhone = form.phone.trim().replace(/\D/g, '')
            const { data: existingPatient, error: existingPatientError } = await (supabase as any)
                .from('patients')
                .select('id')
                .eq('clinic_id', clinicId)
                .eq('phone', cleanPhone)
                .maybeSingle()

            if (existingPatientError) throw existingPatientError

            let patientId = existingPatient?.id as string | undefined

            if (patientId) {
                const { error: updatePatientError } = await (supabase as any)
                    .from('patients')
                    .update({
                        full_name: form.full_name.trim(),
                        phone: cleanPhone,
                        gender: form.gender || null,
                        status: 'waiting',
                        is_active: true,
                        source: 'QR_Checkin',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', patientId)

                if (updatePatientError) throw updatePatientError
            } else {
                const { data: patient, error: patientError } = await (supabase as any)
                    .from('patients')
                    .insert({
                        full_name: form.full_name.trim(),
                        phone: cleanPhone,
                        clinic_id: clinicId,
                        status: 'waiting',
                        is_active: true,
                        source: 'QR_Checkin',
                        consultation_fee: 0,
                        gender: form.gender || null,
                    })
                    .select('id')
                    .single()

                if (patientError) throw patientError
                patientId = patient.id
            }

            const { data: existingWaitingAppointments, error: waitingAppointmentError } = await (supabase as any)
                .from('appointments')
                .select('id, created_at')
                .eq('clinic_id', clinicId)
                .eq('patient_id', patientId)
                .eq('status', 'waiting')
                .order('created_at', { ascending: true })
                .limit(1)

            if (waitingAppointmentError) throw waitingAppointmentError

            const existingWaitingAppointment = existingWaitingAppointments?.[0] ?? null

            let appointmentId = existingWaitingAppointment?.id as string | undefined
            let appointmentCreatedAt = existingWaitingAppointment?.created_at as string | undefined

            if (!appointmentId) {
                const { data: appointment, error: appointmentError } = await (supabase as any)
                    .from('appointments')
                    .insert({
                        patient_id: patientId,
                        clinic_id: clinicId,
                        status: 'waiting',
                        chief_complaint: form.chief_complaint.trim() || null,
                    })
                    .select('id, created_at')
                    .single()

                if (appointmentError) throw appointmentError
                appointmentId = appointment.id
                appointmentCreatedAt = appointment.created_at
            }

            const session: ActiveCheckinSession = {
                clinicId,
                patientId: patientId!,
                appointmentId: appointmentId!,
                patientName: form.full_name.trim(),
                phone: cleanPhone,
                createdAt: appointmentCreatedAt ?? new Date().toISOString(),
            }

            persistCheckin(session)
            setActiveCheckin(session)
            setStep('success')
            await refreshQueuePosition(session)
        } catch (err: any) {
            console.error('Check-in error:', err)
            setError(err.message ?? 'Something went wrong. Please ask the front desk for help.')
        } finally {
            setSubmitting(false)
        }
    }

    const isBlockedForNewCheckins = !activeCheckin && (!queueAccepting || emergencyMode)

    if (step === 'invalid') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="text-center max-w-sm">
                    <div className="text-5xl mb-4">❌</div>
                    <h1 className="text-xl font-black text-slate-900 mb-2">Invalid QR Code</h1>
                    <p className="text-slate-400 text-sm">This QR code is not linked to a valid clinic. Please ask the front desk for a new QR code.</p>
                </div>
            </div>
        )
    }

    if (step === 'loading') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="animate-spin text-indigo-500 w-8 h-8" />
                    <p className="text-sm text-slate-400">Loading clinic information...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg, #eef2ff 0%, #f8fafc 60%)' }}>
            <div
                className="flex items-center gap-3 px-4 py-4"
                style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
            >
                <div className="rounded-2xl bg-white/80 px-3 py-2 shadow-sm ring-1 ring-slate-200/70 backdrop-blur">
                    <img
                        src="/assets/logo/NirogOs.png"
                        alt="NirogOS"
                        className="h-7 w-auto object-contain"
                    />
                </div>
                <div className="min-w-0">
                    <p className="truncate font-black text-slate-900 text-sm leading-none">{clinic?.name}</p>
                    <p className="mt-0.5 text-[11px] font-semibold text-slate-500">Official self check-in page</p>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-start px-4 pb-8">
                <AnimatePresence mode="wait">
                    {step === 'form' && (
                        <motion.div
                            className="w-full max-w-sm"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.25 }}
                        >
                            <div className="text-center mb-6 mt-2">
                                <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-3">
                                    <User className="text-indigo-600 w-8 h-8" />
                                </div>
                                <h1 className="text-2xl font-black text-slate-900 mb-1">Quick Check-In</h1>
                                <p className="text-slate-400 text-sm">
                                    Fill in your details to join the waiting queue
                                </p>
                            </div>

                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl mb-4"
                                >
                                    <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                                    <p className="text-red-600 text-xs font-medium">{error}</p>
                                </motion.div>
                            )}

                            {isBlockedForNewCheckins && (
                                <div className={`mb-4 rounded-2xl border px-4 py-3 ${emergencyMode ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                                    <p className={`text-sm font-black ${emergencyMode ? 'text-red-700' : 'text-amber-700'}`}>
                                        {emergencyMode ? 'Emergency pause active' : 'Queue is paused'}
                                    </p>
                                    <p className={`mt-1 text-xs font-medium ${emergencyMode ? 'text-red-600' : 'text-amber-700'}`}>
                                        {emergencyMode
                                            ? 'The doctor is handling an emergency. This page will reopen automatically when the queue resumes.'
                                            : 'New check-ins are temporarily paused. This page will update automatically when the queue reopens.'}
                                    </p>
                                </div>
                            )}

                            <div className="bg-white rounded-3xl p-5 shadow-lg shadow-slate-200/60 border border-slate-100">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                                            Full Name *
                                        </label>
                                        <div className="flex items-center gap-3 px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition">
                                            <User size={15} className="text-slate-400 flex-shrink-0" />
                                            <input
                                                style={{ fontSize: '16px' }}
                                                autoComplete="name"
                                                className="flex-1 bg-transparent outline-none text-slate-900 font-medium placeholder:text-slate-400"
                                                placeholder="Your full name"
                                                value={form.full_name}
                                                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                                            Phone Number *
                                        </label>
                                        <div className="flex items-center gap-3 px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition">
                                            <Phone size={15} className="text-slate-400 flex-shrink-0" />
                                            <span className="text-slate-500 font-medium text-sm">+91</span>
                                            <input
                                                type="tel"
                                                inputMode="numeric"
                                                style={{ fontSize: '16px' }}
                                                autoComplete="tel"
                                                className="flex-1 bg-transparent outline-none text-slate-900 font-medium placeholder:text-slate-400"
                                                placeholder="10-digit mobile number"
                                                maxLength={10}
                                                value={form.phone}
                                                onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Gender</label>
                                            <select
                                                style={{ fontSize: '16px' }}
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 font-medium focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none appearance-none"
                                                value={form.gender}
                                                onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                                            >
                                                <option value="">Select</option>
                                                <option>Male</option>
                                                <option>Female</option>
                                                <option>Other</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Age</label>
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                style={{ fontSize: '16px' }}
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 font-medium focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
                                                placeholder="Years"
                                                min={1}
                                                max={120}
                                                value={form.age}
                                                onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                                            Reason for Visit <span className="text-slate-300 font-normal normal-case">(optional)</span>
                                        </label>
                                        <input
                                            style={{ fontSize: '16px' }}
                                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 font-medium focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
                                            placeholder="e.g. Fever, Cough, Checkup..."
                                            value={form.chief_complaint}
                                            onChange={e => setForm(f => ({ ...f, chief_complaint: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={handleSubmit}
                                    disabled={submitting || isBlockedForNewCheckins}
                                    className="w-full mt-5 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black rounded-2xl text-base shadow-lg shadow-indigo-500/25 active:scale-[0.98] transition-transform disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {submitting ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <Loader2 size={18} className="animate-spin" />
                                            Joining queue...
                                        </span>
                                    ) : (
                                        '✓ Join Waiting Queue'
                                    )}
                                </button>
                            </div>

                            <p className="text-center text-slate-400 text-xs mt-4">
                                Your data is private and only visible to {clinic?.doctor_name ?? 'your doctor'}
                            </p>
                        </motion.div>
                    )}

                    {step === 'success' && (
                        <motion.div
                            className="w-full max-w-sm mt-8 text-center"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        >
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.15, type: 'spring', stiffness: 400 }}
                                className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-5"
                            >
                                <CheckCircle className="text-emerald-500 w-10 h-10" />
                            </motion.div>

                            <h1 className="text-2xl font-black text-slate-900 mb-2">You're in the Queue!</h1>
                            <p className="text-slate-400 text-sm mb-5">
                                Welcome, <strong className="text-slate-700">{activeCheckin?.patientName ?? form.full_name}</strong>.
                                You have been registered at{' '}
                                <strong className="text-slate-700">{clinic?.name}</strong>.
                            </p>

                            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-lg shadow-slate-200/60 mb-5">
                                <div className="flex items-center justify-between gap-3 mb-3">
                                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Your Live Position</p>
                                    <button
                                        type="button"
                                        onClick={() => void refreshQueuePosition()}
                                        disabled={refreshingPosition}
                                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                                    >
                                        <RefreshCw size={12} className={refreshingPosition ? 'animate-spin' : ''} />
                                        Refresh
                                    </button>
                                </div>

                                <div className="flex items-center justify-center gap-3">
                                    <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                                        <span className="text-white font-black text-2xl">{Math.max(1, patientPosition)}</span>
                                    </div>
                                    <div className="text-left">
                                        <p className="font-black text-slate-900 text-lg leading-none">
                                            {patientPosition <= 1 ? "You're next!" : `${patientPosition - 1} patient${patientPosition - 1 !== 1 ? 's' : ''} ahead`}
                                        </p>
                                        <p className="text-slate-400 text-sm mt-1">
                                            Est. wait: ~{Math.max(5, Math.max(0, patientPosition - 1) * 10)} mins
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {error && (
                                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-left">
                                    <p className="text-xs font-semibold text-red-700">{error}</p>
                                </div>
                            )}

                            <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100 text-left">
                                <p className="text-xs font-bold text-indigo-700 mb-2">What's next?</p>
                                <ul className="space-y-1.5 text-xs text-indigo-600">
                                    <li>• This token updates automatically as the queue moves</li>
                                    <li>• You can refresh this page and keep the same queue session</li>
                                    <li>• The doctor will call your name when it's your turn</li>
                                </ul>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    if (!clinicId) return
                                    clearStoredCheckin(clinicId)
                                    setActiveCheckin(null)
                                    setPatientPosition(0)
                                    setError('')
                                    setStep('form')
                                }}
                                className="mt-4 text-xs font-bold text-slate-500 hover:text-slate-700"
                            >
                                Not you? Start a fresh check-in
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
