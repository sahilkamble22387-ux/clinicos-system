import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
    User, Building2, PenLine, ChevronRight, ChevronLeft,
    CheckCircle, Upload, X, AlertCircle, Loader2,
    Phone, MapPin, Mail, Clock, Hash, Stamp,
    ShieldCheck, Info,
} from 'lucide-react'
import { supabase } from '../services/db'
import { useAuth } from '../context/AuthContext'
import { compressSignatureToBase64, signatureToImgSrc, getSignatureSizeKB } from '../utils/signatureCompressor'
import { SPECIALIZATION_OPTIONS, OnboardingFormData } from '../types/clinic'
import { DegreeInput } from '../components/DegreeInput'
import toast from 'react-hot-toast'

// ─────────────────────────────────────────────────────────────────────────────
// STEP CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = [
    { id: 1, title: 'Doctor Details', subtitle: 'Your professional identity', icon: User },
    { id: 2, title: 'Clinic Details', subtitle: 'Where you practice', icon: Building2 },
    { id: 3, title: 'Your Signature', subtitle: 'For authentic prescriptions', icon: PenLine },
]

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Reject strings that are all the same character, all numbers, or too short */
function isLikelyFakeName(s: string): boolean {
    const t = s.trim()
    if (t.length < 3) return true
    if (/^\d+$/.test(t)) return true                                   // all digits
    if (/^(.)\1+$/.test(t)) return true                                // aaaa, bbbb
    if (/^(dr\.?\s*)?\d/i.test(t)) return true                        // Dr. 123…
    // Must contain at least one letter that forms a real word-ish pattern
    if (!/[a-zA-Z]{2,}/.test(t)) return true
    return false
}

/** Indian mobile: 10 digits, starts with 6-9, no all-same, no sequential runs */
function validatePhone(raw: string): string | null {
    const digits = raw.replace(/\D/g, '')
    if (!digits) return 'Phone number is required.'
    if (digits.length !== 10) return 'Must be exactly 10 digits.'
    if (!/^[6-9]/.test(digits)) return 'Must start with 6, 7, 8, or 9 (Indian mobile).'
    if (/^(\d)\1{9}$/.test(digits)) return 'Please enter a real phone number.'
    const seq = ['0123456789', '9876543210', '1234567890']
    if (seq.some(s => s.includes(digits) || digits === s)) return 'Please enter a real phone number.'
    const fakes = ['1234567890', '9876543210', '1111111111', '2222222222', '5555555555']
    if (fakes.includes(digits)) return 'Please enter a real phone number.'
    return null
}

/**
 * Indian medical registration: alphanumeric, at least 4 chars,
 * must contain at least one digit and one letter.
 * Rejects "AAAA", "1234", "TEST".
 */
function validateRegNumber(val: string): string | null {
    const v = val.trim()
    if (!v) return 'Registration number is legally required.'
    if (v.length < 4) return 'Must be at least 4 characters.'
    if (!/[A-Za-z]/.test(v)) return 'Must contain letters (e.g. MH-12345).'
    if (!/\d/.test(v)) return 'Must contain numbers (e.g. MH-12345).'
    // Reject obviously fake patterns
    if (/^(test|demo|fake|xxxx|abcd|1234)/i.test(v)) return 'Please enter your real registration number.'
    return null
}

function validateEmail(val: string): string | null {
    if (!val.trim()) return null // optional
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val.trim())) return 'Enter a valid email address.'
    if (/^(test|demo|fake|dummy|noreply)@/i.test(val.trim())) return 'Please use a real email address.'
    return null
}

function validateExperience(val: string): string | null {
    if (!val.trim()) return null // optional
    const n = parseInt(val, 10)
    if (isNaN(n) || n < 0) return 'Enter a valid number of years.'
    if (n > 70) return 'That seems too high — please check.'
    return null
}

function formatPhoneDisplay(raw: string): string {
    const d = raw.replace(/\D/g, '').slice(0, 10)
    if (d.length <= 5) return d
    return d.slice(0, 5) + ' ' + d.slice(5)
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────
function Field({
    label, required = false, hint, error, children,
}: {
    label: string
    required?: boolean
    hint?: string
    error?: string | null
    children: React.ReactNode
}) {
    return (
        <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-sm font-semibold text-slate-700">
                {label}
                {required && <span className="text-rose-500 ml-0.5">*</span>}
            </label>
            {children}
            {hint && !error && (
                <p className="text-xs text-slate-400 flex items-center gap-1">
                    <Info size={10} className="flex-shrink-0" /> {hint}
                </p>
            )}
            {error && (
                <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs font-semibold text-rose-500 flex items-center gap-1"
                >
                    <AlertCircle size={12} className="flex-shrink-0" /> {error}
                </motion.p>
            )}
        </div>
    )
}

function Input({
    value, onChange, placeholder, type = 'text', className = '',
    hasError = false, rightIcon, ...rest
}: {
    value: string
    onChange: (v: string) => void
    placeholder?: string
    type?: string
    className?: string
    hasError?: boolean
    rightIcon?: React.ReactNode
    [key: string]: any
}) {
    return (
        <div className="relative">
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                style={{ fontSize: 16 }}
                className={`w-full px-4 py-3 bg-white border rounded-xl text-slate-900 font-medium
                    placeholder:text-slate-300 placeholder:font-normal outline-none
                    transition-all duration-200
                    ${hasError
                        ? 'border-rose-300 bg-rose-50/40 focus:border-rose-400 focus:ring-2 focus:ring-rose-100'
                        : 'border-slate-200 hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'
                    }
                    ${rightIcon ? 'pr-10' : ''}
                    ${className}`}
                {...rest}
            />
            {rightIcon && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    {rightIcon}
                </div>
            )}
        </div>
    )
}

function IconInput({
    icon, value, onChange, placeholder, type = 'text', hasError = false, ...rest
}: {
    icon: React.ReactNode
    value: string
    onChange: (v: string) => void
    placeholder?: string
    type?: string
    hasError?: boolean
    [key: string]: any
}) {
    return (
        <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <span className="text-slate-400">{icon}</span>
            </div>
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                style={{ fontSize: 16 }}
                className={`w-full pl-11 pr-4 py-3 bg-white border rounded-xl text-slate-900 font-medium
                    placeholder:text-slate-300 placeholder:font-normal outline-none transition-all duration-200
                    ${hasError
                        ? 'border-rose-300 bg-rose-50/40 focus:border-rose-400 focus:ring-2 focus:ring-rose-100'
                        : 'border-slate-200 hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'
                    }`}
                {...rest}
            />
        </div>
    )
}

function Select({
    value, onChange, options, placeholder, hasError = false,
}: {
    value: string
    onChange: (v: string) => void
    options: string[]
    placeholder?: string
    hasError?: boolean
}) {
    return (
        <div className="relative">
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                style={{ fontSize: 16 }}
                className={`w-full px-4 py-3 bg-white border rounded-xl text-slate-900 font-medium
                    outline-none transition-all duration-200 appearance-none cursor-pointer
                    ${hasError
                        ? 'border-rose-300 bg-rose-50/40 focus:border-rose-400 focus:ring-2 focus:ring-rose-100'
                        : 'border-slate-200 hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'
                    }`}
            >
                <option value="" disabled>{placeholder ?? 'Select…'}</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                <ChevronRight size={14} className="text-slate-400 rotate-90" />
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — DOCTOR DETAILS
// ─────────────────────────────────────────────────────────────────────────────
function StepDoctor({
    form, update, errors, degreeList, onDegreeChange,
}: {
    form: OnboardingFormData
    update: (k: keyof OnboardingFormData, v: string | null) => void
    errors: Partial<Record<keyof OnboardingFormData, string>>
    degreeList: string[]
    onDegreeChange: (v: string[]) => void
}) {
    return (
        <div className="space-y-6">
            <Field label="Your Full Name" required error={errors.doctor_name}
                hint="First and last name, optionally with Dr. prefix">
                <Input
                    value={form.doctor_name}
                    onChange={v => update('doctor_name', v)}
                    placeholder="e.g. Dr. Deepak Sharma"
                    hasError={!!errors.doctor_name}
                    onBlur={() => {
                        if (isLikelyFakeName(form.doctor_name))
                            update('doctor_name', form.doctor_name) // triggers re-render; error shown by validateStep
                    }}
                />
            </Field>

            <Field label="Qualifications" required error={errors.qualifications}
                hint="Add each degree separately">
                <DegreeInput
                    values={degreeList}
                    onChange={onDegreeChange}
                    placeholder="Type MBBS, MD… and press Enter"
                    error={errors.qualifications}
                />
            </Field>

            <Field label="Medical Registration Number" required error={errors.registration_number}>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Hash size={17} className="text-slate-400" />
                    </div>
                    <input
                        type="text"
                        value={form.registration_number}
                        onChange={e => update('registration_number', e.target.value.toUpperCase())}
                        placeholder="e.g. MH-12345 or MMC/2015/12345"
                        style={{ fontSize: 16 }}
                        className={`w-full pl-11 pr-4 py-3 bg-white border rounded-xl text-slate-900 font-medium font-mono
                            placeholder:text-slate-300 placeholder:font-normal outline-none transition-all duration-200
                            ${errors.registration_number
                                ? 'border-rose-300 bg-rose-50/40 focus:border-rose-400 focus:ring-2 focus:ring-rose-100'
                                : 'border-slate-200 hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'
                            }`}
                    />
                </div>
                <div className="mt-2.5 bg-amber-50 border border-amber-200/80 p-3 rounded-xl flex items-start gap-2.5">
                    <ShieldCheck size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-800 leading-relaxed">
                        <strong>Legally required:</strong> Under the Drugs & Cosmetics Act 1940 and IMC regulations,
                        every prescription must carry the doctor's registration number. Prescriptions without it are legally invalid.
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
                        hasError={!!errors.specialization}
                    />
                </Field>
                <Field label="Years of Experience" error={errors.experience_years}
                    hint="0–70 years">
                    <Input
                        type="number"
                        value={form.experience_years}
                        onChange={v => update('experience_years', v)}
                        placeholder="e.g. 10"
                        hasError={!!errors.experience_years}
                        min={0} max={70}
                    />
                </Field>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// STAMP UPLOADER
// ─────────────────────────────────────────────────────────────────────────────
function StampUploader({
    stampBase64, onChange,
}: {
    stampBase64: string | null
    onChange: (v: string | null) => void
}) {
    const fileRef = useRef<HTMLInputElement>(null)
    const [mode, setMode] = useState<'photo' | 'generate'>('photo')
    const [processing, setProcessing] = useState(false)
    const [uploadErr, setUploadErr] = useState<string | null>(null)
    const [genName, setGenName] = useState('')
    const [genReg, setGenReg] = useState('')

    async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        if (file.size > 5 * 1024 * 1024) {
            setUploadErr('File too large — max 5MB.')
            e.target.value = ''
            return
        }
        setProcessing(true)
        setUploadErr(null)
        try {
            // BUG FIX: use static import directly, not a redundant dynamic re-import
            const b64 = await compressSignatureToBase64(file)
            onChange(b64)
        } catch (err: any) {
            setUploadErr(err?.message ?? 'Failed to process image. Try a different file.')
        } finally {
            setProcessing(false)
            e.target.value = ''
        }
    }

    function generateDigitalStamp() {
        if (!genName.trim() || !genReg.trim()) {
            setUploadErr('Enter both name and registration number to generate a stamp.')
            return
        }
        setUploadErr(null)
        const canvas = document.createElement('canvas')
        canvas.width = 280
        canvas.height = 280
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Outer ring
        ctx.beginPath()
        ctx.arc(140, 140, 128, 0, 2 * Math.PI)
        ctx.lineWidth = 5
        ctx.strokeStyle = '#1e3a8a'
        ctx.stroke()

        // Inner ring
        ctx.beginPath()
        ctx.arc(140, 140, 108, 0, 2 * Math.PI)
        ctx.lineWidth = 1.5
        ctx.strokeStyle = '#1e3a8a'
        ctx.stroke()

        // Name
        ctx.font = 'bold 16px serif'
        ctx.fillStyle = '#1e3a8a'
        ctx.textAlign = 'center'
        ctx.fillText(`Dr. ${genName.trim()}`, 140, 118)

        // Cross symbol
        ctx.font = 'bold 32px serif'
        ctx.fillText('✚', 140, 162)

        // Reg number
        ctx.font = '12px monospace'
        ctx.fillText(`Reg: ${genReg.trim().toUpperCase()}`, 140, 196)

        // BUG FIX: canvas.toDataURL() already returns a full data URL — don't strip then re-add prefix
        const dataUrl = canvas.toDataURL('image/png')
        onChange(dataUrl)
    }

    // Normalise: accept both raw base64 and full data URLs
    const imgSrc = stampBase64
        ? stampBase64.startsWith('data:')
            ? stampBase64
            : `data:image/png;base64,${stampBase64}`
        : null

    return (
        <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Stamp size={15} className="text-violet-600" />
                </div>
                <div>
                    <p className="text-sm font-bold text-slate-800">
                        Doctor Stamp
                        <span className="ml-1.5 text-[11px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                            Optional
                        </span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">Appears at the bottom of printed prescriptions</p>
                </div>
            </div>

            {!imgSrc ? (
                <div>
                    <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-4">
                        {(['photo', 'generate'] as const).map(m => (
                            <button key={m} type="button" onClick={() => { setMode(m); setUploadErr(null) }}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                    }`}>
                                {m === 'photo' ? '📷 Upload Photo' : '✨ Generate Digital'}
                            </button>
                        ))}
                    </div>

                    {mode === 'photo' ? (
                        <button type="button" onClick={() => fileRef.current?.click()} disabled={processing}
                            className="w-full flex items-center gap-3 px-4 py-3.5 bg-white border-2 border-dashed border-slate-200 hover:border-violet-300 hover:bg-violet-50/50 rounded-2xl transition-all">
                            {processing
                                ? <Loader2 size={18} className="text-violet-500 animate-spin" />
                                : <Upload size={18} className="text-slate-400" />
                            }
                            <span className="text-sm font-semibold text-slate-600">
                                {processing ? 'Compressing…' : 'Upload stamp image'}
                            </span>
                        </button>
                    ) : (
                        <div className="space-y-2.5">
                            <input style={{ fontSize: 16 }} value={genName} onChange={e => setGenName(e.target.value)}
                                placeholder="Doctor Name (e.g. Deepak Sharma)"
                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition" />
                            <input style={{ fontSize: 16 }} value={genReg} onChange={e => setGenReg(e.target.value.toUpperCase())}
                                placeholder="Registration No. (e.g. MH-12345)"
                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium font-mono outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition" />
                            <button type="button" onClick={generateDigitalStamp}
                                className="w-full py-3 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-violet-200">
                                ✨ Generate My Stamp
                            </button>
                        </div>
                    )}

                    {uploadErr && (
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="flex items-center gap-1.5 text-xs font-semibold text-rose-500 mt-2">
                            <AlertCircle size={12} /> {uploadErr}
                        </motion.p>
                    )}

                    <input type="file" ref={fileRef} accept="image/*" className="hidden" onChange={handleFile} />
                </div>
            ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <img src={imgSrc} alt="Stamp preview" className="w-full max-h-36 object-contain bg-white p-3" />
                    <div className="px-4 py-2.5 bg-slate-50 flex items-center justify-between border-t border-slate-100">
                        <p className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                            <CheckCircle size={12} /> Stamp ready
                        </p>
                        <button type="button" onClick={() => onChange(null)}
                            className="text-xs text-rose-500 hover:text-rose-700 font-bold transition-colors">
                            Remove
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — CLINIC DETAILS
// ─────────────────────────────────────────────────────────────────────────────
function StepClinic({
    form, update, errors,
}: {
    form: OnboardingFormData
    // BUG FIX: unified update signature (same as parent)
    update: (k: keyof OnboardingFormData, v: string | null) => void
    errors: Partial<Record<keyof OnboardingFormData, string>>
}) {
    return (
        <div className="space-y-6">
            <Field label="Clinic Name" required error={errors.clinic_name_override}>
                <IconInput
                    icon={<Building2 size={17} />}
                    value={form.clinic_name_override}
                    onChange={v => update('clinic_name_override', v)}
                    placeholder="e.g. Sharma Medical Centre"
                    hasError={!!errors.clinic_name_override}
                />
            </Field>

            <Field label="Clinic Phone Number" required error={errors.phone_number}
                hint="10-digit Indian mobile or landline">
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none gap-1.5">
                        <Phone size={17} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-400">+91</span>
                        <div className="w-px h-4 bg-slate-200" />
                    </div>
                    <input
                        type="tel"
                        inputMode="numeric"
                        value={formatPhoneDisplay(form.phone_number)}
                        onChange={e => {
                            const raw = e.target.value.replace(/\D/g, '').slice(0, 10)
                            update('phone_number', raw)
                        }}
                        placeholder="98765 43210"
                        style={{ fontSize: 16 }}
                        className={`w-full pl-[5.5rem] pr-10 py-3 bg-white border rounded-xl text-slate-900 font-medium
                            placeholder:text-slate-300 outline-none transition-all duration-200
                            ${errors.phone_number
                                ? 'border-rose-300 bg-rose-50/40 focus:border-rose-400 focus:ring-2 focus:ring-rose-100'
                                : form.phone_number.length === 10 && !errors.phone_number
                                    ? 'border-emerald-300 bg-emerald-50/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100'
                                    : 'border-slate-200 hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'
                            }`}
                    />
                    {form.phone_number.length === 10 && !errors.phone_number && (
                        <CheckCircle size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-500" />
                    )}
                    {errors.phone_number && (
                        <AlertCircle size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-rose-400" />
                    )}
                </div>
            </Field>

            <Field label="Clinic Address" required error={errors.clinic_address}>
                <div className="relative">
                    <div className="absolute top-3.5 left-3.5 pointer-events-none">
                        <MapPin size={17} className="text-slate-400" />
                    </div>
                    <textarea
                        value={form.clinic_address}
                        onChange={e => update('clinic_address', e.target.value)}
                        placeholder="e.g. 12, MG Road, Near Civil Hospital, Pune – 411001"
                        style={{ fontSize: 16 }}
                        rows={3}
                        className={`w-full pl-11 pr-4 py-3 bg-white border rounded-xl text-slate-900 font-medium
                            placeholder:text-slate-300 outline-none transition-all duration-200 resize-none
                            ${errors.clinic_address
                                ? 'border-rose-300 bg-rose-50/40 focus:border-rose-400 focus:ring-2 focus:ring-rose-100'
                                : 'border-slate-200 hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'
                            }`}
                    />
                </div>
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Clinic Email" error={errors.clinic_email} hint="Optional">
                    <IconInput
                        icon={<Mail size={17} />}
                        type="email"
                        value={form.clinic_email}
                        onChange={v => update('clinic_email', v)}
                        placeholder="dr.sharma@gmail.com"
                        hasError={!!errors.clinic_email}
                    />
                </Field>

                <Field label="Clinic Timings" hint="Optional">
                    <IconInput
                        icon={<Clock size={17} />}
                        value={form.clinic_timings}
                        onChange={v => update('clinic_timings', v)}
                        placeholder="Mon–Sat: 9AM–1PM, 5–8PM"
                    />
                </Field>
            </div>

            <StampUploader
                stampBase64={form.stamp_base64 ?? null}
                onChange={v => update('stamp_base64', v)}
            />
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — SIGNATURE
// ─────────────────────────────────────────────────────────────────────────────
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
        if (file.size > 5 * 1024 * 1024) {
            setError('File too large — max 5MB.')
            e.target.value = ''
            return
        }
        setProcessing(true)
        setError(null)
        try {
            const base64 = await compressSignatureToBase64(file)
            update('signature_base64', base64)
        } catch (err: any) {
            setError(err?.message ?? 'Failed to process image. Try a different file.')
        } finally {
            setProcessing(false)
            e.target.value = ''
        }
    }

    return (
        <div className="space-y-6">
            <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-5 flex gap-4">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <PenLine size={20} className="text-indigo-600" />
                </div>
                <div>
                    <h4 className="font-bold text-slate-800 text-sm mb-1">Why add your signature?</h4>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                        Indian medical law requires a doctor's handwritten signature on every prescription.
                        NirogOS saves it securely in the database and renders it on every prescription —
                        making them legally authentic without any printing extra step.
                    </p>
                </div>
            </div>

            {!imgSrc ? (
                <div
                    onClick={() => !processing && inputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 ${processing
                            ? 'border-indigo-300 bg-indigo-50 cursor-wait'
                            : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 cursor-pointer active:scale-[0.99]'
                        }`}
                >
                    {processing ? (
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 size={32} className="text-indigo-500 animate-spin" />
                            <p className="font-semibold text-indigo-700 text-sm">Compressing signature…</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mb-2 border border-indigo-100">
                                <Upload size={24} />
                            </div>
                            <h4 className="font-bold text-slate-800 text-sm">Upload your signature photo</h4>
                            <p className="text-xs text-slate-400 mb-3">PNG or JPG · Max 5MB · Auto-compressed</p>
                            <div className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-700 shadow-sm inline-block">
                                Choose File
                            </div>
                            <div className="mt-4 text-[11px] font-semibold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 inline-block">
                                💡 Sign on white paper, photograph in good light, upload here
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex items-center justify-between">
                        <div>
                            <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                                <CheckCircle size={15} className="text-emerald-500" /> Signature ready
                            </h4>
                            <p className="text-xs text-slate-400 mt-0.5">{sizeKB}KB compressed</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button type="button" onClick={() => inputRef.current?.click()}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition">
                                Change
                            </button>
                            <button type="button" onClick={() => update('signature_base64', null)}
                                className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition">
                                <X size={14} className="text-red-500" />
                            </button>
                        </div>
                    </div>
                    <div className="p-8 bg-white flex justify-center min-h-[140px] items-center"
                        style={{ backgroundImage: 'radial-gradient(circle, #e2e8f0 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                        <img src={imgSrc} alt="Signature Preview" className="max-h-20 object-contain mix-blend-multiply drop-shadow-sm" />
                    </div>
                    <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-100 text-center">
                        <p className="text-xs font-semibold text-slate-400">
                            This is exactly how your signature appears on prescriptions
                        </p>
                    </div>
                </div>
            )}

            {error && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm font-medium text-rose-600 flex items-start gap-2">
                    <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                    {error}
                </motion.div>
            )}

            <div className="pt-4 border-t border-slate-100 text-center">
                <p className="text-xs font-medium text-slate-400 max-w-sm mx-auto leading-relaxed">
                    You can skip this and add your signature later in Settings.
                    Prescriptions without a signature will show a blank signature line.
                </p>
            </div>

            <input type="file" ref={inputRef} onChange={handleFileChange}
                accept="image/png, image/jpeg, image/jpg" className="hidden" />
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function OnboardingForm() {
    const { user, clinicId, refreshClinicProfile } = useAuth()
    const navigate = useNavigate()

    const [step, setStep] = useState(1)
    const [form, setForm] = useState<OnboardingFormData>(INITIAL)
    const [degreeList, setDegreeList] = useState<string[]>([])
    const [errors, setErrors] = useState<Partial<Record<keyof OnboardingFormData, string>>>({})
    const [saving, setSaving] = useState(false)
    const [completed, setCompleted] = useState(false)

    // BUG FIX: unified update signature accepts string | null
    function update(key: keyof OnboardingFormData, value: string | null) {
        setForm(f => ({ ...f, [key]: value }))
        setErrors(e => ({ ...e, [key]: undefined }))
    }

    function handleDegreeChange(list: string[]) {
        setDegreeList(list)
        update('qualifications', list.join(', '))
    }

    // ── Validation ──
    function validateStep(s: number): boolean {
        const errs: typeof errors = {}

        if (s === 1) {
            const name = form.doctor_name.trim()
            if (!name) {
                errs.doctor_name = 'Doctor name is required.'
            } else if (isLikelyFakeName(name)) {
                errs.doctor_name = 'Please enter your real full name.'
            } else if (name.length < 3) {
                errs.doctor_name = 'Name must be at least 3 characters.'
            }

            if (!form.qualifications.trim() || degreeList.length === 0)
                errs.qualifications = 'Add at least one qualification.'

            const regErr = validateRegNumber(form.registration_number)
            if (regErr) errs.registration_number = regErr

            if (!form.specialization.trim())
                errs.specialization = 'Please select a specialization.'

            const expErr = validateExperience(form.experience_years)
            if (expErr) errs.experience_years = expErr
        }

        if (s === 2) {
            const clinicName = form.clinic_name_override.trim()
            if (!clinicName) {
                errs.clinic_name_override = 'Clinic name is required.'
            } else if (clinicName.length < 3) {
                errs.clinic_name_override = 'Clinic name must be at least 3 characters.'
            } else if (/^(test|demo|fake|clinic1|abc|xyz)/i.test(clinicName)) {
                errs.clinic_name_override = 'Please enter your real clinic name.'
            }

            const phoneErr = validatePhone(form.phone_number)
            if (phoneErr) errs.phone_number = phoneErr

            const addr = form.clinic_address.trim()
            if (!addr) {
                errs.clinic_address = 'Clinic address is required.'
            } else if (addr.length < 10) {
                errs.clinic_address = 'Please enter a more complete address.'
            }

            const emailErr = validateEmail(form.clinic_email)
            if (emailErr) errs.clinic_email = emailErr
        }

        setErrors(errs)
        return Object.keys(errs).length === 0
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

    // ── Save ──
    async function handleSave() {
        if (!user || !clinicId) {
            toast.error('Session expired — please log in again.')
            return
        }

        setSaving(true)
        try {
            const payload = {
                doctor_name: form.doctor_name.trim(),
                // BUG FIX: derive qualifications from degreeList, not by splitting
                // the already-joined string (which breaks degrees containing commas)
                qualifications: degreeList.filter(Boolean),
                registration_number: form.registration_number.trim().toUpperCase(),
                specialization: form.specialization,
                // BUG FIX: parseInt with explicit radix 10 + bounds guard
                experience_years: form.experience_years
                    ? Math.min(70, Math.max(0, parseInt(form.experience_years, 10)))
                    : null,
                phone_number: form.phone_number.replace(/\D/g, ''),
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

            await refreshClinicProfile()

            localStorage.removeItem('nirogos_welcome_popup_done')
            localStorage.removeItem('nirogos_tutorial_done_v2')

            setCompleted(true)
            toast.success('Profile saved! Welcome to NirogOS 🎉')
            setTimeout(() => navigate('/dashboard', { replace: true }), 1800)

        } catch (err: any) {
            console.error('[Onboarding]', err)
            toast.error('Failed to save: ' + (err?.message ?? 'Unknown error'))
        } finally {
            setSaving(false)
        }
    }

    // ── Success screen ──
    if (completed) {
        // BUG FIX: extract first real name word, skipping honorific prefix "Dr."
        const nameParts = form.doctor_name.trim().split(/\s+/)
        const firstName = nameParts.find(p => !/^dr\.?$/i.test(p)) ?? nameParts[0] ?? 'Doctor'

        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 240, damping: 24 }}
                    className="bg-white rounded-3xl p-10 shadow-xl shadow-indigo-100/60 max-w-sm w-full text-center border border-slate-100"
                >
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.15 }}
                        className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6"
                    >
                        <CheckCircle size={40} />
                    </motion.div>
                    <h2 className="text-2xl font-black text-slate-800 mb-2">
                        All set, Dr. {firstName}! 👋
                    </h2>
                    <p className="text-slate-400 font-medium text-sm">Redirecting to your dashboard…</p>
                </motion.div>
            </div>
        )
    }

    // ── Main render ──
    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Top bar */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3 sticky top-0 z-20 shadow-sm">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-indigo-200">
                    C
                </div>
                <span className="font-black text-slate-800 tracking-tight">NirogOS</span>
                <span className="text-slate-300 mx-1">·</span>
                <span className="text-slate-500 font-medium text-sm">Setup your profile</span>

                {/* Mini progress in top bar on mobile */}
                <div className="ml-auto flex items-center gap-1.5">
                    {STEPS.map(s => (
                        <div key={s.id} className={`h-1.5 rounded-full transition-all duration-300 ${step > s.id ? 'w-4 bg-indigo-600' :
                                step === s.id ? 'w-6 bg-indigo-400' :
                                    'w-4 bg-slate-200'
                            }`} />
                    ))}
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-10">

                {/* Hero */}
                <div className="mb-10 text-center">
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">
                        Complete your profile
                    </h1>
                    <p className="text-slate-500 font-medium text-sm max-w-md mx-auto">
                        This information is required to generate legally valid prescriptions in India.
                    </p>
                </div>

                {/* Step indicators */}
                <div className="flex items-center justify-center mb-10 px-4">
                    {STEPS.map((s, i) => {
                        const isDone = step > s.id
                        const isCurrent = step === s.id
                        return (
                            <React.Fragment key={s.id}>
                                <div className="flex flex-col items-center">
                                    <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${isDone ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' :
                                            isCurrent ? 'bg-white text-indigo-700 border-2 border-indigo-500 shadow-lg shadow-indigo-100' :
                                                'bg-white text-slate-400 border border-slate-200'
                                        }`}>
                                        {isDone ? <CheckCircle size={18} strokeWidth={2.5} /> : s.id}
                                    </div>
                                    <p className={`mt-2 text-[11px] font-bold transition-colors hidden sm:block ${isCurrent ? 'text-indigo-700' : isDone ? 'text-indigo-500' : 'text-slate-400'
                                        }`}>
                                        {s.title}
                                    </p>
                                </div>
                                {i < STEPS.length - 1 && (
                                    <div className="flex-1 h-0.5 mx-3 rounded-full overflow-hidden bg-slate-200 mt-[-18px] sm:mt-[-28px]">
                                        <motion.div
                                            className="h-full bg-indigo-500 rounded-full"
                                            animate={{ width: isDone ? '100%' : '0%' }}
                                            transition={{ duration: 0.4, ease: 'easeInOut' }}
                                        />
                                    </div>
                                )}
                            </React.Fragment>
                        )
                    })}
                </div>

                {/* Step card */}
                <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/60 border border-slate-200/80 overflow-hidden mb-6">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, x: 24 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -24 }}
                            transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
                            className="p-6 sm:p-10"
                        >
                            {/* Step header */}
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0 border border-indigo-100">
                                    {(() => { const Icon = STEPS[step - 1].icon; return <Icon size={23} strokeWidth={2.5} /> })()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-xl font-black text-slate-800 leading-tight">
                                        {STEPS[step - 1].title}
                                    </h2>
                                    <p className="text-sm font-semibold text-slate-400 mt-0.5">
                                        {STEPS[step - 1].subtitle}
                                    </p>
                                </div>
                                <div className="flex-shrink-0 bg-slate-100 px-3 py-1 rounded-full text-xs font-bold text-slate-500">
                                    {step} / {STEPS.length}
                                </div>
                            </div>

                            {step === 1 && (
                                <StepDoctor
                                    form={form} update={update} errors={errors}
                                    degreeList={degreeList} onDegreeChange={handleDegreeChange}
                                />
                            )}
                            {step === 2 && (
                                <StepClinic form={form} update={update} errors={errors} />
                            )}
                            {step === 3 && (
                                <StepSignature form={form} update={update} />
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Nav buttons */}
                <div className="flex items-center gap-3 px-1">
                    {step > 1 && (
                        <button onClick={handleBack}
                            className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all text-sm">
                            <ChevronLeft size={17} /> Back
                        </button>
                    )}

                    {step < 3 ? (
                        <button onClick={handleNext}
                            className="ml-auto flex items-center gap-2 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 transition-all">
                            Continue <ChevronRight size={17} />
                        </button>
                    ) : (
                        <button onClick={handleSave} disabled={saving}
                            className={`ml-auto flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm shadow-lg transition-all ${saving
                                    ? 'bg-indigo-400 text-white cursor-wait shadow-none'
                                    : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-indigo-200'
                                }`}>
                            {saving
                                ? <><Loader2 size={17} className="animate-spin" /> Saving…</>
                                : <><CheckCircle size={17} /> Complete Setup</>
                            }
                        </button>
                    )}
                </div>

                {/* Legal footnote */}
                <div className="mt-12 text-center max-w-md mx-auto pb-4">
                    <p className="text-xs text-slate-400 leading-relaxed">
                        🔒 Your information is stored securely and used only to generate prescriptions for your clinic.
                        The registration number is required by the Medical Council of India (MCI) / National Medical Commission (NMC).
                    </p>
                </div>
            </div>
        </div>
    )
}