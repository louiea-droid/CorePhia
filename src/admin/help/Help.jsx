import { useRef, useState } from "react"
import { flushSync } from "react-dom"
import Select from "../../components/Select"
import PageHeader from "../layout/PageHeader"
import { SearchIcon } from "../ui/icons"
import { canAdmit, canOpen } from "../staff/roles"

// Short how-tos, one per task. `show` takes the signed-in role so a person only
// sees guidance for what their role can do (the same predicates the sidebar and
// the rules use, in roles.js). Keep each topic short; when a screen changes,
// change its topic here.
const everyone = () => true

const TOPICS = [
  {
    id: "signing-in",
    title: "Signing in and staying safe",
    show: everyone,
    steps: [
      "Sign in with your email and password. If two-step sign-in is on, also enter the 6-digit code from your authenticator app.",
      "After 15 minutes with no activity, a \"Still there?\" box appears. If you don't answer, you're signed out a minute later. Activity in any of your admin tabs counts, and closing the tab doesn't keep you signed in: come back after 15 minutes and you'll need to sign in again.",
      "Open your account menu, top right, and choose Profile to change your password, set up two-step sign-in or set your display name.",
    ],
    note: "Your display name only labels your account menu. The name on the Staff list is the one others see.",
  },
  {
    id: "applicants",
    title: "Review an applicant",
    show: (role) => canOpen("applicants", role),
    steps: [
      "Open Applicants. New form submissions show as Pending. Search by name, or filter by status.",
      "Click a row to read the whole form.",
      "Press Admit or Decline. Then add an admitted patient in Elation, where their chart, visits, messages and billing live.",
      "Use Note to save a private team note.",
    ],
    note: "Admitting doesn't email the patient. Dietitians can read forms but can't admit or decline.",
  },
  {
    id: "elation",
    title: "Where patient care happens",
    show: everyone,
    lead: "Since November 2026 the practice runs in Elation, our electronic medical record.",
    steps: [
      "Charts, notes, prescriptions, appointments, tasks and billing are all in Elation.",
      "Patients use Elation's patient portal (Patient Passport) for messages, visits and booking.",
      "This admin is for new applicants, website queries, analytics and staff accounts.",
    ],
  },
  {
    id: "dashboard",
    title: "Read the dashboard",
    show: everyone,
    steps: [
      "The totals and charts show what applicants told us on the form. Click a bar or a row to see the applicants behind it, and click a name to read their form.",
      "Most recent forms are at the bottom.",
    ],
  },
  {
    id: "queries",
    title: "Read website queries",
    show: (role) => canOpen("messages", role),
    steps: [
      "Open Queries to read messages from the website contact form. New ones are marked, with a count in the sidebar.",
      "There is no reply button here. Answer by phone or email.",
    ],
  },
  {
    id: "analytics",
    title: "Read site analytics",
    show: (role) => canOpen("analytics", role),
    steps: [
      "Open Analytics and choose 7, 30 or 90 days, or press Custom to enter any number of days, weeks or months (up to a year).",
      "You'll see page views, \"Get started\" clicks, forms opened and submitted, top pages and most-clicked links.",
    ],
    note: "Counts are anonymous, use no cookies and only include visitors who accepted the privacy banner, so real traffic is higher.",
  },
  {
    id: "staff",
    title: "Add and manage staff",
    show: (role) => canOpen("staff", role),
    steps: [
      "Open Staff and press + Add user. Enter an email and a role, plus a name if you're the admin. They get an email to set their own password. Someone a co-admin adds shows by their email until the admin gives them a name with Edit name.",
      "Use the pencil to change a role. Choosing No access removes their ability to sign in.",
      "The three-dot menu has Edit name, Remove access and Delete account. Deleting takes the person off the list.",
    ],
    note: "Edit name is for the admin. You can't change, remove or rename your own account here. Use Profile for your own details. Elation logins are set up in Elation.",
  },
  {
    id: "emails",
    title: "What emails go out",
    show: everyone,
    steps: [
      "New form alert: to the practice when someone sends the form. It never includes their answers.",
      "Form receipt: to the person who sent it, saying we received it and will be in touch.",
      "Password reset and new staff set-up: a secure link to choose a password.",
    ],
    note: "No email goes out on admit or decline. Patient emails after that come from Elation.",
  },
  // One page of short answers. A question's `show` defaults to everyone, and
  // `see` names the how-to topic its answer links to.
  {
    id: "questions",
    title: "Common questions",
    show: everyone,
    questions: [
      {
        q: "Does the patient get an email when I admit them?",
        a: "No. Admitting only marks them admitted. Add them in Elation, which handles their portal invite.",
        see: "applicants",
        show: (role) => canAdmit(role),
      },
      {
        q: "Where did Patients, Calendar, To-do and Messages go?",
        a: "They moved to Elation in November 2026. Older entries for them still show on Activity.",
        see: "elation",
      },
      {
        q: "Why was I signed out?",
        a: "After 15 minutes with no activity in any of your admin tabs, you're signed out to protect patient information. Sign in again to carry on.",
        see: "signing-in",
      },
      {
        q: "How do I change my password or turn on two-step sign-in?",
        a: "Open your account menu, top right, and choose Profile. Changing your password asks for your current one first.",
        see: "signing-in",
      },
      {
        q: "Why don't I see a page someone else has?",
        a: "The sidebar only shows the pages your role can open. Queries, Analytics and Staff are for co-admins and up, and Activity is for the super admin. Ask the admin if you need a different role.",
      },
    ],
  },
]


// How the list is grouped on the left, in order. A topic's group is looked up
// by id so the topic data above stays plain.
const GROUPS = [
  ["Getting started", ["signing-in", "questions", "elation"]],
  ["Applicants", ["applicants", "dashboard", "emails"]],
  ["Practice", ["queries", "analytics", "staff"]],
]

const includes = (texts, query) => texts.filter(Boolean).join(" ").toLowerCase().includes(query)
const questionsFor = (topic, role) => (topic.questions ?? []).filter((item) => (item.show ?? everyone)(role))
const matches = (topic, query, role) =>
  includes([topic.title, topic.lead, ...(topic.steps ?? []), topic.note], query) ||
  questionsFor(topic, role).some((item) => includes([item.q, item.a], query))

export default function Help({ role }) {
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState(TOPICS[0].id)
  const titleRef = useRef(null)
  const needle = query.trim().toLowerCase()
  const visible = TOPICS.filter((topic) => topic.show(role) && (!needle || matches(topic, needle, role)))
  const groups = GROUPS.map(([label, ids]) => [label, visible.filter((topic) => ids.includes(topic.id))]).filter(([, topics]) => topics.length)
  const active = visible.find((topic) => topic.id === selectedId) ?? visible[0]
  // While searching, list only the questions that match (all of them if the search matched the page title).
  const allQuestions = active ? questionsFor(active, role) : []
  const matching = allQuestions.filter((item) => includes([item.q, item.a], needle))
  const questions = needle && matching.length ? matching : allQuestions

  const openTopic = (id) => {
    // Clear the search too, or a topic that doesn't match it would be filtered out.
    flushSync(() => {
      setQuery("")
      setSelectedId(id)
    })
    // The link that was clicked is gone now, so move focus to the new topic's title.
    titleRef.current?.focus()
  }

  return (
    // On desktop the page itself doesn't scroll: the topic list scrolls on its
    // own, and the article only scrolls when its text is taller than the card.
    <div className="flex h-full flex-col">
      <PageHeader title="Help" />

      <div className="grid gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[17rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:gap-8">
        <div className="flex min-h-0 flex-col gap-4">
          <label className="relative block">
            <span className="sr-only">Search help</span>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-950/40" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search help"
              className="w-full rounded-xl border border-ink-950/15 bg-white py-2 pr-3 pl-9 text-sm text-ink-950 outline-none placeholder:text-ink-950/40 focus:border-ink-950/40"
            />
          </label>

          {/* Phones: one dropdown. Desktop: the full grouped list. */}
          {active && (
            <div className="lg:hidden">
              <Select
                ariaLabel="Help topic"
                value={active.id}
                onChange={setSelectedId}
                options={visible.map((topic) => ({ value: topic.id, label: topic.title }))}
                triggerClassName="px-3 py-2 text-sm"
              />
            </div>
          )}
          <nav aria-label="Help topics" className="scrollbar-thin -mr-2 hidden min-h-0 flex-1 overflow-y-auto pr-2 lg:block">
            {groups.map(([label, topics]) => (
              <div key={label} className="border-t border-ink-950/10 py-3 first:border-t-0 first:pt-0">
                <p className="mb-2 px-3 font-serif text-lg leading-snug font-semibold text-ink-950">{label}</p>
                <ul className="space-y-0.5">
                  {topics.map((topic) => (
                    <li key={topic.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(topic.id)}
                        aria-current={topic.id === active.id ? "true" : undefined}
                        className={`block w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition-colors duration-200 ${
                          topic.id === active.id ? "bg-accent-dark font-semibold text-oncolor" : "text-ink-950/75 hover:bg-ink-950/8 hover:text-ink-950"
                        }`}
                      >
                        {topic.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {active ? (
          <article className="scrollbar-thin min-w-0 rounded-2xl border border-ink-950/10 bg-white p-5 sm:p-8 lg:overflow-y-auto">
            <h2 ref={titleRef} tabIndex={-1} className="font-serif text-2xl leading-snug text-ink-950 outline-none">
              {active.title}
            </h2>
            {active.lead && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-950/70">{active.lead}</p>}
            {active.steps && <ol className="mt-6 max-w-2xl space-y-4">
              {active.steps.map((step, index) => (
                <li key={step} className="flex gap-3.5 text-sm leading-relaxed text-ink-950/85">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-dark/15 text-xs font-semibold text-accent-text tabular-nums">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>}
            {questions.length > 0 && (
              <dl className="mt-4 max-w-2xl divide-y divide-ink-950/10">
                {questions.map((item) => {
                  const see = item.see && TOPICS.find((topic) => topic.id === item.see && topic.show(role))
                  return (
                    <div key={item.q} className="py-5">
                      <dt className="text-[0.95rem] leading-snug font-semibold text-ink-950">{item.q}</dt>
                      <dd className="mt-2 text-sm leading-relaxed text-ink-950/85">
                        {item.a}
                        {see && (
                          <button
                            type="button"
                            onClick={() => openTopic(see.id)}
                            className="mt-2 block cursor-pointer rounded text-sm font-semibold text-accent-text underline-offset-4 transition-colors duration-200 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent/50"
                          >
                            {see.title}
                          </button>
                        )}
                      </dd>
                    </div>
                  )
                })}
              </dl>
            )}
            {active.note && <p className="mt-7 max-w-2xl rounded-xl bg-paper-100 px-4 py-3 text-sm leading-relaxed text-ink-950/70">{active.note}</p>}
          </article>
        ) : (
          <p className="rounded-2xl border border-ink-950/10 bg-white p-8 text-center text-sm text-ink-950/55">No help topics match "{query.trim()}".</p>
        )}
      </div>
    </div>
  )
}
