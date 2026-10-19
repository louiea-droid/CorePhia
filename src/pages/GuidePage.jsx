import { Helmet } from "react-helmet-async"
import { Link, useParams } from "react-router-dom"
import { ChevronRightIcon } from "../components/icons"
import ReviewedLine, { LAST_REVIEWED } from "../components/ReviewedLine"
import { guides } from "../data/guides"
import { programs } from "../data/programs"
import NotFound from "./NotFound"

// One plain-language guide per page, from data/guides.js. Read like an article:
// one column, serif headings, nothing competing with the text.
export default function GuidePage() {
  const { slug } = useParams()
  const guide = guides.find((entry) => entry.slug === slug)
  if (!guide) return <NotFound />

  const program = programs.find((entry) => entry.slug === guide.program)
  const url = `https://corephia.com/guides/${guide.slug}`
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "MedicalWebPage",
        name: guide.name,
        description: guide.description,
        url,
        // The business, not a person: the site does not name the provider.
        ...(guide.reviewed !== false && { lastReviewed: LAST_REVIEWED, reviewedBy: { "@id": "https://corephia.com/#business" } }),
        publisher: { "@id": "https://corephia.com/#business" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://corephia.com/" },
          { "@type": "ListItem", position: 2, name: guide.name, item: url },
        ],
      },
    ],
  }

  return (
    <>
      <Helmet>
        <title>{guide.title}</title>
        <meta name="description" content={guide.description} />
        <link rel="canonical" href={url} />
        <script type="application/ld+json">{JSON.stringify(schema)}</script>
      </Helmet>

      <article aria-labelledby="guide-heading" className="mx-auto max-w-3xl px-4 pt-12 pb-16 sm:px-6 sm:pt-16">
        <h1 id="guide-heading" className="font-serif text-4xl leading-tight text-balance text-ink-950 sm:text-5xl">
          {guide.name}
        </h1>
        {guide.reviewed !== false && <ReviewedLine className="mt-4" />}
        <p className="mt-8 font-serif text-xl leading-relaxed text-ink-950/80 sm:text-2xl">{guide.intro}</p>

        {guide.sections.map(({ h, body }) => (
          <section key={h} className="mt-12">
            <h2 className="font-serif text-2xl text-ink-950 sm:text-3xl">{h}</h2>
            <div className="mt-4 space-y-4 text-lg leading-relaxed text-ink-950/75">
              {body.map((item) =>
                Array.isArray(item) ? (
                  <ul key={item[0]} className="list-disc space-y-2 pl-6">
                    {item.map((text) => (
                      <li key={text}>{text}</li>
                    ))}
                  </ul>
                ) : (
                  <p key={item}>{item}</p>
                ),
              )}
            </div>
          </section>
        ))}

        <nav aria-label="More guides" className="mt-12 border-t border-ink-950/10 pt-6">
          <h2 className="font-serif text-xl text-ink-950">More guides</h2>
          <ul className="mt-3 space-y-2">
            {guides
              .filter((entry) => entry.slug !== guide.slug)
              .map((entry) => (
                <li key={entry.slug}>
                  <Link to={`/guides/${entry.slug}`} className="font-semibold text-accent-dark underline-offset-4 hover:underline">
                    {entry.name}
                  </Link>
                </li>
              ))}
          </ul>
        </nav>

        <p className="mt-6 border-t border-ink-950/10 pt-6 text-sm leading-relaxed text-ink-950/70">
          CorePhia is a weight loss program based in Tampa, Florida. This guide is general information, not medical advice. Talk to a licensed provider about your own
          health. In an emergency, call 911.
        </p>
      </article>

      <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <div className="flex flex-col items-start gap-6 rounded-3xl bg-ink-950 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <div>
            <h2 className="font-serif text-3xl text-paper-50">Ready to start your program?</h2>
            {program && (
              <Link
                to={`/programs/${program.slug}`}
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent underline-offset-4 hover:underline"
              >
                About {program.name.toLowerCase()} at CorePhia
                <ChevronRightIcon className="size-4" />
              </Link>
            )}
          </div>
          <Link
            to="/intake"
            className="inline-flex shrink-0 items-center rounded-full bg-paper-50 px-8 py-4 text-base font-semibold text-ink-950 transition-colors duration-200 ease-out-smooth hover:bg-accent"
          >
            Get started
          </Link>
        </div>
      </section>
    </>
  )
}
