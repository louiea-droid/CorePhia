import { Link } from "react-router-dom"
import { guides } from "../data/guides"
import { ChevronRightIcon } from "./icons"
import Reveal from "./Reveal"

// ~300 words, mostly labels). Same rules as the program pages: medication only
// as one part of the program, no numbers without a source.
const STEPS = [
  {
    title: "Tell us about yourself",
    body: "Start with the intake. It takes about ten minutes, one question at a time, and covers your goals, your health and family history, your medications and allergies, and how you eat and move today.",
  },
  {
    title: "Your provider reviews it",
    body: "A licensed provider reads your answers before your first visit, asks any follow-up questions, and decides with you what belongs in your plan.",
  },
  {
    title: "Start your plan",
    body: "You get a meal plan from a registered dietitian, a written exercise plan matched to your fitness level, and medical care from your provider. Weight loss medication is added only if your provider decides it is clinically appropriate.",
  },
  {
    title: "Check in and adjust",
    body: "At regular follow-ups your care team reviews your progress and changes what isn't working. Between visits you can log your weight and message your care team in the patient portal.",
  },
]

export default function HowItWorksSection() {
  return (
    <section aria-labelledby="how-heading" className="bg-paper-50 py-12 sm:py-16 lg:py-24">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
        <Reveal>
          <h2 id="how-heading" className="font-serif text-4xl leading-tight text-ink-950 sm:text-5xl">
            How CorePhia works
          </h2>
          <div className="mt-6 space-y-5 text-lg leading-relaxed text-ink-950/75">
            <p>
              CorePhia is a physician-built weight loss program in Tampa, Florida. Instead of handing you a diet
              or a prescription, we build one plan around your health, your habits, and your goals, and we keep
              adjusting it with you.
            </p>
            <p>
              Every plan brings together four programs: medical care, dietitian services, a comprehensive
              exercise plan, and follow-ups. They work as one, so your meals, your workouts, and your medical
              care stay in step as your weight and routine change.
            </p>
            <p>
              It is for adults who want a provider to guide their weight loss: people who have tried on their
              own without lasting results, whose weight affects their health, or who want a plan that fits their
              life. Only a provider can say what is right for you, which is why every plan starts with a review
              of your health. CorePhia is cash pay, with monthly memberships, and currently cares for adults
              located in Florida.
            </p>
          </div>

          <h3 className="mt-10 font-serif text-2xl text-ink-950">Learn more</h3>
          <ul className="mt-4 space-y-3">
            {guides.map(({ slug, name }) => (
              <li key={slug}>
                <Link
                  to={`/guides/${slug}`}
                  className="font-semibold text-accent-dark underline-offset-4 hover:underline"
                >
                  {name}
                  <ChevronRightIcon className="ml-1 inline size-4 align-[-3px]" />
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>

        {/* A real sequence, so the steps are numbered. */}
        <ol className="space-y-4">
          {STEPS.map((step, index) => (
            <Reveal
              as="li"
              key={step.title}
              index={index + 1}
              className="flex gap-5 rounded-3xl border border-ink-950/10 bg-white p-6"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink-950 font-semibold text-paper-50">
                {index + 1}
              </span>
              <div>
                <h3 className="text-lg font-semibold text-ink-950">{step.title}</h3>
                <p className="mt-2 leading-relaxed text-ink-950/70">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}
