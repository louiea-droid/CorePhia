import { useEffect, useRef, useState } from "react"
import { ChevronLeftIcon } from "../ui/icons"
import { NOTE_TYPES } from "./noteUi"

// Menu order follows the chart's filter chips: medical, dietitian, exercise.
const ORDER = ["consultation", "progress", "dietitian", "exercise"]

// One line under each name, so nobody has to guess which note to start.
const BLURB = {
  consultation: "First visit: history, exam and plan",
  progress: "Check-in on weight, medication and plan",
  dietitian: "Diet history and meal plan",
  exercise: "Set or change the exercise plan",
}

// One "New note" button for the Notes card instead of a button per type. With
// a single type the button starts it directly. Same disclosure pattern as
// AccountMenu (button + plain buttons, Escape and outside click close it).
// `hint` explains a type this role can't write, so its absence isn't a puzzle.
export default function NewNoteMenu({ types, creating, onPick, hint }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const buttonRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event) => !rootRef.current?.contains(event.target) && setOpen(false)
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return
      setOpen(false)
      buttonRef.current?.focus()
    }
    const onFocusIn = (event) => !rootRef.current?.contains(event.target) && setOpen(false)
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    document.addEventListener("focusin", onFocusIn)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("focusin", onFocusIn)
    }
  }, [open])

  const buttonClass =
    "cursor-pointer rounded-lg bg-ink-950 px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-paper-50 transition-colors duration-200 hover:bg-brand-dark disabled:opacity-50"

  if (types.length === 1) {
    const [type] = types
    return (
      <button type="button" disabled={Boolean(creating)} onClick={() => onPick(type)} className={buttonClass}>
        {creating === type ? "Starting…" : NOTE_TYPES[type].newLabel}
      </button>
    )
  }

  const ordered = ORDER.filter((type) => types.includes(type))

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={Boolean(creating)}
        aria-expanded={open}
        aria-controls="new-note-menu"
        onClick={() => setOpen((current) => !current)}
        className={`${buttonClass} inline-flex items-center gap-1.5`}
      >
        {creating ? "Starting…" : "New note"}
        <ChevronLeftIcon className={`size-3.5 transition-transform duration-200 ${open ? "rotate-90" : "-rotate-90"}`} />
      </button>
      <div
        id="new-note-menu"
        hidden={!open}
        className="absolute top-full right-0 z-30 mt-2 w-72 max-w-[calc(100vw-3rem)] rounded-2xl bg-white p-1.5 shadow-xl ring-1 ring-ink-950/10"
      >
        {ordered.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => {
              setOpen(false)
              onPick(type)
            }}
            className="block w-full cursor-pointer rounded-xl px-3 py-2.5 text-left transition-colors duration-150 hover:bg-ink-950/5 focus-visible:bg-ink-950/5 focus-visible:outline-none"
          >
            <span className="block text-sm font-semibold text-ink-950">{NOTE_TYPES[type].label}</span>
            <span className="mt-0.5 block text-xs text-ink-950/55">{BLURB[type]}</span>
          </button>
        ))}
        {hint && <p className="mx-1.5 mt-1 border-t border-ink-950/10 px-1.5 pt-2 pb-1.5 text-xs text-ink-950/50">{hint}</p>}
      </div>
    </div>
  )
}
