import { supabase } from './db'
import { generatePrescriptionPDF } from './prescriptionPDF'
import toast from 'react-hot-toast'

interface SendPrescriptionOptions {
    medicalRecordId: string
    patientId: string
    clinicId: string
    patientPhone: string
    patientName: string
    doctorName: string
    clinicName: string
    clinicAddress: string | null
    clinicPhone: string | null
    patientAge: string | null
    patientGender: string | null
    diagnosis: string
    medicines: any[]
    doctorNotes: string | null
}

export async function sendPrescriptionWhatsApp(
    opts: SendPrescriptionOptions
): Promise<{ success: boolean; pdfUrl?: string; error?: string }> {

    try {
        // ── STEP 1: Generate PDF ──
        console.log('[Prescription] Generating PDF...')
        const pdfBlob = await generatePrescriptionPDF({
            clinicName: opts.clinicName,
            doctorName: opts.doctorName,
            clinicAddress: opts.clinicAddress,
            clinicPhone: opts.clinicPhone,
            patientName: opts.patientName,
            patientPhone: opts.patientPhone,
            patientAge: opts.patientAge,
            patientGender: opts.patientGender,
            diagnosis: opts.diagnosis,
            medicines: opts.medicines,
            doctorNotes: opts.doctorNotes,
            date: new Date().toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric'
            }),
            recordId: opts.medicalRecordId,
        })

        if (!pdfBlob || pdfBlob.size === 0) {
            throw new Error('PDF generation failed — blob is empty')
        }
        console.log('[Prescription] PDF generated, size:', pdfBlob.size, 'bytes')

        // ── STEP 2: Convert Blob to File (required by Supabase Storage) ──
        const fileName = `rx_${opts.medicalRecordId.slice(0, 8)}_${Date.now()}.pdf`
        const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' })

        // ── STEP 3: Upload to Supabase Storage ──
        const storagePath = `${opts.clinicId}/${opts.patientId}/${fileName}`
        console.log('[Prescription] Uploading to Storage path:', storagePath)

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('prescriptions')
            .upload(storagePath, pdfFile, {
                contentType: 'application/pdf',
                upsert: true,
                cacheControl: '3600',
            })

        if (uploadError) {
            console.error('[Prescription] Upload error:', uploadError)

            // If bucket doesn't exist, give a clear error:
            if (uploadError.message.includes('Bucket not found') ||
                uploadError.message.includes('bucket')) {
                throw new Error(
                    'Storage bucket "prescriptions" not found. ' +
                    'Go to Supabase Dashboard → Storage → New Bucket → Name: prescriptions → Public: YES'
                )
            }
            throw new Error(`Upload failed: ${uploadError.message}`)
        }

        console.log('[Prescription] Uploaded:', uploadData?.path)

        // ── STEP 4: Get public URL ──
        const { data: urlData } = supabase.storage
            .from('prescriptions')
            .getPublicUrl(storagePath)

        const pdfUrl = urlData?.publicUrl

        if (!pdfUrl) {
            throw new Error(
                'Could not get public URL. Make sure the "prescriptions" bucket is set to PUBLIC in Supabase Storage.'
            )
        }

        console.log('[Prescription] Public URL:', pdfUrl)

        // ── STEP 5: Save PDF record to database ──
        const { error: dbError } = await supabase
            .from('prescription_pdfs')
            .insert({
                medical_record_id: opts.medicalRecordId,
                patient_id: opts.patientId,
                clinic_id: opts.clinicId,
                pdf_url: pdfUrl,
                pdf_path: storagePath,
                whatsapp_sent: true,
                whatsapp_sent_at: new Date().toISOString(),
            })

        if (dbError) {
            // Non-fatal — log but continue (WhatsApp is more important)
            console.warn('[Prescription] DB insert warning:', dbError.message)
        }

        // ── STEP 6: Format phone number for wa.me ──
        // Remove all non-digits, then ensure it starts with 91
        let phone = opts.patientPhone.replace(/\D/g, '')
        if (phone.startsWith('0')) phone = phone.slice(1)         // remove leading 0
        if (!phone.startsWith('91')) phone = `91${phone}`        // add India country code
        if (phone.length !== 12) {
            // Phone number is malformed — warn but continue
            console.warn('[Prescription] Phone number may be malformed:', phone)
        }

        // ── STEP 7: Build WhatsApp message ──
        const message = encodeURIComponent(
            `Hello ${opts.patientName} 👋\n\n` +
            `Your prescription from *${opts.doctorName}* at *${opts.clinicName}* is ready.\n\n` +
            `📄 *Download Prescription:*\n${pdfUrl}\n\n` +
            `🗓 Date: ${new Date().toLocaleDateString('en-IN')}\n` +
            `🔬 Diagnosis: ${opts.diagnosis}\n\n` +
            `Get well soon! 💊\n` +
            `_Sent via ClinicOS_`
        )

        const whatsappUrl = `https://wa.me/${phone}?text=${message}`
        console.log('[Prescription] Opening WhatsApp:', whatsappUrl)

        // ── STEP 8: Open WhatsApp ──
        const win = window.open(whatsappUrl, '_blank')
        if (!win) {
            // Popup blocked — give user the link to copy
            toast.error(
                'Popup was blocked. Copy this link and open WhatsApp manually.',
                { duration: 8000 }
            )
            console.warn('[Prescription] Window popup blocked. URL:', whatsappUrl)
        }

        return { success: true, pdfUrl }

    } catch (err: any) {
        console.error('[Prescription] Error:', err)
        toast.error(err.message ?? 'Prescription sending failed. Check console.')
        return { success: false, error: err.message }
    }
}
