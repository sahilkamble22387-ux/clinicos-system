import { generatePrescriptionPDF } from './prescriptionPDF'
import toast from 'react-hot-toast'

export interface PrescriptionForWhatsApp {
    // Clinic
    clinicName: string
    doctorName: string
    doctorQualification?: string | null
    doctorRegistrationNo?: string | null
    clinicAddress: string | null
    clinicPhone: string | null
    clinicEmail?: string | null
    doctorSignatureBase64?: string | null

    // Patient
    patientName: string
    patientPhone: string
    patientAge: string | null
    patientGender: string | null

    // Consultation
    diagnosis: string
    medicines: {
        medicine_name: string
        strength: string | null
        form: string | null
        dosage: string                    // e.g. "1-0-1"
        timing_meaning?: string | null    // e.g. "Morning & Night"
        food_relation?: string | null     // e.g. "after", "before", "with", "any"
        duration: string                  // e.g. "5 days"
        instructions: string | null
    }[]
    doctorNotes: string | null
    feeCollected: number
    paymentMethod: string
    date: string
    recordId: string
}

// ── METHOD A: Download PDF to device ──────────────────────────────
export async function downloadPrescriptionAndPrompt(
    data: PrescriptionForWhatsApp
): Promise<void> {
    const loadingToast = toast.loading('Generating prescription PDF...')

    try {
        const blob = await generatePrescriptionPDF(data)

        if (!blob || blob.size < 100) {
            throw new Error('PDF generation failed — file is empty. Check jsPDF setup.')
        }

        // Create download link
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `Rx_${data.patientName.replace(/\s+/g, '_')}_${data.date.replace(/[\s,]/g, '_')}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 8000)

        toast.dismiss(loadingToast)
        toast.success('PDF downloaded! Share it via WhatsApp from your Files app.', { duration: 5000 })

    } catch (err: any) {
        toast.dismiss(loadingToast)
        console.error('[Prescription PDF] Error:', err)
        toast.error('PDF failed: ' + (err.message ?? 'Unknown error'))
        throw err
    }
}

// ── Helper: human-readable food label ──────────────────────────────
function foodLabel(food: string | null | undefined): string | null {
    if (!food) return null
    return ({ before: 'Before food', after: 'After food', with: 'With food', any: 'Anytime' } as Record<string, string>)[food] ?? food
}

// ── METHOD B: Open WhatsApp with formatted text prescription ───────
export function sendPrescriptionTextWhatsApp(data: PrescriptionForWhatsApp): void {
    // Format phone number for wa.me
    let phone = data.patientPhone.replace(/\D/g, '')
    if (phone.startsWith('0')) phone = phone.slice(1)
    if (!phone.startsWith('91')) phone = `91${phone}`

    // Build formatted prescription text
    const divider = '─────────────────────'

    const medicineLines = data.medicines.map((m, i) => {
        const food = foodLabel(m.food_relation)
        const meaning = m.timing_meaning ? `(${m.timing_meaning})` : null
        const infoParts = [m.dosage, meaning, food, m.duration].filter(Boolean).join(' — ')

        return (
            `*${i + 1}. ${m.medicine_name}*${m.strength ? ` ${m.strength}` : ''}${m.form ? ` ${m.form}` : ''}\n` +
            `   ${infoParts}` +
            (m.instructions ? `\n   📌 ${m.instructions}` : '')
        )
    }).join('\n\n')

    const message = [
        `🏥 *${data.clinicName}*`,
        data.clinicAddress ? `📍 ${data.clinicAddress}` : null,
        data.clinicPhone ? `📞 ${data.clinicPhone}` : null,
        data.clinicEmail ? `✉️ ${data.clinicEmail}` : null,
        '',
        divider,
        `📋 *PRESCRIPTION*`,
        divider,
        '',
        `👤 *Patient:* ${data.patientName}`,
        data.patientAge ? `🎂 *Age:* ${data.patientAge} yrs` : null,
        data.patientGender ? `🧬 *Gender:* ${data.patientGender}` : null,
        `📅 *Date:* ${data.date}`,
        '',
        `🔬 *Diagnosis:* ${data.diagnosis}`,
        '',
        `💊 *Medicines:*`,
        medicineLines,
        '',
        data.doctorNotes ? `📝 *Doctor's Notes:* ${data.doctorNotes}\n` : null,
        divider,
        `💰 *Fee:* ₹${data.feeCollected.toLocaleString('en-IN')} (${data.paymentMethod})`,
        divider,
        '',
        `👨‍⚕️ *Dr. ${data.doctorName}*`,
        data.doctorQualification ? `   ${data.doctorQualification}` : null,
        data.doctorRegistrationNo ? `   Reg. No. ${data.doctorRegistrationNo}` : null,
        '',
        `_Ref: ${data.recordId.slice(0, 8).toUpperCase()}_`,
        `_Sent via ClinicOS · clinicos-system.vercel.app_`,
    ]
        .filter(line => line !== null)
        .join('\n')

    const encoded = encodeURIComponent(message)
    const whatsappUrl = `https://wa.me/${phone}?text=${encoded}`

    console.log('[WhatsApp] Opening URL for phone:', phone)
    console.log('[WhatsApp] Message length:', message.length, 'chars')

    const win = window.open(whatsappUrl, '_blank')

    if (!win) {
        // Popup blocked — copy link to clipboard as fallback
        navigator.clipboard.writeText(whatsappUrl).catch(() => { })
        toast.error(
            'Popup blocked by browser. The WhatsApp link has been copied to clipboard.',
            { duration: 6000 }
        )
    } else {
        toast.success(`WhatsApp opened for ${data.patientName}`)
    }
}
