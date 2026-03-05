// components/UpgradePendingBanner.tsx
// Feature 4: Sticky yellow "Upgrade Pending" banner for Dashboard
// Fetches plan_status from clinics table, shows banner when 'pending'

import { useState, useEffect } from 'react'
import { Clock, MessageCircle } from 'lucide-react'
import { supabase } from '../services/db'

interface UpgradePendingBannerProps {
    clinicId: string | null | undefined
}

export function UpgradePendingBanner({ clinicId }: UpgradePendingBannerProps) {
    const [planStatus, setPlanStatus] = useState<string>('none')

    useEffect(() => {
        if (!clinicId) return

        supabase
            .from('clinics')
            .select('plan_status')
            .eq('id', clinicId)
            .single()
            .then(({ data, error }) => {
                if (!error && data && typeof data.plan_status === 'string') {
                    setPlanStatus(data.plan_status)
                }
            })

        // Listen for realtime updates (admin activates plan → banner disappears)
        const channel = supabase
            .channel(`pending-banner-${clinicId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'clinics',
                filter: `id=eq.${clinicId}`,
            }, (payload) => {
                const newStatus = (payload.new as { plan_status?: string }).plan_status
                if (newStatus) setPlanStatus(newStatus)
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [clinicId])

    if (planStatus !== 'pending') return null

    const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '917620422387'

    return (
        <div className="sticky top-0 z-40 bg-amber-50 border-b border-amber-200 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Clock size={16} className="text-amber-600" />
                </div>
                <div>
                    <p className="text-sm font-bold text-amber-900">
                        ⏳ Upgrade Pending
                    </p>
                    <p className="text-xs font-medium text-amber-700">
                        Please complete your UPI payment on WhatsApp. Your account will be upgraded within 30 minutes of payment confirmation.
                    </p>
                </div>
            </div>
            <a
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hi, I have already paid for my ClinicOS upgrade. Please check and activate my plan.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl transition whitespace-nowrap flex-shrink-0"
            >
                <MessageCircle size={14} />
                Open WhatsApp
            </a>
        </div>
    )
}
