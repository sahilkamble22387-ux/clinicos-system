export interface PricingFeature {
    name: string;
    included: boolean;
}

export interface PricingTier {
    id: string;
    name: string;
    price: number;
    currency: string;
    interval: string;
    description: string;
    features: PricingFeature[];
    badge?: string;
    highlighted: boolean;
    theme: 'light' | 'primary' | 'dark';
}

export const pricingTiers: PricingTier[] = [
    {
        id: 'basic',
        name: 'Basic',
        price: 499,
        currency: '₹',
        interval: 'month',
        description: 'Essential tools for small clinics just getting started.',
        highlighted: false,
        theme: 'light',
        features: [
            { name: 'Full clinic workspace access', included: true },
            { name: 'Unlimited patients and records', included: true },
            { name: 'QR code check-in system', included: true },
            { name: 'Analytics dashboard and exports', included: true },
            { name: 'Doctor portal access', included: true },
            { name: 'Admin-controlled clinic access', included: true },
        ],
    },
    {
        id: 'professional',
        name: 'Professional',
        price: 999,
        currency: '₹',
        interval: 'month',
        description: 'Everything you need to run a growing practice efficiently.',
        badge: 'Most Popular',
        highlighted: true,
        theme: 'primary',
        features: [
            { name: 'Everything in Basic', included: true },
            { name: 'Priority email & chat support', included: true },
            { name: 'QR code check-in system', included: true },
            { name: 'Founder onboarding assistance', included: true },
            { name: 'Doctor portal access', included: true },
            { name: 'Unlimited patients and records', included: true },
            { name: 'Custom clinic branding', included: true },
            { name: 'No patient-data usage limit', included: true },
        ],
    },
];

export const faqs = [
    {
        question: "How does the free trial work?",
        answer: "You get full access to the Professional tier for 30 days. No credit card required. You can upgrade, downgrade, or cancel at any time during the trial."
    },
    {
        question: "Can I change my plan later?",
        answer: "Absolutely. You can upgrade or downgrade your plan at any time from your billing dashboard. Changes take effect on your next billing cycle."
    },
    {
        question: "What happens if I exceed my patient limit?",
        answer: "We won't interrupt your service. We will notify you when you reach 90% of your limit. If you exceed it, we'll automatically upgrade you to the next tier for the following month."
    },
    {
        question: "Do you offer discounts for annual billing?",
        answer: "Yes. Annual billing is discounted by 17% compared with paying monthly."
    },
    {
        question: "Is my patients' data secure?",
        answer: "Security is our top priority. All data is encrypted at rest and in transit. We comply with all major health data protection regulations and perform regular security audits."
    },
    {
        question: "What kind of support is included?",
        answer: "All plans include support. Professional adds priority handling and rollout help for growing clinics."
    }
];
