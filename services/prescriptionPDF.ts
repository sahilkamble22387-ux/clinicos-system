import jsPDF from 'jspdf'

export interface PrescriptionLine {
    medicine_name: string
    generic_name?: string | null
    strength: string
    form: string
    timing?: [number, number, number]
    food_relation?: string
    duration_value?: number
    duration_unit?: string
    dosage?: string
    duration?: string
    instructions: string
}

export interface PrescriptionData {
    clinicName: string
    doctorName: string
    doctorQualification?: string | null
    doctorRegistrationNo?: string | null
    clinicAddress: string | null
    clinicPhone: string | null
    clinicEmail?: string | null
    doctorSignatureBase64?: string | null
    clinicLogoBase64?: string | null
    patientName: string
    patientPhone: string
    patientAge: string | null
    patientGender: string | null
    patientWeight?: string | null
    patientAddress?: string | null
    diagnosis: string
    medicines: PrescriptionLine[]
    doctorNotes: string | null
    date: string
    recordId: string
    vitals?: {
        bp_systolic?: number | null
        bp_diastolic?: number | null
        heart_rate?: number | null
        weight_kg?: number | null
        temperature_f?: number | null
    } | null
}

type RGB = [number, number, number]

// ── Color palette ─────────────────────────────────────────────────────────────
const C = {
    navy: [10, 25, 60] as RGB,
    teal: [13, 183, 154] as RGB,
    lightBg: [245, 248, 252] as RGB,
    white: [255, 255, 255] as RGB,
    border: [220, 228, 240] as RGB,
    muted: [100, 110, 130] as RGB,
    headerMuted: [160, 185, 210] as RGB,
    foodBefore: [239, 68, 68] as RGB,
    foodWith: [245, 158, 11] as RGB,
    foodAfter: [16, 185, 129] as RGB,
    amber: [245, 158, 11] as RGB,
    amberDark: [180, 83, 9] as RGB,
    amberPale: [255, 243, 205] as RGB,
    dxBg: [240, 253, 250] as RGB,
    badgeBg: [235, 242, 255] as RGB,
    oddRow: [248, 251, 255] as RGB,
    sigLine: [180, 190, 210] as RGB,
}

// ── Page geometry ─────────────────────────────────────────────────────────────
const W = 210          // A4 width mm
const H = 297          // A4 height mm
const M = 14           // margin mm
const COL_W = W - M * 2

// Column stops
const COL_NUM = M + 3
const COL_NAME = M + 12
const COL_TIMING = W - 55
const COL_DUR = W - 28

// ── Helpers ───────────────────────────────────────────────────────────────────
function filled(doc: jsPDF, x: number, y: number, w: number, h: number, color: RGB, r = 0) {
    doc.setFillColor(...color)
    r > 0 ? doc.roundedRect(x, y, w, h, r, r, 'F') : doc.rect(x, y, w, h, 'F')
}

function filledStroke(doc: jsPDF, x: number, y: number, w: number, h: number,
    fill: RGB, stroke: RGB, lw: number, r = 0) {
    doc.setFillColor(...fill)
    doc.setDrawColor(...stroke)
    doc.setLineWidth(lw)
    r > 0 ? doc.roundedRect(x, y, w, h, r, r, 'FD') : doc.rect(x, y, w, h, 'FD')
}

function timingDots(t?: [number, number, number]): string {
    if (!t) return ''
    return `${t[0]}-${t[1]}-${t[2]}`
}

function timingLabel(t?: [number, number, number]): string {
    if (!t) return ''
    const parts: string[] = []
    if (t[0]) parts.push('Morning')
    if (t[1]) parts.push('Afternoon')
    if (t[2]) parts.push('Night')
    return parts.length ? parts.join(' + ') : 'As needed'
}

function foodColor(rel?: string): RGB | null {
    if (!rel) return null
    const lower = rel.toLowerCase()
    if (lower.includes('before')) return C.foodBefore
    if (lower.includes('with')) return C.foodWith
    if (lower.includes('after')) return C.foodAfter
    return C.muted
}

function foodLabel(rel?: string): string {
    if (!rel) return ''
    const lower = rel.toLowerCase()
    if (lower.includes('before')) return 'Before food'
    if (lower.includes('with')) return 'With food'
    if (lower.includes('after')) return 'After food'
    return rel
}

// ── MAIN RENDERER ─────────────────────────────────────────────────────────────
function render(doc: jsPDF, data: PrescriptionData): void {
    let y = 0

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. HEADER BAND (0 → 38mm)
    // ═══════════════════════════════════════════════════════════════════════════
    filled(doc, 0, 0, W, 38, C.navy)
    filled(doc, 0, 0, 4, 38, C.teal)

    // Left: clinic info
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...C.white)
    doc.text(data.clinicName, M + 4, 13)

    if (data.clinicAddress) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(...C.headerMuted)
        doc.text(data.clinicAddress, M + 4, 19)
    }
    if (data.clinicPhone) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(...C.headerMuted)
        doc.text(`\u260E  ${data.clinicPhone}`, M + 4, 24.5)
    }

    // Right: doctor info
    const rx = W - M
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...C.white)
    doc.text(`Dr. ${data.doctorName}`, rx, 13, { align: 'right' })

    if (data.doctorQualification) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(...C.teal)
        doc.text(data.doctorQualification, rx, 19, { align: 'right' })
    }
    if (data.doctorRegistrationNo) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(...C.headerMuted)
        doc.text(`Reg. No. ${data.doctorRegistrationNo}`, rx, 24.5, { align: 'right' })
    }

    y = 38

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. DATE + RX ID STRIP (10mm)
    // ═══════════════════════════════════════════════════════════════════════════
    filled(doc, 0, y, W, 10, C.lightBg)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...C.muted)
    doc.text(`Date: ${data.date}`, M, y + 6.5)

    const rxId = `Rx-${data.recordId.slice(0, 8).toUpperCase()}`
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...C.teal)
    doc.text(rxId, rx, y + 6.5, { align: 'right' })

    y += 10

    // gap
    y += 8

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. PATIENT CARD (22mm)
    // ═══════════════════════════════════════════════════════════════════════════
    filledStroke(doc, M, y, COL_W, 22, C.white, C.border, 0.3, 2)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...C.teal)
    doc.text('PATIENT', M + 5, y + 6)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...C.navy)
    doc.text(data.patientName, M + 5, y + 13)

    const meta = [
        data.patientAge ? `Age ${data.patientAge} yrs` : '',
        data.patientGender ?? '',
        data.patientPhone,
    ].filter(Boolean)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...C.muted)
    doc.text(meta.join('  \xb7  '), M + 5, y + 19)

    y += 28

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. DIAGNOSIS CARD (18mm)
    // ═══════════════════════════════════════════════════════════════════════════
    filledStroke(doc, M, y, COL_W, 18, C.dxBg, C.teal, 0.4, 2)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...C.teal)
    doc.text('DIAGNOSIS / CHIEF COMPLAINT', M + 5, y + 6)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...C.navy)
    const dxText = data.diagnosis || 'General Consultation'
    const dxLines = doc.splitTextToSize(dxText, COL_W - 10)
    doc.text(dxLines, M + 5, y + 14)

    y += 24

    // ═══════════════════════════════════════════════════════════════════════════
    // 5. PRESCRIPTION SECTION HEADER (~18mm)
    // ═══════════════════════════════════════════════════════════════════════════
    // Rx symbol
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.setTextColor(...C.teal)
    doc.text('\u211E', M, y + 8)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...C.navy)
    doc.text('PRESCRIPTION', M + 10, y + 6)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...C.muted)
    doc.text(
        `${data.medicines.length} medicine${data.medicines.length !== 1 ? 's' : ''}  \xb7  ${data.date}`,
        M + 10, y + 12
    )

    // Food legend (right side)
    const legendItems: { color: RGB; label: string }[] = [
        { color: C.foodBefore, label: 'Before' },
        { color: C.foodWith, label: 'With' },
        { color: C.foodAfter, label: 'After' },
    ]
    const legendStartX = W - M - 70
    legendItems.forEach((item, idx) => {
        const ix = legendStartX + idx * 25
        doc.setFillColor(...item.color)
        doc.circle(ix + 1.8, y + 5.8, 1.8, 'F')
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6.5)
        doc.setTextColor(...C.muted)
        doc.text(item.label, ix + 5, y + 6.5)
    })

    y += 18

    // ═══════════════════════════════════════════════════════════════════════════
    // 6. TABLE HEADER ROW (8mm)
    // ═══════════════════════════════════════════════════════════════════════════
    filled(doc, M, y, COL_W, 8, C.navy)

    const headerY = y + 5.5
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)

    doc.setTextColor(...C.teal)
    doc.text('#', COL_NUM, headerY)

    doc.setTextColor(...C.white)
    doc.text('MEDICINE', COL_NAME, headerY)
    doc.text('TIMING', COL_TIMING, headerY)
    doc.text('DURATION', COL_DUR, headerY)

    y += 8

    // ═══════════════════════════════════════════════════════════════════════════
    // 7. MEDICINE ROWS (20mm each)
    // ═══════════════════════════════════════════════════════════════════════════
    const ROW_H = 20
    const medCount = data.medicines.length

    if (medCount > 0) {
        data.medicines.forEach((med, i) => {
            const isOdd = i % 2 !== 0
            const isLast = i === medCount - 1
            const rowY = y

            // Row background
            const bgColor = isOdd ? C.oddRow : C.white
            if (isLast) {
                // last row: rounded bottom
                doc.setFillColor(...bgColor)
                doc.setDrawColor(...C.border)
                doc.setLineWidth(0.2)
                doc.roundedRect(M, rowY, COL_W, ROW_H, 0, 0, 'FD')
            } else {
                doc.setFillColor(...bgColor)
                doc.setDrawColor(...C.border)
                doc.setLineWidth(0.2)
                doc.rect(M, rowY, COL_W, ROW_H, 'FD')
            }

            // ── Number badge (circle) ────────────────────────────────────────
            const circleX = COL_NUM + 2.5
            const circleY = rowY + 10
            doc.setFillColor(...C.navy)
            doc.circle(circleX, circleY, 4, 'F')
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(7)
            doc.setTextColor(...C.white)
            const numStr = `${i + 1}`
            const numW = doc.getTextWidth(numStr)
            doc.text(numStr, circleX - numW / 2, circleY + 2.5)

            // ── Medicine name ────────────────────────────────────────────────
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(9.5)
            doc.setTextColor(...C.navy)
            doc.text(med.medicine_name, COL_NAME, rowY + 8)

            // ── Dose badge / warning ─────────────────────────────────────────
            const doseText = med.strength || med.dosage || '\u2014'
            const hasDose = doseText !== '\u2014' && doseText.trim() !== ''
            let badgeX = COL_NAME

            if (hasDose) {
                // Dose badge
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(6.5)
                const dw = doc.getTextWidth(doseText) + 4
                filledStroke(doc, badgeX, rowY + 10, dw, 5, C.badgeBg, C.teal, 0.3, 1)
                doc.setTextColor(10, 120, 100)
                doc.text(doseText, badgeX + 2, rowY + 13.8)
                badgeX += dw + 2
            } else {
                // Amber warning badge for missing dose
                const warnText = '\u26A0 Dose not specified'
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(6.5)
                const ww = doc.getTextWidth(warnText) + 4
                filledStroke(doc, badgeX, rowY + 10, ww, 5, C.amberPale, C.amber, 0.3, 1)
                doc.setTextColor(...C.amberDark)
                doc.text(warnText, badgeX + 2, rowY + 13.8)
                badgeX += ww + 2
            }

            // Form badge
            if (med.form) {
                const formLabel = med.form.charAt(0).toUpperCase() + med.form.slice(1)
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(6.5)
                const fw = doc.getTextWidth(formLabel) + 4
                filledStroke(doc, badgeX, rowY + 10, fw, 5, C.badgeBg, C.teal, 0.3, 1)
                doc.setTextColor(10, 120, 100)
                doc.text(formLabel, badgeX + 2, rowY + 13.8)
            }

            // ── Food indicator ───────────────────────────────────────────────
            const fc = foodColor(med.food_relation)
            if (fc) {
                doc.setFillColor(...fc)
                doc.circle(COL_NAME + 1.5, rowY + 17.5, 1.5, 'F')
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(6.5)
                doc.setTextColor(...C.muted)
                doc.text(foodLabel(med.food_relation), COL_NAME + 4, rowY + 18)
            }

            // ── Timing column ────────────────────────────────────────────────
            const dots = med.timing ? timingDots(med.timing) : (med.dosage || 'As prescribed')
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(8.5)
            doc.setTextColor(...C.navy)
            doc.text(dots, COL_TIMING, rowY + 8)

            const meaning = med.timing ? timingLabel(med.timing) : ''
            if (meaning) {
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(6.5)
                doc.setTextColor(...C.muted)
                doc.text(meaning, COL_TIMING, rowY + 14)
            }

            // ── Duration column ──────────────────────────────────────────────
            const durText = med.duration_value
                ? `${med.duration_value} ${med.duration_unit ?? ''}`
                : (med.duration || '')

            if (durText) {
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(9)
                doc.setTextColor(...C.teal)
                doc.text(durText, COL_DUR, rowY + 10)
            }

            y += ROW_H
        })
    } else {
        filled(doc, M, y, COL_W, 20, C.lightBg)
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(8)
        doc.setTextColor(...C.muted)
        doc.text('No medicines prescribed', COL_NAME, y + 10)
        y += 20
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 8. DOCTOR NOTES (optional — before validity strip)
    // ═══════════════════════════════════════════════════════════════════════════
    if (data.doctorNotes) {
        y += 4
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        const noteLines = doc.splitTextToSize(data.doctorNotes, COL_W - 16)
        const noteH = Math.max(16, noteLines.length * 4 + 14)

        filledStroke(doc, M, y, COL_W, noteH, C.amberPale, C.amber, 0.3, 2)

        // Left accent
        filled(doc, M, y, 3, noteH, C.amber, 1)

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.setTextColor(...C.amberDark)
        doc.text("DOCTOR'S INSTRUCTIONS", M + 6, y + 5.5)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(120, 53, 15)
        doc.text(noteLines, M + 6, y + 11)

        y += noteH
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 9. VALIDITY STRIP (10mm)
    // ═══════════════════════════════════════════════════════════════════════════
    y += 6
    filledStroke(doc, M, y, COL_W, 10, C.lightBg, C.border, 0.3)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...C.muted)
    doc.text('\u26A0  Valid for 30 days from issue date. Present original to pharmacist.', M + 4, y + 6.5)

    y += 16

    // ═══════════════════════════════════════════════════════════════════════════
    // 10. SIGNATURE BLOCK
    // ═══════════════════════════════════════════════════════════════════════════
    // Optional signature image
    if (data.doctorSignatureBase64) {
        try {
            doc.addImage(
                `data:image/png;base64,${data.doctorSignatureBase64}`,
                'PNG', W - M - 50, y - 2, 46, 14, undefined, 'FAST'
            )
            y += 14
        } catch {
            // Skip if bad image
        }
    }

    // Horizontal signature line
    doc.setDrawColor(...C.sigLine)
    doc.setLineWidth(0.4)
    doc.line(W - M - 50, y, W - M, y)

    // Doctor info (right-aligned)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...C.navy)
    doc.text(`Dr. ${data.doctorName}`, rx, y + 6, { align: 'right' })

    if (data.doctorQualification) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(...C.teal)
        doc.text(data.doctorQualification, rx, y + 11, { align: 'right' })
    }
    if (data.doctorRegistrationNo) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(...C.muted)
        doc.text(`Reg. No. ${data.doctorRegistrationNo}`, rx, y + 16, { align: 'right' })
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 11. FOOTER BAND (pinned at y=287, 10mm)
    // ═══════════════════════════════════════════════════════════════════════════
    filled(doc, 0, 287, W, 10, C.navy)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...C.teal)
    doc.text('ClinicOS', M + 4, 293)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...C.muted)
    doc.text('Secure Digital Prescription  \xb7  clinicos-system.vercel.app', W / 2, 293, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...C.teal)
    doc.text(data.date, W - M, 293, { align: 'right' })
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function generatePrescriptionPDF(data: PrescriptionData): Promise<Blob> {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
    })

    render(doc, data)
    return doc.output('blob')
}

export async function downloadPrescriptionPDF(data: PrescriptionData): Promise<void> {
    const blob = await generatePrescriptionPDF(data)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Rx_${data.patientName.replace(/\s+/g, '_')}_${data.date.replace(/[\s,]/g, '_')}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 5000)
}