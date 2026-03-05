import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
    User, Building2, PenLine, Save, Upload, X,
    CheckCircle, Loader2, AlertCircle, Eye, EyeOff,
    Phone, MapPin, Mail, Clock, Award, RefreshCw, Stamp
} from 'lucide-react'
import { supabase } from '../services/db'
import { useAuth } from '../context/AuthContext'
import { compressSignatureToBase64, signatureToImgSrc, getSignatureSizeKB } from '../utils/signatureCompressor'
import { QUALIFICATION_PRESETS, SPECIALIZATION_OPTIONS, ClinicProfile } from '../types/clinic'
import toast from 'react-hot-toast'

// ── Section wrapper ───────────────────────────────────────────────
function Section({
    icon: Icon, title, subtitle, children,
}: {
    icon: React.FC<any>
    title: string
    subtitle: string
    children: React.ReactNode
}) {
    return (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 mb-8">
            <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Icon size={24} strokeWidth={2.5} />
                </div>
                <div>
                    <h2 className="text-xl font-black text-slate-800">{title}</h2>
                    <p className="text-sm font-medium text-slate-500">{subtitle}</p>
                </div>
            </div>
            {children}
        </div>
    )
}

function Field({ label, required = false, hint, error, children }: {
    label: string
    required?: boolean
    hint?: string
    error?: string
    children: React.ReactNode
}) {
    return (
        <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                {label}
                {required && <span className="text-rose-500">*</span>}
            </label>
            {children}
            {hint && !error && <p className="text-xs font-medium text-slate-500">{hint}</p>}
            {error && <p className="text-xs font-bold text-rose-500 flex items-center gap-1"><AlertCircle size={14} /> {error}</p>}
        </div>
    )
}

function InputField({ value, onChange, placeholder, type = 'text', icon: Icon, disabled = false }: {
    value: string
    onChange: (v: string) => void
    placeholder?: string
    type?: string
    icon?: React.FC<any>
    disabled?: boolean
}) {
    return (
        <div className="relative flex-1">
            {Icon && (
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Icon size={18} className="text-slate-400" />
                </div>
            )}
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                style={{ fontSize: 16 }}
                className={`w-full ${Icon ? 'pl-9' : 'px-4'} pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 font-medium placeholder:text-slate-400 placeholder:text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition ${disabled ? 'bg-slate-50 cursor-not-allowed text-slate-400' : ''}`}
            />
        </div>
    )
}

// ── MAIN COMPONENT ────────────────────────────────────────────────
export default function EditProfile() {
    const { clinicId, refreshClinicProfile, user } = useAuth()

    const [profile, setProfile] = useState<Partial<ClinicProfile>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [sigProcessing, setSigProcessing] = useState(false)
    const [showSigPreview, setShowSigPreview] = useState(false)
    const [errors, setErrors] = useState<Partial<Record<keyof ClinicProfile, string>>>({})
    const sigInputRef = useRef<HTMLInputElement>(null)
    const stampInputRef = useRef<HTMLInputElement>(null)
    const [stampProcessing, setStampProcessing] = useState(false)
    const [stampMode, setStampMode] = useState<'photo' | 'generate'>('photo')
    const [stampGenName, setStampGenName] = useState('')
    const [stampGenReg, setStampGenReg] = useState('')

    // ── Load clinic data on mount ────────────────────────────────────
    useEffect(() => {
        async function load() {
            if (!clinicId) return
            setLoading(true)

            const { data, error } = await supabase
                .from('clinics')
                .select('*')
                .eq('id', clinicId)
                .single()

            if (!error && data) {
                if (Array.isArray(data.qualifications)) {
                    data.qualifications = data.qualifications.join(', ')
                }
                setProfile(data)
            } else {
                toast.error('Failed to load profile data')
            }
            setLoading(false)
        }
        load()
    }, [clinicId])

    function update(key: keyof ClinicProfile, value: any) {
        setProfile(p => ({ ...p, [key]: value }))
        setErrors(e => ({ ...e, [key]: undefined }))
        setSaved(false)
    }

    // ── Signature upload ─────────────────────────────────────────────
    async function handleSignatureUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        setSigProcessing(true)

        try {
            const base64 = await compressSignatureToBase64(file)
            update('signature_base64', base64)
            setShowSigPreview(true)
            toast.success(`Signature compressed (${getSignatureSizeKB(base64)}KB)`)
        } catch (err: any) {
            toast.error(err.message ?? 'Failed to process signature')
        } finally {
            setSigProcessing(false)
            e.target.value = ''
        }
    }

    // ── Stamp upload ────────────────────────────────────────────────────
    async function handleStampUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        setStampProcessing(true)
        try {
            const base64 = await compressSignatureToBase64(file)
            update('stamp_base64' as keyof ClinicProfile, base64)
            toast.success(`Stamp compressed (${getSignatureSizeKB(base64)}KB)`)
        } catch (err: any) {
            toast.error(err.message ?? 'Failed to process stamp')
        } finally {
            setStampProcessing(false)
            e.target.value = ''
        }
    }

    function generateDigitalStamp() {
        const canvas = document.createElement('canvas')
        canvas.width = 280
        canvas.height = 280
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.beginPath()
        ctx.arc(140, 140, 130, 0, 2 * Math.PI)
        ctx.lineWidth = 6
        ctx.strokeStyle = '#1e3a8a'
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(140, 140, 110, 0, 2 * Math.PI)
        ctx.lineWidth = 2
        ctx.strokeStyle = '#1e3a8a'
        ctx.stroke()

        ctx.font = 'bold 18px Arial'
        ctx.fillStyle = '#1e3a8a'
        ctx.textAlign = 'center'
        ctx.fillText(`Dr. ${stampGenName || 'Name'}`, 140, 120)

        ctx.font = 'bold 28px Arial'
        ctx.fillStyle = '#1e3a8a'
        ctx.fillText('✚', 140, 160)

        ctx.font = '13px Arial'
        ctx.fillText(`Reg: ${stampGenReg || 'XXXXXX'}`, 140, 195)

        const dataUrl = canvas.toDataURL('image/png')
        update('stamp_base64' as keyof ClinicProfile, dataUrl)
    }

    // ── Validation ───────────────────────────────────────────────────
    function validate(): boolean {
        const newErrors: typeof errors = {}
        if (!profile.doctor_name?.trim()) newErrors.doctor_name = 'Required'
        if (!profile.qualifications?.trim()) newErrors.qualifications = 'Required'
        if (!profile.registration_number?.trim()) newErrors.registration_number = 'Required — legally mandatory'
        if (!profile.clinic_name_override?.trim()) newErrors.clinic_name_override = 'Required'
        if (!profile.phone_number?.trim()) newErrors.phone_number = 'Required'
        if (!profile.clinic_address?.trim()) newErrors.clinic_address = 'Required'
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    // ── Save ─────────────────────────────────────────────────────────
    async function handleSave() {
        if (!validate()) {
            toast.error('Please fix the errors before saving')
            return
        }
        if (!clinicId) return

        setSaving(true)
        setSaved(false)

        const payload = {
            doctor_name: profile.doctor_name?.trim(),
            qualifications: profile.qualifications?.split(',').map(s => s.trim()).filter(Boolean),
            registration_number: profile.registration_number?.trim().toUpperCase(),
            specialization: profile.specialization,
            experience_years: profile.experience_years,
            phone_number: profile.phone_number?.trim(),
            clinic_name_override: profile.clinic_name_override?.trim(),
            clinic_address: profile.clinic_address?.trim(),
            clinic_email: profile.clinic_email?.trim() || null,
            clinic_timings: profile.clinic_timings?.trim() || null,
            signature_base64: profile.signature_base64 ?? null,
            stamp_base64: (profile as any).stamp_base64 ?? null,
            onboarding_completed: true,
            updated_at: new Date().toISOString(),
        }

        const { error } = await supabase
            .from('clinics')
            .update(payload)
            .eq('id', clinicId)

        if (error) {
            toast.error('Save failed: ' + error.message)
            setSaving(false)
            return
        }

        await refreshClinicProfile()
        setSaving(false)
        setSaved(true)
        toast.success('Profile updated successfully')

        // Reset saved indicator after 3s
        setTimeout(() => setSaved(false), 3000)
    }

    // ── Loading skeleton ─────────────────────────────────────────────
    if (loading) {
        return (
            <div className="max-w-3xl mx-auto p-4 md:p-8 animate-pulse space-y-8">
                {[1, 2, 3].map(i => (
                    <div key={i} className="bg-slate-200 h-64 rounded-3xl" />
                ))}
            </div>
        )
    }

    const sigSrc = signatureToImgSrc(profile.signature_base64)
    const sigSize = profile.signature_base64 ? getSignatureSizeKB(profile.signature_base64) : 0

    return (
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-8 pb-32">

            {/* Page header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2">Edit Profile</h1>
                    <p className="text-slate-500 font-medium">
                        Manage your doctor identity and clinic details. These appear on every prescription.
                    </p>
                </div>

                {/* Save button — top right for large screens */}
                <button
                    onClick={handleSave}
                    disabled={saving || saved}
                    className={`hidden md:flex items-center gap-2 px-6 py-3 rounded-xl font-bold shadow-sm transition-all ${saving ? 'bg-indigo-400 text-white cursor-wait' :
                        saved ? 'bg-emerald-500 text-white' :
                            'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-indigo-200'
                        }`}
                >
                    {saving ? <><Loader2 size={18} className="animate-spin" /> Saving…</> :
                        saved ? <><CheckCircle size={18} /> Saved!</> :
                            <><Save size={18} /> Save Changes</>}
                </button>
            </div>

            <div className="space-y-8">

                {/* ═══ SECTION 1: Doctor Identity ═══ */}
                <Section icon={User} title="Doctor Identity" subtitle="Your professional information">
                    <div className="space-y-5">
                        <Field label="Full Name" required error={errors.doctor_name}>
                            <InputField
                                value={profile.doctor_name ?? ''}
                                onChange={v => update('doctor_name', v)}
                                placeholder="Dr. Deepak Sharma"
                                icon={User}
                            />
                        </Field>

                        <Field label="Specialization" required error={errors.specialization}>
                            <select
                                value={profile.specialization ?? ''}
                                onChange={e => update('specialization', e.target.value)}
                                style={{ fontSize: 16 }}
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition appearance-none"
                            >
                                <option value="" disabled>Select specialization…</option>
                                {SPECIALIZATION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </Field>
                    </div>

                    <div className="mt-5 space-y-5">
                        <Field label="Qualifications" required error={errors.qualifications}>
                            <select
                                value=""
                                onChange={e => { if (e.target.value) update('qualifications', e.target.value) }}
                                style={{ fontSize: 16 }}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition appearance-none mb-3 font-medium"
                            >
                                <option value="" disabled>Quick select a preset…</option>
                                {QUALIFICATION_PRESETS.map(q => <option key={q} value={q}>{q}</option>)}
                            </select>
                            <InputField
                                value={profile.qualifications ?? ''}
                                onChange={v => update('qualifications', v)}
                                placeholder="Or type custom qualifications here"
                                icon={Award}
                            />
                        </Field>
                    </div>

                    <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                        <Field label="Medical Registration No." required error={errors.registration_number}>
                            <InputField
                                value={profile.registration_number ?? ''}
                                onChange={v => update('registration_number', v.toUpperCase())}
                                placeholder="e.g. MMC-12345"
                            />
                            {profile.registration_number && (
                                <div className="mt-2 text-xs font-semibold text-emerald-600 flex items-center gap-1.5 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">
                                    <CheckCircle size={14} /> Legally valid for e-prescriptions
                                </div>
                            )}
                        </Field>
                        {!profile.registration_number && (
                            <div className="mt-2 text-xs font-semibold text-rose-600 flex items-center gap-1.5 bg-rose-50 px-3 py-2 rounded-lg border border-rose-100 col-span-1 md:col-span-2">
                                <AlertCircle size={14} className="flex-shrink-0" />
                                <span className="leading-tight">Legally required. Prescriptions without a registration number are invalid under Indian medical law.</span>
                            </div>
                        )}
                    </div>

                    <div className="mt-5">
                        <Field label="Years of Experience" error={errors.experience_years}>
                            <InputField
                                type="number"
                                value={profile.experience_years?.toString() ?? ''}
                                onChange={v => update('experience_years', parseInt(v) || null)}
                                placeholder="e.g. 10"
                            />
                        </Field>
                    </div>
                </Section>

                {/* ═══ SECTION 2: Clinic Details ═══ */}
                <Section icon={Building2} title="Clinic Details" subtitle="Contact and location info">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <Field label="Clinic Name" required error={errors.clinic_name_override}>
                            <InputField
                                value={profile.clinic_name_override ?? ''}
                                onChange={v => update('clinic_name_override', v)}
                                placeholder="Sharma Medical Centre"
                                icon={Building2}
                            />
                        </Field>

                        <Field label="Phone Number" required error={errors.phone_number}>
                            <InputField
                                type="tel"
                                value={profile.phone_number ?? ''}
                                onChange={v => update('phone_number', v)}
                                placeholder="+91 98765 43210"
                                icon={Phone}
                            />
                        </Field>
                    </div>

                    <div className="mt-5">
                        <Field label="Full Address" required error={errors.clinic_address}>
                            <div className="relative">
                                <textarea
                                    value={profile.clinic_address ?? ''}
                                    onChange={e => update('clinic_address', e.target.value)}
                                    placeholder="12, MG Road, Near Civil Hospital, Pune - 411001"
                                    style={{ fontSize: 16 }}
                                    rows={3}
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 font-medium placeholder:text-slate-400 placeholder:text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition resize-none"
                                />
                            </div>
                        </Field>
                    </div>

                    <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                        <Field label="Clinic Email (Optional)" error={errors.clinic_email}>
                            <InputField
                                type="email"
                                value={profile.clinic_email ?? ''}
                                onChange={v => update('clinic_email', v)}
                                placeholder="dr@gmail.com"
                                icon={Mail}
                            />
                        </Field>

                        <Field label="Timings (Optional)" error={errors.clinic_timings}>
                            <InputField
                                value={profile.clinic_timings ?? ''}
                                onChange={v => update('clinic_timings', v)}
                                placeholder="Mon–Sat: 9AM–1PM"
                                icon={Clock}
                            />
                        </Field>
                    </div>
                </Section>

                {/* ═══ SECTION 3: Signature ═══ */}
                <Section icon={PenLine} title="Signature" subtitle="For authentic prescriptions">
                    {sigSrc ? (
                        /* Existing signature */
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
                            {/* Current signature display */}
                            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                                        <CheckCircle size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm">Signature on file</h4>
                                        <p className="text-xs font-semibold text-slate-500">
                                            {sigSize}KB compressd
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowSigPreview(p => !p)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-bold text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition"
                                    >
                                        {showSigPreview ? <EyeOff size={14} /> : <Eye size={14} />}
                                        {showSigPreview ? 'Hide' : 'Preview'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => sigInputRef.current?.click()}
                                        disabled={sigProcessing}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-xs font-bold text-indigo-600 hover:bg-indigo-100 hover:text-indigo-800 transition"
                                    >
                                        {sigProcessing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                        Replace
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { update('signature_base64', null); setShowSigPreview(false) }}
                                        className="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 flex items-center justify-center transition"
                                        title="Remove Signature"
                                    >
                                        <X size={16} className="text-rose-600" />
                                    </button>
                                </div>
                            </div>

                            {showSigPreview && (
                                <div className="p-8 bg-white flex justify-center bg-[url('https://transparenttextures.com/patterns/cubes.png')] bg-opacity-5 min-h-[140px] items-center border-b border-slate-200">
                                    <img src={sigSrc} alt="Signature Preview" className="max-h-24 object-contain mix-blend-multiply drop-shadow-sm" />
                                </div>
                            )}

                            {/* How it appears on prescription */}
                            <div className="p-5">
                                <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center justify-center">
                                    How it looks on prescription
                                </h5>
                                <div className="max-w-[240px] mx-auto border-2 border-slate-200 border-dashed rounded-xl p-4 bg-white relative">
                                    <div className="h-16 flex items-end justify-center mb-2">
                                        <img src={sigSrc} className="max-h-full max-w-full object-contain mix-blend-multiply opacity-90" />
                                    </div>
                                    <div className="border-t-2 border-slate-800 pt-2 text-center mt-auto">
                                        <p className="font-bold text-slate-900 text-sm">Dr. {profile.doctor_name || 'Your Name'}</p>
                                        {profile.qualifications && <p className="text-xs font-bold text-slate-600 mt-0.5">{profile.qualifications}</p>}
                                        {profile.registration_number && <p className="text-[10px] font-bold text-slate-500 mt-0.5">Reg: {profile.registration_number}</p>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Upload zone */
                        <div className="space-y-4">
                            <div
                                onClick={() => !sigProcessing && sigInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${sigProcessing
                                    ? 'border-indigo-300 bg-indigo-50 cursor-wait'
                                    : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                                    }`}
                            >
                                {sigProcessing ? (
                                    <div className="flex flex-col items-center gap-3">
                                        <Loader2 size={32} className="text-indigo-500 animate-spin" />
                                        <p className="font-bold text-indigo-900">Compressing…</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center">
                                        <div className="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                                            <Upload size={24} />
                                        </div>
                                        <h4 className="font-bold text-slate-800 text-base">Upload your signature photo</h4>
                                        <p className="text-xs font-medium text-slate-500 mb-5 mt-1">PNG or JPG · Max 5MB</p>
                                        <div className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-700 shadow-sm transition hover:border-slate-300">
                                            Choose File
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                                <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                <p className="text-xs font-medium text-amber-800 leading-relaxed">
                                    No signature on file. Prescriptions will show a blank signature line until you add one.
                                </p>
                            </div>
                        </div>
                    )}

                    <input
                        type="file"
                        ref={sigInputRef}
                        onChange={handleSignatureUpload}
                        accept="image/png, image/jpeg, image/jpg"
                        className="hidden"
                    />
                </Section>

                {/* ═══ SECTION: Doctor Stamp ═══ */}
                <Section icon={Stamp} title="Doctor Stamp" subtitle="Appears at the bottom of printed prescriptions (optional)">
                    {(() => {
                        const stampSrc = (profile as any).stamp_base64
                            ? ((profile as any).stamp_base64.startsWith('data:')
                                ? (profile as any).stamp_base64
                                : `data:image/png;base64,${(profile as any).stamp_base64}`)
                            : null

                        if (stampSrc) {
                            return (
                                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                                    <img src={stampSrc} alt="Stamp preview" className="w-full max-h-32 object-contain bg-white p-2" />
                                    <div className="px-4 py-2 bg-slate-50 flex items-center justify-between border-t border-slate-100">
                                        <p className="text-xs font-semibold text-slate-500">✅ Stamp uploaded</p>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => stampInputRef.current?.click()}
                                                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                                            >
                                                Replace
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => update('stamp_base64' as keyof ClinicProfile, null)}
                                                className="text-xs text-red-500 hover:text-red-700 font-semibold"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        }

                        return (
                            <div className="space-y-4">
                                {/* Toggle: Photo / Generate */}
                                <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                                    {(['photo', 'generate'] as const).map(m => (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => setStampMode(m)}
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${stampMode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            {m === 'photo' ? '📷 Upload Photo' : '✨ Generate Digital'}
                                        </button>
                                    ))}
                                </div>

                                {stampMode === 'photo' ? (
                                    <button
                                        type="button"
                                        onClick={() => stampInputRef.current?.click()}
                                        disabled={stampProcessing}
                                        className="w-full flex items-center gap-3 px-4 py-3 bg-white border-2 border-dashed border-slate-200 hover:border-violet-300 hover:bg-violet-50 rounded-2xl transition"
                                    >
                                        {stampProcessing ? (
                                            <Loader2 size={18} className="text-violet-500 animate-spin" />
                                        ) : (
                                            <Upload size={18} className="text-slate-400" />
                                        )}
                                        <span className="text-sm font-medium text-slate-600">
                                            {stampProcessing ? 'Compressing…' : 'Upload stamp photo'}
                                        </span>
                                    </button>
                                ) : (
                                    <div className="space-y-3">
                                        <input
                                            style={{ fontSize: 16 }}
                                            value={stampGenName}
                                            onChange={e => setStampGenName(e.target.value)}
                                            placeholder="Doctor Name (e.g. Sharma)"
                                            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-violet-400"
                                        />
                                        <input
                                            style={{ fontSize: 16 }}
                                            value={stampGenReg}
                                            onChange={e => setStampGenReg(e.target.value)}
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
                            </div>
                        )
                    })()}

                    <input type="file" ref={stampInputRef} accept="image/*" className="hidden" onChange={handleStampUpload} />
                </Section>

                {/* ═══ MOBILE SAVE BUTTON ═══ */}
                <div className="md:hidden sticky z-10 bottom-24 mt-8 px-4 py-4 bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50">
                    <button
                        onClick={handleSave}
                        disabled={saving || saved}
                        className={`w-full py-4 rounded-xl font-black text-lg transition shadow-lg flex items-center justify-center gap-2 ${saving ? 'bg-indigo-400 text-white cursor-wait shadow-none' :
                            saved ? 'bg-emerald-500 text-white shadow-emerald-200' :
                                'bg-indigo-600 active:bg-indigo-700 text-white shadow-indigo-200'
                            }`}
                    >
                        {saving ? <><Loader2 size={20} className="animate-spin" /> Saving changes…</> :
                            saved ? <><CheckCircle size={20} /> Changes saved!</> :
                                <><Save size={20} /> Save All Changes</>}
                    </button>
                </div>

                {/* Last updated */}
                {profile.updated_at && (
                    <div className="text-center mt-6">
                        <p className="text-xs font-semibold text-slate-400">
                            Last updated: {new Date(profile.updated_at).toLocaleString('en-IN', {
                                day: '2-digit', month: 'short', year: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                            })}
                        </p>
                    </div>
                )}

            </div>
        </div>
    )
}
