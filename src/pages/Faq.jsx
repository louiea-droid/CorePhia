import { Helmet } from "react-helmet-async"
import { Link } from "react-router-dom"
import { ChevronRightIcon, StethoscopeIcon } from "../components/icons"
import { PRICES_ANNOUNCED, tiers } from "../data/pricingTiers"
import Reveal from "../components/Reveal"

const priceList = tiers.map((tier) => `${tier.name} at $${tier.price} per month`).join(", ")

// Answers are plain strings so the same source feeds both the page and the
// FAQPage JSON-LD below — structured data that drifts from the visible copy is
// a search penalty, not just untidy.
const faqGroups = [
  {
    title: "Getting started",
    items: [
      {
        q: "What is CorePhia, exactly?",
        a: "CorePhia is a physician-built weight loss program based in Tampa, Florida. It combines three things: dietitian services built around what you actually eat, an exercise prescription matched to your fitness level, and weight loss medication if a licensed provider prescribes it. You are enrolling in a program, not buying a medication.",
      },
      {
        q: "How do I get started?",
        a: "Start with the patient intake form. It asks for your health history, your current medications and allergies, what a normal day of eating and movement looks like for you, and what you have already tried. Once you submit it, a member of our care team reaches out to arrange your first visit, and your provider reviews your answers before you meet.",
      },
      {
        q: "Who qualifies for the program?",
        a: "Eligibility is a clinical decision rather than a checkbox. A licensed provider reviews your intake, your medical history and your goals, then recommends a plan, including whether medication is appropriate for you. Some patients are a better fit for nutrition and exercise support on its own.",
      },
    ],
  },
  {
    title: "The program",
    items: [
      {
        q: "Is medication included in the price?",
        a: "What you pay for is the program. Medication is one part of that program, and it is prescribed only if a licensed provider decides it is right for you. It is never promised in advance, and it is never the whole plan. CorePhia is not a medication storefront.",
      },
      {
        q: "Do I have to take medication to join?",
        a: "No. The program is built on dietitian services and a structured exercise prescription, and those stand on their own. Medication is added only if your provider judges it appropriate for your situation.",
      },
      {
        q: "What do the nutrition and exercise parts actually involve?",
        a: "A licensed provider documents what they're recommending for you and builds your plan around what you actually eat, rather than handing you a template. Your exercise plan is prescribed the way medication is: matched to your current fitness level, your goals, and what you can realistically sustain, and it progresses as you do.",
      },
      {
        q: "How quickly will I see results?",
        a: "That varies genuinely from person to person, and it depends on your starting point, your health history and which parts of the plan fit your life. CorePhia is built for sustainable change rather than a fast number, so your provider tracks your progress at regular follow-ups and adjusts the plan instead of promising a timeline up front.",
      },
    ],
  },
  {
    title: "Safety and privacy",
    items: [
      {
        q: "Is this safe?",
        a: "Your care is delivered by licensed providers who review your complete history (your conditions, current medications, allergies and family history) before recommending anything. You are then seen at regular follow-ups, so your plan is monitored and adjusted rather than left to run on its own.",
      },
      {
        q: "Who will I be working with?",
        a: "A licensed provider oversees your medical care and a registered dietitian handles the nutrition side. Your provider is board certified in internal medicine and follows your care from your first review.",
      },
      {
        q: "What happens to the health information I submit?",
        a: "Your intake is collected so that your care team can treat you, and you are asked to acknowledge how it will be used before you sign it. It is handled confidentially, and it is not used to sell you unrelated products.",
      },
    ],
  },
  {
    title: "Cost and coverage",
    items: [
      {
        q: "How much does the program cost?",
        a: PRICES_ANNOUNCED
          ? `Membership is billed monthly, with a tier for the level of support you want: ${priceList}. Each tier lists exactly what it includes on our membership page.`
          : "Membership is billed monthly, with a tier for the level of support you want. Each tier lists exactly what it includes on our membership page, and prices are coming soon.",
      },
      {
        // Cash only (client decision 2026-09-29), worded to match the program
        // pages. TODO: HSA and FSA cards are still unconfirmed, so they aren't mentioned.
        q: "Do you accept insurance?",
        a: "No. CorePhia is cash pay, so there are no insurance approvals or claims standing between you and your care. Membership is billed monthly, and what each tier includes is listed on our membership page.",
      },
      {
        // TODO: replace with the actual list of licensed states once the client confirms it.
        q: "Where do you operate?",
        a: "CorePhia is based in Tampa, Florida, and your care is provided by a licensed provider. Because licensure determines where a provider is able to treat you, contact us to confirm that we can care for you where you live.",
      },
    ],
  },
]

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqGroups.flatMap((group) =>
    group.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  ),
}

function FaqItem({ question, answer }) {
  return (
    <details className="group border-b border-ink-950/10 last:border-b-0">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-5 py-5 text-left font-medium text-ink-950 transition-colors duration-200 ease-out-smooth hover:text-accent-dark [&::-webkit-details-marker]:hidden">
        {question}
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-ink-950/15 text-ink-950/50 transition-[transform,color,border-color] duration-300 ease-out-smooth group-open:rotate-90 group-open:border-accent-dark/40 group-open:text-accent-dark">
          <ChevronRightIcon className="size-4" />
        </span>
      </summary>
      <p className="pr-12 pb-5 leading-relaxed text-ink-950/70">{answer}</p>
    </details>
  )
}

export default function Faq() {
  return (
    <>
      <Helmet>
        <title>FAQs | CorePhia Weight Loss Programs in Tampa</title>
        <meta
          name="description"
          content="Answers to common questions about CorePhia's weight loss program in Tampa, Florida: who qualifies, how medication is prescribed, what the program costs, and how your care is delivered."
        />
        <link rel="canonical" href="https://www.corephia.com/faq" />
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      <section aria-labelledby="faq-heading" className="mx-auto max-w-4xl px-4 pt-16 pb-12 sm:px-6">
        <p className="text-xs font-semibold tracking-widest text-accent-dark uppercase">FAQs</p>
        <h1 id="faq-heading" className="mt-3 font-serif text-4xl leading-tight text-ink-950 sm:text-5xl">
          Questions worth
          <br />
          <span className="text-accent-dark">a straight answer.</span>
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-ink-950/70">
          What the program includes, how medication is actually handled, who it's for and what it costs. If
          something you need isn't here, ask us directly. We would rather answer it properly.
        </p>
      </section>

      {faqGroups.map((group, groupIndex) => (
        <section
          key={group.title}
          aria-labelledby={`faq-group-${groupIndex}`}
          className={groupIndex % 2 === 1 ? "bg-paper-100/60 py-14 sm:py-16" : "py-14 sm:py-16"}
        >
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <Reveal>
              <h2
                id={`faq-group-${groupIndex}`}
                className="font-serif text-2xl leading-tight text-ink-950 sm:text-3xl"
              >
                {group.title}
              </h2>
              <div className="mt-6">
                {group.items.map((item) => (
                  <FaqItem key={item.q} question={item.q} answer={item.a} />
                ))}
              </div>
            </Reveal>
          </div>
        </section>
      ))}

      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <Reveal>
          <div className="flex flex-col items-start gap-5 rounded-3xl bg-gradient-to-br from-ink-950 via-ink-900 to-accent-dark p-8 sm:p-12">
            <StethoscopeIcon className="size-10 text-accent" />
            <h2 className="font-serif text-2xl leading-tight text-paper-100 sm:text-3xl">
              Still have a question?
            </h2>
            <p className="max-w-md text-paper-100/70">
              Ask us before you commit to anything. A member of our care team can walk you through how the
              program would work for you.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/intake"
                className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-ink-950 transition-colors duration-200 ease-out-smooth hover:bg-accent-dark"
              >
                Get started
              </Link>
              <Link
                to="/contact"
                className="rounded-full border border-paper-100/25 px-6 py-3 text-sm font-semibold text-paper-100 transition-colors duration-200 ease-out-smooth hover:bg-paper-100/10"
              >
                Contact us
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  )
}
