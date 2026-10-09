import { Helmet } from "react-helmet-async"
import PricingSection from "../components/PricingSection"
import { PRICES_ANNOUNCED, tiers } from "../data/pricingTiers"

// The three plans. Switches (plans shown, prices announced) live in
// data/pricingTiers.js, and the description follows them.
export default function Membership() {
  const from = PRICES_ANNOUNCED ? ` From $${tiers[0].price} a month.` : ""
  return (
    <>
      <Helmet>
        <title>Membership | CorePhia Weight Loss Program</title>
        <meta
          name="description"
          content={`Compare CorePhia membership plans. Each includes a licensed provider and a personal plan; higher tiers add dietitian and exercise support.${from}`}
        />
        <link rel="canonical" href="https://www.corephia.com/membership" />
      </Helmet>
      <PricingSection headingAs="h1" />
    </>
  )
}
