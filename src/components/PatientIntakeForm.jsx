import { useEffect, useRef, useState } from "react"
import { Helmet } from "react-helmet-async"
import { Link, useSearchParams } from "react-router-dom"
import { SUPPORT_PHONE } from "../lib/siteContact"
import { trackEvent } from "../lib/track"
import { PLANS_SHOWN } from "../data/pricingTiers"
import { ArrowRightIcon, CheckCircleIcon } from "./icons"
import { EXACT, PLANS, SCREENS } from "./intakeScreens"

const MULTI_FIELDS = new Set(["conditions", "familyHistory"])
const NONE = "None of the above"

// A snapshot of what's currently answered, for showIf, the live readouts and
// the review screen. Disabled (branch-skipped) fieldsets are already absent
// from FormData, so their answers never show up here either.
function readAnswers(form) {
  const data = new FormData(form)
  const answers = {}
  for (const key of new Set(data.keys())) {
    answers[key] = MULTI_FIELDS.has(key) ? data.getAll(key).map(String) : String(data.get(key))
  }
  return answers
}

// A fieldset is barred from constraint validation, so its own checkValidity()
// and reportValidity() always return true. Find the first invalid control
// inside it instead.
const firstInvalid = (fieldset) =>
  [...fieldset.elements].find((element) => element.willValidate && !element.checkValidity())

// Whether the patient has answered anything on a screen yet: a card or box
// ticked, or something typed (typedOnly: typed only). Read-only fields (the
// pre-filled signature date) and buttons don't count.
const hasAnswer = (fieldset, { typedOnly = false } = {}) =>
  [...fieldset.elements].some((element) =>
    element.type === "radio" || element.type === "checkbox"
      ? !typedOnly && element.checked
      : element.type !== "button" && !element.readOnly && Boolean(element.value?.trim()),
  )

const screenState = (fieldset) => ({ any: hasAnswer(fieldset), typed: hasAnswer(fieldset, { typedOnly: true }) })

// The form ignores pointer input this soon after a screen appears (see goTo).
const EARLY_TAP_MS = 400

const visibleScreens = (answers) => SCREENS.filter((screen) => !screen.showIf || screen.showIf(answers))

// "None of the above" and a real answer can't both be ticked.
function enforceNoneExclusive(input) {
  if (input.type !== "checkbox" || !input.checked) return
  for (const box of input.form.querySelectorAll(`input[type="checkbox"][name="${input.name}"]`)) {
    if (box !== input && (input.value === NONE || box.value === NONE)) box.checked = false
  }
}

// Grouped to mirror the sections of a standard EMR intake (demographics,
// emergency contact, vitals, history, social history, visit, consent) so it
// can be mapped onto the EMR's own intake record with minimal translation.
// firestore.rules accepts only these top-level keys, so new fields go inside
// an existing group. The has* gate answers are deliberately not read: an
// empty detail string means "none".
function buildIntakeRecord(form) {
  const data = new FormData(form)
  const text = (name) => (data.get(name) ?? "").toString().trim()
  const many = (name) => data.getAll(name).map((entry) => entry.toString())
  const checked = (name) => data.get(name) === "on"
  // A range answer, or "" when the patient chose to type the exact number.
  const range = (name) => (text(name) === EXACT ? "" : text(name))

  return {
    submittedAt: new Date().toISOString(),
    demographics: {
      firstName: text("firstName"),
      lastName: text("lastName"),
      dateOfBirth: text("dob"),
      sexAssignedAtBirth: text("sexAssigned"),
      phone: text("phone"),
      email: text("email"),
      address: {
        line1: text("address"),
        city: text("city"),
        state: text("state"),
        postalCode: text("zip"),
      },
    },
    emergencyContact: {
      name: text("emergencyName"),
      relationship: text("emergencyRelationship"),
      phone: text("emergencyPhone"),
    },
    vitals: {
      heightFeet: text("heightFeet"),
      heightInches: text("heightInches"),
      currentWeightLb: text("currentWeight"),
      goalWeightLb: text("goalWeight"),
      weightLossGoalRange: range("weightLossGoal"),
      highestAdultWeightLb: text("highestWeight"),
      highestAdultWeightRange: range("highestWeightRange"),
    },
    medicalHistory: {
      conditions: many("conditions"),
      medications: text("medications"),
      allergies: text("allergies"),
      surgeries: text("surgeries"),
      priorWeightLossTreatment: text("priorWeightLossTreatment"),
      medicationInterest: text("medicationInterest"),
    },
    familyHistory: {
      conditions: many("familyHistory"),
      notes: text("familyHistoryNotes"),
    },
    socialHistory: {
      tobacco: text("tobacco"),
      alcohol: text("alcohol"),
      exerciseFrequency: text("exerciseFrequency"),
    },
    nutrition: {
      waterIntake: text("waterIntake"),
      estimatedDailyCalories: text("dailyCalories"),
      estimatedDailyCaloriesRange: range("dailyCaloriesRange"),
      mealsPerDay: text("mealsPerDay"),
      dietNotes: text("dietNotes"),
    },
    visit: {
      membershipPlan: text("plan"),
      reason: text("appointmentType"),
      preferredDate: text("preferredDate"),
      preferredTime: text("preferredTime"),
      notes: text("notes"),
    },
    consent: {
      telehealth: checked("consentTelehealth"),
      hipaaAcknowledged: checked("consentHipaa"),
      signature: text("signature"),
      signedOn: text("signatureDate"),
    },
  }
}

// Imported on submit rather than at module scope so the Firebase SDK stays out
// of the main bundle — the same reason App.jsx lazy-loads the admin and account
// routes. Someone reading the intake page downloads nothing extra until they
// actually send it.
async function submitIntakeRecord(record) {
  const { sendIntakeRecord } = await import("../lib/intakeSubmission")
  return sendIntakeRecord(record)
}

// Just the logo, as on the Hims intake: no nav, no progress bar, nothing to
// click. Deliberately not a link, since the intake has no way back into the site.
function TopBar() {
  return (
    <header className="mx-auto max-w-xl px-4 pt-8 sm:px-6 sm:pt-12">
      <img src="/cp-health.webp" alt="CorePhia Health" className="h-10 w-auto" />
    </header>
  )
}

// Intro splash over the first question, modelled on Hims's intro step: a
// full-bleed moody photo under grain, the logo, one line, then a second line
// that surfaces word by word. Slow on purpose (Louie: "slow and aesthetic").
// Only opacity and blur animate, never position (no "shake"). It moves on by
// itself; a tap or key skips it, and it stays clickable while fading so a
// second tap can't answer the first question behind it. Shown once per visit:
// going back between screens never remounts the intake.
// TODO: Unsplash placeholder photo (feet on stairs); swap for the client's own.
const SPLASH_LINE = "It’s time for weight loss that fits your life."
const SPLASH_WORDS = "Let’s get started with a few questions about you.".split(" ")
const WORDS_START_MS = 1300
const WORD_STAGGER_MS = 140
const SPLASH_MS = WORDS_START_MS + SPLASH_WORDS.length * WORD_STAGGER_MS + 1900
const SPLASH_FADE_MS = 800

// A reload doesn't replay the splash (Louie). The flag lives in this tab's
// sessionStorage while the intake is open and is cleared when the patient
// navigates away, so a later "Get started" still gets the intro. A reload
// never runs that cleanup, so the flag survives it. Storage can throw
// (private mode, blocked storage): then the splash just shows as usual.
const SPLASH_SEEN_KEY = "corephia:intake-splash-seen"
const splashSeen = () => {
  try {
    return sessionStorage.getItem(SPLASH_SEEN_KEY) === "1"
  } catch {
    return false
  }
}
const markSplashSeen = (seen) => {
  try {
    if (seen) sessionStorage.setItem(SPLASH_SEEN_KEY, "1")
    else sessionStorage.removeItem(SPLASH_SEEN_KEY)
  } catch {
    // Storage unavailable: nothing to remember.
  }
}
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

function Splash({ onDone }) {
  const [leaving, setLeaving] = useState(false)
  const [photoReady, setPhotoReady] = useState(false)

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const hold = setTimeout(() => setLeaving(true), reduce ? 1800 : SPLASH_MS)
    const skip = () => setLeaving(true)
    window.addEventListener("keydown", skip)
    return () => {
      clearTimeout(hold)
      window.removeEventListener("keydown", skip)
    }
  }, [])

  useEffect(() => {
    if (!leaving) return
    const done = setTimeout(() => onDone(true), SPLASH_FADE_MS)
    return () => clearTimeout(done)
  }, [leaving, onDone])

  return (
    <div
      aria-hidden="true"
      onClick={() => setLeaving(true)}
      style={{ transitionDuration: `${SPLASH_FADE_MS}ms` }}
      className={`fixed inset-0 z-50 overflow-hidden bg-ink-950 transition-opacity ease-out-smooth ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* The photo fades up once loaded, so a slow connection sees plain navy
          rather than the image painting in strips. */}
      <img
        src="/intake-splash.webp"
        srcSet="/intake-splash-800.webp 800w, /intake-splash.webp 1600w"
        sizes="100vw"
        alt=""
        onLoad={() => setPhotoReady(true)}
        className={`absolute inset-0 size-full object-cover transition-opacity duration-1500 ease-out-smooth ${
          photoReady ? "opacity-100" : "opacity-0"
        }`}
      />
      {/* Navy wash keeps it on brand and the white text readable over any
          part of the photo; heavier at the bottom-left where the text sits. */}
      <div className="absolute inset-0 bg-linear-to-tr from-ink-950/90 via-ink-950/65 to-ink-900/45" />
      <div className="absolute inset-0 opacity-[0.12] mix-blend-overlay" style={{ backgroundImage: GRAIN }} />

      <div className="relative mx-auto flex h-full max-w-2xl flex-col px-6 pt-16 pb-24 sm:pt-24">
        <img
          src="/cp-health.webp"
          alt=""
          className="animate-splash-in h-10 w-fit brightness-0 invert sm:h-12"
        />
        <div className="my-auto">
          <p
            className="animate-splash-in text-2xl leading-snug font-medium text-pretty text-paper-50 sm:text-3xl"
            style={{ animationDelay: "350ms" }}
          >
            {SPLASH_LINE}
          </p>
          <p className="mt-4 text-2xl leading-snug font-medium text-pretty text-paper-50 sm:text-3xl">
            {SPLASH_WORDS.map((word, index) => (
              <span
                key={index}
                className="animate-splash-in"
                style={{ animationDelay: `${WORDS_START_MS + index * WORD_STAGGER_MS}ms` }}
              >
                {word}{" "}
              </span>
            ))}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function PatientIntakeForm() {
  const formRef = useRef(null)
  const advanceTimer = useRef(null)
  const pendingReport = useRef(false)
  const hasNavigated = useRef(false)
  const settleTimer = useRef(null)
  const pressedInput = useRef(null)
  const [answers, setAnswers] = useState({})
  const [currentId, setCurrentId] = useState(SCREENS[0].id)
  const [direction, setDirection] = useState("forward")
  const [dirty, setDirty] = useState(false)
  const [fieldError, setFieldError] = useState("")
  const [settling, setSettling] = useState(false)
  const [answered, setAnswered] = useState({ any: false, typed: false })
  const [keyboardPick, setKeyboardPick] = useState(false)
  const [status, setStatus] = useState("idle")
  const [splashDone, setSplashDone] = useState(splashSeen)
  useEffect(() => {
    markSplashSeen(true)
    return () => markSplashSeen(false)
  }, [])
  // The one thing counted in the intake: that it was opened (see lib/track.js).
  // The ref keeps it to one count when StrictMode re-runs mount effects.
  const countedOpen = useRef(false)
  useEffect(() => {
    if (countedOpen.current) return
    countedOpen.current = true
    trackEvent("pageview", "/intake")
  }, [])
  const [searchParams] = useSearchParams()
  // The patient's local date (en-CA formats as YYYY-MM-DD). toISOString() is
  // UTC, which after 8pm in Tampa is already tomorrow: the signature would be
  // dated wrong and today couldn't be picked as a visit date.
  const today = new Date().toLocaleDateString("en-CA")
  const requestedPlan = searchParams.get("plan")
  const selectedPlan = PLANS_SHOWN && PLANS.includes(requestedPlan) ? requestedPlan : ""

  const visible = visibleScreens(answers)
  const position = visible.findIndex((screen) => screen.id === currentId)
  const current = visible[position]
  const isLast = position === visible.length - 1
  // Continue appears only once the screen has an answer (Louie's rule, on
  // every question). A screen can set a stricter ready rule instead.
  // A single-choice screen moves on by itself when tapped, so it never shows
  // Continue, except after a keyboard pick (arrow keys choose without moving
  // on) or once the patient has typed the exact number they chose to enter.
  const pickedExact = current.autoAdvance && answers[current.autoAdvance] === EXACT
  const canContinue = current.ready
    ? current.ready(answers)
    : current.autoAdvance
      ? (pickedExact ? answered.typed : keyboardPick)
      : answered.any

  // Answers live only in memory (never Web Storage: they're PHI), so a reload
  // or closed tab loses them. Warn first.
  useEffect(() => {
    if (!dirty || status === "sent") return
    const warn = (event) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty, status])

  // On every screen change: back to the top, and focus the new question so a
  // screen reader announces it. Skipped on first load, where the page itself
  // is what's new.
  useEffect(() => {
    if (!hasNavigated.current) return
    window.scrollTo({ top: 0, behavior: "instant" })
    const fieldset = formRef.current?.querySelector(`[data-screen="${currentId}"]`)
    if (pendingReport.current) {
      pendingReport.current = false
      const invalid = fieldset && firstInvalid(fieldset)
      if (invalid) report(invalid)
      return
    }
    document.getElementById(`q-${currentId}`)?.focus()
    // report is recreated every render; the effect only needs to run on a
    // screen change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId])

  useEffect(
    () => () => {
      clearTimeout(advanceTimer.current)
      clearTimeout(settleTimer.current)
    },
    [],
  )

  // One history entry per question, so the browser or phone back gesture steps
  // back a question instead of leaving /intake. Leaving would unmount the form
  // and silently lose every answer: in-app navigation never fires
  // beforeunload, and iOS Safari never shows it at all. The /intake entry
  // itself is tagged as the first screen.
  useEffect(() => {
    window.history.replaceState({ ...window.history.state, intakeScreen: SCREENS[0].id }, "")
  }, [])

  useEffect(() => {
    const onPop = (event) => {
      const id = event.state?.intakeScreen
      // No tag: the patient went back past the first question and is leaving.
      if (!id || status === "sent") return
      const list = visibleScreens(readAnswers(formRef.current))
      // A screen that a changed answer has since hidden falls back to the one
      // before where the patient is now.
      const fallback = list[Math.max(0, list.findIndex((screen) => screen.id === currentId) - 1)]
      goTo(list.some((screen) => screen.id === id) ? id : fallback.id, "back", { push: false })
    }
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  })

  const goTo = (id, dir = "forward", { push = true } = {}) => {
    clearTimeout(advanceTimer.current)
    hasNavigated.current = true
    if (push) window.history.pushState({ ...window.history.state, intakeScreen: id }, "")
    // Yes/No cards sit in the same place on consecutive screens, so a second
    // tap landing just after the next screen appears would answer a question
    // the patient never read. The form ignores pointer input briefly while the
    // new screen settles, so that tap lands on nothing. (Cancelling the click
    // with preventDefault instead desyncs React from the radio, and the next
    // real tap on it then fires no change.)
    setSettling(true)
    clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => setSettling(false), EARLY_TAP_MS)
    setFieldError("")
    setAnswers(readAnswers(formRef.current))
    // Coming back to a screen that already has an answer shows Continue.
    setAnswered(screenState(formRef.current.querySelector(`[data-screen="${id}"]`)))
    setKeyboardPick(false)
    pressedInput.current = null
    setDirection(dir)
    setCurrentId(id)
  }

  // Points the patient at a missing answer. The custom Select and DatePicker
  // keep their real input sr-only and aria-hidden, so the browser's own
  // report would focus something a screen reader can't describe. Focus their
  // visible trigger and name the field in an alert instead.
  const report = (invalid) => {
    if (invalid.getAttribute("aria-hidden") !== "true") {
      invalid.reportValidity()
      return
    }
    invalid.parentElement.querySelector("button")?.focus()
    const label = invalid.closest("label")?.querySelector("span")?.textContent.replace("*", "").trim()
    setFieldError(`${label || "This field"} is required.`)
  }

  const goNext = () => {
    const form = formRef.current
    const invalid = firstInvalid(form.querySelector(`[data-screen="${currentId}"]`))
    if (invalid) {
      report(invalid)
      return
    }
    // Recompute from the form, not state: the answer that was just picked may
    // be what reveals the next screen.
    const list = visibleScreens(readAnswers(form))
    const target = list[list.findIndex((screen) => screen.id === currentId) + 1]
    if (target) goTo(target.id)
  }

  // The review screen's Edit buttons (data-goto) jump back to a section.
  const handleClick = (event) => {
    const target = event.target.closest("[data-goto]")?.dataset.goto
    if (target) {
      goTo(target, "back")
      return
    }
    // A tap on a single-choice answer moves on, including a tap on the answer
    // already chosen (after coming back to it), which fires click but no
    // change. Arrow keys can also fire click, so only the input the pointer
    // actually pressed counts. "Enter exact" reveals a number box instead.
    const input = event.target
    if (input.name === current.autoAdvance && pressedInput.current === input && input.value !== EXACT) {
      // A beat to show the selected state before moving on. Resetting the
      // timer means a quick second tap still advances only once.
      clearTimeout(advanceTimer.current)
      advanceTimer.current = setTimeout(goNext, 250)
    }
  }

  const handleChange = (event) => {
    const input = event.target
    enforceNoneExclusive(input)
    setDirty(true)
    setFieldError("")
    setAnswers(readAnswers(formRef.current))
    setAnswered(screenState(formRef.current.querySelector(`[data-screen="${currentId}"]`)))
    // Arrow keys fire change on every step through a radio group, so they
    // never auto-advance (handleClick only advances pointer taps); that keeps
    // every option reachable by keyboard. A keyboard pick reveals Continue.
    if (input.name === current.autoAdvance && pressedInput.current !== input) setKeyboardPick(true)
    pressedInput.current = null
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    // Enter in any field lands here; before the last screen it just advances.
    if (!isLast) {
      goNext()
      return
    }
    const form = event.currentTarget
    // Each screen was checked on the way through, but an Edit from the review
    // screen can change what's visible, so check every visible screen again.
    const invalid = visible.find((screen) => firstInvalid(form.querySelector(`[data-screen="${screen.id}"]`)))
    if (invalid) {
      if (invalid.id === currentId) report(firstInvalid(form.querySelector(`[data-screen="${invalid.id}"]`)))
      else {
        pendingReport.current = true
        goTo(invalid.id)
      }
      return
    }
    // Read the form before awaiting: currentTarget is only valid for the
    // lifetime of the event dispatch.
    const record = buildIntakeRecord(form)
    setStatus("sending")
    try {
      await submitIntakeRecord(record)
      setStatus("sent")
    } catch (cause) {
      // Never fall through to the confirmation screen on a failure — it tells
      // the patient a care team has their information when nothing was stored.
      console.error("Intake submission failed:", cause.code ?? cause.message)
      setStatus("error")
    }
  }

  if (status === "sent") {
    return (
      <div className="min-h-dvh bg-paper-50">
        <Helmet>
          <title>Request Received | CorePhia</title>
          <meta name="robots" content="noindex, follow" />
          <link rel="canonical" href="https://www.corephia.com/intake" />
        </Helmet>
        <TopBar />
        <main className="mx-auto max-w-xl px-4 py-16 sm:px-6">
          <div className="flex flex-col items-center rounded-3xl bg-paper-100 p-10 text-center">
            <CheckCircleIcon className="size-14 text-accent-dark" />
            <h1 className="mt-5 font-serif text-3xl text-ink-950">Request received</h1>
            <p className="mt-3 max-w-md text-ink-950/70">
              Thanks for filling out your intake form. A member of our care team will reach out within one business
              day to confirm your appointment.
            </p>
            <Link
              to="/"
              className="mt-6 rounded-full bg-ink-950 px-6 py-3 text-sm font-semibold text-paper-50 transition-colors duration-200 ease-out-smooth hover:bg-ink-900"
            >
              Back to home
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-paper-50">
      <Helmet>
        <title>Schedule an Appointment | CorePhia Patient Intake Form</title>
        <meta
          name="description"
          content="Book your CorePhia appointment. Fill out our secure patient intake form to schedule a nutrition, exercise, or medical support consultation."
        />
        <link rel="canonical" href="https://www.corephia.com/intake" />
      </Helmet>
      {!splashDone && <Splash onDone={setSplashDone} />}
      <TopBar />
      {/* inert while the splash is up, so Tab can't reach the question behind it. */}
      <main inert={!splashDone} className="mx-auto max-w-xl px-4 pt-8 pb-16 sm:px-6 sm:pt-10">
        <h1 className="sr-only">Patient intake form</h1>
        {/* noValidate: validation runs per screen in goNext/handleSubmit, since
            the browser's whole-form check would trip on hidden screens. */}
        <form
          ref={formRef}
          noValidate
          onSubmit={handleSubmit}
          onChange={handleChange}
          onClick={handleClick}
          className={settling ? "pointer-events-none" : ""}
          onPointerDown={(event) => {
            pressedInput.current = event.target
          }}
        >
          {SCREENS.map((screen) => (
            <fieldset
              key={screen.id}
              data-screen={screen.id}
              aria-labelledby={`q-${screen.id}`}
              // Branch-skipped screens are disabled so the browser leaves them
              // out of both validation and FormData.
              disabled={!visible.includes(screen)}
              hidden={screen.id !== currentId}
              className={direction === "back" ? "animate-view-back" : "animate-view-forward"}
            >
              <h2
                id={`q-${screen.id}`}
                tabIndex={-1}
                className="font-serif text-3xl leading-tight text-balance text-ink-950 outline-none sm:text-4xl"
              >
                {screen.question}
              </h2>
              {screen.hint && <p className="mt-3 text-ink-950/70">{screen.hint}</p>}
              <div className="mt-8 space-y-5">{screen.render({ answers, selectedPlan, today })}</div>
            </fieldset>
          ))}

          {status === "error" && isLast && (
            <div role="alert" className="mt-8 rounded-2xl border border-brand-dark/30 bg-paper-100 p-5">
              <p className="font-medium text-ink-950">We could not send your intake form.</p>
              <p className="mt-1 text-sm text-ink-950/70">
                Nothing was submitted, so your answers are still here. Try again in a moment. If it keeps failing,
                call us at {SUPPORT_PHONE} and we will take your intake over the phone.
              </p>
            </div>
          )}

          {fieldError && (
            <p role="alert" className="mt-6 text-sm font-medium text-brand-dark">
              {fieldError}
            </p>
          )}

          {/* No Back button (Louie's call): the browser or phone back gesture
              steps back a question, and the review screen's Edit links cover
              changing an answer. Continue appears once the screen has an
              answer; an optional screen offers Skip until then. */}
          <div className="mt-10 flex items-center">
            {current.optional && !canContinue && (
              <button
                type="button"
                onClick={goNext}
                className="ml-auto cursor-pointer rounded-full px-4 py-3 text-sm font-semibold text-ink-950/70 underline-offset-4 transition-colors duration-200 ease-out-smooth hover:text-ink-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-dark"
              >
                Skip for now
              </button>
            )}
            {canContinue && (
              <button
                type="submit"
                disabled={status === "sending"}
                className="inline-flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-ink-950 px-8 text-base font-semibold text-paper-50 shadow-lg shadow-ink-950/20 transition-colors duration-200 ease-out-smooth hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-dark focus-visible:ring-offset-2 focus-visible:ring-offset-paper-50 disabled:cursor-not-allowed disabled:opacity-60 sm:ml-auto sm:w-auto sm:min-w-44"
              >
                {isLast ? (status === "sending" ? "Sending…" : "Submit intake form") : "Continue"}
                {!isLast && <ArrowRightIcon className="size-5" />}
              </button>
            )}
          </div>
        </form>
      </main>
    </div>
  )
}
