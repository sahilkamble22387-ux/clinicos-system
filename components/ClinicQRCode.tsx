import React, { useRef } from 'react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { Printer, QrCode, Download, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface ClinicQRCodeProps {
    clinicId: string;
    clinicName: string;
}

// Consistent with QRGenerator.tsx — always use env var, never window.location.origin
const BASE_URL = import.meta.env.VITE_SITE_URL ?? 'https://nirogos.in';

const ClinicQRCode: React.FC<ClinicQRCodeProps> = ({ clinicId, clinicName }) => {
    const checkinUrl = `${BASE_URL}/checkin/${clinicId}`;
    const [copied, setCopied] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    // ── COPY LINK ────────────────────────────────────────────────
    function copyLink() {
        navigator.clipboard.writeText(checkinUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    }

    // ── DOWNLOAD PNG (mirrors QRGenerator logic) ─────────────────
    function downloadQR() {
        const canvas = document.getElementById('clinic-qrcode-canvas') as HTMLCanvasElement | null;
        if (!canvas) return;

        const padding = 48;
        const headerHeight = 90;
        const footerHeight = 100;
        const qrSize = canvas.width;
        const width = qrSize + padding * 2;
        const height = headerHeight + qrSize + footerHeight;

        const out = document.createElement('canvas');
        out.width = width;
        out.height = height;
        const ctx = out.getContext('2d')!;

        // Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // Top gradient strip
        const grad = ctx.createLinearGradient(0, 0, width, 0);
        grad.addColorStop(0, '#4f46e5');
        grad.addColorStop(1, '#7c3aed');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, 14);

        // Logo mark
        const logoSize = 44;
        const logoX = (width - logoSize) / 2;
        const logoY = 22;
        ctx.fillStyle = '#7c3aed';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(logoX, logoY, logoSize, logoSize, 10);
        } else {
            ctx.rect(logoX, logoY, logoSize, logoSize);
        }
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('OS', width / 2, logoY + logoSize / 2);

        // QR
        const qrY = headerHeight;
        ctx.shadowColor = 'rgba(79,70,229,0.12)';
        ctx.shadowBlur = 24;
        ctx.shadowOffsetY = 8;
        ctx.fillStyle = '#fff';
        ctx.fillRect(padding - 4, qrY - 4, qrSize + 8, qrSize + 8);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.drawImage(canvas, padding, qrY);

        // Clinic name
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 28px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(clinicName || 'Clinic Check-In', width / 2, qrY + qrSize + 44);

        // Subtitle
        ctx.fillStyle = '#64748b';
        ctx.font = '500 17px system-ui, sans-serif';
        ctx.fillText('Scan to check in', width / 2, qrY + qrSize + 74);

        // Bottom strip
        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(0, height - 14, width, 14);

        const link = document.createElement('a');
        link.download = `NirogOS_QR_${clinicId.slice(0, 8)}.png`;
        link.href = out.toDataURL('image/png', 1.0);
        link.click();
    }

    // ── PRINT — isolated to QR card only ─────────────────────────
    function handlePrint() {
        const content = printRef.current;
        if (!content) return;

        const printWindow = window.open('', '_blank', 'width=600,height=700');
        if (!printWindow) return;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>QR Check-In — ${clinicName}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #fff; font-family: system-ui, sans-serif; }
                    .card { text-align: center; padding: 40px; border: 2px solid #e2e8f0; border-radius: 24px; max-width: 380px; margin: auto; }
                    .badge { display: inline-block; background: #eef2ff; color: #4f46e5; border: 1px solid #c7d2fe; border-radius: 999px; padding: 5px 14px; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 16px; }
                    h1 { font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: 6px; }
                    .sub { font-size: 13px; color: #64748b; margin-bottom: 24px; }
                    .qr-wrap { display: inline-block; padding: 20px; border: 2px solid #c7d2fe; border-radius: 18px; margin-bottom: 16px; }
                    .url { font-family: monospace; font-size: 9px; color: #94a3b8; word-break: break-all; margin-bottom: 8px; }
                    .clinic { font-size: 13px; font-weight: 700; color: #475569; }
                    .strip { height: 8px; background: linear-gradient(to right, #4f46e5, #7c3aed); border-radius: 4px; margin-top: 24px; }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="badge">Self Check-In</div>
                    <h1>Patient Self Check-In</h1>
                    <p class="sub">Scan with your phone camera to join the queue</p>
                    <div class="qr-wrap">${content.querySelector('svg')?.outerHTML ?? ''}</div>
                    <p class="url">${checkinUrl}</p>
                    <p class="clinic">${clinicName}</p>
                    <div class="strip"></div>
                </div>
                <script>window.onload = () => { window.print(); window.close(); }<\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    return (
        <div className="flex flex-col items-center gap-5 p-6 bg-white rounded-2xl shadow-sm border border-slate-200">
            {/* Header */}
            <div className="text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100 mb-3">
                    <QrCode size={14} />
                    <span className="text-xs font-bold uppercase tracking-wider">Self Check-In</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">Patient Self Check-In</h3>
                <p className="text-sm text-slate-500 mt-1">
                    Display at reception. Patients scan to join the queue.
                </p>
            </div>

            {/* Visible SVG QR (for display) */}
            <div ref={printRef} className="p-5 bg-white rounded-2xl border-2 border-indigo-100 shadow-inner">
                <QRCodeSVG
                    value={checkinUrl}
                    size={200}
                    fgColor="#1e293b"
                    level="H"
                    style={{ justifySelf: 'center' }}
                />
            </div>

            {/* Hidden Canvas QR (for PNG download) - DO NOT use 'hidden' or 'display: none', canvas loses context! */}
            <div style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', zIndex: -10 }} aria-hidden="true">
                <QRCodeCanvas
                    id="clinic-qrcode-canvas"
                    value={checkinUrl}
                    size={400}
                    level="H"
                    fgColor="#1e293b"
                    bgColor="#ffffff"
                    includeMargin={false}
                />
            </div>

            {/* URL preview */}
            <p className="text-[10px] text-slate-400 font-mono tracking-wide break-all text-center px-2">
                {checkinUrl}
            </p>

            {/* Clinic name */}
            <p className="text-xs text-slate-500 font-semibold">{clinicName}</p>

            {/* Action buttons */}
            <div className="grid grid-cols-3 gap-2 w-full">
                {/* Copy */}
                <button
                    onClick={copyLink}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-bold transition border ${copied
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Copied!' : 'Copy Link'}
                </button>

                {/* Download */}
                <button
                    onClick={downloadQR}
                    className="flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition border border-indigo-700"
                >
                    <Download size={16} />
                    Download
                </button>

                {/* Print */}
                <button
                    onClick={handlePrint}
                    className="flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-bold bg-slate-800 text-white hover:bg-slate-900 transition border border-slate-900"
                >
                    <Printer size={16} />
                    Print
                </button>
            </div>
        </div>
    );
};

export default ClinicQRCode;