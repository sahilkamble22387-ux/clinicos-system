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
            { name: 'Up to 50 patients/month', included: true },
            { name: 'Basic patient records', included: true },
            { name: 'Email support', included: true },
            { name: 'Manual check-in only', included: true },
            { name: 'QR code check-in system', included: false },
            { name: 'Advanced patient analytics', included: false },
            { name: 'Doctor portal access', included: false },
            { name: 'API access for integrations', included: false },
        ],
    },
    {
        id: 'professional',
        name: 'Professional',
        price: 2499,
        currency: '₹',
        interval: 'month',
        description: 'Everything you need to run a growing practice efficiently.',
        badge: 'Most Popular',
        highlighted: true,
        theme: 'primary',
        features: [
            { name: 'Up to 500 patients/month', included: true },
            { name: 'Basic patient records', included: true },
            { name: 'Priority email & chat support', included: true },
            { name: 'Manual check-in', included: true },
            { name: 'QR code check-in system', included: true },
            { name: 'Advanced patient analytics', included: true },
            { name: 'Doctor portal access', included: true },
            { name: 'Monthly reports', included: true },
            { name: 'Custom clinic branding', included: true },
            { name: 'API access for integrations', included: false },
        ],
    },
    {
        id: 'premium',
        name: 'Premium',
        price: 4999,
        currency: '₹',
        interval: 'month',
        description: 'Advanced capabilities for high-volume clinics and hospitals.',
        badge: 'Best Value',
        highlighted: false,
        theme: 'dark',
        features: [
            { name: 'Unlimited patients', included: true },
            { name: 'Comprehensive patient records', included: true },
            { name: 'Phone, email & chat support', included: true },
            { name: 'QR code check-in system', included: true },
            { name: 'Advanced analytics & insights', included: true },
            { name: 'Doctor portal access', included: true },
            { name: 'Automated custom reports', included: true },
            { name: 'Custom clinic branding', included: true },
            { name: 'Mobile app access', included: true },
            { name: 'API access for integrations', included: true },
            { name: 'Dedicated account manager', included: true },
            { name: 'Custom features consultation', included: true },
            { name: 'White-label option', included: true },
        ],
    },
];

export const faqs = [
    {
        question: "How does the free trial work?",
        answer: "You get full access to the Professional tier for 14 days. No credit card required. You can upgrade, downgrade, or cancel at any time during the trial."
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
        answer: "Yes! If you choose to be billed annually rather than monthly, you receive a 20% discount across all our pricing tiers."
    },
    {
        question: "Is my patients' data secure?",
        answer: "Security is our top priority. All data is encrypted at rest and in transit. We comply with all major health data protection regulations and perform regular security audits."
    },
    {
        question: "What kind of support is included?",
        answer: "All plans include email support. Professional plans add priority chat support, and Premium plans include 24/7 phone support and a dedicated account manager."
    }
];
