import { Helmet } from "react-helmet-async"
import { Link } from "react-router-dom"
import { PersonAvatar } from "../components/Artwork"
import { useReveal } from "../hooks/useReveal"
import { ClipboardCheckIcon, LeafIcon, MapPinIcon, PillBottleIcon, StethoscopeIcon } from "../components/icons"

const pillars = [
    {
    icon: PillBottleIcon,
    title: "Medication Management",
    body: "A licensed provider prescribes and manages your medication as one part of your program — never as the whole plan.",
  },
  {
    icon: LeafIcon,
    title: "Dietitian services",
    body: "A licensed provider assesses and documents what's best for you, and your plan is built around what you actually eat — not a template.",
  },
  {
    icon: ClipboardCheckIcon,
    title: "Exercise prescriptions",
    body: "Movement is prescribed the way medication is: matched to your fitness level, your goals, and what you can realistically sustain.",
  },

]

function Reveal({ children, className = "", delay = 0 }) {
  const [ref, visible] = useReveal()
  return (
    <div
      ref={ref}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
      className={`transition-all duration-700 ease-out-smooth ${
        visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  )
}

export default function About() {
  return (
    <>
      <Helmet>
        <title>About CorePhia — Physician-Built Weight Loss Programs in Tampa</title>
        <meta
          name="description"
          content="CorePhia is a physician-built weight loss program based in Tampa, Florida, combining dietitian services, exercise prescriptions, and medication when clinically appropriate. Founded by Dr. Daniel Antonious, MD."
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
          services, exercise prescriptions, and — when it's clinically appropriate — weight loss medication,
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
                whether you're moving, whether any of it is working — that's not really their concern, and if
                the medication stops, there's nothing else behind it.
              </p>
              <p className="leading-relaxed">
                CorePhia exists to be the alternative.{" "}
                <span className="text-paper-100">Dietitian services and an exercise prescription are full parts
                of the program</span>, not an afterthought — and medication is something a licensed provider
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
              <Reveal delay={index * 90} className="h-full">
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
              Before your first visit, you complete a full intake form — your history, your medications and allergies,
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
              Start your journey
            </Link>
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="founder-heading" className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
        <Reveal>
          <h2 id="founder-heading" className="font-serif text-3xl leading-tight text-ink-950 sm:text-4xl">
            The physician behind CorePhia
          </h2>
          <div className="mt-8 flex flex-col gap-8 sm:flex-row sm:items-start">
            <span className="size-28 shrink-0 overflow-hidden rounded-full bg-paper-200/70 ring-4 ring-paper-100">
              <PersonAvatar className="h-full w-full" tone="#2563eb" />
            </span>
            <div>
              <h3 className="font-serif text-2xl text-ink-950">Dr. Daniel Antonious, MD</h3>
              <p className="mt-1 text-sm font-medium text-accent-dark">
                Double board certified in Internal Medicine
              </p>
              <p className="mt-4 leading-relaxed text-ink-950/70">
                Dr. Antonious spent years in internal medicine before he started CorePhia. What bothered him was how often weight loss got treated like a prescription problem — a pill, a monthly fee, and nothing said about how someone actually eats or moves day to day. CorePhia pairs dietitian services and an exercise prescription with medication, and medication only enters the plan when a licensed provider decides it's clinically appropriate.
              </p>
              <p className="mt-4 flex items-center gap-2 text-sm text-ink-950/60">
                <MapPinIcon className="size-4 shrink-0 text-accent-dark" />
                Based in Tampa, Florida
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-20 sm:px-6">
        <Reveal>
          <div className="flex flex-col items-start gap-5 rounded-3xl bg-gradient-to-br from-ink-950 via-ink-900 to-accent-dark p-8 sm:p-12">
            <StethoscopeIcon className="size-10 text-accent" />
            <h2 className="font-serif text-2xl leading-tight text-paper-100 sm:text-3xl">
              Ready to start the right way?
            </h2>
            <p className="max-w-md text-paper-100/70">
              Tell us about yourself and a member of our care team will reach out to get you started.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/intake"
                className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-ink-950 transition-[transform,background-color] duration-200 ease-out-smooth hover:scale-[1.02] hover:bg-accent-dark"
              >
                Start your journey
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
