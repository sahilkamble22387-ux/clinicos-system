import jsPDF from 'jspdf';
import type { PatientCardContent } from '../ai/features/takeHomeCard.ts';

export interface GeneratePatientCardPdfInput {
  frontDeskId: string;
  content: PatientCardContent;
  clinicLogoBase64?: string;
}

const PAGE_W = 148;
const PAGE_H = 210;
const M = 10;

function writeWrapped(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = 6): number {
  const lines = doc.splitTextToSize(text || '-', maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

export function generatePatientCardPdf(input: GeneratePatientCardPdfInput): Uint8Array {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
  const { content } = input;
  let y = M;

  doc.setFillColor(11, 94, 88);
  doc.rect(0, 0, PAGE_W, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);

  if (input.clinicLogoBase64) {
    try {
      doc.addImage(input.clinicLogoBase64, 'PNG', M, 6, 18, 12);
      doc.text('NirogOS', M + 22, 15);
    } catch {
      doc.text('NirogOS', M, 15);
    }
  } else {
    doc.text('NirogOS', M, 15);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Patient ID: ${input.frontDeskId}`, PAGE_W - M, 15, { align: 'right' });

  y = 34;
  doc.setTextColor(22, 43, 48);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  y = writeWrapped(doc, content.title, M, y, PAGE_W - M * 2, 7) + 3;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  y = writeWrapped(doc, content.intro, M, y, PAGE_W - M * 2, 6) + 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Medicines', M, y);
  y += 7;

  doc.setFontSize(11);
  content.medications.forEach((medicine, index) => {
    if (y > PAGE_H - 42) {
      doc.addPage('a5', 'portrait');
      y = M;
    }

    doc.setFillColor(241, 248, 246);
    doc.roundedRect(M, y - 5, PAGE_W - M * 2, 32, 2, 2, 'F');
    doc.setTextColor(11, 94, 88);
    doc.setFont('helvetica', 'bold');
    doc.text(`${index + 1}. ${medicine.drug_simple_name}`, M + 4, y);
    y += 6;

    doc.setTextColor(31, 41, 55);
    doc.setFont('helvetica', 'normal');
    y = writeWrapped(doc, `Why: ${medicine.why}`, M + 4, y, PAGE_W - M * 2 - 8, 5);
    y = writeWrapped(doc, `How: ${medicine.how}`, M + 4, y, PAGE_W - M * 2 - 8, 5);
    if (medicine.warning) y = writeWrapped(doc, `Care: ${medicine.warning}`, M + 4, y, PAGE_W - M * 2 - 8, 5);
    y += 8;
  });

  if (content.lifestyle_tips.length) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 43, 48);
    doc.setFontSize(13);
    doc.text('Daily Care', M, y);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    content.lifestyle_tips.slice(0, 4).forEach((tip) => {
      y = writeWrapped(doc, `- ${tip}`, M + 2, y, PAGE_W - M * 2 - 2, 5);
    });
    y += 4;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Follow up', M, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  y = writeWrapped(doc, content.follow_up, M, y, PAGE_W - M * 2, 5);

  doc.setFillColor(11, 94, 88);
  doc.rect(0, PAGE_H - 18, PAGE_W, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text(content.footer || content._disclaimer, M, PAGE_H - 10, { maxWidth: PAGE_W - M * 2 });
  doc.text('Powered by NirogAI for NirogOS', PAGE_W - M, PAGE_H - 4, { align: 'right' });

  return new Uint8Array(doc.output('arraybuffer'));
}
