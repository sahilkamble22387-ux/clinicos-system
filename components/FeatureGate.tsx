import { useState, useCallback } from 'react'
import { useSubscription, type FeatureKey } from '../hooks/useSubscription'
import { UpgradeModal } from './UpgradeModal'

interface FeatureGateProps {
    /** Which feature this gate protects */
    feature: FeatureKey
    /** The button/element to protect */
    children: React.ReactNode
    /** Optional: custom locked UI instead of click interception */
    fallback?: React.ReactNode
    /** Required by useSubscription — pass from parent (e.g. clinic?.id) */
    clinicId?: string | null
    clinicName?: string | null
    /** Must be true only after auth + clinic load complete */
    authResolved?: boolean
}

export function FeatureGate({
    feature,
    children,
    fallback,
    clinicId,
    clinicName,
    authResolved = true,
}: FeatureGateProps) {
    const { canUse, isLoading } = useSubscription(clinicId, authResolved)
    const [modalOpen, setModalOpen] = useState(false)

    const allowed = canUse(feature)

    const handleLockedClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setModalOpen(true)
    }, [])

    // While subscription is loading → show dimmed/disabled children (never flash as active)
    if (isLoading) {
        return (
            <div className="opacity-50 pointer-events-none cursor-wait" aria-disabled>
                {children}
            </div>
        )
    }

    // Feature is allowed → render normally
    if (allowed) {
        return <>{children}</>
    }

    // Feature is locked — use fallback if provided
    if (fallback) {
        return (
            <>
                {fallback}
                <UpgradeModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    lockedFeature={feature}
                    clinicId={clinicId}
                    clinicName={clinicName}
                />
            </>
        )
    }

    // Default: wrap children in a click-intercepting container with a 🔒 PRO badge
    return (
        <>
            <div
                className="relative cursor-pointer"
                onClick={handleLockedClick}
                onTouchEnd={handleLockedClick}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setModalOpen(true) }}
                aria-label="Locked feature — upgrade to access"
            >
                {/* Lock badge — top-right corner */}
                <div className="absolute -top-1.5 -right-1.5 z-10 pointer-events-none">
                    <div
                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-white"
                        style={{
                            background: 'linear-gradient(135deg,#7C3AED,#6D28D9)',
                            boxShadow: '0 2px 8px rgba(109,40,217,0.4)',
                            fontSize: '9px',
                            fontWeight: 800,
                            letterSpacing: '0.04em',
                        }}
                    >
                        <span>🔒</span>
                        <span>PRO</span>
                    </div>
                </div>

                {/* Dim children to signal locked state */}
                <div className="opacity-60 pointer-events-none select-none">
                    {children}
                </div>
            </div>

            <UpgradeModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                lockedFeature={feature}
                clinicId={clinicId}
                clinicName={clinicName}
            />
        </>
    )
}
