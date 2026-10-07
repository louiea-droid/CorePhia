import { useState } from "react"
import Select from "../../components/Select"
import PageHeader from "../layout/PageHeader"
import { SearchIcon } from "../ui/icons"
import { canAdmit, canOpen, canWriteNote } from "../staff/roles"

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
      "After 15 minutes with no activity, a \"Still there?\" box appears. If you don't answer, you're signed out a minute later.",
      "Open your account menu, top right, and choose Profile to change your password, set up two-step sign-in or set your display name.",
    ],
    note: "Your display name only labels your account menu. The name stamped on signed notes comes from the Staff list.",
  },
  {
    id: "applicants",
    title: "Review an applicant",
    show: (role) => canOpen("applicants", role),
    steps: [
      "Open Applicants. New intake submissions show as Pending. Search by name, or filter by status.",
      "Click a row to read the whole intake.",
      "Press Admit or Decline. Admitting creates the patient's chart. Declining someone who was already admitted marks their chart Inactive. Nothing is deleted, and pressing Admit again reactivates it.",
      "Use Note to save a private team note. Use Book appointment to open the calendar.",
    ],
    note: "Admitting doesn't email the patient. Portal invites are sent from the chart. Dietitians can read intakes but can't admit or decline.",
  },
  {
    id: "notes",
    title: "Write and sign a note",
    show: everyone,
    steps: [
      "Open Patients, click a name, then press New consultation, New progress note, New exercise note or New dietitian note. You only see the types your role may write.",
      "Fill in the visit date, weight, next follow-up and the sections. Consultation and progress notes also take blood pressure and heart rate. A consultation's pertinent history is filled in from the intake.",
      "Your note saves itself as a draft that only you can see. Close keeps it. Discard draft removes it.",
      "Press Sign note. Signing locks the note for good, stamped with your name, role and the time. Any later change is added as a dated addendum, and the original never changes.",
      "If the note has weight, blood pressure or heart rate, those numbers also go to the patient's progress chart. Tick \"Then share an update with the patient\" to post an update right away.",
    ],
    note: "A chart for someone who is no longer admitted is inactive. You can read it, but you can't add notes until they are admitted again.",
  },
  {
    id: "prescriptions",
    title: "Add, renew or stop a prescription",
    show: (role) => canWriteNote("consultation", role),
    lead: "Prescriptions are part of a consultation or progress note, written by a licensed provider when clinically appropriate.",
    steps: [
      "In a consultation or progress note, press Add prescription. Enter the medication, the instructions, the start date and when it is next due for renewal (30, 60 or 90 days, or a date).",
      "To renew or stop one that is already current, press Renew or Stop beside it in the note.",
      "Sign the note. The chart's Current prescriptions card then shows what is started or renewed and not stopped.",
    ],
  },
  {
    id: "invite",
    title: "Invite a patient to the portal",
    show: (role) => canAdmit(role),
    steps: [
      "Open the patient's chart. On the Patient portal card, press Send portal invite.",
      "The email goes to the address on their intake. You can edit the wording, and the link works for 7 days.",
      "The card shows the status: not invited, sent, expired, or \"Portal active since\" a date once they have joined.",
    ],
    note: "Keep the invite wording plain and free of clinical details, because email travels outside the secured system.",
  },
  {
    id: "updates",
    title: "Post an update to a patient",
    show: everyone,
    steps: [
      "On the chart's Updates card, press Post an update and write up to 2,000 characters.",
      "Leave \"Email the patient\" ticked if they should be told to check their portal. The email never contains the update.",
      "The patient sees your name and role. An update can be removed but not edited. A removed update disappears from the patient's view and stays on the chart marked as removed.",
    ],
  },
  {
    id: "messages",
    title: "Answer patient messages",
    show: everyone,
    steps: [
      "Open Messages. The number beside it is how many conversations are waiting for a reply.",
      "Filter by Needs a reply, Open, Closed or All, or search by patient.",
      "Open a conversation, write in \"Write a reply\" and press Send. The email box tells the patient there is a new message, without the message itself.",
      "Press Close topic to file a conversation away. A new message from either side reopens it. Press New message to start one with any active patient.",
    ],
    note: "Messages are patient messages. Queries are the website contact form.",
  },
  {
    id: "calendar",
    title: "Book and change appointments",
    show: everyone,
    steps: [
      "Open Calendar. Switch between Week, Month and Agenda, and between your own schedule, everyone's, or one person's. Times are Tampa time.",
      "Press New appointment, click an empty slot, or click a \"Follow-up due, not booked yet\" marker. Choose the patient, who it is with, the kind of visit, the date, time and length. A clash shows a warning but can still be booked.",
      "To change one, click it, edit it and save. You can mark it Completed or No-show, or cancel it with an optional reason.",
    ],
    note: "Every change is kept on the appointment. The calendar doesn't send reminders.",
  },
  {
    id: "todo",
    title: "Use the to-do list",
    show: everyone,
    steps: [
      "Needs doing fills itself from the charts: prescriptions due for renewal in 7 days or overdue, follow-ups due or overdue, and patients with no signed consultation yet.",
      "Nothing in Needs doing is ticked by hand. Signing the note that handles an item clears it.",
      "Your list holds your own items. Press + Add a to-do, optionally link a patient and a date, and choose just you or everyone.",
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
      "Open Analytics and choose 7, 30 or 90 days.",
      "You'll see page views, \"Get started\" clicks, intakes opened and submitted, top pages and most-clicked links.",
    ],
    note: "Counts are anonymous, use no cookies and only include visitors who accepted the privacy banner, so real traffic is higher.",
  },
  {
    id: "staff",
    title: "Add and manage staff",
    show: (role) => canOpen("staff", role),
    steps: [
      "Open Staff and press + Add user. Enter a name, an email and a role. They get an email to set their own password.",
      "Use the pencil to change a role. Choosing No access removes their ability to sign in.",
      "The three-dot menu has Edit name, Remove access and Delete account. Deleting takes the person off the list, and notes they signed keep their name.",
    ],
    note: "Edit name is for the admin. You can't change, remove or rename your own account here. Use Profile for your own details.",
  },
  {
    id: "portal",
    title: "What patients see in the portal",
    show: everyone,
    lead: "Patients join by invite only. They choose their own password from the invite link, then use Patient portal in the site header.",
    steps: [
      "Overview: a short progress summary, their latest messages and the latest update.",
      "Progress: their weight chart and numbers from each visit. They can log their own weight and delete their own entries. You still see that an entry was deleted.",
      "Messages: they can start a message, reply and close a conversation.",
      "Updates: a dated list of what the care team has posted, each from Provider, Dietitian or Care team.",
    ],
    note: "Patients can't see notes, prescriptions, appointments, to-dos or team notes. If a chart is inactive, messaging closes and the portal says so.",
  },
  {
    id: "emails",
    title: "What emails go out",
    show: everyone,
    steps: [
      "Portal invite: when you press Send portal invite. It has the wording you wrote and a Set up your portal button.",
      "New update or new message: only when the email box is ticked. It says something is waiting and never includes the content.",
      "Team notice to info@corephia.com: when a patient message means a conversation needs a reply. One email per waiting conversation.",
      "Password reset and new staff set-up: a secure link to choose a password.",
    ],
    note: "No email goes out for new intake submissions, appointments, admit or decline, or to-dos.",
  },
]


// How the list is grouped on the left, in order. A topic's group is looked up
// by id so the topic data above stays plain.
const GROUPS = [
  ["Getting started", ["signing-in"]],
  ["Patients and charts", ["applicants", "notes", "prescriptions", "invite", "updates"]],
  ["Day to day", ["messages", "calendar", "todo"]],
  ["Practice", ["queries", "analytics", "staff"]],
  ["The patient portal", ["portal", "emails"]],
]

const matches = (topic, query) =>
  [topic.title, topic.lead, ...topic.steps, topic.note].filter(Boolean).join(" ").toLowerCase().includes(query)

export default function Help({ role }) {
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState(TOPICS[0].id)
  const needle = query.trim().toLowerCase()
  const visible = TOPICS.filter((topic) => topic.show(role) && (!needle || matches(topic, needle)))
  const groups = GROUPS.map(([label, ids]) => [label, visible.filter((topic) => ids.includes(topic.id))]).filter(([, topics]) => topics.length)
  const active = visible.find((topic) => topic.id === selectedId) ?? visible[0]

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
                <p className="mb-1.5 px-3 text-sm font-semibold text-ink-950">{label}</p>
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
            <h2 className="font-serif text-2xl leading-snug text-ink-950">{active.title}</h2>
            {active.lead && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-950/70">{active.lead}</p>}
            <ol className="mt-6 max-w-2xl space-y-4">
              {active.steps.map((step, index) => (
                <li key={step} className="flex gap-3.5 text-sm leading-relaxed text-ink-950/85">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-dark/15 text-xs font-semibold text-accent-text tabular-nums">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            {active.note && <p className="mt-7 max-w-2xl rounded-xl bg-paper-100 px-4 py-3 text-sm leading-relaxed text-ink-950/70">{active.note}</p>}
          </article>
        ) : (
          <p className="rounded-2xl border border-ink-950/10 bg-white p-8 text-center text-sm text-ink-950/55">No help topics match "{query.trim()}".</p>
        )}
      </div>
    </div>
  )
}
