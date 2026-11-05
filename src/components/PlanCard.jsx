import { PRICES_ANNOUNCED } from "../data/pricingTiers"
import { BadgeCheckIcon } from "./icons"

// One membership plan: icon, name, tagline, description, price, features.
// Used on /membership (PricingSection) and in the portal's plan choice, which
// passes its own card classes, a `tag` under the description and a button as
// children.
export default function PlanCard({ tier, className, tag, children }) {
  return (
    <article className={className}>
      <header>
        <span className="flex size-11 items-center justify-center rounded-2xl bg-accent/12 text-accent-dark">
          <tier.icon className="size-5" />
        </span>
        <h2 className="mt-5 font-serif text-2xl text-ink-950">{tier.name}</h2>
        <p className="mt-1 text-sm font-medium text-accent-dark">{tier.tagline}</p>
        <p className="mt-3 text-sm leading-relaxed text-ink-950/70">{tier.description}</p>
        {tag}
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

      {children}
    </article>
  )
}
