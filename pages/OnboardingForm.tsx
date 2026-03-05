import React, { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
    User, Building2, PenLine, ChevronRight, ChevronLeft,
    CheckCircle, Upload, X, AlertCircle, Eye, Loader2,
    Stethoscope, Phone, MapPin, Mail, Clock, Award, Hash, Stamp
} from 'lucide-react'
import { supabase } from '../services/db'
import { useAuth } from '../context/AuthContext'
import { compressSignatureToBase64, signatureToImgSrc, getSignatureSizeKB } from '../utils/signatureCompressor'
import { QUALIFICATION_PRESETS, SPECIALIZATION_OPTIONS, OnboardingFormData } from '../types/clinic'
import { DegreeInput } from '../components/DegreeInput'
import toast from 'react-hot-toast'

// ── Step definitions ──────────────────────────────────────────────
const STEPS = [
    { id: 1, title: 'Doctor Details', subtitle: 'Your professional identity', icon: User },
    { id: 2, title: 'Clinic Details', subtitle: 'Where you practice', icon: Building2 },
    { id: 3, title: 'Your Signature', subtitle: 'For authentic prescriptions', icon: PenLine },
]

// ── Initial form state ────────────────────────────────────────────
const INITIAL: OnboardingFormData = {
    doctor_name: '',
    qualifications: '',
    registration_number: '',
    specialization: '',
    experience_years: '',
    phone_number: '',
    clinic_name_override: '',
    clinic_address: '',
    clinic_email: '',
    clinic_timings: '',
    signature_base64: null,
    stamp_base64: null,
}

// ── Reusable field component ──────────────────────────────────────
function Field({
    label, required = false, hint, error, children,
}: {
    label: string
    required?: boolean
    hint?: string
    error?: string
    children: React.ReactNode
}) {
    return (
        <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-sm font-semibold text-slate-700">
                {label}
                {required && <span className="text-rose-500">*</span>}
            </label>
            {children}
            {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
            {error && (
                <p className="text-xs font-semibold text-rose-500 flex items-center gap-1">
                    <AlertCircle size={12} /> {error}
                </p>
            )}
        </div>
    )
}

function Input({
    value, onChange, placeholder, type = 'text', className = '', ...rest
}: {
    value: string
    onChange: (v: string) => void
    placeholder?: string
    type?: string
    className?: string
    [key: string]: any
}) {
    return (
        <input
            type={type}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            style={{ fontSize: 16 }}  // prevents mobile zoom
            className={`w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 font-medium placeholder:text-slate-400 placeholder:text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition ${className}`}
            {...rest}
        />
    )
}

function Select({
    value, onChange, options, placeholder,
}: {
    value: string
    onChange: (v: string) => void
    options: string[]
    placeholder?: string
}) {
    return (
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            style={{ fontSize: 16 }}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition appearance-none"
        >
            <option value="" disabled>{placeholder ?? 'Select…'}</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
    )
}

// ── Step 1 — Doctor Details ───────────────────────────────────────
function StepDoctor({
    form, update, errors, degreeList, onDegreeChange,
}: {
    form: OnboardingFormData
    update: (k: keyof OnboardingFormData, v: string) => void
    errors: Partial<Record<keyof OnboardingFormData, string>>
    degreeList: string[]
    onDegreeChange: (v: string[]) => void
}) {
    return (
        <div className="space-y-6">
            <Field label="Your Full Name" required error={errors.doctor_name}>
                <Input
                    value={form.doctor_name}
                    onChange={v => update('doctor_name', v)}
                    placeholder="e.g. Dr. Deepak Sharma"
                />
            </Field>

            <Field label="Qualifications" required error={errors.qualifications}>
                <DegreeInput
                    values={degreeList}
                    onChange={onDegreeChange}
                    placeholder="Type MBBS, MD… and press Enter"
                    error={errors.qualifications}
                />
            </Field>

            <Field label="Medical Registration Number" required error={errors.registration_number}>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Hash size={18} className="text-slate-400" />
                    </div>
                    <Input
                        value={form.registration_number}
                        onChange={v => update('registration_number', v.toUpperCase())}
                        placeholder="e.g. MMC-12345"
                        className="pl-9"
                    />
                </div>
                <div className="mt-2 bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-start gap-2">
                    <AlertCircle size={16} className="text-slate-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-slate-600 leading-relaxed">
                        <strong>Why this is mandatory:</strong> Under the Drugs and Cosmetics Act, 1940 and IMC regulations,
                        every prescription must include the doctor's registration number. Prescriptions without it are legally invalid.
                    </p>
                </div>
            </Field>

            <div className="grid grid-cols-2 gap-4">
                <Field label="Specialization" required error={errors.specialization}>
                    <Select
                        value={form.specialization}
                        onChange={v => update('specialization', v)}
                        options={SPECIALIZATION_OPTIONS}
                        placeholder="Select specialization…"
                    />
                </Field>
                <Field label="Years of Experience" error={errors.experience_years}>
                    <Input
                        type="number"
                        value={form.experience_years}
                        onChange={v => update('experience_years', v)}
                        placeholder="e.g. 10"
                    />
                </Field>
            </div>
        </div>
    )
}

// ── Doctor Stamp Sub-section ─────────────────────────────────────
function StampUploader({
    stampBase64, onChange,
}: {
    stampBase64: string | null
    onChange: (v: string | null) => void
}) {
    const fileRef = useRef<HTMLInputElement>(null)
    const [mode, setMode] = useState<'photo' | 'generate'>('photo')
    const [processing, setProcessing] = useState(false)
    const [genName, setGenName] = useState('')
    const [genReg, setGenReg] = useState('')

    async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        setProcessing(true)
        try {
            const { compressSignatureToBase64 } = await import('../utils/signatureCompressor')
            const b64 = await compressSignatureToBase64(file)
            onChange(b64)
        } catch {
            // Silently fail — show error in UI
        } finally { setProcessing(false) }
    }

    function generateDigitalStamp() {
        const canvas = document.createElement('canvas')
        canvas.width = 280
        canvas.height = 280
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Outer circle
        ctx.beginPath()
        ctx.arc(140, 140, 130, 0, 2 * Math.PI)
        ctx.lineWidth = 6
        ctx.strokeStyle = '#1e3a8a'
        ctx.stroke()

        // Inner circle
        ctx.beginPath()
        ctx.arc(140, 140, 110, 0, 2 * Math.PI)
        ctx.lineWidth = 2
        ctx.strokeStyle = '#1e3a8a'
        ctx.stroke()

        // Top text (Dr. Name) along arc
        ctx.font = 'bold 18px Arial'
        ctx.fillStyle = '#1e3a8a'
        ctx.textAlign = 'center'
        ctx.fillText(`Dr. ${genName || 'Name'}`, 140, 120)

        // Middle cross/symbol
        ctx.font = 'bold 28px Arial'
        ctx.fillStyle = '#1e3a8a'
        ctx.fillText('✚', 140, 160)

        // Reg number
        ctx.font = '13px Arial'
        ctx.fillText(`Reg: ${genReg || 'XXXXXX'}`, 140, 195)

        const dataUrl = canvas.toDataURL('image/png')
        // strip the data URL prefix
        const b64 = dataUrl.replace(/^data:image\/png;base64,/, '')
        onChange('data:image/png;base64,' + b64)
    }

    const imgSrc = stampBase64?.startsWith('data:') ? stampBase64 : stampBase64 ? `data:image/png;base64,${stampBase64}` : null

    return (
        <div className="mt-6 pt-6 border-t border-slate-200 space-y-4">
            <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center">
                    <Stamp size={14} className="text-violet-600" />
                </div>
                <div>
                    <p className="text-sm font-bold text-slate-800">Doctor Stamp <span className="text-slate-400 font-normal text-xs">(Optional)</span></p>
                    <p className="text-xs text-slate-500">Appears at the bottom of printed prescriptions</p>
                </div>
            </div>

            {!imgSrc ? (
                <div>
                    {/* Toggle: Photo / Generate */}
                    <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-4">
                        {(['photo', 'generate'] as const).map(m => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => setMode(m)}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {m === 'photo' ? '📷 Upload Photo' : '✨ Generate Digital'}
                            </button>
                        ))}
                    </div>

                    {mode === 'photo' ? (
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            disabled={processing}
                            className="w-full flex items-center gap-3 px-4 py-3 bg-white border-2 border-dashed border-slate-200 hover:border-violet-300 hover:bg-violet-50 rounded-2xl transition"
                        >
                            {processing ? (
                                <Loader2 size={18} className="text-violet-500 animate-spin" />
                            ) : (
                                <Upload size={18} className="text-slate-400" />
                            )}
                            <span className="text-sm font-medium text-slate-600">
                                {processing ? 'Compressing...' : 'Upload stamp photo'}
                            </span>
                        </button>
                    ) : (
                        <div className="space-y-3">
                            <input
                                style={{ fontSize: 16 }}
                                value={genName}
                                onChange={e => setGenName(e.target.value)}
                                placeholder="Doctor Name (e.g. Sharma)"
                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-violet-400"
                            />
                            <input
                                style={{ fontSize: 16 }}
                                value={genReg}
                                onChange={e => setGenReg(e.target.value)}
                                placeholder="Registration No."
                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-violet-400"
                            />
                            <button
                                type="button"
                                onClick={generateDigitalStamp}
                                className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold transition"
                            >
                                ✨ Generate My Stamp
                            </button>
                        </div>
                    )}

                    <input type="file" ref={fileRef} accept="image/*" className="hidden" onChange={handleFile} />
                </div>
            ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <img src={imgSrc} alt="Stamp preview" className="w-full max-h-32 object-contain bg-white p-2" />
                    <div className="px-4 py-2 bg-slate-50 flex items-center justify-between border-t border-slate-100">
                        <p className="text-xs font-semibold text-slate-500">✅ Stamp uploaded</p>
                        <button
                            type="button"
                            onClick={() => onChange(null)}
                            className="text-xs text-red-500 hover:text-red-700 font-semibold"
                        >
                            Remove
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Step 2 — Clinic Details ───────────────────────────────────────
function StepClinic({
    form, update, errors,
}: {
    form: OnboardingFormData
    update: (k: keyof OnboardingFormData, v: string | null) => void
    errors: Partial<Record<keyof OnboardingFormData, string>>
}) {
    return (
        <div className="space-y-6">
            <Field label="Clinic Name" required error={errors.clinic_name_override}>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Building2 size={18} className="text-slate-400" />
                    </div>
                    <Input
                        value={form.clinic_name_override}
                        onChange={v => update('clinic_name_override', v)}
                        placeholder="e.g. Sharma Medical Centre"
                        className="pl-9"
                    />
                </div>
            </Field>

            <Field label="Clinic Phone Number" required error={errors.phone_number}>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone size={18} className="text-slate-400" />
                    </div>
                    <Input
                        type="tel"
                        value={form.phone_number}
                        onChange={v => update('phone_number', v)}
                        placeholder="e.g. +91 98765 43210"
                        className="pl-9"
                    />
                </div>
            </Field>

            <Field label="Clinic Address" required error={errors.clinic_address}>
                <div className="relative">
                    <div className="absolute top-3 left-3 pointer-events-none">
                        <MapPin size={18} className="text-slate-400" />
                    </div>
                    <textarea
                        value={form.clinic_address}
                        onChange={e => update('clinic_address', e.target.value)}
                        placeholder="e.g. 12, MG Road, Near Civil Hospital, Pune - 411001"
                        style={{ fontSize: 16 }}
                        rows={3}
                        className="w-full pl-9 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 font-medium placeholder:text-slate-400 placeholder:text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition resize-none"
                    />
                </div>
            </Field>

            <Field label="Clinic Email (Optional)" error={errors.clinic_email}>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail size={18} className="text-slate-400" />
                    </div>
                    <Input
                        type="email"
                        value={form.clinic_email}
                        onChange={v => update('clinic_email', v)}
                        placeholder="e.g. dr.sharma@gmail.com"
                        className="pl-9"
                    />
                </div>
            </Field>

            <Field label="Clinic Timings (Optional)" error={errors.clinic_timings}>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Clock size={18} className="text-slate-400" />
                    </div>
                    <Input
                        value={form.clinic_timings}
                        onChange={v => update('clinic_timings', v)}
                        placeholder="e.g. Mon–Sat: 9AM–1PM, 5PM–8PM"
                        className="pl-9"
                    />
                </div>
            </Field>

            {/* Doctor Stamp section */}
            <StampUploader
                stampBase64={form.stamp_base64 ?? null}
                onChange={v => update('stamp_base64', v)}
            />
        </div>
    )
}

// ── Step 3 — Signature ────────────────────────────────────────────
function StepSignature({
    form, update,
}: {
    form: OnboardingFormData
    update: (k: keyof OnboardingFormData, v: string | null) => void
}) {
    const [processing, setProcessing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const imgSrc = signatureToImgSrc(form.signature_base64)
    const sizeKB = form.signature_base64 ? getSignatureSizeKB(form.signature_base64) : 0

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        setProcessing(true)
        setError(null)

        try {
            const base64 = await compressSignatureToBase64(file)
            update('signature_base64', base64)
        } catch (err: any) {
            setError(err.message ?? 'Failed to process image')
        } finally {
            setProcessing(false)
            e.target.value = ''   // reset so same file can be re-selected
        }
    }

    return (
        <div className="space-y-6">
            {/* Why it matters */}
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5 flex gap-4">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <PenLine size={20} className="text-indigo-600" />
                </div>
                <div>
                    <h4 className="font-bold text-slate-800 text-sm mb-1">Why add your signature?</h4>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                        Indian medical law requires a doctor's signature on every prescription.
                        ClinicOS saves your signature securely in the database (not file storage)
                        and renders it on every prescription — making them legally authentic.
                    </p>
                </div>
            </div>

            {/* Upload zone */}
            {!imgSrc ? (
                <div
                    onClick={() => !processing && inputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ${processing
                        ? 'border-indigo-300 bg-indigo-50 cursor-wait'
                        : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 active:scale-[0.99]'
                        }`}
                >
                    {processing ? (
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 size={32} className="text-indigo-500 animate-spin" />
                            <p className="font-semibold text-indigo-900">Compressing signature…</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mb-2">
                                <Upload size={24} />
                            </div>
                            <h4 className="font-bold text-slate-800">Upload your signature photo</h4>
                            <p className="text-xs text-slate-500 mb-4">PNG or JPG · Max 5MB · Will be auto-compressed</p>
                            <div className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-700 shadow-sm">
                                Choose File
                            </div>
                            <div className="mt-4 text-[11px] font-medium text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 inline-block">
                                Tip: Sign on white paper, photograph it in good light, upload here
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                /* Signature preview */
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                    {/* Preview header */}
                    <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center justify-between">
                        <div>
                            <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                                <CheckCircle size={16} className="text-emerald-500" /> Signature ready
                            </h4>
                            <p className="text-xs font-semibold text-slate-500 mt-0.5">
                                {sizeKB}KB compressed
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => inputRef.current?.click()}
                                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
                            >
                                Change
                            </button>
                            <button
                                type="button"
                                onClick={() => update('signature_base64', null)}
                                className="w-6 h-6 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition"
                            >
                                <X size={14} className="text-red-500" />
                            </button>
                        </div>
                    </div>

                    {/* Signature image — shown on white bg like it will appear on prescription */}
                    <div className="p-8 bg-white flex justify-center bg-[url('https://transparenttextures.com/patterns/cubes.png')] bg-opacity-10 min-h-[160px] items-center">
                        <img src={imgSrc} alt="Signature Preview" className="max-h-24 object-contain mix-blend-multiply drop-shadow-sm" />
                    </div>

                    {/* Prescription preview mock */}
                    <div className="bg-slate-50 p-3 border-t border-slate-100 text-center">
                        <p className="text-xs font-bold text-slate-500">
                            👆 This is exactly how your signature will appear on prescriptions
                        </p>
                    </div>
                </div>
            )}

            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm font-medium text-red-600 flex items-start gap-2">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    {error}
                </div>
            )}

            {/* Skip option */}
            <div className="mt-8 pt-6 border-t border-slate-200 text-center">
                <p className="text-xs font-medium text-slate-500 max-w-sm mx-auto">
                    You can skip this now and add your signature later in Settings.
                    Prescriptions without a signature will show a blank signature line.
                </p>
            </div>

            <input
                type="file"
                ref={inputRef}
                onChange={handleFileChange}
                accept="image/png, image/jpeg, image/jpg"
                className="hidden"
            />
        </div>
    )
}

// ── MAIN COMPONENT ────────────────────────────────────────────────
export default function OnboardingForm() {
    const { user, clinicId, refreshClinicProfile } = useAuth()
    const navigate = useNavigate()

    const [step, setStep] = useState(1)
    const [form, setForm] = useState(INITIAL)
    const [degreeList, setDegreeList] = useState<string[]>([])
    const [errors, setErrors] = useState<Partial<Record<keyof OnboardingFormData, string>>>({})
    const [saving, setSaving] = useState(false)
    const [completed, setCompleted] = useState(false)

    function update(key: keyof OnboardingFormData, value: string | null) {
        setForm(f => ({ ...f, [key]: value }))
        setErrors(e => ({ ...e, [key]: undefined }))
    }

    // Sync degreeList → form.qualifications string
    function handleDegreeChange(list: string[]) {
        setDegreeList(list)
        update('qualifications', list.join(', '))
    }

    // ── Validation ──────────────────────────────────────────────────
    function validateStep(s: number): boolean {
        const newErrors: typeof errors = {}

        if (s === 1) {
            if (!form.doctor_name.trim()) newErrors.doctor_name = 'Doctor name is required'
            if (!form.qualifications.trim()) newErrors.qualifications = 'Qualifications are required'
            if (!form.registration_number.trim()) newErrors.registration_number = 'Registration number is legally required'
            if (!form.specialization.trim()) newErrors.specialization = 'Please select a specialization'
        }

        if (s === 2) {
            if (!form.clinic_name_override.trim()) newErrors.clinic_name_override = 'Clinic name is required'
            if (!form.phone_number.trim()) newErrors.phone_number = 'Phone number is required'
            if (!form.clinic_address.trim()) newErrors.clinic_address = 'Clinic address is required'
        }

        // Step 3 (signature) is optional
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    function handleNext() {
        if (validateStep(step)) {
            setStep(s => Math.min(s + 1, 3))
            window.scrollTo({ top: 0, behavior: 'smooth' })
        }
    }

    function handleBack() {
        setStep(s => Math.max(s - 1, 1))
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    // ── Save ────────────────────────────────────────────────────────
    async function handleSave() {
        if (!user || !clinicId) {
            toast.error('Session expired — please log in again')
            return
        }

        setSaving(true)

        try {
            const payload = {
                doctor_name: form.doctor_name.trim(),
                qualifications: form.qualifications.split(',').map(s => s.trim()).filter(Boolean),
                registration_number: form.registration_number.trim().toUpperCase(),
                specialization: form.specialization,
                experience_years: form.experience_years ? parseInt(form.experience_years) : null,
                phone_number: form.phone_number.trim(),
                clinic_name_override: form.clinic_name_override.trim(),
                clinic_address: form.clinic_address.trim(),
                clinic_email: form.clinic_email.trim() || null,
                clinic_timings: form.clinic_timings.trim() || null,
                signature_base64: form.signature_base64 ?? null,
                stamp_base64: form.stamp_base64 ?? null,
                onboarding_completed: true,
                updated_at: new Date().toISOString(),
            }

            const { error } = await supabase
                .from('clinics')
                .update(payload)
                .eq('id', clinicId)

            if (error) throw error

            // Refresh AuthContext so OnboardingGuard lets them through
            await refreshClinicProfile()

            setCompleted(true)
            toast.success('Profile saved! Welcome to ClinicOS 🎉')

            // Navigate after a brief success animation
            // Clear welcome/tutorial keys so they show fresh after onboarding
            localStorage.removeItem('clinicos_welcome_popup_done')
            localStorage.removeItem('clinicos_tutorial_done_v2')
            setTimeout(() => navigate('/dashboard', { replace: true }), 1800)

        } catch (err: any) {
            console.error('[Onboarding]', err)
            toast.error('Failed to save: ' + (err.message ?? 'Unknown error'))
        } finally {
            setSaving(false)
        }
    }

    // ── Success screen ──────────────────────────────────────────────
    if (completed) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-3xl p-10 shadow-xl shadow-indigo-100 max-w-sm w-full text-center"
                >
                    <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle size={40} />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 mb-2">
                        All set, Dr. {form.doctor_name.split(' ')[0]}! 👋
                    </h2>
                    <p className="text-slate-500 font-medium">Redirecting to your dashboard…</p>
                </motion.div>
            </div>
        )
    }

    // ── Main render ─────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Top bar */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3 top-0 sticky z-20 shadow-sm">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-indigo-200">
                    C
                </div>
                <div className="font-black text-slate-800 tracking-tight">
                    ClinicOS <span className="text-slate-300 font-normal mx-2">·</span> <span className="text-slate-500 font-medium">Setup your profile</span>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-10">

                {/* Progress header */}
                <div className="mb-10 text-center">
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">
                        Complete your profile
                    </h1>
                    <p className="text-slate-500 font-medium">
                        This information is required to generate legally valid prescriptions in India.
                    </p>
                </div>

                {/* Step indicators */}
                <div className="flex items-center justify-center mb-10 overflow-hidden px-4">
                    {STEPS.map((s, i) => {
                        const isDone = step > s.id
                        const isCurrent = step === s.id
                        return (
                            <React.Fragment key={s.id}>
                                <div className="flex flex-col items-center relative z-10">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm transition-colors duration-300 ${isDone ? 'bg-indigo-600 text-white shadow-indigo-200' :
                                        isCurrent ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-600' :
                                            'bg-white text-slate-400 border border-slate-200'
                                        }`}>
                                        {isDone ? (
                                            <CheckCircle size={18} />
                                        ) : (
                                            s.id
                                        )}
                                    </div>
                                    <div className={`absolute top-12 whitespace-nowrap text-xs font-bold transition-colors ${isCurrent ? 'text-indigo-900' : isDone ? 'text-indigo-600' : 'text-slate-400'
                                        }`}>
                                        <span className="hidden sm:inline">{s.title}</span>
                                    </div>
                                </div>
                                {i < STEPS.length - 1 && (
                                    <div className={`flex-1 h-1 mx-2 rounded-full transition-colors duration-300 ${isDone ? 'bg-indigo-600' : 'bg-slate-200'}`} />
                                )}
                            </React.Fragment>
                        )
                    })}
                </div>

                {/* Step card */}
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden mb-6 relative">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            className="p-6 sm:p-10"
                        >
                            {/* Step header */}
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                                    {(() => {
                                        const StepIcon = STEPS[step - 1].icon
                                        return <StepIcon size={24} strokeWidth={2.5} />
                                    })()}
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-800">{STEPS[step - 1].title}</h2>
                                    <p className="text-sm font-semibold text-slate-500">{STEPS[step - 1].subtitle}</p>
                                </div>
                                <div className="ml-auto bg-slate-100 px-3 py-1 rounded-full text-xs font-bold text-slate-500">
                                    Step {step} of {STEPS.length}
                                </div>
                            </div>

                            {/* Step content */}
                            {step === 1 && <StepDoctor form={form} update={update} errors={errors} degreeList={degreeList} onDegreeChange={handleDegreeChange} />}
                            {step === 2 && <StepClinic form={form} update={update} errors={errors} />}
                            {step === 3 && <StepSignature form={form} update={update} />}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Navigation buttons */}
                <div className="flex items-center justify-between px-2">
                    {step > 1 && (
                        <button
                            onClick={handleBack}
                            className="px-6 py-3.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition flex items-center gap-2"
                        >
                            <ChevronLeft size={18} /> Back
                        </button>
                    )}

                    {step < 3 ? (
                        <button
                            onClick={handleNext}
                            className="ml-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition flex items-center gap-2"
                        >
                            Continue <ChevronRight size={18} />
                        </button>
                    ) : (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className={`ml-auto px-8 py-3.5 rounded-xl font-bold shadow-lg transition flex items-center gap-2 ${saving
                                ? 'bg-indigo-400 text-white cursor-wait shadow-none'
                                : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-indigo-200'
                                }`}
                        >
                            {saving ? (
                                <><Loader2 size={18} className="animate-spin" /> Saving profile…</>
                            ) : (
                                <><CheckCircle size={18} /> Complete Setup</>
                            )}
                        </button>
                    )}
                </div>

                {/* Legal note */}
                <div className="mt-12 text-center max-w-md mx-auto">
                    <p className="text-xs font-medium text-slate-400 leading-relaxed">
                        🔒 Your information is stored securely and used only to generate prescriptions for your clinic.
                        The registration number is required by the Medical Council of India (MCI) / National Medical Commission (NMC).
                    </p>
                </div>
            </div>
        </div>
    )
}
