import { useReveal } from "../hooks/useReveal"
import { PersonAvatar } from "./Artwork"

const doctor = {
  role: "Double board certified in Internal Medicine",
  tags: ["Internal Medicine"],
 bio: "Dr. Antonious spent years in internal medicine before he started CorePhia. What bothered him was how often weight loss got treated like a prescription problem — a pill, a monthly fee, and nothing said about how someone actually eats or moves day to day. CorePhia pairs dietitian services and an exercise prescription with medication, and medication only enters the plan when a licensed provider decides it's clinically appropriate.",
  tone: "#2563eb",
}

export default function TeamSection() {
  const [ref, visible] = useReveal()

  return (
    <section
      aria-labelledby="team-heading"
      className="bg-gradient-to-br from-paper-50 via-paper-100 to-accent/15 py-12 sm:py-16 lg:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 text-center sm:px-6">
        <h2 id="team-heading" className="font-serif text-4xl leading-tight text-ink-950 sm:text-5xl">
          <span className="text-accent-dark">The best care</span>
          <br />
          by the best in medicine
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-ink-950/60">
          Meet the physician guiding CorePhia's clinical approach.
        </p>
      </div>

      <div
        ref={ref}
        className={`mx-auto mt-14 max-w-[38.4rem] px-4 transition-all duration-700 ease-out-smooth sm:px-6 ${
          visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
        }`}
      >
        <article className="flex flex-col items-center gap-6 overflow-hidden rounded-3xl bg-paper-100 p-6 shadow-lg transition-[transform,box-shadow] duration-300 ease-out-smooth hover:-translate-y-1 hover:shadow-2xl sm:flex-row sm:items-start sm:p-8">
          <span className="size-28 shrink-0 overflow-hidden rounded-full bg-paper-200/70 ring-4 ring-paper-50">
            <PersonAvatar className="h-full w-full" tone={doctor.tone} />
          </span>

          <div className="flex flex-col justify-center gap-3 text-center sm:text-left">
            <p className="text-base font-semibold text-ink-950">{doctor.role}</p>

            <ul className="flex flex-wrap justify-center gap-x-5 gap-y-1 sm:justify-start">
              {doctor.tags.map((tag) => (
                <li key={tag} className="flex items-center gap-2 text-sm text-ink-950/60">
                  <span className="h-3.5 w-0.5 shrink-0 bg-accent-dark" aria-hidden="true" />
                  {tag}
                </li>
              ))}
            </ul>

            <p className="mt-2 font-serif text-2xl text-ink-950">{doctor.name}</p>
            <p className="text-sm leading-relaxed text-ink-950/60">{doctor.bio}</p>
          </div>
        </article>

        
      </div>
    </section>
  )
}
