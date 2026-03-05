import { supabase } from './db'
import { PrescriptionLine } from '../components/PrescriptionForm'
import toast from 'react-hot-toast'

const SITE_URL = import.meta.env.VITE_SITE_URL ?? 'https://clinicos-system.vercel.app'

export interface SavePrescriptionInput {
    // Auth
    clinicId: string

    // Patient
    patientId: string
    patientName: string
    patientPhone: string
    patientAge?: string | null
    patientGender?: string | null

    // Clinic snapshot (fetched at call time so it's denormalized)
    clinicName: string
    doctorName: string
    doctorQualification?: string | null
    doctorRegistrationNo?: string | null
    clinicAddress?: string | null
    clinicPhone?: string | null
    doctorSignatureBase64?: string | null

    // Consultation
    medicalRecordId?: string | null
    diagnosis: string
    doctorNotes?: string | null
    feeCollected: number
    paymentMethod: string
    medicines: PrescriptionLine[]
    vitals?: {
        bp_systolic?: number | null
        bp_diastolic?: number | null
        heart_rate?: number | null
        weight_kg?: number | null
        temperature_f?: number | null
    } | null
}

export interface SavePrescriptionResult {
    success: boolean
    prescriptionId?: string
    publicUrl?: string
    error?: string
}

export async function savePrescriptionAndGetLink(
    input: SavePrescriptionInput
): Promise<SavePrescriptionResult> {
    try {
        // Transform PrescriptionLine → JSON for DB
        const medicinesJson = input.medicines.map(m => ({
            medicine_id: m.medicine_id,
            medicine_name: m.medicine_name,
            generic_name: m.generic_name,
            strength: m.strength,
            form: m.form,
            timing: m.timing,              // [1,0,1]
            food_relation: m.food_relation,
            duration_value: m.duration_value,
            duration_unit: m.duration_unit,
            instructions: m.instructions,
        }))

        const { data, error } = await supabase
            .from('prescriptions')
            .insert({
                clinic_id: input.clinicId,
                patient_id: input.patientId,
                medical_record_id: input.medicalRecordId ?? null,

                // Patient snapshot
                patient_name: input.patientName,
                patient_phone: input.patientPhone,
                patient_age: input.patientAge ?? null,
                patient_gender: input.patientGender ?? null,

                // Clinic snapshot
                clinic_name: input.clinicName,
                doctor_name: input.doctorName,
                doctor_qualification: input.doctorQualification ?? null,
                doctor_registration_no: input.doctorRegistrationNo ?? null,
                clinic_address: input.clinicAddress ?? null,
                clinic_phone: input.clinicPhone ?? null,
                doctor_signature_base64: input.doctorSignatureBase64 ?? null,

                // Consultation
                diagnosis: input.diagnosis,
                doctor_notes: input.doctorNotes ?? null,
                fee_collected: input.feeCollected,
                payment_method: input.paymentMethod,
                medicines: medicinesJson,
                vitals: input.vitals ?? null,
            })
            .select('id')
            .single()

        if (error || !data) {
            throw new Error(error?.message ?? 'Prescription insert failed')
        }

        const publicUrl = `${SITE_URL}/rx/${data.id}`
        return { success: true, prescriptionId: data.id, publicUrl }

    } catch (err: any) {
        console.error('[PrescriptionService]', err)
        return { success: false, error: err.message }
    }
}

export function openWhatsAppWithPrescription(
    patientPhone: string,
    patientName: string,
    clinicName: string,
    doctorName: string,
    publicUrl: string
): void {
    let phone = patientPhone.replace(/\D/g, '')
    if (phone.startsWith('0')) phone = phone.slice(1)
    if (!phone.startsWith('91')) phone = `91${phone}`

    const msg = encodeURIComponent(
        `Hello ${patientName} 👋\n\n` +
        `Your digital prescription from *Dr. ${doctorName}* at *${clinicName}* is ready.\n\n` +
        `🔗 View & Download Prescription:\n${publicUrl}\n\n` +
        `This link contains your diagnosis, medicines, and dosage instructions.\n` +
        `You can download it as a PDF directly from the link.\n\n` +
        `Get well soon! 💊\n` +
        `_Sent via ClinicOS_`
    )

    const url = `https://wa.me/${phone}?text=${msg}`
    const win = window.open(url, '_blank')

    if (!win) {
        navigator.clipboard.writeText(url).catch(() => { })
        toast.error('Popup blocked — WhatsApp link copied to clipboard', { duration: 5000 })
    }
}
