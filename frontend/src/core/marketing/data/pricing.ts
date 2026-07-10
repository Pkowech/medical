export const pricingTiers = [
  {
    name: 'Student',
    price: '$9.99',
    priceSuffix: '/ month',
    description: 'Essential core features for medical students starting their journey.',
    features: [
      'Access to 100+ basic medical courses',
      'Personalized AI study plans',
      'Unified progress dashboard',
      'Community forum access',
      'Standard email support',
    ],
    cta: 'Start Learning Now',
  },
  {
    name: 'Physician Pro',
    price: '$24.99',
    priceSuffix: '/ month',
    description: 'Advanced clinical tools for professional practitioners and residents.',
    features: [
      'Everything in Student',
      'High-yield clinical case simulations',
      'Advanced AI-driven diagnosis patterns',
      'Unlimited MCQ & Flashcard bank',
      'Priority expert support (2-hr response)',
    ],
    cta: 'Unlock Pro Features',
  },
  {
    name: 'Institutional',
    price: 'Custom',
    priceSuffix: '',
    description: 'Scalable medical education solutions for hospitals and universities.',
    features: [
      'Everything in Physician Pro',
      'Institutional performance analytics',
      'White-label curriculum options',
      'Dedicated success manager',
      'Enterprise-grade security & SSO',
    ],
    cta: 'Connect with Sales',
  },
];
