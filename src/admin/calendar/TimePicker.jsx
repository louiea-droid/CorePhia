import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { ChevronDownIcon } from "../../components/icons"
import { usePopupPlacement } from "../../components/usePopupPlacement"
import { periodOf, timesIn } from "./calendarMath"

// Same trigger and option look as components/Select, so the booking dialog's
// fields match.
const triggerClass =
  "flex w-full items-center justify-between gap-2 rounded-2xl border border-ink-950/15 bg-paper-50 text-left text-ink-950 outline-none transition-colors duration-200 ease-out-smooth focus:border-ink-950/40"

const labelOf = (time) => {
  const [hours, minutes] = time.split(":").map(Number)
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${periodOf(time)}`
}

// One dropdown for a bookable time: the panel has AM/PM at the top and that
// half's 15-minute times below (Louie, 2026-10-02), instead of one long list.
// Switching AM/PM only changes which times are listed; picking one sets it.
export default function TimePicker({ value, onChange, ariaLabel = "Time", triggerClassName = "px-4 py-3.5" }) {
  const [open, setOpen] = useState(false)
  const [period, setPeriod] = useState(() => periodOf(value))
  const rootRef = useRef(null)
  const panelRef = useRef(null)
  const listRef = useRef(null)
  const up = usePopupPlacement(open, rootRef, panelRef)

  const toggle = () => {
    if (!open) setPeriod(periodOf(value))
    setOpen((previous) => !previous)
  }

  // Open (and switch halves) with the chosen time in the middle of the list,
  // or the top of the list when the chosen time is in the other half.
  useLayoutEffect(() => {
    const list = listRef.current
    if (!open || !list) return
    const chosen = list.querySelector('[aria-selected="true"]')
    list.scrollTop = chosen ? chosen.offsetTop - list.clientHeight / 2 + chosen.offsetHeight / 2 : 0
  }, [open, period])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    // Capture phase, and marked handled: Escape closes this panel only, not
    // the dialog around it.
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown, true)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown, true)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${ariaLabel}: ${labelOf(value)}`}
        className={`${triggerClass} ${triggerClassName}`}
      >
        <span>{labelOf(value)}</span>
        <ChevronDownIcon
          className={`size-4 shrink-0 text-ink-950/40 transition-transform duration-200 ease-out-smooth ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div
        ref={panelRef}
        className={`absolute inset-x-0 z-20 min-w-40 rounded-2xl bg-white p-1.5 shadow-xl ring-1 ring-ink-950/10 ${
          up ? "bottom-full mb-2 origin-bottom" : "top-full mt-2 origin-top"
        } transition-[opacity,transform,display] transition-discrete duration-150 ease-out-smooth ${
          open ? "block scale-100 opacity-100 starting:scale-95 starting:opacity-0" : "hidden scale-95 opacity-0"
        }`}
      >
        <div role="group" aria-label="Morning or afternoon" className="grid grid-cols-2 gap-1 rounded-xl bg-paper-100 p-1">
          {["AM", "PM"].map((half) => (
            <button
              key={half}
              type="button"
              aria-pressed={period === half}
              onClick={() => setPeriod(half)}
              className={`cursor-pointer rounded-lg py-1.5 text-xs font-semibold transition-colors duration-150 ${
                period === half ? "bg-accent-dark text-oncolor" : "text-ink-950/60 hover:text-ink-950"
              }`}
            >
              {half}
            </button>
          ))}
        </div>
        <ul ref={listRef} role="listbox" aria-label={`${ariaLabel}, ${period}`} className="scrollbar-thin relative mt-1.5 max-h-52 overflow-y-auto">
          {timesIn(period).map((time) => {
            const isSelected = time.value === value
            return (
              <li key={time.value} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(time.value)
                    setOpen(false)
                  }}
                  className={`block w-full cursor-pointer rounded-xl px-3.5 py-2.5 text-left text-sm transition-colors duration-150 ease-out-smooth ${
                    isSelected ? "bg-accent-dark font-medium text-oncolor" : "text-ink-950 hover:bg-paper-100"
                  }`}
                >
                  {time.label}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
