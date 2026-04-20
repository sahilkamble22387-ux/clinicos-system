export const ADMIN_PLAN_OPTIONS = ['trial', 'basic', 'professional', 'founder'] as const;
export const PUBLIC_PLAN_OPTIONS = ['basic', 'professional'] as const;

export type SupportedPlanId = (typeof ADMIN_PLAN_OPTIONS)[number];
export type PublicPlanId = (typeof PUBLIC_PLAN_OPTIONS)[number];

export const PLAN_PRICE_BY_ID: Record<SupportedPlanId, number> = {
  trial: 0,
  basic: 499,
  professional: 999,
  founder: 599,
};

export const PLAN_NAME_BY_ID: Record<SupportedPlanId, string> = {
  trial: 'Trial',
  basic: 'Basic',
  professional: 'Professional',
  founder: 'Founder',
};

export const SUBSCRIPTION_STATUS_OPTIONS = ['trial', 'active', 'expired', 'cancelled'] as const;
export type SubscriptionStatusOption = (typeof SUBSCRIPTION_STATUS_OPTIONS)[number];

export function normalizePlanId(planName: string | null | undefined): SupportedPlanId {
  switch ((planName ?? '').trim().toLowerCase()) {
    case 'trial':
    case 'trialing':
      return 'trial';
    case 'founder':
      return 'founder';
    case 'basic':
    case 'essential':
    case 'starter':
      return 'basic';
    case 'professional':
    case 'pro':
    case 'premium':
    case 'elite':
    case 'enterprise':
    case 'clinic_pro':
      return 'professional';
    default:
      return 'basic';
  }
}

export function formatPlanName(planName: string | null | undefined): string {
  return PLAN_NAME_BY_ID[normalizePlanId(planName)];
}
