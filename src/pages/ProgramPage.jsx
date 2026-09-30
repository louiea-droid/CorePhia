import { Helmet } from "react-helmet-async"
import { Link, Navigate, useParams } from "react-router-dom"
import { CheckCircleIcon, ChevronRightIcon, ClipboardCheckIcon } from "../components/icons"
import Reveal from "../components/Reveal"
import { PROGRAM_NAMES, programs } from "../data/programs"

const sectionHeading = "font-serif text-3xl leading-tight text-ink-950 sm:text-4xl"

// One landing page per program (Dr. Antonious: "each one to have its own
// landing page", with pricing at the bottom). Content lives in data/programs.js.
export default function ProgramPage() {
  const { slug } = useParams()
  const program = programs.find((entry) => entry.slug === slug)
  if (!program) return <Navigate to="/" replace />

  const url = `https://www.corephia.com/programs/${program.slug}`
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: program.faqs.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  }

  return (
    <>
      <Helmet>
        <title>{program.title}</title>
        <meta name="description" content={program.description} />
        <link rel="canonical" href={url} />
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      {/* Same dark band and glow as the homepage programs section, so the page
          reads as that card opened up. The illustration floats on a soft glow
          rather than sitting in its own box. */}
      <section
        aria-labelledby="program-heading"
        data-header-theme="dark"
        className="relative mx-3 mt-4 overflow-hidden rounded-3xl bg-ink-950 sm:mx-4"
      >
        <div className="absolute inset-0 bg-linear-to-tr from-ink-950 via-ink-800 to-brand" />
        {/* Darkens the text side only: the accent headline measured 3.2:1 where
            the gradient brightens toward brand, and at least 5.2:1 with this. */}
        <div className="absolute inset-0 bg-linear-to-r from-ink-950/60 via-ink-950/40 to-transparent" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-0 size-128 translate-x-1/4 -translate-y-1/4 rounded-full bg-accent/20 blur-3xl"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.4fr_1fr]">
          <Reveal>
            <h1 id="program-heading" className="font-serif text-5xl leading-tight text-paper-50 sm:text-6xl">
              {program.name}
            </h1>
            <p className="mt-4 font-serif text-2xl leading-snug text-balance text-accent sm:text-3xl">
              {program.headline}
            </p>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-paper-100/85">{program.intro}</p>
          </Reveal>
          {/* The whole photo in a frame (auto-cutouts looked pasted on). A
              tighter radius than the band so the frame reads as inside it,
              and a navy fade at the foot so the photo settles into the band.
              TODO: Unsplash placeholders; swap for the client's own photos. */}
          <Reveal index={1} className="relative mx-auto w-full max-w-md">
            {/* Glow: an accent bloom weighted to the lower right, where the
                band's gradient already brightens, so the light reads as the
                band's own and not a halo pasted around the photo. */}
            <div className="absolute -inset-8 translate-x-6 translate-y-6 rounded-full bg-accent/45 blur-3xl" />
            {/* Border: a 1.5px gradient rim, bright at the top-left and fading
                out, like light catching the frame's edge. The deep navy
                shadow lifts the frame off the band. */}
            <div className="relative rounded-2xl bg-linear-to-br from-accent via-paper-50/30 to-accent/60 p-0.5 shadow-[0_30px_60px_-12px_rgb(5_10_35/0.8),0_0_60px_-4px_rgb(96_165_250/0.55)]">
              <div className="relative overflow-hidden rounded-[calc(1rem-2px)]">
                <img
                  src={`/programs/${program.slug}.webp`}
                  alt=""
                  width="800"
                  height="600"
                  className="aspect-4/3 w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-ink-950/50 to-transparent" />
                {/* A faint inner edge so light photos don't bleed into the rim. */}
                <div className="absolute inset-0 rounded-[inherit] ring-1 ring-ink-950/20 ring-inset" />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="what-we-do" className="bg-paper-100/60 py-16">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2">
          <Reveal>
            <h2 id="what-we-do" className={sectionHeading}>
              What we do
            </h2>
            <div className="mt-5 space-y-4 text-lg leading-relaxed text-ink-950/70">
              {program.whatWeDo.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </Reveal>
          <Reveal index={1}>
            <h2 className={sectionHeading}>What you get</h2>
            <ul className="mt-5 space-y-3">
              {program.whatYouGet.map((item) => (
                <li key={item} className="flex items-start gap-3 rounded-2xl border border-ink-950/10 bg-white p-4">
                  <CheckCircleIcon className="mt-0.5 size-5 shrink-0 text-accent-dark" />
                  <span className="text-ink-950">{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="how-it-works" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <Reveal>
          <h2 id="how-it-works" className={sectionHeading}>
            How it works
          </h2>
        </Reveal>
        <ol className="mt-8 grid gap-5 sm:grid-cols-3">
          {program.steps.map((step, index) => (
            <Reveal as="li" key={step.title} index={index + 1} className="rounded-3xl border border-ink-950/10 bg-white p-6">
              <span className="flex size-9 items-center justify-center rounded-full bg-ink-950 text-sm font-semibold text-paper-50">
                {index + 1}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-ink-950">{step.title}</h3>
              <p className="mt-2 leading-relaxed text-ink-950/70">{step.body}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      <section aria-labelledby="one-program" className="bg-paper-100/60 py-16">
        <Reveal className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 id="one-program" className={sectionHeading}>
            Part of one program
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-950/70">
            {program.name} works alongside the rest of your CorePhia program. Every member gets all four.
          </p>
          <ul className="mt-6 flex flex-wrap gap-3">
            {PROGRAM_NAMES.filter((name) => name !== program.name).map((name) => {
              const page = programs.find((entry) => entry.name === name)
              const chip = "inline-flex items-center gap-1.5 rounded-full border border-ink-950/10 bg-white px-5 py-3 font-medium text-ink-950"
              return (
                <li key={name}>
                  {page ? (
                    <Link
                      to={`/programs/${page.slug}`}
                      className={`${chip} transition-colors duration-200 ease-out-smooth hover:border-accent-dark`}
                    >
                      {name}
                      <ChevronRightIcon className="size-4 text-ink-950/50" />
                    </Link>
                  ) : (
                    <span className={chip}>{name}</span>
                  )}
                </li>
              )
            })}
          </ul>
        </Reveal>
      </section>

      <section aria-labelledby="program-faq" className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <h2 id="program-faq" className={sectionHeading}>
          Questions
        </h2>
        <Reveal className="mt-6">
          {program.faqs.map(({ q, a }) => (
            <details key={q} className="group border-b border-ink-950/10 last:border-b-0">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-5 py-5 text-left font-medium text-ink-950 transition-colors duration-200 ease-out-smooth hover:text-accent-dark [&::-webkit-details-marker]:hidden">
                {q}
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-ink-950/15 text-ink-950/50 transition-[transform,color,border-color] duration-300 ease-out-smooth group-open:rotate-90 group-open:border-accent-dark/40 group-open:text-accent-dark">
                  <ChevronRightIcon className="size-4" />
                </span>
              </summary>
              <p className="pr-12 pb-5 leading-relaxed text-ink-950/70">{a}</p>
            </details>
          ))}
        </Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <p className="mx-auto max-w-3xl text-center text-xs text-ink-950/70">
          <ClipboardCheckIcon className="mr-1 inline size-3.5 align-[-2px]" />
          Medication is prescribed by a licensed provider as part of your plan. An active CorePhia Weight Loss
          Membership is required. Membership does not include or guarantee a prescription.
        </p>
        <div className="mt-10 flex flex-col items-start gap-6 rounded-3xl bg-ink-950 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <h2 className="font-serif text-3xl text-paper-50">Ready to start your program?</h2>
          <Link
            to="/intake"
            className="inline-flex items-center rounded-full bg-paper-50 px-8 py-4 text-base font-semibold text-ink-950 transition-colors duration-200 ease-out-smooth hover:bg-accent"
          >
            Get started
          </Link>
        </div>
      </section>
    </>
  )
}
