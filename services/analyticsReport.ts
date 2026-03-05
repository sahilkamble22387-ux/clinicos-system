import jsPDF from 'jspdf'
import { supabase } from './db'
import toast from 'react-hot-toast'

function rs(n: number): string {
    return `Rs.${n.toLocaleString('en-IN')}`
}

type RGB = [number, number, number]
const C = {
    navy: [12, 26, 53] as RGB,
    navyMid: [26, 50, 96] as RGB,
    navyLight: [45, 75, 130] as RGB,
    gold: [201, 168, 76] as RGB,
    indigo: [67, 56, 202] as RGB,
    indigoDark: [55, 48, 163] as RGB,
    indigoLight: [165, 180, 252] as RGB,
    purple: [124, 58, 237] as RGB,
    white: [255, 255, 255] as RGB,
    slate900: [15, 23, 42] as RGB,
    slate700: [51, 65, 85] as RGB,
    slate600: [71, 85, 105] as RGB,
    slate500: [100, 116, 139] as RGB,
    slate400: [148, 163, 184] as RGB,
    slate300: [203, 213, 225] as RGB,
    slate200: [226, 232, 240] as RGB,
    slate100: [241, 245, 249] as RGB,
    slate50: [248, 250, 252] as RGB,
    emerald: [16, 185, 129] as RGB,
    amber: [245, 158, 11] as RGB,
    red: [239, 68, 68] as RGB,
}

export async function downloadAnalyticsReport(
    clinicId: string,
    clinicName: string,
    doctorName: string
) {
    const loadingToast = toast.loading('Generating analytics report…')

    try {
        const now = new Date()
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(now.getDate() - 7)
        sevenDaysAgo.setHours(0, 0, 0, 0)
        const fromISO = sevenDaysAgo.toISOString()
        const fromLabel = sevenDaysAgo.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
        const toLabel = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

        // Fetch all data in parallel
        const [patientsRes, recordsAllTimeRes, recordsWeekRes] = await Promise.all([
            supabase.from('patients').select('id, full_name, status, source, created_at')
                .eq('clinic_id', clinicId).gte('created_at', fromISO).order('created_at', { ascending: false }),
            supabase.from('medical_records').select('id, diagnosis, created_at')
                .eq('clinic_id', clinicId).not('diagnosis', 'is', null).neq('diagnosis', ''),
            supabase.from('medical_records').select('id, fee_collected, payment_method, created_at')
                .eq('clinic_id', clinicId).gte('created_at', fromISO),
        ])

        const patients = patientsRes.data ?? []
        const allRecords = recordsAllTimeRes.data ?? []
        const weekRecords = recordsWeekRes.data ?? []

        // ── Stats ──
        const totalPatients = patients.length
        const completedVisits = weekRecords.length
        const totalRevenue = weekRecords.reduce((s, r) => s + (r.fee_collected ?? 0), 0)
        const qrCheckIns = patients.filter(p => p.source === 'QR_Checkin').length
        const frontDesk = patients.filter(p => p.source === 'Front_Desk').length
        const avgRevenue = completedVisits > 0 ? Math.round(totalRevenue / completedVisits) : 0

        // ── Daily breakdown ──
        const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date()
            d.setDate(d.getDate() - (6 - i))
            return {
                date: d,
                label: d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' }),
                short: d.toLocaleDateString('en-IN', { weekday: 'short' }),
                patients: 0,
                revenue: 0,
            }
        })

        patients.forEach(p => {
            const key = new Date(p.created_at).toLocaleDateString('en-IN', { weekday: 'short' })
            const d = days.find(x => x.short === key)
            if (d) d.patients++
        })
        weekRecords.forEach(r => {
            const key = new Date(r.created_at).toLocaleDateString('en-IN', { weekday: 'short' })
            const d = days.find(x => x.short === key)
            if (d) d.revenue += r.fee_collected ?? 0
        })

        // ── Top diagnoses (all time) ──
        const diagCount: Record<string, number> = {}
        allRecords.forEach(r => {
            const d = (r.diagnosis ?? '').trim()
            if (d) diagCount[d] = (diagCount[d] || 0) + 1
        })
        const topDiags = Object.entries(diagCount).sort(([, a], [, b]) => b - a).slice(0, 5)

        // ── Revenue by method ──
        const byMethod: Record<string, number> = {}
        weekRecords.forEach(r => {
            const m = r.payment_method || 'Cash'
            byMethod[m] = (byMethod[m] || 0) + (r.fee_collected ?? 0)
        })

        // ════════════════════════════════════════
        // BUILD PDF
        // ════════════════════════════════════════
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
        const PW = 210
        const PH = 297
        const M = 18
        const CW = PW - M * 2
        let y = 0

        // ═══════════════════════════════
        // HEADER
        // ═══════════════════════════════
        doc.setFillColor(...C.navy)
        doc.rect(0, 0, PW, 54, 'F')

        // Gold top strip
        doc.setFillColor(...C.gold)
        doc.rect(0, 0, PW, 4, 'F')

        // ClinicOS wordmark
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(...C.indigoLight)
        doc.text('ClinicOS', M, 16)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(100, 90, 180)
        doc.text('Weekly Analytics Report', M + 28, 16)

        // Divider
        doc.setDrawColor(67, 56, 202)
        doc.setLineWidth(0.3)
        doc.line(M, 19, PW - M, 19)

        // Clinic name
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(17)
        doc.setTextColor(...C.white)
        doc.text(clinicName, M, 30)

        // Doctor + date range
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.5)
        doc.setTextColor(...C.indigoLight)
        doc.text(`Dr. ${doctorName}`, M, 38)
        doc.text(`${fromLabel} – ${toLabel}`, M, 43.5)

        // Generated time — right aligned
        const genTime = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        doc.setFontSize(7)
        doc.setTextColor(80, 72, 150)
        doc.text(`Generated: ${genTime}`, PW - M, 43.5, { align: 'right' })

        // White wave
        doc.setFillColor(...C.white)
        doc.roundedRect(-2, 51, PW + 4, 8, 4, 4, 'F')

        y = 64

        // ═══════════════════════════════
        // KPI CARDS
        // ═══════════════════════════════
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.5)
        doc.setTextColor(...C.slate500)
        doc.text('PERFORMANCE SUMMARY', M, y)
        y += 4

        const kpis = [
            { label: 'Total Patients', value: `${totalPatients}`, sub: `${qrCheckIns} QR · ${frontDesk} front desk`, color: C.indigo },
            { label: 'Completed Visits', value: `${completedVisits}`, sub: 'This week', color: C.purple },
            { label: 'Total Revenue', value: rs(totalRevenue), sub: `Avg ${rs(avgRevenue)} / visit`, color: C.emerald },
            { label: 'QR Check-Ins', value: `${qrCheckIns}`, sub: `${frontDesk} front desk entries`, color: C.amber },
        ]

        const cardW = (CW - 9) / 4

        kpis.forEach((kpi, i) => {
            const cx = M + i * (cardW + 3)

            doc.setFillColor(...C.slate50)
            doc.roundedRect(cx, y, cardW, 26, 2.5, 2.5, 'F')
            doc.setDrawColor(...C.slate200)
            doc.setLineWidth(0.2)
            doc.roundedRect(cx, y, cardW, 26, 2.5, 2.5, 'D')

            // Color left bar
            doc.setFillColor(...kpi.color)
            doc.roundedRect(cx, y, 3, 26, 1, 1, 'F')

            // Value
            const isLong = kpi.value.length > 7
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(isLong ? 10.5 : 19)
            doc.setTextColor(...C.slate900)
            doc.text(kpi.value, cx + 6, y + 14, { maxWidth: cardW - 8 })

            // Label
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(7)
            doc.setTextColor(...C.slate700)
            doc.text(kpi.label, cx + 6, y + 20)

            // Sub
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(5.5)
            doc.setTextColor(...C.slate400)
            doc.text(kpi.sub, cx + 6, y + 24.5, { maxWidth: cardW - 8 })
        })

        y += 32

        // ═══════════════════════════════
        // DAILY PATIENT CHART
        // ═══════════════════════════════
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.5)
        doc.setTextColor(...C.slate500)
        doc.text('DAILY PATIENT TRAFFIC — 7 DAYS', M, y)
        y += 4

        const chartH = 46
        const chartW = CW
        doc.setFillColor(...C.slate50)
        doc.roundedRect(M, y, chartW, chartH, 3, 3, 'F')
        doc.setDrawColor(...C.slate200)
        doc.setLineWidth(0.2)
        doc.roundedRect(M, y, chartW, chartH, 3, 3, 'D')

        const barAreaX = M + 15
        const barAreaY = y + 6
        const barAreaW = chartW - 22
        const barAreaH = chartH - 18
        const maxP = Math.max(...days.map(d => d.patients), 1)

            // Y gridlines
            ;[0.25, 0.5, 0.75, 1].forEach(ratio => {
                const gy = barAreaY + barAreaH - ratio * barAreaH
                doc.setDrawColor(...C.slate200)
                doc.setLineWidth(0.2)
                doc.line(barAreaX, gy, barAreaX + barAreaW, gy)
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(5.5)
                doc.setTextColor(...C.slate400)
                doc.text(`${Math.round(ratio * maxP)}`, M + 13, gy + 1.5, { align: 'right' })
            })

        const barW = (barAreaW / 7) * 0.52
        const barGap = barAreaW / 7

        days.forEach((day, i) => {
            const bx = barAreaX + i * barGap + (barGap - barW) / 2
            const barH = day.patients > 0 ? Math.max(3, (day.patients / maxP) * barAreaH) : 0

            if (barH > 0) {
                // Bar gradient via two rects
                doc.setFillColor(...C.navyLight)
                doc.roundedRect(bx, barAreaY + barAreaH - barH, barW, barH, 1.2, 1.2, 'F')
                doc.setFillColor(...C.indigo)
                doc.roundedRect(bx, barAreaY + barAreaH - barH, barW, barH * 0.5, 1.2, 1.2, 'F')

                doc.setFont('helvetica', 'bold')
                doc.setFontSize(6.5)
                doc.setTextColor(...C.indigo)
                doc.text(`${day.patients}`, bx + barW / 2, barAreaY + barAreaH - barH - 2, { align: 'center' })
            } else {
                // Empty tick
                doc.setDrawColor(...C.slate300)
                doc.setLineWidth(0.3)
                doc.line(bx, barAreaY + barAreaH, bx + barW, barAreaY + barAreaH)
            }

            doc.setFont('helvetica', i === 0 || i === 6 ? 'bold' : 'normal')
            doc.setFontSize(6)
            doc.setTextColor(...C.slate600)
            doc.text(day.short, bx + barW / 2, barAreaY + barAreaH + 5.5, { align: 'center' })
        })

        y += chartH + 9

        // ═══════════════════════════════
        // DAILY REVENUE TABLE
        // ═══════════════════════════════
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.5)
        doc.setTextColor(...C.slate500)
        doc.text('DAILY REVENUE BREAKDOWN', M, y)
        y += 4

        // Header
        doc.setFillColor(...C.navy)
        doc.roundedRect(M, y, CW, 9, 2, 2, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.setTextColor(...C.white)
        const tCols = [
            { h: 'Date', x: M + 4 },
            { h: 'Patients', x: M + 56 },
            { h: 'Revenue', x: M + 88 },
            { h: 'Trend', x: M + 140 },
        ]
        tCols.forEach(c => doc.text(c.h, c.x, y + 6))
        y += 9

        const maxRev = Math.max(...days.map(d => d.revenue), 1)

        days.forEach((day, i) => {
            if (i % 2 === 0) {
                doc.setFillColor(...C.slate50)
                doc.rect(M, y, CW, 9.5, 'F')
            }

            doc.setFont('helvetica', 'normal')
            doc.setFontSize(7.5)
            doc.setTextColor(...C.slate700)
            doc.text(day.label, M + 4, y + 6.5)

            // Patients
            if (day.patients > 0) {
                doc.setFont('helvetica', 'bold')
                doc.setFillColor(...C.indigo)
                doc.circle(M + 56 + 4, y + 4.5, 4, 'F')
                doc.setTextColor(...C.white)
                doc.setFontSize(6.5)
                doc.text(`${day.patients}`, M + 60, y + 6.5, { align: 'center' })
            } else {
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(7.5)
                doc.setTextColor(...C.slate400)
                doc.text('0', M + 60, y + 6.5, { align: 'center' })
            }

            // Revenue
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(7.5)
            doc.setTextColor(day.revenue > 0 ? C.emerald[0] : C.slate400[0], day.revenue > 0 ? C.emerald[1] : C.slate400[1], day.revenue > 0 ? C.emerald[2] : C.slate400[2])
            doc.text(day.revenue > 0 ? rs(day.revenue) : '—', M + 88, y + 6.5)

            // Mini bar
            if (day.revenue > 0) {
                const bLen = Math.max(3, (day.revenue / maxRev) * 38)
                doc.setFillColor(226, 232, 240)
                doc.roundedRect(M + 140, y + 2.5, 38, 4.5, 1, 1, 'F')
                doc.setFillColor(...C.emerald)
                doc.roundedRect(M + 140, y + 2.5, bLen, 4.5, 1, 1, 'F')
            }

            doc.setDrawColor(...C.slate200)
            doc.setLineWidth(0.15)
            doc.line(M, y + 9.5, M + CW, y + 9.5)
            y += 9.5
        })

        // Totals row
        doc.setFillColor(...C.navy)
        doc.roundedRect(M, y, CW, 11, 2, 2, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(...C.white)
        doc.text('TOTAL', M + 4, y + 7.5)
        doc.text(`${totalPatients} patients`, M + 56, y + 7.5)
        doc.setTextColor(...C.emerald)
        doc.text(rs(totalRevenue), M + 88, y + 7.5)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6.5)
        doc.setTextColor(C.indigoLight[0], C.indigoLight[1], C.indigoLight[2])
        doc.text(`Avg ${rs(avgRevenue)} per visit`, M + 130, y + 7.5)
        y += 17

        // ═══════════════════════════════
        // BOTTOM TWO COLUMNS
        // ═══════════════════════════════
        const halfW = (CW - 8) / 2
        const leftX = M
        const rightX = M + halfW + 8

        // ── LEFT: Top Diagnoses ──
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.5)
        doc.setTextColor(...C.slate500)
        doc.text('TOP DIAGNOSES (ALL TIME)', leftX, y)

        // ── RIGHT: Payment Methods ──
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.5)
        doc.setTextColor(...C.slate500)
        doc.text('REVENUE BY METHOD', rightX, y)

        y += 5

        const diagStartY = y

        if (topDiags.length > 0) {
            const maxCount = topDiags[0][1]
            topDiags.forEach(([diag, count], i) => {
                const rowH = 10.5
                const rowY = diagStartY + i * rowH

                doc.setFillColor(i % 2 === 0 ? 248 : 255, i % 2 === 0 ? 250 : 255, i % 2 === 0 ? 252 : 255)
                doc.rect(leftX, rowY, halfW, rowH, 'F')

                // Number circle
                doc.setFillColor(...C.navy)
                doc.circle(leftX + 4.5, rowY + 5, 3.5, 'F')
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(6)
                doc.setTextColor(...C.white)
                doc.text(`${i + 1}`, leftX + 3.2, rowY + 7)

                // Name
                const name = diag.length > 24 ? diag.slice(0, 23) + '…' : diag
                doc.setFont('helvetica', i === 0 ? 'bold' : 'normal')
                doc.setFontSize(7.5)
                doc.setTextColor(...C.slate900)
                doc.text(name, leftX + 10, rowY + 6)

                // Bar
                const barMaxW = halfW - 30
                const filled = Math.max(2, (count / maxCount) * barMaxW)
                doc.setFillColor(...C.slate200)
                doc.roundedRect(leftX + halfW - barMaxW - 4, rowY + 3.5, barMaxW, 4, 1, 1, 'F')
                doc.setFillColor(...C.indigo)
                doc.roundedRect(leftX + halfW - barMaxW - 4, rowY + 3.5, filled, 4, 1, 1, 'F')

                // Count
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(7)
                doc.setTextColor(...C.indigo)
                doc.text(`${count}`, leftX + halfW - 1, rowY + 6.5, { align: 'right' })
            })
        } else {
            doc.setFillColor(...C.slate50)
            doc.roundedRect(leftX, y, halfW, 22, 2, 2, 'F')
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(8)
            doc.setTextColor(...C.slate400)
            doc.text('No diagnoses yet', leftX + halfW / 2, y + 13, { align: 'center' })
        }

        // Payment methods
        const methEntries = Object.entries(byMethod).sort(([, a], [, b]) => b - a)
        const maxMeth = methEntries.length > 0 ? methEntries[0][1] : 1
        const methColors = [C.emerald, C.indigo, C.purple, C.amber, C.navyLight]

        if (methEntries.length > 0) {
            methEntries.forEach(([method, amt], i) => {
                const rowH = 10.5
                const rowY = diagStartY + i * rowH
                const acc = methColors[i % methColors.length]

                if (i % 2 === 0) {
                    doc.setFillColor(...C.slate50)
                    doc.rect(rightX, rowY, halfW, rowH, 'F')
                }

                doc.setFillColor(...acc)
                doc.roundedRect(rightX, rowY, 3, rowH, 1, 1, 'F')

                doc.setFont('helvetica', 'bold')
                doc.setFontSize(7.5)
                doc.setTextColor(...C.slate900)
                doc.text(method, rightX + 6, rowY + 5)

                doc.setFont('helvetica', 'bold')
                doc.setFontSize(8)
                doc.setTextColor(...acc)
                doc.text(rs(amt), rightX + 6, rowY + 9.5)

                const mBarMaxW = halfW - 30
                const mBarW = Math.max(3, (amt / maxMeth) * mBarMaxW)
                doc.setFillColor(...C.slate200)
                doc.roundedRect(rightX + halfW - mBarMaxW - 4, rowY + 3.5, mBarMaxW, 4, 1, 1, 'F')
                doc.setFillColor(...acc)
                doc.roundedRect(rightX + halfW - mBarMaxW - 4, rowY + 3.5, mBarW, 4, 1, 1, 'F')
            })
        } else {
            doc.setFillColor(...C.slate50)
            doc.roundedRect(rightX, y, halfW, 22, 2, 2, 'F')
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(8)
            doc.setTextColor(...C.slate400)
            doc.text('No revenue this week', rightX + halfW / 2, y + 13, { align: 'center' })
        }

        // ═══════════════════════════════
        // FOOTER
        // ═══════════════════════════════
        doc.setFillColor(...C.navy)
        doc.rect(0, PH - 14, PW, 14, 'F')
        doc.setFillColor(...C.gold)
        doc.rect(0, PH - 14, PW, 2, 'F')

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(...C.indigoLight)
        doc.text('ClinicOS', M, PH - 5.5)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(80, 72, 150)
        doc.text(`Weekly Report · ${clinicName} · ${fromLabel}–${toLabel}`, PW / 2, PH - 5.5, { align: 'center' })

        doc.setTextColor(67, 56, 202)
        doc.text('clinicos-system.vercel.app', PW - M, PH - 5.5, { align: 'right' })

        // Save
        const filename = `ClinicOS_Report_${fromLabel.replace(/\s/g, '_')}_to_${toLabel.replace(/[\s,]/g, '_')}.pdf`
        doc.save(filename)
        toast.dismiss(loadingToast)
        toast.success('Analytics report downloaded!')

    } catch (err: any) {
        console.error('[Analytics Report]', err)
        toast.dismiss(loadingToast)
        toast.error('Report failed: ' + (err.message ?? 'Unknown error'))
    }
}