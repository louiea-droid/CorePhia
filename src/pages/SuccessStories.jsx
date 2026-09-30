import { Helmet } from "react-helmet-async"
import { Link } from "react-router-dom"
import { PersonIcon, ShieldCheckIcon } from "../components/icons"
import { successStories } from "../data/successStories"

// Dev-server preview only, so the layout can be judged before real stories
// exist. `import.meta.env.DEV` is false in `npm run build`, so this whole list
// is dropped from the production bundle and can never go live as a fake
// testimonial.
const SAMPLE_STORIES = [
  { id: "sample-1", name: "Sample patient", age: 43, poundsLost: 40, months: 9, sample: true },
  { id: "sample-2", name: "Sample patient", age: 36, poundsLost: 25, months: 6, sample: true },
  { id: "sample-3", name: "Sample patient", age: 51, poundsLost: 32, months: 8, sample: true },
]

const stories = successStories.length ? successStories : import.meta.env.DEV ? SAMPLE_STORIES : []

function Photo({ src, alt, label }) {
  return (
    <div className="relative aspect-3/4 overflow-hidden bg-paper-100">
      {src ? (
        <img src={src} alt={alt} className="size-full object-cover" loading="lazy" />
      ) : (
        <div className="flex size-full items-center justify-center text-ink-950/25">
          <PersonIcon className="size-12" />
        </div>
      )}
      <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-paper-50/95 px-3 py-1 text-xs font-semibold text-ink-950">
        {label}
      </span>
    </div>
  )
}

function StoryCard({ story }) {
  return (
    <article className="flex flex-col rounded-3xl border border-ink-950/10 bg-white p-3">
      <div className="grid grid-cols-2 gap-1 overflow-hidden rounded-2xl">
        <Photo src={story.photos?.before} alt={`${story.name} before starting the program`} label="Before" />
        <Photo src={story.photos?.after} alt={`${story.name} after ${story.months} months`} label="After" />
      </div>
      <div className="flex flex-1 flex-col items-center px-4 pt-6 pb-5 text-center">
        <p className="text-sm font-semibold text-ink-950/70">
          {story.name}, {story.age}
        </p>
        <h2 className="mt-2 font-serif text-3xl leading-tight text-ink-950">
          Lost <span className="text-accent-dark">{story.poundsLost} pounds</span>
          <span className="block">in {story.months} months</span>
        </h2>
        {story.quote && <p className="mt-4 leading-relaxed text-ink-950/70">"{story.quote}"</p>}
        <p className="mt-auto flex items-center gap-1.5 pt-5 text-sm font-medium text-ink-950/70">
          <ShieldCheckIcon className="size-4 text-accent-dark" />
          {story.sample ? "Sample, not a real patient" : "CorePhia patient"}
        </p>
      </div>
    </article>
  )
}

export default function SuccessStories() {
  const hasStories = stories.length > 0

  return (
    <>
      <Helmet>
        <title>Success Stories | CorePhia Weight Loss Program</title>
        <meta
          name="description"
          content="Stories from CorePhia patients in their own words: what changed with nutrition coaching, an exercise plan, and physician-guided care."
        />
        <link rel="canonical" href="https://www.corephia.com/success-stories" />
        {/* Kept out of search until real stories exist: an empty page is thin
            content. It is also left out of public/sitemap.xml for now. */}
        {!successStories.length && <meta name="robots" content="noindex, follow" />}
      </Helmet>

      <section aria-labelledby="stories-heading" className="mx-auto max-w-6xl px-4 pt-16 pb-12 sm:px-6">
        <p className="text-xs font-semibold tracking-widest text-accent-dark uppercase">Success stories</p>
        <h1 id="stories-heading" className="mt-3 max-w-2xl font-serif text-4xl leading-tight text-balance text-ink-950 sm:text-5xl">
          Progress, in our patients' own words.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-950/70">
          Every story here comes from a real CorePhia patient who chose to share it. Each one did it through the
          whole program: a nutrition plan, an exercise plan, and medical care when their provider found it
          appropriate.
        </p>
      </section>

      <section aria-label="Patient stories" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        {hasStories ? (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {stories.map((story) => (
                <StoryCard key={story.id} story={story} />
              ))}
            </div>
            <p className="mt-8 max-w-3xl text-xs leading-relaxed text-ink-950/70">
              Results shown are from real CorePhia patients who gave written permission to share them. Individual
              results vary and are not typical. The CorePhia program includes nutrition coaching, an exercise plan,
              and medication only when a provider finds it appropriate.
            </p>
          </>
        ) : (
          <div className="flex flex-col items-center rounded-3xl border border-ink-950/10 bg-white px-6 py-14 text-center">
            <h2 className="font-serif text-3xl text-ink-950">Our first patient stories are on their way.</h2>
            <p className="mt-3 max-w-md text-ink-950/70">
              We only share stories from real patients, with their written permission. Check back soon, or start
              your own.
            </p>
          </div>
        )}
      </section>

      <section className="bg-paper-100/60 py-16">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <h2 className="font-serif text-3xl text-ink-950">Ready to write your own?</h2>
          <Link
            to="/intake"
            className="rounded-full bg-ink-950 px-8 py-4 text-base font-semibold text-paper-50 transition-colors duration-200 ease-out-smooth hover:bg-brand-dark"
          >
            Get started
          </Link>
        </div>
      </section>
    </>
  )
}
