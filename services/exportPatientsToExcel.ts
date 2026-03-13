/**
 * exportPatientsToExcel.ts
 * Run: npm install exceljs file-saver
 * Types: npm install --save-dev @types/file-saver
 */

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
    indigo: 'FF4F46E5',
    indigoLight: 'FFEEF2FF',
    white: 'FFFFFFFF',
    slate900: 'FF0F172A',
    slate600: 'FF475569',
    slate200: 'FFE2E8F0',
    emerald: 'FF059669',
    emeraldLight: 'FFECFDF5',
    violet: 'FF7C3AED',
    violetLight: 'FFF5F3FF',
    amber: 'FFD97706',
    amberLight: 'FFFFFBEB',
    red: 'FFDC2626',
    redLight: 'FFFEF2F2',
    slate50: 'FFF8FAFC',
    slate400: 'FF94A3B8',
};

type RGB = string; // ExcelJS ARGB hex

function fill(argb: RGB): ExcelJS.Fill {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function font(opts: Partial<ExcelJS.Font>): Partial<ExcelJS.Font> {
    return { name: 'Arial', size: 9, ...opts };
}

function border(argb = C.slate200): Partial<ExcelJS.Borders> {
    const s: ExcelJS.BorderStyle = 'thin';
    const side = { style: s, color: { argb } };
    return { top: side, bottom: side, left: side, right: side };
}

function bottomBorder(argb = C.slate200): Partial<ExcelJS.Borders> {
    return { bottom: { style: 'thin', color: { argb } } };
}

function center(wrap = false): Partial<ExcelJS.Alignment> {
    return { horizontal: 'center', vertical: 'middle', wrapText: wrap };
}

// ── Vital status ─────────────────────────────────────────────────────────────
function bpStatus(bp: string | null): 'ok' | 'warning' | 'high' {
    if (!bp) return 'ok';
    const sys = parseInt(bp.split('/')[0]);
    if (sys >= 140) return 'high';
    if (sys >= 130) return 'warning';
    return 'ok';
}
function hrStatus(hr: number | null): 'ok' | 'warning' {
    if (!hr) return 'ok';
    return hr < 60 || hr > 100 ? 'warning' : 'ok';
}
function tempStatus(t: number | null): 'ok' | 'warning' | 'high' {
    if (!t) return 'ok';
    if (t >= 101) return 'high';
    if (t >= 99) return 'warning';
    return 'ok';
}
const vitalFill: Record<string, RGB> = {
    ok: C.white, warning: C.amberLight, high: C.redLight,
};

// ── Types ────────────────────────────────────────────────────────────────────
export interface ExportPatient {
    full_name: string;
    age: number | null;
    gender: string | null;
    phone: string | null;
    address: string | null;
    dob: string | null;
}

export interface ExportVisit {
    created_at: string;
    diagnosis: string;
    doctor_notes: string | null;
    fee_collected: number;
    payment_method: string;
    vitals: {
        bp_systolic: number | null;
        bp_diastolic: number | null;
        heart_rate: number | null;
        temperature_f: number | null;
        weight_kg: number | null;
    } | null;
    medicines: {
        medicine_name: string;
        strength: string | null;
        form: string | null;
        dosage: string;
        duration: string;
        instructions: string | null;
    }[];
}

export interface ExportRecord {
    patient: ExportPatient;
    visits: ExportVisit[];
}

// ── Main export function ─────────────────────────────────────────────────────
export async function exportPatientsToExcel(
    records: ExportRecord[],
    clinicName = 'Clinic',
): Promise<void> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'NirogOS';
    wb.created = new Date();

    // Flatten all visits into rows
    const rows: Array<{
        patient: ExportPatient;
        visit: ExportVisit;
    }> = [];
    for (const r of records) {
        for (const v of r.visits) {
            rows.push({ patient: r.patient, visit: v });
        }
    }

    // ── SHEET: Patient Records ─────────────────────────────────────────────────
    const ws = wb.addWorksheet('Patient Records', {
        views: [{ showGridLines: false, zoomScale: 95 }],
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    });

    // Column definitions
    ws.columns = [
        { key: '_pad1', width: 2 },
        { key: 'name', width: 20 },
        { key: 'age', width: 6 },
        { key: 'gender', width: 9 },
        { key: 'phone', width: 14 },
        { key: 'address', width: 22 },
        { key: 'date', width: 13 },
        { key: 'time', width: 10 },
        { key: 'bp', width: 11 },
        { key: 'hr', width: 9 },
        { key: 'temp', width: 10 },
        { key: 'wt', width: 8 },
        { key: 'diagnosis', width: 26 },
        { key: 'medicines', width: 38 },
        { key: 'fee', width: 12 },
        { key: 'payment', width: 11 },
        { key: 'notes', width: 30 },
        { key: '_pad2', width: 2 },
    ];

    // Row 1 — top accent bar
    const r1 = ws.getRow(1);
    r1.height = 6;
    for (let c = 1; c <= 18; c++) r1.getCell(c).fill = fill(C.indigo);

    // Row 3 — sheet title
    const r3 = ws.getRow(3);
    r3.height = 34;
    ws.mergeCells('B3:Q3');
    const titleCell = ws.getCell('B3');
    titleCell.value = `🏥  ${clinicName} — Patient Visit Records`;
    titleCell.font = font({ size: 18, bold: true, color: { argb: C.slate900 } });
    titleCell.alignment = { vertical: 'middle' };

    // Row 4 — subtitle
    const r4 = ws.getRow(4);
    r4.height = 16;
    ws.mergeCells('B4:Q4');
    const subCell = ws.getCell('B4');
    subCell.value = `NirogOS  ·  Exported ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`;
    subCell.font = font({ size: 9, color: { argb: C.slate600 } });

    // Row 5 — spacer
    ws.getRow(5).height = 10;

    // Row 6 — group labels
    const groupRow = ws.getRow(6);
    groupRow.height = 16;
    const groups: [string, string, RGB, RGB][] = [
        ['B6:E6', 'PATIENT INFO', C.indigo, C.white],
        ['F6:H6', 'VISIT DETAILS', C.violet, C.white],
        ['I6:L6', 'VITALS', C.emerald, C.white],
        ['M6:N6', 'CLINICAL', C.amber, C.white],
        ['O6:P6', 'BILLING', C.slate900, C.white],
        ['Q6:Q6', 'NOTES', C.slate600, C.white],
    ];
    for (const [range, label, bg, fg] of groups) {
        ws.mergeCells(range);
        const cell = ws.getCell(range.split(':')[0]);
        cell.value = label;
        cell.font = font({ size: 7, bold: true, color: { argb: fg } });
        cell.fill = fill(bg);
        cell.alignment = center();
    }

    // Row 7 — column headers
    const hdrRow = ws.getRow(7);
    hdrRow.height = 22;
    const headers = [
        ['B', 'Patient Name', C.indigo],
        ['C', 'Age', C.indigo],
        ['D', 'Gender', C.indigo],
        ['E', 'Phone', C.indigo],
        ['F', 'Address', C.violet],
        ['G', 'Visit Date', C.violet],
        ['H', 'Time', C.violet],
        ['I', 'BP (mmHg)', C.emerald],
        ['J', 'HR (bpm)', C.emerald],
        ['K', 'Temp (°F)', C.emerald],
        ['L', 'Wt (kg)', C.emerald],
        ['M', 'Diagnosis', C.amber],
        ['N', 'Medicines', C.amber],
        ['O', 'Fee (₹)', 'FF1E293B'],
        ['P', 'Payment', 'FF1E293B'],
        ['Q', "Doctor's Notes", C.slate600],
    ] as const;
    for (const [col, label, bg] of headers) {
        const cell = ws.getCell(`${col}7`);
        cell.value = label;
        cell.font = font({ size: 8, bold: true, color: { argb: C.white } });
        cell.fill = fill(bg);
        cell.alignment = center(true);
        cell.border = border(C.white);
    }

    // Freeze header
    ws.views = [{ state: 'frozen', ySplit: 7, showGridLines: false }];

    // ── Data rows ───────────────────────────────────────────────────────────────
    rows.forEach(({ patient, visit }, idx) => {
        const rowNum = 8 + idx;
        const dataRow = ws.getRow(rowNum);
        dataRow.height = 52;

        const rowBg = idx % 2 === 0 ? C.slate50 : C.white;

        const visitDate = new Date(visit.created_at);
        const bp = visit.vitals?.bp_systolic && visit.vitals?.bp_diastolic
            ? `${visit.vitals.bp_systolic}/${visit.vitals.bp_diastolic}`
            : '';

        const medsText = visit.medicines.length > 0
            ? visit.medicines.map(m => {
                const parts = [m.medicine_name];
                if (m.strength) parts.push(m.strength);
                if (m.dosage) parts.push(m.dosage);
                if (m.duration) parts.push(`· ${m.duration}`);
                if (m.instructions) parts.push(`(${m.instructions})`);
                return parts.join(' ');
            }).join('\n')
            : '—';

        const age = patient.dob
            ? new Date().getFullYear() - new Date(patient.dob).getFullYear()
            : patient.age ?? '—';

        const rowValues: Record<string, ExcelJS.CellValue> = {
            B: patient.full_name,
            C: age,
            D: patient.gender ?? '—',
            E: patient.phone ?? '—',
            F: patient.address ?? '—',
            G: visitDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            H: visitDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            I: bp || '—',
            J: visit.vitals?.heart_rate ?? '—',
            K: visit.vitals?.temperature_f ?? '—',
            L: visit.vitals?.weight_kg ?? '—',
            M: visit.diagnosis,
            N: medsText,
            O: visit.fee_collected > 0 ? `₹${visit.fee_collected.toLocaleString('en-IN')}` : '—',
            P: visit.payment_method,
            Q: visit.doctor_notes ?? '—',
        };

        // Vital background overrides
        const vitalBgs: Record<string, RGB> = {
            I: vitalFill[bpStatus(bp)],
            J: vitalFill[hrStatus(visit.vitals?.heart_rate ?? null)],
            K: vitalFill[tempStatus(visit.vitals?.temperature_f ?? null)],
        };

        for (const [col, val] of Object.entries(rowValues)) {
            const cell = dataRow.getCell(col);
            cell.value = val;
            const isLeft = ['B', 'F', 'M', 'N', 'Q'].includes(col);
            cell.alignment = {
                horizontal: isLeft ? 'left' : 'center',
                vertical: 'middle',
                wrapText: true,
            };
            cell.fill = fill(vitalBgs[col] ?? rowBg);
            cell.border = bottomBorder();

            if (col === 'B') {
                cell.font = font({ bold: true, color: { argb: C.slate900 } });
            } else if (col === 'O') {
                cell.font = font({ bold: true, size: 10, color: { argb: C.emerald } });
            } else if (col === 'M') {
                cell.font = font({ bold: true, color: { argb: C.slate900 } });
            } else if (col === 'N') {
                cell.font = font({ size: 8, color: { argb: C.violet } });
            } else if (col === 'Q') {
                cell.font = font({ italic: true, size: 8, color: { argb: C.slate600 } });
            } else {
                cell.font = font({ color: { argb: C.slate900 } });
            }
        }

        // Padding cells
        ['A', 'R'].forEach(col => {
            dataRow.getCell(col).fill = fill(C.white);
        });
    });

    // ── Totals row ──────────────────────────────────────────────────────────────
    const totalRow = ws.getRow(8 + rows.length);
    totalRow.height = 22;
    ws.mergeCells(`B${8 + rows.length}:N${8 + rows.length}`);
    const totalLabelCell = totalRow.getCell('B');
    totalLabelCell.value = 'TOTAL REVENUE';
    totalLabelCell.font = font({ bold: true, size: 10, color: { argb: C.white } });
    totalLabelCell.fill = fill(C.indigo);
    totalLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };

    const totalAmt = rows.reduce((s, r) => s + r.visit.fee_collected, 0);
    const totalAmtCell = totalRow.getCell('O');
    totalAmtCell.value = `₹${totalAmt.toLocaleString('en-IN')}`;
    totalAmtCell.font = font({ bold: true, size: 12, color: { argb: C.white } });
    totalAmtCell.fill = fill(C.indigo);
    totalAmtCell.alignment = center();

    ['P', 'Q'].forEach(col => {
        totalRow.getCell(col).fill = fill(C.indigo);
    });

    // ── Footer ──────────────────────────────────────────────────────────────────
    const footerRowNum = 8 + rows.length + 2;
    ws.mergeCells(`B${footerRowNum}:Q${footerRowNum}`);
    const footerCell = ws.getCell(`B${footerRowNum}`);
    footerCell.value = `Confidential · Generated by NirogOS · ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`;
    footerCell.font = font({ size: 8, italic: true, color: { argb: C.slate400 } });
    footerCell.alignment = center();
    ws.getRow(footerRowNum).height = 16;

    // Bottom accent bar
    const bottomBarRow = ws.getRow(footerRowNum + 1);
    bottomBarRow.height = 5;
    for (let c = 1; c <= 18; c++) bottomBarRow.getCell(c).fill = fill(C.indigo);

    // ── Generate and download ───────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const fileName = `${clinicName.replace(/\s+/g, '_')}_Patient_Records_${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '_')}.xlsx`;
    saveAs(blob, fileName);
}