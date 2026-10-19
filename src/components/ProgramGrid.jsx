import { Link } from "react-router-dom"
import { useReveal } from "../hooks/useReveal"
import { ActivityArt, CareShieldArt, HealthCheckArt, MealPlateArt } from "./Artwork"
import { ClipboardCheckIcon } from "./icons"

function PillarCard({ pillar, index }) {
  const [ref, visible] = useReveal()

  return (
    <li
      ref={ref}
      data-reveal={visible ? "shown" : "hidden"}
      style={{ "--reveal-i": index + 1 }}
    >
      <article className="group relative isolate flex h-full min-h-48 flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-b from-brand to-brand-dark p-4 shadow-lg transition-shadow duration-500 ease-out-smooth hover:shadow-[0_22px_44px_-18px_rgb(96_165_250/0.5)] focus-within:shadow-[0_22px_44px_-18px_rgb(96_165_250/0.5)] sm:min-h-80 sm:rounded-3xl sm:p-6">
        {/* Hover highlight, colour only (no movement, per Louie): a pale blue
            light fades up from the bottom corner, like the hero card. Also
            on keyboard focus. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-radial-[at_85%_100%] from-accent/50 via-accent/15 via-45% to-transparent to-70% opacity-0 transition-opacity duration-500 ease-out-smooth group-hover:opacity-100 group-focus-within:opacity-100"
        />

        <div
          className="flex flex-1 items-center justify-center py-2 sm:py-6"
          aria-hidden="true"
        >
          {pillar.art}
        </div>

        <div className="sm:min-h-24">
          <p className="text-sm font-semibold text-paper-50 sm:text-lg">{pillar.name}</p>
          <p className="mt-1 text-xs leading-snug text-paper-100 sm:mt-1.5 sm:text-sm sm:leading-relaxed">
            {pillar.description}
          </p>
        </div>
        {/* Cards with a landing page link to it. The link covers the whole
            card, so it is the only thing to tap. */}
        {pillar.to && (
          <Link to={pillar.to} className="absolute inset-0 rounded-2xl sm:rounded-3xl" aria-label={pillar.name} />
        )}
      </article>
    </li>
  )
}

const pillars = [
    {
    name: "Medical care",
    to: "/programs/medical-care",
    description: "Prescription medication, guided by a licensed provider.",
    art: <CareShieldArt className="h-20 sm:h-40" />,
  },
  {
    name: "Dietitian services",
    to: "/programs/dietitian-services",
    description: "A meal plan built around your goals, preferences, and lifestyle.",
    art: <MealPlateArt className="size-16 sm:size-28" />,
  },
    {
    name: "Follow-ups",
    to: "/programs/follow-ups",
    description: "Regular check-ins and progress tracking to keep your plan on target.",
    art: <HealthCheckArt className="size-16 sm:size-28" />,
  },
  {
    name: "Comprehensive Exercise Plan",
    to: "/programs/exercise-plan",
    description: "Workouts tailored to your fitness level, with a plan that grows with you.",
    art: <ActivityArt className="h-14 w-32 sm:h-24 sm:w-56" />,
  },


]

export default function ProgramGrid() {
  const [headingRef, headingVisible] = useReveal()

  return (
    <section
      id="programs"
      aria-labelledby="programs-heading"
      data-header-theme="dark"
      className="relative overflow-hidden rounded-3xl bg-ink-950 py-12 sm:py-16 lg:py-24"
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-ink-950 via-ink-800 to-brand" />
      <div
        className="pointer-events-none absolute top-0 left-1/2 size-[36rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-accent/20 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <h2
          ref={headingRef}
          id="programs-heading"
          data-reveal={headingVisible ? "shown" : "hidden"}
          className="font-serif text-4xl leading-tight text-paper-100 sm:text-5xl"
        >
          Your weight loss,
          <br />
          <span className="text-accent">done the right way</span>
        </h2>
       

        <ul className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-4 lg:grid-cols-4">
          {pillars.map((pillar, index) => (
            <PillarCard key={pillar.name} pillar={pillar} index={index} />
          ))}
        </ul>

        <p className="mt-8 max-w-3xl text-center text-xs text-paper-100/50 sm:mx-auto">
          <ClipboardCheckIcon className="mr-1 inline size-3.5 align-[-2px]" />
          Medication is prescribed by a licensed provider as part of your plan. An active CorePhia
          Weight Loss Membership is required. Membership does not include or guarantee a prescription.
        </p>
      </div>
    </section>
  )
}
