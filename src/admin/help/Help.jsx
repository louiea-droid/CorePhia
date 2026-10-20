import { useRef, useState } from "react"
import { flushSync } from "react-dom"
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
      "After 15 minutes with no activity, a \"Still there?\" box appears. If you don't answer, you're signed out a minute later. Activity in any of your admin tabs counts, and closing the tab doesn't keep you signed in: come back after 15 minutes and you'll need to sign in again.",
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
    id: "chart",
    title: "Find your way around a chart",
    show: everyone,
    steps: [
      "The top of the chart shows what you need before you write: the patient's allergies from the intake, their current prescriptions, and the next follow-up for each kind of care.",
      "The Notes card is on the right (first on a phone). New note starts one. Medical, Dietitian and Exercise filter the list. Click any note to read it, or to carry on with a draft.",
      "Your drafts sit at the top of the Notes card, and only you can see them. Each shows a short preview, and a draft with nothing in it says \"Nothing written yet\", so a stray copy is easy to spot and discard. Signed notes are listed below, with a count of any addenda.",
      "On the left: Updates (what the patient sees in their portal), Messages (how many conversations are waiting for a reply, and the latest subject), the Progress chart, the exercise plan and upcoming appointments.",
      "Patient portal, further down, is where you send the portal invite. From the intake summarises what they told us, with View full intake for the rest.",
    ],
    note: "Prescriptions and follow-ups at the top only change when a note that sets them is signed.",
  },
  {
    id: "notes",
    title: "Write and sign a note",
    show: everyone,
    steps: [
      "Open Patients, click a name, then press New note and pick Consultation, Progress note, Dietitian note or Exercise note. The menu only lists the types your role may write. Dietitian notes are written by the dietitian, the admin and the super admin.",
      "Fill in the visit date, weight, next follow-up and the sections. Consultation and progress notes also take blood pressure and heart rate. A consultation's pertinent history is filled in from the intake.",
      "Your note saves itself as a draft that only you can see. Close keeps it, and it waits under Your drafts at the top of the Notes card. Discard draft removes it.",
      "Press Sign note. Signing locks the note for good, stamped with your name, role and the time. Any later change is added as a dated addendum, and the original never changes.",
      "If the note has weight, blood pressure or heart rate, those numbers also go to the patient's progress chart. Tick \"Then share an update with the patient\" to post an update right away.",
    ],
    note: "A chart for someone who is no longer admitted is inactive. You can read it, but you can't add notes until they are admitted again, and a draft left on it can only be discarded. On the Patients page, the Status column has Make inactive and Reactivate for providers and above. Someone made inactive shows as Discharged on Applicants.",
  },
  {
    id: "prescriptions",
    title: "Add, renew or stop a prescription",
    show: (role) => canWriteNote("consultation", role),
    lead: "Prescriptions are part of a consultation or progress note, written by a licensed provider when clinically appropriate.",
    steps: [
      "In a consultation or progress note, press Add prescription. Enter the medication, the instructions, the start date and when it is next due for renewal (30, 60 or 90 days, or a date).",
      "To renew or stop one that is already current, press Renew or Stop beside it in the note.",
      "Sign the note. Current prescriptions at the top of the chart then shows what is started or renewed and not stopped.",
    ],
  },
  {
    id: "invite",
    title: "Invite a patient to the portal",
    show: (role) => canAdmit(role),
    steps: [
      "Open the patient's chart. On the Patient portal card, press Send portal invite.",
      "The email goes to the address on their intake. You can edit the wording, and the link works for 7 days.",
      "The card shows the status: not invited, sent, expired, or \"Portal active since\" a date once they have joined. Once they join, the invite link stops working.",
      "A returning patient who already has a portal login can use the new chart's invite. Their login moves to the new chart.",
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
      "The patient sees your name and role. An update can be removed but not edited. A removed update disappears from the patient's view. On the chart it stays as a single greyed line saying who removed it and when.",
    ],
  },
  {
    id: "dashboard",
    title: "Read the dashboard",
    show: everyone,
    steps: [
      "The four cards across the top are what needs attention now. Click one to open its page.",
      "Visits today counts scheduled appointments for today, and names the next one. Due this week counts prescription renewals and follow-ups due within 7 days or already overdue. The caption says how many are overdue.",
      "Needs a reply is the same number as the badge beside Messages. Pending applicants are intakes waiting for an admit or decline decision.",
      "Below that, six totals and the charts show what applicants told us on the intake. Click a bar or a row to see the applicants behind it, and click a name to read their intake. Most recent intakes is at the bottom.",
    ],
    note: "The cards count the whole practice, not just you. Dietitians see the same numbers but can't admit or decline. First consultations still waiting are on the To-do page, not in Due this week.",
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
      "Sent something to the wrong patient? Press Remove under your message. The patient stops seeing it, and it stays in the conversation as a greyed line saying who removed it and when. Co-admins and up can remove any staff message.",
    ],
    note: "Messages are patient messages. Queries are the website contact form.",
  },
  {
    id: "calendar",
    title: "Book and change appointments",
    show: everyone,
    steps: [
      "Open Calendar. Switch between Week, Month and Agenda, and between your own schedule, everyone's, or one person's. Times are Tampa time.",
      "Press New appointment, click an empty slot, or click a \"Follow-up due\" marker (a follow-up from a signed note that isn't booked yet). Choose the patient, who it is with, the kind of visit, the date, time and length. A clash shows a warning but can still be booked.",
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
      "Nothing in Needs doing is ticked by hand. Signing the note that handles an item clears it. Overdue items have a blue bar down the side of their group.",
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
      "Open Analytics and choose 7, 30 or 90 days, or press Custom to enter any number of days, weeks or months (up to a year).",
      "You'll see page views, \"Get started\" clicks, intakes opened and submitted, top pages and most-clicked links.",
    ],
    note: "Counts are anonymous, use no cookies and only include visitors who accepted the privacy banner, so real traffic is higher.",
  },
  {
    id: "staff",
    title: "Add and manage staff",
    show: (role) => canOpen("staff", role),
    steps: [
      "Open Staff and press + Add user. Enter an email and a role, plus a name if you're the admin. They get an email to set their own password. Someone a co-admin adds signs notes with their email until the admin gives them a name with Edit name.",
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
    note: "Patients can't see notes, prescriptions, appointments, to-dos or team notes. If a chart is inactive, messaging and weigh-ins close and the portal says so. Patients are signed out after 15 minutes with no activity.",
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
  // One page of short answers. A question's `show` defaults to everyone, and
  // `see` names the how-to topic its answer links to.
  {
    id: "questions",
    title: "Common questions",
    show: everyone,
    questions: [
      {
        q: "Why can't I change a signed note?",
        a: "Signing locks a note so the record always shows what was written at the time. To correct or add something, open the note and press Add addendum. The addendum is dated and carries your name, and the original stays as it was.",
        see: "notes",
      },
      {
        q: "What happens if I close a note without signing it?",
        a: "Nothing is lost. It stays as a draft that only you can see, under Your drafts at the top of the chart's Notes card. Open it to carry on, or press Discard draft.",
        see: "notes",
      },
      {
        q: "Why can't I add a note to this chart?",
        a: "The chart is inactive: the patient was made inactive, or declined after being admitted. A provider, co-admin or admin can press Reactivate in the Status column on Patients, or Admit on Applicants. Then notes can be added again.",
        see: "chart",
      },
      {
        q: "Why won't an item leave the to-do list?",
        a: "Items under Needs doing clear when you sign the note that handles them, such as a note that renews the prescription or sets the next follow-up. A draft doesn't count until it's signed.",
        see: "todo",
      },
      {
        q: "Does the patient get an email when I admit them?",
        a: "No. Admitting only creates their chart. To give them portal access, open the chart and press Send portal invite on the Patient portal card.",
        see: "invite",
        show: (role) => canAdmit(role),
      },
      {
        q: "A patient says their invite link doesn't work",
        a: "Invite links stop working after 7 days, and once the patient has joined. Check the Patient portal card on their chart. If the invite has expired, press Resend invite. If their portal is already active, point them to Patient portal in the site header, where they can reset a forgotten password.",
        see: "invite",
        show: (role) => canAdmit(role),
      },
      {
        q: "Can patients read my notes?",
        a: "No. Patients never see notes, prescriptions, appointments or to-dos. They see the updates you post, their own progress and their messages.",
        see: "portal",
      },
      {
        q: "Does the calendar send appointment reminders?",
        a: "No. Booking, changing or cancelling an appointment doesn't email anyone. Tell the patient yourself, for example with a portal message.",
        see: "calendar",
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
      {
        q: "Why does a signed note show an email instead of a name?",
        a: "That person was added by a co-admin, so their staff record had no name yet. The admin can give them one with Edit name on Staff. Notes they signed before that keep the email.",
        see: "staff",
      },
    ],
  },
]


// How the list is grouped on the left, in order. A topic's group is looked up
// by id so the topic data above stays plain.
const GROUPS = [
  ["Getting started", ["signing-in", "questions"]],
  ["Patients and charts", ["applicants", "chart", "notes", "prescriptions", "invite", "updates"]],
  ["Day to day", ["dashboard", "messages", "calendar", "todo"]],
  ["Practice", ["queries", "analytics", "staff"]],
  ["The patient portal", ["portal", "emails"]],
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
