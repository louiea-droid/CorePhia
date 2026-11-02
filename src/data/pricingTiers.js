import { CrownIcon, LeafIcon } from "../components/icons"

// Shared so the pricing cards and the FAQ quote the same prices. Lives outside
// PricingSection because exporting non-components from a component file breaks
// Fast Refresh.
// Two switches (Louie, 2026-09-30):
// - PLANS_SHOWN: the two plans appear (Core+ merged into Core at $299, 2026-11-02) on /membership, and the intake asks
//   which plan (the "Choose {plan}" buttons preselect it via ?plan=).
// - PRICES_ANNOUNCED: while false, every price reads "Coming soon" (plan cards
//   and the FAQ). Set true once the client confirms real prices below.
export const PLANS_SHOWN = true
export const PRICES_ANNOUNCED = true

export const tiers = [
  {
    name: "Core",
    tagline: "Build the foundation",
    icon: LeafIcon,
    description: "Essential support to kickstart your journey, with nutrition and workout guidance.",
    price: "299",
    popular: false,
    features: [
      "Physician consultation & medical evaluation",
      "Personalized weight loss plan",
      "Prescription medication",
      "Regular progress check-ins",
      "Patient support through your portal",
      "Personalized nutrition guidance",
      "Advanced macro/calorie tracking & dietitian discussion (every quarter)",
      "Workout & lifestyle recommendations",
      "Priority support",
      "Monthly progress review with provider",
    ],
  },
  {
    name: "Core Complete",
    tagline: "The complete transformation",
    icon: CrownIcon,
    description: "Our most comprehensive program for maximum and lasting results.",
    price: "349",
    popular: false,
    features: [
      "Everything in Core",
      "Custom meal planning",
      "Exercise recommendations based on your goal",
      "Advanced lab testing (2x per year)",
      "1:1 certified trainer check-ins",
      "Unlimited provider access",
      "VIP experience",
    ],
  },
]
