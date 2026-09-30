import { Helmet } from "react-helmet-async"
import PricingSection from "../components/PricingSection"

// The three plans with prices held back as "Coming soon" (Louie, 2026-09-30).
// Switches live in data/pricingTiers.js.
export default function Membership() {
  return (
    <>
      <Helmet>
        <title>Membership | CorePhia Weight Loss Program</title>
        <meta
          name="description"
          content="Compare CorePhia membership plans. Every plan pairs you with a licensed provider, dietitian services, and an exercise plan. Pricing is coming soon."
        />
        <link rel="canonical" href="https://www.corephia.com/membership" />
      </Helmet>
      <PricingSection headingAs="h1" />
    </>
  )
}
