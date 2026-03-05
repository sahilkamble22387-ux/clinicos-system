import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../services/db'
import { Download, Share2, CheckCircle, Loader2, AlertCircle, Phone, MapPin, Calendar, Mail } from 'lucide-react'

interface MedicineLine {
    medicine_name: string
    generic_name: string | null
    strength: string
    form: string
    timing: [number, number, number]
    food_relation: string
    duration_value: number
    duration_unit: string
    instructions: string
}

interface Prescription {
    id: string
    created_at: string
    patient_name: string
    patient_phone: string
    patient_age: string | null
    patient_gender: string | null
    patient_weight?: string | null
    patient_address?: string | null
    clinic_name: string
    doctor_name: string
    doctor_qualification: string | null
    doctor_registration_no: string | null
    clinic_address: string | null
    clinic_phone: string | null
    clinic_email?: string | null
    doctor_signature_base64: string | null
    diagnosis: string
    doctor_notes: string | null
    fee_collected: number
    payment_method: string
    medicines: MedicineLine[]
    vitals: {
        bp_systolic: number | null
        bp_diastolic: number | null
        heart_rate: number | null
        weight_kg: number | null
        temperature_f: number | null
    } | null
}

function timingLabel(t: [number, number, number]): string {
    const [m, a, n] = t
    if (!m && !a && !n) return 'As needed (SOS)'
    if (m && a && n) return '3 times daily'
    if (m && !a && n) return 'Twice daily (Morning & Night)'
    if (m && a && !n) return 'Twice daily (Morning & Afternoon)'
    if (!m && a && n) return 'Twice daily (Afternoon & Night)'
    if (m && !a && !n) return 'Once daily · Morning'
    if (!m && a && !n) return 'Once daily · Afternoon'
    if (!m && !a && n) return 'Once daily · Night'
    return `${m}-${a}-${n}`
}

function foodLabel(f: string): string {
    return ({ after: 'After food', before: 'Before food', with: 'With food', any: 'Anytime' } as Record<string, string>)[f] ?? f
}

function calcQty(t: [number, number, number], val: number, unit: string): number {
    const perDay = t[0] + t[1] + t[2]
    if (!perDay) return 0
    const days = unit === 'weeks' ? val * 7 : unit === 'months' ? val * 30 : val
    return perDay * days
}

function LoadingScreen() {
    return (
        <div style={{ minHeight: '100vh', background: '#F0F2F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, background: 'linear-gradient(135deg,#0C1A35,#1A3260)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 8px 28px rgba(12,26,53,0.4)' }}>
                    <span style={{ color: '#C9A84C', fontWeight: 800, fontSize: 22, fontFamily: 'Georgia,serif' }}>℞</span>
                </div>
                <p style={{ color: '#64748B', fontSize: 13, fontWeight: 500 }}>Loading your prescription…</p>
            </div>
        </div>
    )
}

function ErrorScreen({ message }: { message: string }) {
    return (
        <div style={{ minHeight: '100vh', background: '#F0F2F5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui' }}>
            <div style={{ textAlign: 'center', maxWidth: 360 }}>
                <div style={{ width: 64, height: 64, background: '#FEE2E2', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <AlertCircle style={{ color: '#EF4444', width: 32, height: 32 }} />
                </div>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Prescription Not Found</h1>
                <p style={{ color: '#64748B', fontSize: 14, lineHeight: 1.6 }}>{message}</p>
                <p style={{ color: '#CBD5E1', fontSize: 12, marginTop: 12 }}>Contact your clinic if you think this is a mistake.</p>
            </div>
        </div>
    )
}

export default function RxPage() {
    const { prescriptionId } = useParams<{ prescriptionId: string }>()
    const [rx, setRx] = useState<Prescription | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [printing, setPrinting] = useState(false)

    useEffect(() => {
        if (!prescriptionId) { setError('Invalid prescription link.'); setLoading(false); return }
        supabase.from('prescriptions').select('*')
            .eq('id', prescriptionId).eq('is_active', true).single()
            .then(({ data, error: e }) => {
                if (e || !data) { setError('Prescription not found or has been revoked.'); setLoading(false); return }
                setRx(data as Prescription)
                setLoading(false)
            })
    }, [prescriptionId])

    function handlePrint() {
        setPrinting(true)
        setTimeout(() => { window.print(); setPrinting(false) }, 200)
    }

    async function handleShare() {
        const url = window.location.href
        if (navigator.share) {
            try { await navigator.share({ title: `Prescription — Dr. ${rx?.doctor_name}`, text: `Your prescription from ${rx?.clinic_name}`, url }) } catch (_) { }
        } else {
            await navigator.clipboard.writeText(url)
            alert('Link copied to clipboard!')
        }
    }

    if (loading) return <LoadingScreen />
    if (error || !rx) return <ErrorScreen message={error ?? 'Prescription not found.'} />

    const date = new Date(rx.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    const refId = rx.id.slice(0, 8).toUpperCase()
    const weight = rx.vitals?.weight_kg ?? (rx.patient_weight ? parseFloat(rx.patient_weight) : null)

    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Sans',system-ui,sans-serif;background:#E8EAED;-webkit-font-smoothing:antialiased}

        .rx-stamp{
          display:inline-block;
          border:2px solid #0C1A35;
          padding:10px 14px;
          border-radius:3px;
          transform:rotate(-2deg);
          opacity:0.80;
          position:relative;
          text-align:left;
        }
        .rx-stamp::before{
          content:'';position:absolute;inset:3px;
          border:1px dashed rgba(12,26,53,0.35);
          pointer-events:none;border-radius:1px;
        }

        .rx-inner-pad { padding-left: clamp(16px, 5vw, 40px); padding-right: clamp(16px, 5vw, 40px); }
        .rx-med-grid { display: grid; grid-template-columns: 28px 1fr 100px 95px 65px; gap: 8px; }
        .rx-letterhead-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
        .rx-clinic-col { flex: 0 0 220px; text-align: right; }
        .rx-sig-row { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; }

        @media (max-width: 600px) {
          .rx-med-grid { grid-template-columns: 28px 1fr !important; }
          .rx-med-grid .rx-col-timing,
          .rx-med-grid .rx-col-duration,
          .rx-med-grid .rx-col-qty { display: none !important; }
          .rx-letterhead-row { flex-direction: column; gap: 16px; }
          .rx-clinic-col { flex: unset !important; text-align: left !important; }
          .rx-sig-row { flex-direction: column; align-items: stretch; gap: 16px; }
          .rx-sig-row > div:last-child { text-align: left !important; }
        }

        @media print {
          .no-print{display:none!important}
          body{background:white!important}
          .rx-document{box-shadow:none!important;border-radius:0!important;max-width:100%!important;width:100%!important}
          @page{size:A4 portrait;margin:0}
        }
      `}</style>

            {/* TOOLBAR */}
            <div className="no-print" style={{ position: 'sticky', top: 0, zIndex: 50, background: 'white', borderBottom: '1px solid #E2E8F0', boxShadow: '0 1px 10px rgba(0,0,0,0.08)' }}>
                <div style={{ maxWidth: 800, margin: '0 auto', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#0C1A35,#1A3260)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(12,26,53,0.4)' }}>
                            <span style={{ color: '#C9A84C', fontWeight: 800, fontSize: 16, fontFamily: 'Georgia,serif' }}>℞</span>
                        </div>
                        <div>
                            <span style={{ fontWeight: 700, color: '#0F172A', fontSize: 14 }}>ClinicOS</span>
                            <span style={{ color: '#94A3B8', fontSize: 12, marginLeft: 6 }}>· e-Prescription</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={handleShare} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: '#F1F5F9', border: 'none', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                            <Share2 size={13} /> Share
                        </button>
                        <button onClick={handlePrint} disabled={printing} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 10, background: 'linear-gradient(135deg,#0C1A35,#1A3260)', border: 'none', color: 'white', fontSize: 13, fontWeight: 700, cursor: printing ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: printing ? 0.7 : 1, boxShadow: '0 2px 14px rgba(12,26,53,0.45)' }}>
                            {printing ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Preparing…</> : <><Download size={13} /> Download PDF</>}
                        </button>
                    </div>
                </div>
            </div>

            {/* DOCUMENT */}
            <div style={{ maxWidth: 800, margin: '28px auto', padding: '0 16px 72px' }}>
                <div className="rx-document" style={{ background: 'white', borderRadius: 18, overflow: 'hidden', boxShadow: '0 4px 48px rgba(0,0,0,0.14), 0 1px 4px rgba(0,0,0,0.06)' }}>

                    {/* ═══ LETTERHEAD ═══ */}
                    <div style={{ background: 'linear-gradient(160deg,#060F20 0%,#0C1A35 40%,#122040 100%)', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ height: 5, background: 'linear-gradient(90deg,#7D5A00,#C9A84C,#F5D080,#C9A84C,#7D5A00)' }} />
                        <div style={{ position: 'absolute', right: -10, top: -20, fontSize: 180, fontWeight: 800, color: 'rgba(201,168,76,0.05)', fontFamily: 'Georgia,serif', lineHeight: 1, userSelect: 'none' }}>℞</div>

                        <div className="rx-inner-pad rx-letterhead-row" style={{ paddingTop: 26 }}>

                            {/* LEFT — Doctor */}
                            <div style={{ flex: 1 }}>
                                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase', marginBottom: 10 }}>Medical Prescription</p>
                                <h1 style={{ fontFamily: "'Libre Baskerville',Georgia,serif", fontSize: 28, fontWeight: 700, color: 'white', lineHeight: 1.15, marginBottom: 6 }}>
                                    Dr. {rx.doctor_name}
                                </h1>
                                {rx.doctor_qualification && (
                                    <p style={{ fontSize: 13, color: '#93C5FD', fontWeight: 500, marginBottom: 8 }}>{rx.doctor_qualification}</p>
                                )}
                                {rx.doctor_registration_no ? (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.45)', borderRadius: 7, padding: '5px 12px' }}>
                                        <span style={{ fontSize: 8, color: '#C9A84C', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Reg. No.</span>
                                        <span style={{ fontSize: 12, color: '#FDE68A', fontWeight: 800, letterSpacing: '0.04em' }}>{rx.doctor_registration_no}</span>
                                    </div>
                                ) : (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 7, padding: '4px 10px' }}>
                                        <span style={{ fontSize: 9, color: '#FCA5A5', fontWeight: 700 }}>⚠ Registration number not set — add in Settings</span>
                                    </div>
                                )}
                            </div>

                            <div style={{ width: 1, alignSelf: 'stretch', minHeight: 95, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />

                            {/* RIGHT — Clinic */}
                            <div className="rx-clinic-col">
                                <p style={{ fontSize: 16, fontWeight: 700, color: '#E2E8F0', marginBottom: 8 }}>{rx.clinic_name}</p>
                                {rx.clinic_address && (
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', gap: 5, marginBottom: 5 }}>
                                        <p style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.6 }}>{rx.clinic_address}</p>
                                        <MapPin size={10} style={{ color: '#64748B', marginTop: 2, flexShrink: 0 }} />
                                    </div>
                                )}
                                {rx.clinic_phone && (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5, marginBottom: 3 }}>
                                        <p style={{ fontSize: 11, color: '#94A3B8' }}>{rx.clinic_phone}</p>
                                        <Phone size={10} style={{ color: '#64748B' }} />
                                    </div>
                                )}
                                {rx.clinic_email && (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                                        <p style={{ fontSize: 11, color: '#64748B' }}>{rx.clinic_email}</p>
                                        <Mail size={10} style={{ color: '#64748B' }} />
                                    </div>
                                )}
                            </div>
                        </div>
                        <div style={{ height: 24, marginTop: 22, background: 'white', borderRadius: '24px 24px 0 0' }} />
                    </div>

                    {/* ═══ PATIENT DETAILS ═══ */}
                    <div className="rx-inner-pad" style={{ paddingTop: 4, paddingBottom: 24, borderBottom: '2px solid #F1F5F9' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 9, padding: '6px 14px' }}>
                                <Calendar size={13} style={{ color: '#6366F1' }} />
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{date}</span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ fontSize: 10, color: '#CBD5E1', fontWeight: 600, letterSpacing: '0.06em' }}>Ref: {refId}</p>
                                <p style={{ fontSize: 9, color: '#E2E8F0', marginTop: 2 }}>Valid for 30 days from date of issue</p>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                            {/* Patient Name */}
                            <div style={{ background: 'linear-gradient(135deg,#F8FAFC,#F1F5F9)', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 14px' }}>
                                <p style={{ fontSize: 9, fontWeight: 800, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Patient Name</p>
                                <p style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', lineHeight: 1.2, marginBottom: 3 }}>{rx.patient_name}</p>
                                <p style={{ fontSize: 10, color: '#94A3B8' }}>{rx.patient_phone}</p>
                            </div>

                            {/* Age / Sex */}
                            <div style={{ background: 'linear-gradient(135deg,#F8FAFC,#F1F5F9)', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 14px' }}>
                                <p style={{ fontSize: 9, fontWeight: 800, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Age / Sex</p>
                                <p style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', lineHeight: 1.2, marginBottom: 3 }}>{rx.patient_age ? `${rx.patient_age} yrs` : '—'}</p>
                                <p style={{ fontSize: 10, color: '#64748B', textTransform: 'capitalize' }}>{rx.patient_gender ?? 'Not specified'}</p>
                            </div>

                            {/* Weight */}
                            <div style={{ background: 'linear-gradient(135deg,#F8FAFC,#F1F5F9)', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 14px' }}>
                                <p style={{ fontSize: 9, fontWeight: 800, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Weight</p>
                                <p style={{ fontSize: 16, fontWeight: 800, color: weight ? '#0F172A' : '#CBD5E1', lineHeight: 1.2, marginBottom: 3 }}>{weight ? `${weight} kg` : '—'}</p>
                                <p style={{ fontSize: 10, color: '#94A3B8' }}>At time of visit</p>
                            </div>

                            {/* Vitals or Address */}
                            {rx.vitals && (rx.vitals.bp_systolic || rx.vitals.heart_rate || rx.vitals.temperature_f) ? (
                                <div style={{ background: 'linear-gradient(135deg,#F0F9FF,#E0F2FE)', border: '1px solid #BAE6FD', borderRadius: 12, padding: '12px 14px' }}>
                                    <p style={{ fontSize: 9, fontWeight: 800, color: '#0284C7', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>Vitals</p>
                                    {rx.vitals.bp_systolic && <p style={{ fontSize: 11, fontWeight: 700, color: '#0C4A6E', marginBottom: 2 }}>BP: {rx.vitals.bp_systolic}/{rx.vitals.bp_diastolic} mmHg</p>}
                                    {rx.vitals.heart_rate && <p style={{ fontSize: 10, color: '#075985', marginBottom: 2 }}>HR: {rx.vitals.heart_rate} bpm</p>}
                                    {rx.vitals.temperature_f && <p style={{ fontSize: 10, color: '#075985' }}>Temp: {rx.vitals.temperature_f}°F</p>}
                                </div>
                            ) : rx.patient_address ? (
                                <div style={{ background: 'linear-gradient(135deg,#F8FAFC,#F1F5F9)', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 14px' }}>
                                    <p style={{ fontSize: 9, fontWeight: 800, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Address</p>
                                    <p style={{ fontSize: 11, color: '#334155', lineHeight: 1.55 }}>{rx.patient_address}</p>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    {/* ═══ DIAGNOSIS ═══ */}
                    <div className="rx-inner-pad" style={{ paddingTop: 18, paddingBottom: 18, borderBottom: '1px solid #F1F5F9' }}>
                        <div style={{ background: 'linear-gradient(135deg,#EEF2FF,#F5F3FF)', border: '1px solid #C7D2FE', borderLeft: '5px solid #3730A3', borderRadius: 12, padding: '14px 20px' }}>
                            <p style={{ fontSize: 9, fontWeight: 800, color: '#3730A3', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 5 }}>Provisional Diagnosis</p>
                            <p style={{ fontSize: 20, fontWeight: 800, color: '#1E1B4B', fontFamily: "'Libre Baskerville',Georgia,serif" }}>{rx.diagnosis}</p>
                        </div>
                    </div>

                    {/* ═══ Rx MEDICINES ═══ */}
                    <div className="rx-inner-pad" style={{ paddingTop: 20, paddingBottom: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
                            <div style={{ width: 56, height: 56, background: 'linear-gradient(135deg,#0C1A35,#1A3260)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 14px rgba(12,26,53,0.35)' }}>
                                <span style={{ color: '#C9A84C', fontSize: 28, fontFamily: "'Libre Baskerville',Georgia,serif", lineHeight: 1, fontWeight: 700 }}>℞</span>
                            </div>
                            <div>
                                <p style={{ fontSize: 14, fontWeight: 800, color: '#0C1A35', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Prescription</p>
                                <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{rx.medicines.length} medicine{rx.medicines.length !== 1 ? 's' : ''} · {date}</p>
                            </div>
                        </div>

                        {/* Table header */}
                        <div className="rx-med-grid" style={{ padding: '8px 16px', background: 'linear-gradient(135deg,#0C1A35,#1A3260)', borderRadius: '10px 10px 0 0' }}>
                            <p style={{ fontSize: 9, fontWeight: 800, color: '#93C5FD', textTransform: 'uppercase', letterSpacing: '0.1em' }}>#</p>
                            <p style={{ fontSize: 9, fontWeight: 800, color: '#93C5FD', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Medicine / Details</p>
                            <p className="rx-col-timing" style={{ fontSize: 9, fontWeight: 800, color: '#93C5FD', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Timing</p>
                            <p className="rx-col-duration" style={{ fontSize: 9, fontWeight: 800, color: '#93C5FD', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Duration</p>
                            <p className="rx-col-qty" style={{ fontSize: 9, fontWeight: 800, color: '#93C5FD', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Qty</p>
                        </div>

                        {rx.medicines.map((med, i) => {
                            const qty = calcQty(med.timing as [number, number, number], med.duration_value, med.duration_unit)
                            return (
                                <div key={i} className="rx-med-grid" style={{ padding: '14px 16px', background: i % 2 === 0 ? '#F8FAFF' : 'white', borderBottom: '1px solid #F1F5F9', alignItems: 'start' }}>
                                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#0C1A35', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                                        <span style={{ color: 'white', fontSize: 10, fontWeight: 800 }}>{i + 1}</span>
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                                            <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', fontFamily: "'Libre Baskerville',Georgia,serif" }}>{med.medicine_name}</span>
                                            {med.strength && <span style={{ fontSize: 10, color: '#475569', background: '#E2E8F0', padding: '2px 8px', borderRadius: 100, fontWeight: 700 }}>{med.strength}</span>}
                                            {med.form && <span style={{ fontSize: 10, color: '#1D4ED8', background: '#DBEAFE', padding: '2px 8px', borderRadius: 100, fontWeight: 700, textTransform: 'capitalize' }}>{med.form}</span>}
                                        </div>
                                        {med.generic_name && <p style={{ fontSize: 10, color: '#94A3B8', marginBottom: 3 }}>Generic: <span style={{ fontWeight: 600, color: '#64748B' }}>{med.generic_name}</span></p>}
                                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 2 }}>
                                            <span style={{ fontSize: 10, color: '#64748B' }}>🍽 {foodLabel(med.food_relation)}</span>
                                            {med.instructions && <span style={{ fontSize: 10, color: '#6366F1', fontStyle: 'italic' }}>ℹ {med.instructions}</span>}
                                        </div>
                                    </div>
                                    <div className="rx-col-timing">
                                        <p style={{ fontSize: 14, fontWeight: 800, color: '#0C1A35', letterSpacing: '0.06em', marginBottom: 3 }}>{med.timing[0]}-{med.timing[1]}-{med.timing[2]}</p>
                                        <p style={{ fontSize: 9, color: '#64748B', lineHeight: 1.5 }}>{timingLabel(med.timing as [number, number, number])}</p>
                                    </div>
                                    <p className="rx-col-duration" style={{ fontSize: 12, fontWeight: 700, color: '#334155', paddingTop: 3 }}>{med.duration_value} {med.duration_unit}</p>
                                    <div className="rx-col-qty" style={{ paddingTop: 3 }}>
                                        <p style={{ fontSize: 12, fontWeight: 800, color: '#0C1A35' }}>{qty > 0 ? qty : '—'}</p>
                                        {qty > 0 && <p style={{ fontSize: 9, color: '#94A3B8' }}>units</p>}
                                    </div>
                                </div>
                            )
                        })}

                        <div style={{ height: 4, background: 'linear-gradient(135deg,#0C1A35,#1A3260)', borderRadius: '0 0 8px 8px' }} />
                    </div>

                    {/* ═══ DOCTOR NOTES ═══ */}
                    {rx.doctor_notes && (
                        <div className="rx-inner-pad" style={{ paddingTop: 0, paddingBottom: 24 }}>
                            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderLeft: '4px solid #F59E0B', borderRadius: 12, padding: '14px 18px' }}>
                                <p style={{ fontSize: 9, fontWeight: 800, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>📝 Doctor's Instructions</p>
                                <p style={{ fontSize: 13, color: '#78350F', lineHeight: 1.75 }}>{rx.doctor_notes}</p>
                            </div>
                        </div>
                    )}

                    {/* ═══ SIGNATURE + RUBBER STAMP ═══ */}
                    <div className="rx-inner-pad rx-sig-row" style={{ paddingTop: 22, paddingBottom: 30, borderTop: '1px dashed #CBD5E1' }}>
                        <div>
                            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 16px', marginBottom: 12, maxWidth: 260 }}>
                                <p style={{ fontSize: 10, fontWeight: 600, color: '#475569', lineHeight: 1.9 }}>
                                    ✔ Digitally issued prescription<br />
                                    ✔ Valid 30 days from date of issue<br />
                                    ✔ Present to your pharmacist
                                </p>
                            </div>
                            {rx.fee_collected > 0 && (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 9, padding: '6px 14px' }}>
                                    <span style={{ fontSize: 12, fontWeight: 800, color: '#15803D' }}>Fee: Rs.{rx.fee_collected.toLocaleString('en-IN')}</span>
                                    <span style={{ fontSize: 10, color: '#86EFAC' }}>({rx.payment_method})</span>
                                </div>
                            )}
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            {rx.doctor_signature_base64 ? (
                                <img
                                    src={`data:image/png;base64,${rx.doctor_signature_base64}`}
                                    alt="Doctor's signature"
                                    style={{ height: 72, maxWidth: 220, objectFit: 'contain', objectPosition: 'right bottom', display: 'block', marginLeft: 'auto', marginBottom: 12, filter: 'contrast(1.5) brightness(0.75)' }}
                                />
                            ) : (
                                <div style={{ height: 52, width: 200, marginLeft: 'auto', marginBottom: 12, borderBottom: '2px solid #94A3B8', position: 'relative' }}>
                                    <span style={{ position: 'absolute', bottom: 4, right: 0, fontSize: 9, color: '#CBD5E1' }}>Signature</span>
                                </div>
                            )}
                            {/* Rubber stamp */}
                            <div className="rx-stamp">
                                <p style={{ fontSize: 12, fontWeight: 800, color: '#0C1A35', marginBottom: 2 }}>Dr. {rx.doctor_name}</p>
                                {rx.doctor_qualification && <p style={{ fontSize: 9, color: '#334155', letterSpacing: '0.05em', marginBottom: 2 }}>{rx.doctor_qualification}</p>}
                                {rx.doctor_registration_no && <p style={{ fontSize: 9, color: '#0C1A35', fontWeight: 800, letterSpacing: '0.08em', marginBottom: 2 }}>Reg: {rx.doctor_registration_no}</p>}
                                <p style={{ fontSize: 9, color: '#64748B' }}>{rx.clinic_name}</p>
                            </div>
                        </div>
                    </div>

                    {/* ═══ FOOTER ═══ */}
                    <div className="rx-inner-pad" style={{ background: '#060F20', paddingTop: 12, paddingBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 26, height: 26, background: 'linear-gradient(135deg,#4338CA,#7C3AED)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ color: 'white', fontSize: 11, fontWeight: 800, fontFamily: 'Georgia,serif' }}>℞</span>
                            </div>
                            <span style={{ color: '#93C5FD', fontSize: 12, fontWeight: 700 }}>ClinicOS</span>
                            <span style={{ color: '#4F46E5', fontSize: 11 }}>⚡</span>
                            <span style={{ color: '#1E2D50', fontSize: 10 }}>Powered by ClinicOS</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ color: '#4338CA', fontSize: 10 }}>clinicos-system.vercel.app</p>
                            <p style={{ color: '#1A2645', fontSize: 9, marginTop: 2 }}>Digital prescription · {date}</p>
                        </div>
                    </div>
                </div>

                {/* Verified badge */}
                <div className="no-print" style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 24px', background: '#F0FDF4', borderRadius: 14, border: '1px solid #BBF7D0' }}>
                    <CheckCircle size={15} style={{ color: '#22C55E' }} />
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#15803D' }}>Authentic prescription issued by {rx.clinic_name} · Verified via ClinicOS</p>
                </div>
            </div>
        </>
    )
}