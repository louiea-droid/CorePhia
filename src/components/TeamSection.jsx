import { useReveal } from "../hooks/useReveal"
import { CheckCircleIcon, ClipboardCheckIcon, MapPinIcon, StethoscopeIcon } from "./icons"

// Unnamed on purpose: the client asked for "our provider" (meeting, ¶21-23).
// No picture either: the illustrated avatar read as a fake person, and a stock
// doctor photo would pass for him. The card leads with confirmed facts instead
// (Louie, 2026-09-30). Add a fact here only once the client confirms it.
const PROVIDER_FACTS = [
  { label: "Board certified in Internal Medicine", icon: ClipboardCheckIcon },
  { label: "Evidence-based care", icon: CheckCircleIcon },
  { label: "Based in Tampa, Florida", icon: MapPinIcon },
]

export const PROVIDER_BIO =
  "Our provider is board certified in internal medicine and started CorePhia after years of watching insurance companies and approval processes stand between patients and the care they need. The focus is evidence-based, quality care built around you, and your full history stays with your care from your first visit to your last."

// Homepage card: shorter, since the tags above it already carry the credential.
const PROVIDER_BIO_SHORT =
  "Our provider started CorePhia after years of watching insurance approvals stand between patients and the care they need. The focus is evidence-based, quality care built around you."

/** Stethoscope mark. Always sits beside a heading so it labels something. */
export function ProviderMark() {
  return (
    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent-dark">
      <StethoscopeIcon className="size-6" />
    </span>
  )
}

/** Confirmed facts about the provider as tags. Shared by this section and About. */
export function ProviderFacts({ className = "" }) {
  return (
    <ul className={`flex flex-wrap gap-2 ${className}`}>
      {PROVIDER_FACTS.map(({ label, icon: Icon }) => (
        <li
          key={label}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink-950/10 bg-paper-50 px-3 py-1.5 text-sm font-medium text-ink-950"
        >
          <Icon className="size-4 shrink-0 text-accent-dark" />
          {label}
        </li>
      ))}
    </ul>
  )
}

/** The card surface both pages use for the provider. */
export const providerCard =
  "relative rounded-3xl border border-paper-50 bg-white/80 p-6 shadow-[0_24px_50px_-20px_rgb(13_26_61/0.35)] sm:p-8"

// Heading and card side by side on desktop, so the heading introduces the
// card beside it instead of floating centred above a narrow column.
export default function TeamSection() {
  const [ref, visible] = useReveal()

  return (
    <section
      aria-labelledby="team-heading"
      className="bg-linear-to-br from-paper-50 via-paper-100 to-accent/15 py-12 sm:py-16 lg:py-24"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div>
          <h2 id="team-heading" className="font-serif text-4xl leading-tight text-ink-950 sm:text-5xl">
            <span className="text-accent-dark">Real medical care</span>
            <br />
            built around your life
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-950/70">
            Meet our provider, who guides every CorePhia patient's care.
          </p>
        </div>

        <div ref={ref} data-reveal={visible ? "shown" : "hidden"} style={{ "--reveal-i": 1 }} className="relative">
          <div aria-hidden="true" className="absolute -inset-6 translate-x-4 translate-y-4 rounded-full bg-accent/20 blur-3xl" />
          <article className={providerCard}>
            <div className="flex items-center gap-4">
              <ProviderMark />
              <p className="font-serif text-2xl text-ink-950">Our provider</p>
            </div>
            <ProviderFacts className="mt-5" />
            <p className="mt-5 leading-relaxed text-ink-950/70">{PROVIDER_BIO_SHORT}</p>
          </article>
        </div>
      </div>
    </section>
  )
}
