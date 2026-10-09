import { Helmet } from "react-helmet-async"
import { Link } from "react-router-dom"

// Any address the site doesn't have. The hosting rewrite serves the app for
// every path with a 200, so this page marks itself noindex: search engines
// then treat it as not found instead of indexing a pile of empty URLs.
export default function NotFound() {
  return (
    <>
      <Helmet>
        <title>Page not found | CorePhia</title>
        <meta name="robots" content="noindex, follow" />
      </Helmet>
      <section aria-labelledby="not-found-heading" className="mx-auto max-w-2xl px-4 pt-24 pb-24 text-center sm:px-6">
        <h1 id="not-found-heading" className="font-serif text-4xl leading-tight text-ink-950 sm:text-5xl">
          We can't find that page
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-950/70">
          The address may be mistyped, or the page may have moved. These will get you back on track.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="rounded-full bg-ink-950 px-6 py-3 text-sm font-semibold text-paper-50 transition-colors duration-200 ease-out-smooth hover:bg-ink-900"
          >
            Go to the home page
          </Link>
          <Link
            to="/contact"
            className="rounded-full px-6 py-3 text-sm font-semibold text-ink-950/70 transition-colors duration-200 hover:bg-ink-950/5 hover:text-ink-950"
          >
            Contact us
          </Link>
        </div>
      </section>
    </>
  )
}
