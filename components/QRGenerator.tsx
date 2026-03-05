import { QRCodeCanvas } from 'qrcode.react'
import { useState } from 'react'
import { Download, Copy, Check, ExternalLink } from 'lucide-react'

// CRITICAL: Uses Vercel domain, NOT localhost
const BASE_URL = import.meta.env.VITE_SITE_URL ?? 'https://clinicos-system.vercel.app'

export function QRGenerator({ clinicId, clinicName }: { clinicId: string; clinicName: string }) {
    const [copied, setCopied] = useState(false)
    const [downloading, setDownloading] = useState(false)

    // This is the URL patients will scan — UNIQUE per clinic
    const checkInUrl = `${BASE_URL}/checkin/${clinicId}`

    function copyLink() {
        navigator.clipboard.writeText(checkInUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
    }

    function downloadQR() {
        setDownloading(true)
        const canvas = document.getElementById('clinic-qr-canvas') as HTMLCanvasElement
        if (!canvas) {
            setDownloading(false)
            return
        }

        // Define premium dimensions
        const padding = 60
        const headerHeight = 100
        const footerHeight = 120
        const qrSize = canvas.width
        const width = qrSize + (padding * 2)
        const height = headerHeight + qrSize + footerHeight

        const output = document.createElement('canvas')
        output.width = width
        output.height = height
        const ctx = output.getContext('2d')!

        // 1. Draw Background (White with slight off-white border)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, width, height)

        ctx.lineWidth = 12
        ctx.strokeStyle = '#f8fafc'
        // Need any cast if using strokeRect with newer TS but we can use fillRect and then inner fillRect
        // Using standard ctx.strokeRect works fine.
        ctx.strokeRect(6, 6, width - 12, height - 12)

        // 2. Top Accent Gradient Strip
        const topGrad = ctx.createLinearGradient(0, 0, width, 0)
        topGrad.addColorStop(0, '#4f46e5') // Indigo 600
        topGrad.addColorStop(1, '#7c3aed') // Violet 600
        ctx.fillStyle = topGrad
        ctx.fillRect(0, 0, width, 16)

        // 3. Draw ClinicOS Logo mark at top center
        const logoSize = 48
        const logoY = 36
        ctx.fillStyle = '#7c3aed'
        ctx.beginPath()
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect((width - logoSize) / 2, logoY, logoSize, logoSize, 12)
        } else {
            // Fallback for older browsers
            ctx.rect((width - logoSize) / 2, logoY, logoSize, logoSize)
        }
        ctx.fill()

        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 24px system-ui, -apple-system, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('OS', width / 2, logoY + (logoSize / 2))

        // 4. Draw QR Code in the middle
        const qrY = headerHeight + 20

        // Add subtle shadow behind QR
        ctx.shadowColor = 'rgba(79, 70, 229, 0.15)'
        ctx.shadowBlur = 30
        ctx.shadowOffsetY = 10
        ctx.fillRect(padding - 4, qrY - 4, qrSize + 8, qrSize + 8)

        // Reset shadow for actual QR
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
        ctx.shadowOffsetY = 0

        ctx.drawImage(canvas, padding, qrY)

        // 5. Draw Clinic Name
        ctx.fillStyle = '#0f172a' // Slate 900
        ctx.font = 'bold 32px system-ui, -apple-system, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'alphabetic'
        ctx.fillText(clinicName || 'Clinic Check-In', width / 2, qrY + qrSize + 50)

        // 6. Draw Subtitle instruction
        ctx.fillStyle = '#64748b' // Slate 500
        ctx.font = '500 20px system-ui, -apple-system, sans-serif'
        ctx.fillText('Scan with any phone camera to check in', width / 2, qrY + qrSize + 85)

        // 7. Bottom Accent Strip
        ctx.fillStyle = '#f1f5f9'
        ctx.fillRect(0, height - 16, width, 16)

        // 8. Download
        const link = document.createElement('a')
        link.download = `ClinicOS_Premium_QR_${clinicId?.slice(0, 8)}.png`
        link.href = output.toDataURL('image/png', 1.0)
        link.click()

        setDownloading(false)
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="font-bold text-slate-900 text-base">Patient QR Check-In</h3>
                    <p className="text-slate-400 text-xs mt-0.5">
                        Patients scan this to join the queue without front desk
                    </p>
                </div>
                <span className="text-xs font-bold px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full">
                    UNIQUE TO YOUR CLINIC
                </span>
            </div>

            {/* QR Code */}
            <div className="flex justify-center mb-4">
                <div className="p-4 bg-white border-2 border-slate-200 rounded-2xl shadow-inner">
                    <QRCodeCanvas
                        id="clinic-qr-canvas"   // ← used by download function
                        value={checkInUrl}
                        size={180}
                        level="H"               // High error correction
                        includeMargin={false}
                        fgColor="#1e293b"
                        bgColor="#ffffff"
                    />
                </div>
            </div>

            {/* URL display */}
            <div className="bg-slate-50 rounded-xl px-3 py-2.5 mb-4 border border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Check-In URL (unique to your clinic)
                </p>
                <p className="text-xs text-slate-700 font-mono break-all leading-relaxed">
                    {checkInUrl}
                </p>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                    onClick={copyLink}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition ${copied
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300'
                        }`}
                >
                    {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Link</>}
                </button>
                <button
                    onClick={downloadQR}
                    disabled={downloading}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 transition"
                >
                    <Download size={14} />
                    {downloading ? 'Saving...' : 'Download PNG'}
                </button>
            </div>

            {/* Test link */}
            <a
                href={checkInUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 font-semibold"
            >
                <ExternalLink size={12} />
                Test this link in a new tab
            </a>

            {/* Instructions */}
            <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-200">
                <p className="text-xs font-bold text-amber-700 mb-1.5">📌 How to use</p>
                <ul className="space-y-1 text-xs text-amber-700">
                    <li>• Print and paste this QR at your reception counter</li>
                    <li>• Patients scan with any phone camera app</li>
                    <li>• They fill their name & phone — instantly added to queue</li>
                    <li>• You see them in Doctor Portal in real-time</li>
                </ul>
            </div>
        </div>
    )
}
