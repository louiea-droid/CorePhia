import { PRICES_ANNOUNCED, tiers } from "../data/pricingTiers"
import { useReveal } from "../hooks/useReveal"
import { BadgeCheckIcon, LockIcon, PillBottleIcon, ShieldCheckIcon, TrendingUpIcon } from "./icons"

const trustBadges = [
  { label: "Doctor Led Care", detail: "Expert care from licensed providers.", icon: ShieldCheckIcon },
  {
    label: "Medication Available",
    detail: "FDA-approved medication, prescribed.",
    icon: PillBottleIcon,
  },
  { label: "Proven Results", detail: "Real people, tracked over time.", icon: TrendingUpIcon },
  { label: "Safe & Confidential", detail: "Your health information stays private", icon: LockIcon },
]

// Each card is a subgrid over three shared rows (header, price, features), so
// the price and the feature list start at the same height in every card even
// when one description runs longer. No buttons on or under the cards (Louie,
// 2026-09-30); the plan is picked in the intake.
function PricingCard({ tier, index }) {
  const [ref, visible] = useReveal()

  return (
    <li
      ref={ref}
      data-reveal={visible ? "shown" : "hidden"}
      style={{ "--reveal-i": index + 1 }}
      className="grid lg:row-span-3 lg:grid-rows-subgrid"
    >
      <article
        // All three plans look the same (Louie, 2026-09-30): no "Most popular"
        // badge or highlighted card while the plans themselves are unconfirmed.
        className="grid gap-6 rounded-3xl border border-ink-950/10 bg-white/70 p-6 shadow-md sm:p-8 lg:row-span-3 lg:grid-rows-subgrid"
      >
        <header>
          <span className="flex size-11 items-center justify-center rounded-2xl bg-accent/12 text-accent-dark">
            <tier.icon className="size-5" />
          </span>
          <h3 className="mt-5 font-serif text-2xl text-ink-950">{tier.name}</h3>
          <p className="mt-1 text-sm font-medium text-accent-dark">{tier.tagline}</p>
          <p className="mt-3 text-sm leading-relaxed text-ink-950/70">{tier.description}</p>
        </header>

        <div className="border-y border-ink-950/10 py-5">
          {PRICES_ANNOUNCED ? (
            <p className="font-serif text-4xl text-ink-950">
              <span className="align-top text-xl">$</span>
              {tier.price}
              <span className="ml-1 font-sans text-sm font-medium text-ink-950/60">per month</span>
            </p>
          ) : (
            <p className="inline-flex items-center gap-2 rounded-full bg-accent/12 px-3.5 py-1.5 text-sm font-semibold text-accent-dark">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-accent-dark" />
              Pricing coming soon
            </p>
          )}
        </div>

        <ul className="space-y-3">
          {tier.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm text-ink-950/75">
              <BadgeCheckIcon className="mt-0.5 size-5 shrink-0 text-accent-dark" />
              {feature}
            </li>
          ))}
        </ul>
      </article>
    </li>
  )
}

// Rendered as the page heading on /pricing, a section heading anywhere else.
export default function PricingSection({ headingAs: Heading = "h2" }) {
  const [headingRef, headingVisible] = useReveal()
  const [badgesRef, badgesVisible] = useReveal()

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="bg-linear-to-br from-paper-50 via-paper-100 to-accent/15 py-12 sm:py-16 lg:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 text-center sm:px-6">
        <div
          ref={headingRef}
          data-reveal={headingVisible ? "shown" : "hidden"}
        >
          <Heading id="pricing-heading" className="font-serif text-4xl leading-tight text-ink-950 sm:text-5xl">
            Choose your <span className="text-accent-dark">membership</span>
          </Heading>
          <p className="mx-auto mt-4 max-w-xl text-ink-950/70">
            {PRICES_ANNOUNCED
              ? "Every plan pairs you with a licensed provider. Pricing reflects a monthly membership. Cancel anytime."
              : "Every plan pairs you with a licensed provider."}
          </p>
        </div>

        <ul className="mt-12 grid gap-6 text-left lg:grid-cols-3">
          {tiers.map((tier, index) => (
            <PricingCard key={tier.name} tier={tier} index={index} />
          ))}
        </ul>

        <ul
          ref={badgesRef}
          data-reveal={badgesVisible ? "shown" : "hidden"}
          className="mt-10 grid gap-6 rounded-3xl bg-paper-100 p-6 sm:mt-12 sm:grid-cols-2 sm:p-8 lg:grid-cols-4"
        >
          {trustBadges.map(({ label, detail, icon: Icon }) => (
            <li key={label} className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
              <Icon className="size-7 text-accent-dark" />
              <p className="font-semibold text-ink-950">{label}</p>
              <p className="text-sm text-ink-950/60">{detail}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
