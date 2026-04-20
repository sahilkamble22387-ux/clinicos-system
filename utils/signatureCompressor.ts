export async function compressSignatureToBase64(
    file: File,
    maxWidth = 320,
    quality = 0.75
): Promise<string> {
    return new Promise((resolve, reject) => {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            reject(new Error('File must be an image (PNG, JPG, or JPEG)'))
            return
        }

        // Validate file size (max 5MB input)
        if (file.size > 5 * 1024 * 1024) {
            reject(new Error('Image must be under 5MB'))
            return
        }

        const reader = new FileReader()

        reader.onload = (readerEvent) => {
            const img = new Image()

            img.onload = () => {
                // Calculate scaled dimensions
                const scale = Math.min(maxWidth / img.width, 1) // never upscale
                const canvasWidth = Math.round(img.width * scale)
                const canvasHeight = Math.round(img.height * scale)

                // Create canvas and draw
                const canvas = document.createElement('canvas')
                canvas.width = canvasWidth
                canvas.height = canvasHeight

                const ctx = canvas.getContext('2d')!

                // White background (removes transparency, reduces file size)
                ctx.fillStyle = '#ffffff'
                ctx.fillRect(0, 0, canvasWidth, canvasHeight)

                // Draw the image
                ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight)

                // Export as PNG (preserves quality for signatures)
                const dataUrl = canvas.toDataURL('image/png', quality)

                // Strip the prefix — we NEVER store the prefix in the database
                const base64 = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '')

                // Final size check
                const estimatedKB = Math.round((base64.length * 3) / 4 / 1024)

                if (estimatedKB > 150) {
                    // Image is still too large — retry with smaller canvas
                    const smallCanvas = document.createElement('canvas')
                    smallCanvas.width = 240
                    smallCanvas.height = Math.round(img.height * (240 / img.width))
                    const smallCtx = smallCanvas.getContext('2d')!
                    smallCtx.fillStyle = '#ffffff'
                    smallCtx.fillRect(0, 0, smallCanvas.width, smallCanvas.height)
                    smallCtx.drawImage(img, 0, 0, smallCanvas.width, smallCanvas.height)
                    const smallDataUrl = smallCanvas.toDataURL('image/png', 0.65)
                    const smallBase64 = smallDataUrl.replace(/^data:image\/[a-z]+;base64,/, '')
                    resolve(smallBase64)
                    return
                }

                resolve(base64)
            }

            img.onerror = () => reject(new Error('Failed to load image — please try a different file'))
            img.src = readerEvent.target?.result as string
        }

        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsDataURL(file)
    })
}

export function signatureToImgSrc(base64: string | null | undefined): string | null {
    if (!base64 || base64.trim() === '') return null
    // If someone accidentally stored the full data URL, handle gracefully
    if (base64.startsWith('data:')) return base64
    return `data:image/png;base64,${base64}`
}

export function getSignatureSizeKB(base64: string): number {
    return Math.round((base64.length * 3) / 4 / 1024)
}
