import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Check, X, Pen, RefreshCw } from 'lucide-react'
import { supabase } from '../services/db'
import toast from 'react-hot-toast'

interface SignatureUploadProps {
  clinicId: string
    currentSignature?: string | null
    onSaved?: (base64: string) => void
}

// Compress + convert image to base64
// Target: < 50KB (base64 string ~66KB), sufficient for a signature
async function compressImageToBase64(file: File, maxWidth = 400, quality = 0.7): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            const img = new Image()
            img.onload = () => {
                const canvas = document.createElement('canvas')
                const ratio = Math.min(maxWidth / img.width, 1)
                canvas.width = Math.round(img.width * ratio)
                canvas.height = Math.round(img.height * ratio)

                const ctx = canvas.getContext('2d')!

                // White background (removes transparency artifacts)
                ctx.fillStyle = '#ffffff'
                ctx.fillRect(0, 0, canvas.width, canvas.height)
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

                // Convert to base64 — strip the data:image/...;base64, prefix
                const dataUrl = canvas.toDataURL('image/png', quality)
                const base64 = dataUrl.split(',')[1]
                resolve(base64)
            }
            img.onerror = reject
            img.src = e.target?.result as string
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}

export function SignatureUpload({ clinicId, currentSignature, onSaved }: SignatureUploadProps) {
    const [preview, setPreview] = useState<string | null>(
        currentSignature ? `data:image/png;base64,${currentSignature}` : null
    )
    const [base64, setBase64] = useState<string | null>(currentSignature ?? null)
    const [saving, setSaving] = useState(false)
    const [dragging, setDragging] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const processFile = useCallback(async (file: File) => {
        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file (PNG, JPG, or JPEG)')
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image must be under 5MB')
            return
        }

        try {
            const compressed = await compressImageToBase64(file)
            const previewUrl = `data:image/png;base64,${compressed}`
            setBase64(compressed)
            setPreview(previewUrl)

            // Show size info
            const sizeKB = Math.round((compressed.length * 3) / 4 / 1024)
            toast.success(`Signature ready (${sizeKB}KB compressed)`)
        } catch (err) {
            toast.error('Failed to process image')
            console.error(err)
        }
    }, [])

    async function handleSave() {
        if (!base64 || !clinicId) return
        setSaving(true)

        const { error } = await supabase
            .from('clinics')
            .update({ doctor_signature_base64: base64 })
            .eq('id', clinicId)

        setSaving(false)

        if (error) {
            toast.error('Failed to save signature: ' + error.message)
        } else {
            toast.success('Signature saved! It will appear on all prescriptions.')
            onSaved?.(base64)
        }
    }

    async function handleRemove() {
        if (!clinicId) return
        setPreview(null)
        setBase64(null)

        await supabase
            .from('clinics')
            .update({ doctor_signature_base64: null })
            .eq('id', clinicId)

        toast.success('Signature removed')
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <Pen size={16} className="text-indigo-500" />
                <h3 className="font-bold text-slate-800 text-sm">Doctor Signature</h3>
                <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    Appears on prescriptions
                </span>
            </div>

            {preview ? (
                /* ── Signature preview ── */
                <div className="relative">
                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 bg-slate-50 flex flex-col items-center gap-3">
                        <img
                            src={preview}
                            alt="Doctor signature"
                            className="max-h-20 max-w-full object-contain"
                            style={{ filter: 'contrast(1.2)' }}
                        />
                        <p className="text-xs text-slate-400">Your signature preview</p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 mt-3">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-sm hover:bg-indigo-700 disabled:opacity-60 transition"
                        >
                            {saving
                                ? <><RefreshCw size={13} className="animate-spin" /> Saving...</>
                                : <><Check size={13} /> Save Signature</>
                            }
                        </button>
                        <button
                            onClick={() => inputRef.current?.click()}
                            className="px-4 py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-xl text-sm hover:bg-slate-200 transition"
                        >
                            Change
                        </button>
                        <button
                            onClick={handleRemove}
                            className="px-3 py-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            ) : (
                /* ── Upload dropzone ── */
                <div
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${dragging
                        ? 'border-indigo-400 bg-indigo-50 scale-[1.01]'
                        : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/50'
                        }`}
                    onClick={() => inputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDragging(true) }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={e => {
                        e.preventDefault()
                        setDragging(false)
                        const file = e.dataTransfer.files[0]
                        if (file) processFile(file)
                    }}
                >
                    <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <Upload size={22} className="text-indigo-500" />
                    </div>
                    <p className="font-bold text-slate-700 text-sm">Upload your signature</p>
                    <p className="text-slate-400 text-xs mt-1">
                        Drag & drop or click · PNG, JPG up to 5MB
                    </p>
                    <p className="text-slate-300 text-[11px] mt-2">
                        Sign on white paper, photograph it, upload here
                    </p>
                </div>
            )}

            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) processFile(file)
                    e.target.value = ''
                }}
            />
        </div>
    )
}
