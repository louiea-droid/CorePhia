import { useState } from "react"
import { Link } from "react-router-dom"
import DatePicker from "../../components/DatePicker"
import { VisibilityChoice } from "./AddTodo"
import { formatDay, inputClass } from "./noteUi"
import { groupTodos } from "./todoMath"
import { editTodo, setTodoDone } from "./todoStore"

const COMPACT = "px-3 py-2 text-sm"
const OPEN_GROUPS = [
  ["overdue", "Overdue"],
  ["today", "Today"],
  ["week", "Next 7 days"],
  ["later", "Later"],
  ["undated", "No date"],
]

function EditRow({ todo, onSaved, onCancel }) {
  const [text, setText] = useState(todo.text)
  const [due, setDue] = useState(todo.due)
  const [visibility, setVisibility] = useState(todo.visibility)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const save = async (event) => {
    event.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    setError(null)
    try {
      onSaved(await editTodo(todo, { text, intakeId: todo.intakeId, patientName: todo.patientName, due, visibility }))
    } catch (cause) {
      console.error("Editing a to-do failed:", cause.code ?? cause.message)
      setError("Couldn't save. Try again.")
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-3 rounded-xl bg-paper-100 p-3">
      <input value={text} onChange={(event) => setText(event.target.value)} maxLength={500} aria-label="To-do" className={inputClass} />
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-44">
          <DatePicker ariaLabel="Due date" value={due} onChange={setDue} triggerClassName={COMPACT} />
        </div>
        <VisibilityChoice value={visibility} onChange={setVisibility} />
        <div className="ml-auto flex items-center gap-2">
          {error && <p className="text-sm text-brand-dark">{error}</p>}
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium text-ink-950/60 transition-colors duration-200 hover:bg-ink-950/5 hover:text-ink-950"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="cursor-pointer rounded-full bg-ink-950 px-4 py-1.5 text-sm font-semibold text-paper-50 transition-colors duration-200 hover:bg-brand-dark disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </form>
  )
}

function TodoRow({ todo, chartIds, actor, onChange, onEdit }) {
  const [busy, setBusy] = useState(false)
  const mine = todo.ownerUid === actor.uid
  const toggle = async () => {
    setBusy(true)
    try {
      onChange(await setTodoDone(todo, !todo.done, actor))
    } catch (cause) {
      console.error("Ticking a to-do failed:", cause.code ?? cause.message)
    } finally {
      setBusy(false)
    }
  }
  const details = [
    todo.due && !todo.done && formatDay(todo.due),
    todo.visibility === "me" ? "Just me" : "Everyone",
    todo.visibility === "everyone" && !mine && `Added by ${todo.ownerName}`,
    todo.done && `Done by ${todo.done.name}, ${formatDay(todo.done.at)}`,
  ].filter(Boolean)

  return (
    <li className="flex items-start gap-3 py-2.5">
      <input
        type="checkbox"
        checked={Boolean(todo.done)}
        disabled={busy}
        onChange={toggle}
        aria-label={todo.text}
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-accent-dark"
      />
      <div className="min-w-0 flex-1">
        <p className={`text-sm wrap-break-word ${todo.done ? "text-ink-950/50 line-through" : "text-ink-950"}`}>
          {todo.text}
        </p>
        <p className="mt-0.5 text-xs text-ink-950/50">
          {todo.patientName &&
            (chartIds.has(todo.intakeId) ? (
              <Link to={`/admin/patients/${todo.intakeId}`} className="font-semibold text-accent-text no-underline hover:underline">
                {todo.patientName}
              </Link>
            ) : (
              <span className="font-semibold text-ink-950/65">{todo.patientName}</span>
            ))}
          {todo.patientName && details.length > 0 && ", "}
          {details.join(", ")}
        </p>
      </div>
      {todo.done ? (
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className="shrink-0 cursor-pointer text-xs font-semibold text-accent-text hover:underline disabled:opacity-50"
        >
          Undo
        </button>
      ) : (
        mine && (
          <button type="button" onClick={onEdit} className="shrink-0 cursor-pointer text-xs font-semibold text-accent-text hover:underline">
            Edit
          </button>
        )
      )}
    </li>
  )
}

// The to-dos staff added, grouped by when they're due, with Done at the end.
// Ticking an item moves it to Done with who and when; Undo moves it back.
export default function AddedTodos({ todos, today, chartIds, actor, onChange, children }) {
  const [editing, setEditing] = useState(null)
  const [showDone, setShowDone] = useState(false)
  const groups = groupTodos(todos, today)
  const openCount = OPEN_GROUPS.reduce((count, [key]) => count + groups[key].length, 0)

  const row = (todo) =>
    editing === todo.id ? (
      <li key={todo.id} className="py-2.5">
        <EditRow
          todo={todo}
          onCancel={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null)
            onChange(saved)
          }}
        />
      </li>
    ) : (
      <TodoRow key={todo.id} todo={todo} chartIds={chartIds} actor={actor} onChange={onChange} onEdit={() => setEditing(todo.id)} />
    )

  return (
    <section aria-labelledby="added-todos" className="rounded-2xl border border-ink-950/10 bg-white p-5">
      <h2 id="added-todos" className="font-serif text-xl text-ink-950">
        Your list <span className="font-sans text-sm font-normal text-ink-950/45 tabular-nums">{openCount}</span>
      </h2>
      <p className="mt-0.5 text-xs text-ink-950/55">To-dos you and the team add. Tick them off when they're done.</p>
      <div className="mt-3">{children}</div>
      {openCount === 0 && groups.done.length === 0 ? (
        <p className="mt-3 text-sm text-ink-950/55">Nothing on your list yet.</p>
      ) : (
        <>
          {openCount === 0 && <p className="mt-2 text-sm text-ink-950/55">All done.</p>}
          {OPEN_GROUPS.filter(([key]) => groups[key].length).map(([key, title]) => (
            <div key={key} className="mt-3">
              <h3 className={`text-xs font-semibold ${key === "overdue" ? "text-brand-dark" : "text-ink-950/60"}`}>{title}</h3>
              <ul className="divide-y divide-ink-950/5">{groups[key].map(row)}</ul>
            </div>
          ))}
          {groups.done.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                aria-expanded={showDone}
                onClick={() => setShowDone((value) => !value)}
                className="cursor-pointer text-xs font-semibold text-ink-950/60 transition-colors duration-200 hover:text-ink-950"
              >
                {showDone ? "Hide done" : `Done (${groups.done.length})`}
              </button>
              {showDone && <ul className="divide-y divide-ink-950/5">{groups.done.map(row)}</ul>}
            </div>
          )}
        </>
      )}
    </section>
  )
}
