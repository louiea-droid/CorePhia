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
    // Elation membership sign-up; the intake sends the patient here after the
    // form is saved (Louie, 2026-11-13).
    enrollUrl: "https://app.elationemr.com/membership/1449583043739652/1451540339032515",
    // The few lines the intake's plan cards show (taken from features). No
    // medication line there: that step leads straight to payment, and the
    // program, not a medication, is what's paid for (CLAUDE.md).
    highlights: [
      "Physician consultation & medical evaluation",
      "Personalized nutrition guidance",
      "Workout & lifestyle recommendations",
      "Monthly progress review with provider",
    ],
    popular: false,
    features: [
      "Physician consultation & medical evaluation",
      "Personalized weight loss plan",
      "Prescription medication",
      "Personalized nutrition guidance",
      "Dietitian discussion and macro/calorie tracking (every quarter)",
      "Workout & lifestyle recommendations",
      "Monthly progress review with provider",
      "Patient support through your portal",
    ],
  },
  {
    name: "Core Complete",
    tagline: "The complete transformation",
    icon: CrownIcon,
    description: "Our most hands-on plan, with more time from your provider, dietitian and trainer.",
    price: "349",
    enrollUrl: "https://app.elationemr.com/membership/1449583043739652/1451543320199619",
    highlightsLead: "Everything in Core, plus",
    highlights: [
      "Custom meal plans from your dietitian",
      "1:1 exercise plan with certified trainer check-ins",
      "Advanced lab testing (twice a year)",
      "Extra provider visits between your monthly reviews",
    ],
    popular: false,
    // Visit counts and trainer frequency still to be confirmed by the client
    // (2026-11-02); "Unlimited provider access" and "VIP experience" removed.
    features: [
      "Everything in Core",
      "Custom meal plans from your dietitian",
      "1:1 exercise plan with certified trainer check-ins",
      "Advanced lab testing (twice a year)",
      "Extra provider visits between your monthly reviews",
    ],
  },
]
