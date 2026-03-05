import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../services/db'
import { Pill, User, Phone, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

type Step = 'loading' | 'form' | 'success' | 'error' | 'invalid'

interface ClinicInfo {
    id: string
    name: string
    doctor_name: string | null
    address: string | null
    logo_url: string | null
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

    // Load clinic info from the URL param
    useEffect(() => {
        async function loadClinic() {
            if (!clinicId) { setStep('invalid'); return }

            const { data, error } = await supabase
                .from('clinics')
                .select('id, name, doctor_name, address, logo_url')
                .eq('id', clinicId)
                .single()

            if (error || !data) {
                setStep('invalid')
                return
            }

            setClinic(data)
            setStep('form')
        }
        loadClinic()
    }, [clinicId])

    async function handleSubmit() {
        if (!form.full_name.trim()) { setError('Please enter your full name'); return }
        if (!form.phone.trim() || form.phone.trim().length < 10) { setError('Please enter a valid 10-digit phone number'); return }
        if (!clinicId || !clinic) return

        setError('')
        setSubmitting(true)

        try {
            // 1. Insert patient row
            const { data: patient, error: patientError } = await supabase
                .from('patients')
                .insert({
                    full_name: form.full_name.trim(),
                    phone: form.phone.trim(),
                    clinic_id: clinicId,          // ← CRITICAL: locks to this clinic
                    status: 'waiting',
                    is_active: true,
                    source: 'QR_Checkin',
                    consultation_fee: 0,
                })
                .select('id')
                .single()

            if (patientError) throw patientError

            // 2. Create appointment row
            await supabase
                .from('appointments')
                .insert({
                    patient_id: patient.id,
                    clinic_id: clinicId,           // ← CRITICAL: locks to this clinic
                    status: 'waiting',
                    chief_complaint: form.chief_complaint || null,
                })

            // 3. Get their position in queue
            const { count } = await supabase
                .from('patients')
                .select('id', { count: 'exact', head: true })
                .eq('clinic_id', clinicId)
                .eq('status', 'waiting')

            setPatientPosition(count ?? 1)
            setStep('success')

        } catch (err: any) {
            console.error('Check-in error:', err)
            setError(err.message ?? 'Something went wrong. Please ask the front desk for help.')
        } finally {
            setSubmitting(false)
        }
    }

    // ── INVALID CLINIC ID ──
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

    // ── LOADING ──
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
            {/* Header */}
            <div
                className="flex items-center gap-3 px-4 py-4"
                style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
            >
                <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                    <Pill className="text-white w-5 h-5" />
                </div>
                <div>
                    <p className="font-black text-slate-900 text-sm leading-none">{clinic?.name}</p>
                    {clinic?.doctor_name && (
                        <p className="text-slate-400 text-xs mt-0.5">{clinic.doctor_name}</p>
                    )}
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-start px-4 pb-8">
                <AnimatePresence mode="wait">

                    {/* ── FORM STEP ── */}
                    {step === 'form' && (
                        <motion.div
                            className="w-full max-w-sm"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.25 }}
                        >
                            {/* Hero */}
                            <div className="text-center mb-6 mt-2">
                                <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-3">
                                    <User className="text-indigo-600 w-8 h-8" />
                                </div>
                                <h1 className="text-2xl font-black text-slate-900 mb-1">Quick Check-In</h1>
                                <p className="text-slate-400 text-sm">
                                    Fill in your details to join the waiting queue
                                </p>
                            </div>

                            {/* Error banner */}
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

                            {/* Form card */}
                            <div className="bg-white rounded-3xl p-5 shadow-lg shadow-slate-200/60 border border-slate-100">
                                <div className="space-y-4">

                                    {/* Full Name */}
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

                                    {/* Phone */}
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

                                    {/* Gender + Age row */}
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
                                                min={1} max={120}
                                                value={form.age}
                                                onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                                            />
                                        </div>
                                    </div>

                                    {/* Chief complaint */}
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

                                {/* Submit */}
                                <button
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    className="w-full mt-5 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black rounded-2xl text-base shadow-lg shadow-indigo-500/25 active:scale-[0.98] transition-transform disabled:opacity-70 disabled:cursor-wait"
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

                    {/* ── SUCCESS STEP ── */}
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
                                Welcome, <strong className="text-slate-700">{form.full_name}</strong>.
                                You have been registered at{' '}
                                <strong className="text-slate-700">{clinic?.name}</strong>.
                            </p>

                            {/* Queue position */}
                            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-lg shadow-slate-200/60 mb-5">
                                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Your Position</p>
                                <div className="flex items-center justify-center gap-3">
                                    <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                                        <span className="text-white font-black text-2xl">{patientPosition}</span>
                                    </div>
                                    <div className="text-left">
                                        <p className="font-black text-slate-900 text-lg leading-none">
                                            {patientPosition === 1 ? "You're next!" : `${patientPosition - 1} patient${patientPosition - 1 !== 1 ? 's' : ''} ahead`}
                                        </p>
                                        <p className="text-slate-400 text-sm mt-1">
                                            Est. wait: ~{Math.max(5, (patientPosition - 1) * 10)} mins
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100 text-left">
                                <p className="text-xs font-bold text-indigo-700 mb-2">What's next?</p>
                                <ul className="space-y-1.5 text-xs text-indigo-600">
                                    <li>• Please wait in the waiting room</li>
                                    <li>• The doctor will call your name when it's your turn</li>
                                    <li>• Keep this screen open for your queue number</li>
                                </ul>
                            </div>
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>
        </div>
    )
}
