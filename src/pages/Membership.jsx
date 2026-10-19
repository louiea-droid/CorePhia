import { Helmet } from "react-helmet-async"
import PricingSection from "../components/PricingSection"
import { PRICES_ANNOUNCED, tiers } from "../data/pricingTiers"

// The three plans. Switches (plans shown, prices announced) live in
// data/pricingTiers.js, and the description follows them.
export default function Membership() {
  const from = PRICES_ANNOUNCED ? ` From $${tiers[0].price} a month.` : ""
  // Monthly prices for answer engines ("how much does CorePhia cost?"). Plans are
  // memberships in the program, never medication, so no drug appears here.
  const schema = PRICES_ANNOUNCED && {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "CorePhia weight loss program membership",
    url: "https://corephia.com/membership",
    provider: { "@id": "https://corephia.com/#business" },
    areaServed: { "@type": "State", name: "Florida" },
    offers: tiers.map((tier) => ({
      "@type": "Offer",
      name: tier.name,
      price: tier.price,
      priceCurrency: "USD",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: tier.price,
        priceCurrency: "USD",
        unitText: "MONTH",
      },
    })),
  }
  return (
    <>
      <Helmet>
        <title>Membership | CorePhia Weight Loss Program</title>
        <meta
          name="description"
          content={`Compare CorePhia membership plans. Each includes a licensed provider and a personal plan.${from}`}
        />
        <link rel="canonical" href="https://corephia.com/membership" />
        {schema && <script type="application/ld+json">{JSON.stringify(schema)}</script>}
      </Helmet>
      <PricingSection headingAs="h1" />
    </>
  )
}
