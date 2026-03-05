// hooks/usePendingPlan.ts
// Manages a "pending plan" stored in localStorage when clicking a pricing CTA
// before the user is logged in. After login/signup, the pending plan is picked
// up and used to auto-open the UPI payment modal.

const STORAGE_KEY = 'clinicos_pending_plan'

export interface PendingPlan {
    id: string
    name: string
    price: number
    isYearly: boolean
}

export function usePendingPlan() {
    function getPendingPlan(): PendingPlan | null {
        try {
            const raw = localStorage.getItem(STORAGE_KEY)
            if (!raw) return null
            return JSON.parse(raw) as PendingPlan
        } catch {
            return null
        }
    }

    function setPendingPlan(plan: PendingPlan): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(plan))
        } catch {
            // Silently fail — localStorage might be unavailable in some browsers
        }
    }

    function clearPendingPlan(): void {
        try {
            localStorage.removeItem(STORAGE_KEY)
        } catch {
            // Silently fail
        }
    }

    return { getPendingPlan, setPendingPlan, clearPendingPlan }
}
