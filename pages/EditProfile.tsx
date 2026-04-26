import React, { useState, useEffect, useRef } from 'react'
import {
    User, Building2, PenLine, Save, Upload, X,
    CheckCircle, Loader2, AlertCircle, Eye, EyeOff,
    Phone, Mail, Clock, Award, RefreshCw, Stamp,
    ChevronRight, Store, CreditCard, CalendarClock, ShieldCheck,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../services/db'
import { useAuth } from '../context/AuthContext'
import { compressSignatureToBase64, signatureToImgSrc, getSignatureSizeKB } from '../utils/signatureCompressor'
import { QUALIFICATION_PRESETS, SPECIALIZATION_OPTIONS, ClinicProfile } from '../types/clinic'
import toast from 'react-hot-toast'
import PharmacyInvitePanel from '../components/Doctor/PharmacyInvitePanel'
import { useSubscription } from '../hooks/useSubscription'
import { formatPlanName, normalizePlanId, PLAN_PRICE_BY_ID } from '../src/constants/subscriptionPlans'

// ─────────────────────────────────────────────────────────────────────────────
// Section — numbered card with colored accent bar
// ─────────────────────────────────────────────────────────────────────────────
function Section({
    icon: Icon, title, subtitle, index, accent = '#6366f1', children,
}: {
    icon: React.FC<any>
    title: string
    subtitle: string
    index: number
    accent?: string
    children: React.ReactNode
}) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden mb-6 transition-shadow hover:shadow-md">
            {/* Accent bar */}
            <div style={{ height: 3, background: `linear-gradient(90deg, ${accent}, ${accent}55)` }} />

            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-4">
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-black text-sm shadow-sm"
                    style={{ background: `linear-gradient(135deg, ${accent}, ${accent}bb)` }}
                >
                    {index}
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className="text-base font-black text-slate-800 tracking-tight">{title}</h2>
                    <p className="text-xs font-medium text-slate-400 mt-0.5">{subtitle}</p>
                </div>
                <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: `${accent}15` }}
                >
                    <Icon size={16} style={{ color: accent }} strokeWidth={2.5} />
                </div>
            </div>

            <div className="p-6">{children}</div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Field
// ─────────────────────────────────────────────────────────────────────────────
function Field({ label, required = false, hint, error, children }: {
    label: string
    required?: boolean
    hint?: string
    error?: string
    children: React.ReactNode
}) {
    return (
        <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-xs font-black text-slate-600 uppercase tracking-wider">
                {label}
                {required && <span className="text-rose-500 font-black">*</span>}
            </label>
            {children}
            {hint && !error && <p className="text-xs font-medium text-slate-400">{hint}</p>}
            {error && (
                <p className="text-xs font-bold text-rose-500 flex items-center gap-1">
                    <AlertCircle size={13} /> {error}
                </p>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// InputField
// ─────────────────────────────────────────────────────────────────────────────
function InputField({ value, onChange, placeholder, type = 'text', icon: Icon, disabled = false }: {
    value: string
    onChange: (v: string) => void
    placeholder?: string
    type?: string
    icon?: React.FC<any>
    disabled?: boolean
}) {
    return (
        <div className="relative">
            {Icon && (
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Icon size={15} className="text-slate-300" />
                </div>
            )}
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                style={{ fontSize: 15 }}
                className={`w-full ${Icon ? 'pl-9' : 'px-4'} pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold placeholder:text-slate-300 placeholder:font-normal outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all duration-150 ${disabled ? 'cursor-not-allowed text-slate-400 opacity-60' : ''}`}
            />
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// StyledSelect
// ─────────────────────────────────────────────────────────────────────────────
function StyledSelect({ value, onChange, children }: {
    value: string
    onChange: (v: string) => void
    children: React.ReactNode
}) {
    return (
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            style={{ fontSize: 15 }}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all duration-150 appearance-none cursor-pointer"
        >
            {children}
        </select>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function EditProfile() {
    const { clinicId, refreshClinicProfile, user, loading: authLoading } = useAuth()
    const {
        subscription,
        status: subscriptionStatus,
        daysLeft,
        fetchError: subscriptionError,
        refetch: refetchSubscription,
        isLoading: subscriptionLoading,
    } = useSubscription(clinicId, !authLoading)

    const [profile, setProfile] = useState<Partial<ClinicProfile>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [sigProcessing, setSigProcessing] = useState(false)
    const [showSigPreview, setShowSigPreview] = useState(false)
    const [errors, setErrors] = useState<Partial<Record<keyof ClinicProfile, string>>>({})
    const [stampProcessing, setStampProcessing] = useState(false)
    const [stampMode, setStampMode] = useState<'photo' | 'generate'>('photo')
    const [stampGenName, setStampGenName] = useState('')
    const [stampGenReg, setStampGenReg] = useState('')
    const sigInputRef = useRef<HTMLInputElement>(null)
    const stampInputRef = useRef<HTMLInputElement>(null)

    // ── Load ─────────────────────────────────────────────────────────
    useEffect(() => {
        async function load() {
            if (!clinicId) return
            setLoading(true)
            const { data, error } = await (supabase as any)
                .from('clinics').select('*').eq('id', clinicId).single()
            if (!error && data) {
                const d = data as any
                if (Array.isArray(d.qualifications)) {
                    d.qualifications = d.qualifications.join(', ')
                }
                setProfile(d)
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

    // ── Signature upload ──────────────────────────────────────────────
    async function handleSignatureUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        setSigProcessing(true)
        try {
            const base64 = await compressSignatureToBase64(file)
            update('signature_base64', base64)
            setShowSigPreview(true)
            toast.success(`Signature compressed (${getSignatureSizeKB(base64)} KB)`)
        } catch (err: any) {
            toast.error(err.message ?? 'Failed to process signature')
        } finally {
            setSigProcessing(false)
            e.target.value = ''
        }
    }

    // ── Stamp upload ──────────────────────────────────────────────────
    async function handleStampUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        setStampProcessing(true)
        try {
            const base64 = await compressSignatureToBase64(file)
            update('stamp_base64' as keyof ClinicProfile, base64)
            toast.success(`Stamp compressed (${getSignatureSizeKB(base64)} KB)`)
        } catch (err: any) {
            toast.error(err.message ?? 'Failed to process stamp')
        } finally {
            setStampProcessing(false)
            e.target.value = ''
        }
    }

    function generateDigitalStamp() {
        if (!stampGenName.trim() || !stampGenReg.trim()) {
            toast.error('Enter doctor name and registration number first')
            return
        }

        const canvas = document.createElement('canvas')
        canvas.width = 280
        canvas.height = 280
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.clearRect(0, 0, 280, 280)

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
        ctx.fillText(`Dr. ${stampGenName}`, 140, 120)

        ctx.font = 'bold 28px Arial'
        ctx.fillStyle = '#1e3a8a'
        ctx.fillText('✚', 140, 160)

        ctx.font = '13px Arial'
        ctx.fillText(`Reg: ${stampGenReg}`, 140, 195)

        const dataUrl = canvas.toDataURL('image/png')
        update('stamp_base64' as keyof ClinicProfile, dataUrl)
        toast.success('Digital stamp generated!')
    }

    // ── Validation ────────────────────────────────────────────────────
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

    // ── Save ──────────────────────────────────────────────────────────
    async function handleSave() {
        if (!validate()) { toast.error('Please fix the errors before saving'); return }
        if (!clinicId) return

        setSaving(true)
        setSaved(false)

        const payload = {
            doctor_name: profile.doctor_name?.trim(),
            qualifications: profile.qualifications?.split(',').map(s => s.trim()).filter(Boolean),
            registration_number: profile.registration_number?.trim().toUpperCase(),
            specialization: profile.specialization,
            experience_years: profile.experience_years != null && !isNaN(Number(profile.experience_years))
                ? Number(profile.experience_years)
                : null,
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

        const { error } = await (supabase as any).from('clinics').update(payload).eq('id', clinicId)

        if (error) {
            toast.error('Save failed: ' + error.message)
            setSaving(false)
            return
        }

        await refreshClinicProfile()
        setSaving(false)
        setSaved(true)
        toast.success('Profile updated successfully')
        setTimeout(() => setSaved(false), 3000)
    }

    // ── Loading skeleton ──────────────────────────────────────────────
    if (loading) {
        return (
            <div className="max-w-2xl mx-auto p-6 md:p-10 space-y-5">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="bg-slate-100 rounded-2xl animate-pulse" style={{ height: i === 1 ? 280 : i === 2 ? 320 : 200 }} />
                ))}
            </div>
        )
    }

    const sigSrc = signatureToImgSrc(profile.signature_base64)
    const sigSize = profile.signature_base64 ? getSignatureSizeKB(profile.signature_base64) : 0
    const stampSrc = (() => {
        const raw = (profile as any).stamp_base64
        if (!raw) return null
        return raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`
    })()

    const completionFields = [
        profile.doctor_name, profile.qualifications, profile.registration_number,
        profile.clinic_name_override, profile.phone_number, profile.clinic_address,
    ]
    const completionPct = Math.round((completionFields.filter(Boolean).length / completionFields.length) * 100)
    const currentPlanId = normalizePlanId(subscription?.plan_name)
    const currentPlanName = formatPlanName(subscription?.plan_name)
    const planPrice = PLAN_PRICE_BY_ID[currentPlanId]
    const effectiveEndDate =
        subscription?.subscription_ends_at ??
        subscription?.grace_period_ends_at ??
        subscription?.trial_ends_at ??
        null
    const effectiveStartDate = subscription?.subscription_starts_at ?? subscription?.trial_starts_at ?? null
    const statusTone = subscriptionStatus === 'active'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : subscriptionStatus === 'trial'
            ? 'bg-amber-50 text-amber-700 border-amber-200'
            : subscriptionStatus === 'loading'
                ? 'bg-slate-100 text-slate-500 border-slate-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
    const statusLabel = subscriptionStatus === 'active'
        ? 'Active'
        : subscriptionStatus === 'trial'
            ? 'Trial'
            : subscriptionStatus === 'locked'
                ? 'Locked'
                : subscriptionStatus === 'expired'
                    ? 'Expired'
                    : subscriptionStatus === 'error'
                        ? 'Unavailable'
                        : 'Checking'
    const endLabel = subscriptionStatus === 'trial'
        ? 'Trial ends'
        : subscriptionStatus === 'active'
            ? 'Plan valid till'
            : 'Access updated'
    const includedFeatures = [
        'Doctor portal',
        'Front desk',
        'QR check-in',
        'Analytics dashboard',
    ]
    const formatDateTime = (value: string | null | undefined) => {
        if (!value) return 'Not available'
        const date = new Date(value)
        if (Number.isNaN(date.getTime())) return 'Not available'
        return date.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    }
    const planMessage = subscriptionStatus === 'trial'
        ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left in your trial`
        : subscriptionStatus === 'active'
            ? effectiveEndDate
                ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left on this plan`
                : 'Your clinic access is active'
            : subscriptionStatus === 'loading'
                ? 'Checking your subscription details'
                : 'Your access needs attention'

    return (
        <div className="min-h-full bg-slate-50">
            {/* ── Top hero strip ── */}
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-2xl mx-auto px-6 py-6 md:px-10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <p className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-1">NirogOS</p>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Edit Profile</h1>
                            <p className="text-sm text-slate-400 font-medium mt-0.5">
                                These details print on every prescription you generate.
                            </p>
                        </div>

                        {/* Profile completeness pill + save button */}
                        <div className="flex items-center gap-3 flex-wrap">
                            {/* Completeness */}
                            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                                <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                            width: `${completionPct}%`,
                                            background: completionPct === 100
                                                ? 'linear-gradient(90deg, #10b981, #059669)'
                                                : 'linear-gradient(90deg, #6366f1, #8b5cf6)'
                                        }}
                                    />
                                </div>
                                <span className="text-xs font-black text-slate-600">{completionPct}%</span>
                            </div>

                            {/* Desktop save */}
                            <button
                                onClick={handleSave}
                                disabled={saving || saved}
                                className={`hidden md:flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-all duration-200 ${saving ? 'bg-indigo-300 text-white cursor-wait' :
                                    saved ? 'bg-emerald-500 text-white' :
                                        'bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-indigo-200'
                                    }`}
                            >
                                {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> :
                                    saved ? <><CheckCircle size={15} /> Saved!</> :
                                        <><Save size={15} /> Save Changes</>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Form body ── */}
            <div className="max-w-2xl mx-auto px-4 md:px-10 py-6 pb-32">

                {/* ═══ 1: Doctor Identity ═══ */}
                <Section index={1} icon={User} title="Doctor Identity"
                    subtitle="Your professional credentials" accent="#6366f1">
                    <div className="space-y-5">

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <Field label="Full Name" required error={errors.doctor_name}>
                                <InputField
                                    value={profile.doctor_name ?? ''}
                                    onChange={v => update('doctor_name', v)}
                                    placeholder="Dr. Deepak Sharma"
                                    icon={User}
                                />
                            </Field>

                            <Field label="Specialization" error={errors.specialization}>
                                <StyledSelect
                                    value={profile.specialization ?? ''}
                                    onChange={v => update('specialization', v)}
                                >
                                    <option value="" disabled>Select specialization…</option>
                                    {SPECIALIZATION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                </StyledSelect>
                            </Field>
                        </div>

                        <Field label="Qualifications" required error={errors.qualifications}>
                            <StyledSelect
                                value=""
                                onChange={v => { if (v) update('qualifications', v) }}
                            >
                                <option value="" disabled>Quick select a preset…</option>
                                {QUALIFICATION_PRESETS.map(q => <option key={q} value={q}>{q}</option>)}
                            </StyledSelect>
                            <div className="mt-2">
                                <InputField
                                    value={profile.qualifications ?? ''}
                                    onChange={v => update('qualifications', v)}
                                    placeholder="Or type custom qualifications (comma separated)"
                                    icon={Award}
                                />
                            </div>
                        </Field>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <Field label="Reg. Number" required error={errors.registration_number}>
                                <InputField
                                    value={profile.registration_number ?? ''}
                                    onChange={v => update('registration_number', v.toUpperCase())}
                                    placeholder="e.g. MMC-12345"
                                />
                                {profile.registration_number ? (
                                    <div className="mt-2 text-xs font-bold text-emerald-600 flex items-center gap-1.5 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">
                                        <CheckCircle size={13} /> Valid for e-prescriptions
                                    </div>
                                ) : (
                                    <div className="mt-2 text-xs font-bold text-rose-500 flex items-center gap-1.5 bg-rose-50 px-3 py-2 rounded-lg border border-rose-100">
                                        <AlertCircle size={13} className="shrink-0" /> Legally mandatory
                                    </div>
                                )}
                            </Field>

                            <Field label="Years of Experience" error={errors.experience_years}>
                                <InputField
                                    type="number"
                                    value={profile.experience_years?.toString() ?? ''}
                                    onChange={v => update('experience_years', v === '' ? null : parseInt(v))}
                                    placeholder="e.g. 10"
                                />
                            </Field>
                        </div>
                    </div>
                </Section>

                {/* ═══ 2: Clinic Details ═══ */}
                <Section index={2} icon={Building2} title="Clinic Details"
                    subtitle="Contact and location information" accent="#0891b2">
                    <div className="space-y-5">

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

                        <Field label="Full Address" required error={errors.clinic_address}>
                            <textarea
                                value={profile.clinic_address ?? ''}
                                onChange={e => update('clinic_address', e.target.value)}
                                placeholder="12, MG Road, Near Civil Hospital, Pune - 411001"
                                style={{ fontSize: 15 }}
                                rows={3}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold placeholder:text-slate-300 placeholder:font-normal outline-none focus:bg-white focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all resize-none"
                            />
                        </Field>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <Field label="Email (Optional)" error={errors.clinic_email}>
                                <InputField
                                    type="email"
                                    value={profile.clinic_email ?? ''}
                                    onChange={v => update('clinic_email', v)}
                                    placeholder="dr@clinic.com"
                                    icon={Mail}
                                />
                            </Field>

                            <Field label="Timings (Optional)">
                                <InputField
                                    value={profile.clinic_timings ?? ''}
                                    onChange={v => update('clinic_timings', v)}
                                    placeholder="Mon–Sat: 9AM–1PM"
                                    icon={Clock}
                                />
                            </Field>
                        </div>
                    </div>
                </Section>

                {/* ═══ 3: Signature ═══ */}
                <Section index={3} icon={PenLine} title="Signature"
                    subtitle="Appears at the bottom of every prescription" accent="#7c3aed">
                    {sigSrc ? (
                        <div className="rounded-2xl border border-slate-200 overflow-hidden">
                            {/* Header row */}
                            <div className="px-4 py-3 bg-white flex items-center justify-between border-b border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                                        <CheckCircle size={16} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-slate-800">Signature on file</p>
                                        <p className="text-xs text-slate-400 font-medium">{sigSize} KB compressed</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowSigPreview(p => !p)}
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
                                    >
                                        {showSigPreview ? <EyeOff size={13} /> : <Eye size={13} />}
                                        {showSigPreview ? 'Hide' : 'Preview'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => sigInputRef.current?.click()}
                                        disabled={sigProcessing}
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-50 text-xs font-bold text-violet-600 hover:bg-violet-100 transition"
                                    >
                                        {sigProcessing
                                            ? <Loader2 size={13} className="animate-spin" />
                                            : <RefreshCw size={13} />}
                                        Replace
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            update('signature_base64', null)
                                            setShowSigPreview(false)
                                            toast('Signature removed', { icon: '🗑️' })
                                        }}
                                        className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 flex items-center justify-center transition"
                                        title="Remove Signature"
                                    >
                                        <X size={14} className="text-rose-500" />
                                    </button>
                                </div>
                            </div>

                            {/* Preview panel */}
                            {showSigPreview && (
                                <div className="bg-[#f8f8f8] p-8 flex justify-center border-b border-slate-100 min-h-[140px] items-center"
                                    style={{ backgroundImage: 'radial-gradient(circle, #e2e2e2 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                                    <img src={sigSrc} alt="Signature" className="max-h-24 object-contain mix-blend-multiply drop-shadow" />
                                </div>
                            )}

                            {/* Prescription preview */}
                            <div className="p-5 bg-slate-50">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-4">
                                    Preview on prescription
                                </p>
                                <div className="max-w-[220px] mx-auto border-2 border-dashed border-slate-200 rounded-xl p-4 bg-white">
                                    <div className="h-14 flex items-end justify-center mb-2">
                                        <img src={sigSrc} className="max-h-full max-w-full object-contain mix-blend-multiply opacity-90" />
                                    </div>
                                    <div className="border-t-2 border-slate-800 pt-2 text-center">
                                        <p className="font-black text-slate-900 text-xs">Dr. {profile.doctor_name || 'Your Name'}</p>
                                        {profile.qualifications && <p className="text-[10px] font-bold text-slate-500 mt-0.5">{profile.qualifications}</p>}
                                        {profile.registration_number && <p className="text-[9px] text-slate-400 mt-0.5">Reg: {profile.registration_number}</p>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div
                                onClick={() => !sigProcessing && sigInputRef.current?.click()}
                                className={`group border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${sigProcessing
                                    ? 'border-violet-300 bg-violet-50 cursor-wait'
                                    : 'border-slate-200 hover:border-violet-300 hover:bg-violet-50/50'
                                    }`}
                            >
                                {sigProcessing ? (
                                    <div className="flex flex-col items-center gap-3">
                                        <Loader2 size={28} className="text-violet-500 animate-spin" />
                                        <p className="font-bold text-violet-700 text-sm">Processing signature…</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-12 h-12 bg-violet-100 text-violet-500 rounded-2xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                            <Upload size={22} />
                                        </div>
                                        <p className="font-black text-slate-800">Upload your signature</p>
                                        <p className="text-xs text-slate-400 font-medium">PNG or JPG · Max 5MB · White background recommended</p>
                                        <div className="mt-3 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 shadow-sm">
                                            Choose File
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                                <AlertCircle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                                <p className="text-xs font-semibold text-amber-800 leading-relaxed">
                                    No signature on file. Prescriptions will show a blank signature line.
                                </p>
                            </div>
                        </div>
                    )}
                    <input type="file" ref={sigInputRef} onChange={handleSignatureUpload}
                        accept="image/png, image/jpeg, image/jpg" className="hidden" />
                </Section>

                {/* ═══ 4: Doctor Stamp ═══ */}
                <Section index={4} icon={Stamp} title="Doctor Stamp"
                    subtitle="Optional — appears on printed prescriptions" accent="#059669">
                    {stampSrc ? (
                        <div className="border border-slate-200 rounded-2xl overflow-hidden">
                            <div className="bg-white p-4 flex justify-center">
                                <img src={stampSrc} alt="Stamp" className="max-h-28 object-contain" />
                            </div>
                            <div className="px-4 py-2.5 bg-slate-50 flex items-center justify-between border-t border-slate-100">
                                <p className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                                    <CheckCircle size={13} /> Stamp on file
                                </p>
                                <div className="flex gap-3">
                                    <button type="button"
                                        onClick={() => stampInputRef.current?.click()}
                                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition">
                                        Replace
                                    </button>
                                    <button type="button"
                                        onClick={() => {
                                            update('stamp_base64' as keyof ClinicProfile, null)
                                            toast('Stamp removed', { icon: '🗑️' })
                                        }}
                                        className="text-xs font-bold text-rose-500 hover:text-rose-700 transition">
                                        Remove
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Toggle */}
                            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                                {(['photo', 'generate'] as const).map(m => (
                                    <button key={m} type="button"
                                        onClick={() => setStampMode(m)}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${stampMode === m
                                            ? 'bg-white text-slate-900 shadow-sm'
                                            : 'text-slate-400 hover:text-slate-600'
                                            }`}
                                    >
                                        {m === 'photo' ? '📷 Upload Photo' : '✨ Generate Digital'}
                                    </button>
                                ))}
                            </div>

                            {stampMode === 'photo' ? (
                                <button type="button"
                                    onClick={() => stampInputRef.current?.click()}
                                    disabled={stampProcessing}
                                    className="w-full flex items-center gap-3 px-4 py-3.5 bg-slate-50 border-2 border-dashed border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 rounded-2xl transition-all"
                                >
                                    {stampProcessing
                                        ? <Loader2 size={16} className="text-emerald-500 animate-spin" />
                                        : <Upload size={16} className="text-slate-400" />}
                                    <span className="text-sm font-semibold text-slate-500">
                                        {stampProcessing ? 'Compressing…' : 'Upload stamp photo (PNG / JPG)'}
                                    </span>
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    <input
                                        style={{ fontSize: 15 }}
                                        value={stampGenName}
                                        onChange={e => setStampGenName(e.target.value)}
                                        placeholder="Doctor name (e.g. Sharma)"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 placeholder:text-slate-300 placeholder:font-normal"
                                    />
                                    <input
                                        style={{ fontSize: 15 }}
                                        value={stampGenReg}
                                        onChange={e => setStampGenReg(e.target.value)}
                                        placeholder="Registration number"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 placeholder:text-slate-300 placeholder:font-normal"
                                    />
                                    <button type="button"
                                        onClick={generateDigitalStamp}
                                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl text-sm font-black transition-all shadow-sm shadow-emerald-200"
                                    >
                                        ✨ Generate My Stamp
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    <input type="file" ref={stampInputRef} accept="image/*" className="hidden" onChange={handleStampUpload} />
                </Section>

                {/* ═══ 5: Subscription ═══ */}
                <Section index={5} icon={CreditCard} title="Current Plan"
                    subtitle="See your plan, billing status, and access window" accent="#2563eb">
                    <div className="space-y-4">
                        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                            <div className="p-5 bg-gradient-to-r from-sky-50 via-white to-indigo-50 border-b border-slate-100">
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-xl font-black text-slate-900">{currentPlanName}</p>
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-black ${statusTone}`}>
                                                <ShieldCheck size={12} />
                                                {statusLabel}
                                            </span>
                                        </div>
                                        <p className="text-sm font-semibold text-slate-500 mt-1">{planMessage}</p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => void refetchSubscription()}
                                            disabled={subscriptionLoading}
                                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:bg-slate-50 transition disabled:opacity-60"
                                        >
                                            <RefreshCw size={14} className={subscriptionLoading ? 'animate-spin' : ''} />
                                            Refresh
                                        </button>
                                        <Link
                                            to="/pricing"
                                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-sm font-bold text-white hover:bg-indigo-700 transition"
                                        >
                                            View Plans
                                            <ChevronRight size={14} />
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Monthly price</p>
                                    <p className="text-lg font-black text-slate-900 mt-1">
                                        {planPrice === 0 ? 'Free' : `₹${planPrice}/month`}
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider">{endLabel}</p>
                                    <p className="text-sm font-black text-slate-900 mt-1">{formatDateTime(effectiveEndDate)}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Started on</p>
                                    <p className="text-sm font-black text-slate-900 mt-1">{formatDateTime(effectiveStartDate)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <CalendarClock size={16} className="text-indigo-500" />
                                    <p className="text-sm font-black text-slate-800">Plan timeline</p>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-slate-500 font-semibold">Current plan</span>
                                        <span className="text-slate-900 font-black">{currentPlanName}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-slate-500 font-semibold">Billing status</span>
                                        <span className="text-slate-900 font-black">{statusLabel}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-slate-500 font-semibold">Days remaining</span>
                                        <span className="text-slate-900 font-black">{daysLeft}</span>
                                    </div>
                                    {subscription?.amount_paid != null && (
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-slate-500 font-semibold">Last recorded payment</span>
                                            <span className="text-slate-900 font-black">₹{subscription.amount_paid}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-sm font-black text-slate-800 mb-3">Included with this plan</p>
                                <div className="flex flex-wrap gap-2">
                                    {includedFeatures.map(feature => (
                                        <span
                                            key={feature}
                                            className="px-3 py-1.5 rounded-full border border-indigo-100 bg-indigo-50 text-xs font-bold text-indigo-700"
                                        >
                                            {feature}
                                        </span>
                                    ))}
                                </div>
                                {subscription?.admin_notes && (
                                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800">
                                        {subscription.admin_notes}
                                    </div>
                                )}
                                {subscriptionError && (
                                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700">
                                        {subscriptionError}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </Section>

                {/* ═══ 6: Pharmacy Integration ═══ */}
                {clinicId && user && (
                    <Section index={6} icon={Store} title="Pharmacy Linking"
                        subtitle="Manage linked pharmacies, send requests, and keep a primary destination" accent="#f59e0b">
                        <PharmacyInvitePanel clinicId={clinicId} doctorProfileId={user.id} />
                    </Section>
                )}

                {/* Last updated */}
                {profile.updated_at && (
                    <p className="text-center text-xs font-semibold text-slate-300 mb-4">
                        Last updated {new Date(profile.updated_at).toLocaleString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                        })}
                    </p>
                )}

                {/* ── Mobile Save Button ── */}
                <div className="md:hidden fixed bottom-0 left-0 right-0 px-4 py-3 bg-white/90 backdrop-blur-xl border-t border-slate-200 z-30">
                    <button
                        onClick={handleSave}
                        disabled={saving || saved}
                        className={`w-full py-4 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-2 shadow-lg ${saving ? 'bg-indigo-400 text-white cursor-wait shadow-none' :
                            saved ? 'bg-emerald-500 text-white shadow-emerald-200/50' :
                                'bg-indigo-600 active:bg-indigo-700 active:scale-[0.98] text-white shadow-indigo-200/50'
                            }`}
                    >
                        {saving ? <><Loader2 size={18} className="animate-spin" /> Saving…</> :
                            saved ? <><CheckCircle size={18} /> Saved!</> :
                                <><Save size={18} /> Save All Changes</>}
                    </button>
                </div>

            </div>
        </div>
    )
}
