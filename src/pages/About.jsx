import { Helmet } from "react-helmet-async"
import { Link } from "react-router-dom"
import Reveal from "../components/Reveal"
import { PROVIDER_BIO, ProviderFacts, ProviderMark, providerCard } from "../components/TeamSection"
import { ClipboardCheckIcon, LeafIcon, PillBottleIcon } from "../components/icons"

const pillars = [
    {
    icon: PillBottleIcon,
    title: "Medication Management",
    body: "A licensed provider prescribes and manages your medication as one part of your program, never as the whole plan.",
  },
  {
    icon: LeafIcon,
    title: "Dietitian services",
    body: "A licensed provider assesses and documents what's best for you, and your plan is built around what you actually eat, not a template.",
  },
  {
    icon: ClipboardCheckIcon,
    title: "Exercise prescriptions",
    body: "Movement is prescribed the way medication is: matched to your fitness level, your goals, and what you can realistically sustain.",
  },

]

// Published outside research the program is modelled on, not CorePhia
// results (Louie, 2026-09-30). Figures checked against each paper. Kept to
// lifestyle trials on purpose: no medication trials, so medication is never
// the headline. Dr. Antonious should review before launch.
const studies = [
  {
    figure: "58%",
    name: "Diabetes Prevention Program",
    source: "New England Journal of Medicine, 2002",
    body: "Adults at high risk of type 2 diabetes aimed to lose 7% of their body weight and stay active 150 minutes a week. Over about three years, their risk of developing diabetes fell by 58%.",
    href: "https://pubmed.ncbi.nlm.nih.gov/11832527/",
  },
  {
    figure: "8.6%",
    name: "Look AHEAD",
    source: "Diabetes Care, 2007",
    body: "Adults with type 2 diabetes in an intensive lifestyle program lost an average of 8.6% of their body weight in the first year, compared with 0.7% in the comparison group, and improved their fitness, blood sugar and blood pressure.",
    href: "https://pubmed.ncbi.nlm.nih.gov/17363746/",
  },
  {
    figure: "5 to 10%",
    name: "Why modest loss matters",
    source: "Diabetes Care, 2011",
    body: "In the same study, losing 5 to 10% of body weight was linked to real improvements in blood pressure, blood sugar and cholesterol within a year. Losing more brought bigger benefits.",
    href: "https://pubmed.ncbi.nlm.nih.gov/21593294/",
  },
]

export default function About() {
  return (
    <>
      <Helmet>
        <title>About CorePhia | Physician-Built Weight Loss Programs in Tampa</title>
        <meta
          name="description"
          content="CorePhia is a physician-built weight loss program based in Tampa, Florida, combining dietitian services, exercise prescriptions, and medication when clinically appropriate. Care is led by a provider board certified in internal medicine."
        />
        <link rel="canonical" href="https://www.corephia.com/about" />
      </Helmet>

      <section aria-labelledby="about-heading" className="mx-auto max-w-4xl px-4 pt-16 pb-12 sm:px-6">
        <p className="text-xs font-semibold tracking-widest text-accent-dark uppercase">About us</p>
        <h1 id="about-heading" className="mt-3 font-serif text-4xl leading-tight text-ink-950 sm:text-5xl">
          Doing weight loss
          <br />
          <span className="text-accent-dark">the right way.</span>
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-ink-950/70">
          CorePhia is a physician-built weight loss program based in Tampa, Florida. We combine dietitian
          services, exercise prescriptions, and, when clinically appropriate, weight loss medication,
          all guided by evidence-based medicine and a licensed provider.
        </p>
      </section>

      <section aria-labelledby="mission-heading" className="bg-ink-950 py-12 sm:py-16 lg:py-20" data-header-theme="dark">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <Reveal>
            <h2 id="mission-heading" className="font-serif text-3xl leading-tight text-paper-100 sm:text-4xl">
              Why we exist
            </h2>
            <div className="mt-6 space-y-5 text-paper-100/70">
              <p className="leading-relaxed">
                Most weight loss companies sell a subscription with a medication attached to it. What you eat,
                whether you're moving, whether any of it is working: that's not really their concern, and if
                the medication stops, there's nothing else behind it.
              </p>
              <p className="leading-relaxed">
                CorePhia exists to be the alternative.{" "}
                <span className="text-paper-100">Dietitian services and an exercise prescription are full parts
                of the program</span>, not an afterthought, and medication is something a licensed provider
                adds when it's clinically appropriate, never the whole plan on its own.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="approach-heading" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
        <Reveal>
          <h2 id="approach-heading" className="font-serif text-3xl leading-tight text-ink-950 sm:text-4xl">
            What the program is built on
          </h2>
        </Reveal>
        <ul className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-3">
          {pillars.map(({ icon: Icon, title, body }, index) => (
            <li key={title}>
              <Reveal index={index + 1} className="h-full">
                <article className="flex h-full flex-col gap-2.5 rounded-3xl bg-paper-100 p-6 sm:gap-3 sm:p-7">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-paper-200/70 text-accent-dark">
                    <Icon className="size-6" />
                  </span>
                  <h3 className="font-serif text-xl text-ink-950">{title}</h3>
                  <p className="text-sm leading-relaxed text-ink-950/70">{body}</p>
                </article>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="standard-heading" className="bg-paper-100/60 py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <Reveal>
            <h2 id="standard-heading" className="font-serif text-3xl leading-tight text-ink-950 sm:text-4xl">
              Every patient, the same standard
            </h2>
            <p className="mt-6 leading-relaxed text-ink-950/70">
              Before your first visit, you complete a full intake form: your history, your medications and allergies,
              what you eat and drink in a day, how you move, and what you've already tried. Every patient answers
              the same questions, so nothing gets missed and your provider walks into your appointment already
              knowing your story.
            </p>
            <p className="mt-4 leading-relaxed text-ink-950/70">
              From there it's structure: regular follow-ups, documented recommendations from your dietitian, and
              the ability to track your weight and results over time.
            </p>
            <Link
              to="/intake"
              className="mt-8 inline-flex rounded-full bg-ink-950 px-6 py-3 text-sm font-semibold text-paper-50 transition-colors duration-200 ease-out-smooth hover:bg-ink-900"
            >
              Get started
            </Link>
          </Reveal>
        </div>
      </section>

      <section id="research" aria-labelledby="research-heading" className="scroll-mt-24 py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal className="max-w-3xl">
            <h2 id="research-heading" className="font-serif text-3xl leading-tight text-ink-950 sm:text-4xl">
              What the research shows
            </h2>
            <p className="mt-5 leading-relaxed text-ink-950/70">
              CorePhia is built on the approach that NIH-funded studies have tested for decades: better eating, more
              activity, and steady support, together. These results come from those studies, not from CorePhia
              patients, and results vary from person to person.
            </p>
          </Reveal>
          <ul className="mt-8 grid gap-4 sm:mt-10 lg:grid-cols-3">
            {studies.map((study, index) => (
              <li key={study.name}>
                <Reveal index={index + 1} className="h-full">
                  <article className="flex h-full flex-col rounded-3xl border border-ink-950/10 bg-white p-6 sm:p-7">
                    <p className="font-serif text-5xl leading-none text-accent-dark">{study.figure}</p>
                    <h3 className="mt-5 text-lg font-semibold text-ink-950">{study.name}</h3>
                    <p className="mt-1 text-sm text-ink-950/60 italic">{study.source}</p>
                    <p className="mt-4 text-sm leading-relaxed text-ink-950/70">{study.body}</p>
                    <a
                      href={study.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-auto inline-flex w-fit items-center gap-1 pt-5 text-sm font-semibold text-accent-dark underline-offset-4 hover:underline"
                    >
                      Read the study
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </article>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="founder-heading" className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
        <Reveal className="relative">
          <div aria-hidden="true" className="absolute -inset-6 translate-x-4 translate-y-4 rounded-full bg-accent/15 blur-3xl" />
          <div className={providerCard}>
            <div className="flex items-center gap-4">
              <ProviderMark />
              <h2 id="founder-heading" className="font-serif text-3xl leading-tight text-ink-950 sm:text-4xl">
                About our provider
              </h2>
            </div>
            <ProviderFacts className="mt-6" />
            <p className="mt-5 text-lg leading-relaxed text-ink-950/70">{PROVIDER_BIO}</p>
          </div>
        </Reveal>
      </section>
    </>
  )
}
