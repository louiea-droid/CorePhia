import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { ChevronDownIcon } from "./icons"

// Padding/text-size lives outside this base string (as the triggerClassName
// default below) rather than baked in, so a caller overriding it isn't
// fighting Tailwind's build-order class precedence with a second, later
// px-*/py-* utility that may or may not win.
const baseTriggerClass =
  "flex w-full items-center justify-between gap-2 rounded-2xl border border-ink-950/15 bg-paper-50 text-left text-ink-950 outline-none transition-colors duration-200 ease-out-smooth focus:border-ink-950/40"

// Dispatched on the hidden <select> (or DatePicker's hidden input) with the
// new value as detail. See setFieldValue in PatientIntakeForm.
export const SET_VALUE_EVENT = "field:set-value"

function optionValue(option) {
  return typeof option === "string" ? option : option.value
}

function optionLabel(option) {
  return typeof option === "string" ? option : option.label
}

// A real <select> (kept in the layout, not display:none) does the actual work
// — it's what FormData(form) reads on submit, and what the browser validates
// against `required` — while everything visible is a custom listbox the OS
// dropdown can't be. sr-only rather than removed-from-flow keeps the native
// "please fill this out" bubble anchored roughly where the button is.
//
// value/onChange make this usable as a controlled filter too (see admin
// Patients.jsx) — pass both and the component defers to them instead of its
// own state, same as any other controlled/uncontrolled React input.
export default function Select({
  name,
  options,
  value: controlledValue,
  onChange,
  defaultValue = "",
  placeholder = "Select one",
  required = false,
  triggerClassName = "px-4 py-3.5",
  // For a Select with no wrapping <label> giving it a name (e.g. one per
  // table row): read before the selected value, "Role for Sam: Provider".
  ariaLabel,
}) {
  const isControlled = controlledValue !== undefined
  const [internalValue, setInternalValue] = useState(defaultValue)
  const value = isControlled ? controlledValue : internalValue
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const selectRef = useRef(null)

  // Lets a form set this value from outside (the intake's edit dialog copies
  // answers in and out), which a plain .value write can't: React state owns it.
  // A layout effect so it's listening before a parent's layout effect sends.
  useLayoutEffect(() => {
    const select = selectRef.current
    const onSet = (event) => setInternalValue(event.detail)
    select.addEventListener(SET_VALUE_EVENT, onSet)
    return () => select.removeEventListener(SET_VALUE_EVENT, onSet)
  }, [])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    // Capture phase, and marked handled: Escape closes this popup only, not
    // a dialog the picker sits in (those skip a defaultPrevented Escape).
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

  const selectedLabel = options.find((option) => optionValue(option) === value)

  return (
    <div ref={rootRef} className="relative">
      <select
        ref={selectRef}
        name={name}
        required={required}
        value={value}
        onChange={() => {}}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={optionValue(option)} value={optionValue(option)}>
            {optionLabel(option)}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ? `${ariaLabel}: ${selectedLabel ? optionLabel(selectedLabel) : placeholder}` : undefined}
        className={`${baseTriggerClass} ${triggerClassName}`}
      >
        <span className={selectedLabel ? "" : "text-ink-950/40"}>
          {selectedLabel ? optionLabel(selectedLabel) : placeholder}
        </span>
        <ChevronDownIcon
          className={`size-4 shrink-0 text-ink-950/40 transition-transform duration-200 ease-out-smooth ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <ul
        role="listbox"
        className={`absolute inset-x-0 top-full z-20 mt-2 max-h-56 origin-top overflow-y-auto rounded-2xl bg-white p-1.5 shadow-xl ring-1 ring-ink-950/10 transition-[opacity,transform,display] transition-discrete duration-150 ease-out-smooth ${
          open ? "block scale-100 opacity-100 starting:scale-95 starting:opacity-0" : "hidden scale-95 opacity-0"
        }`}
      >
        {options.map((option) => {
          const isSelected = optionValue(option) === value
          return (
            <li key={optionValue(option)} role="option" aria-selected={isSelected}>
              <button
                type="button"
                onClick={() => {
                  if (!isControlled) setInternalValue(optionValue(option))
                  onChange?.(optionValue(option))
                  setOpen(false)
                }}
                className={`block w-full rounded-xl px-3.5 py-2.5 text-left text-sm transition-colors duration-150 ease-out-smooth ${
                  // oncolor, not paper-50: this text sits on a solid accent-dark
                  // fill, so it must stay light in both themes — paper-50 flips
                  // to near-black under .dark and goes invisible there (this
                  // component is now also used from the admin, which is
                  // dark-mode capable; the public form has no .dark scope, so
                  // this is a no-op there since both tokens are the same hex).
                  isSelected ? "bg-accent-dark font-medium text-oncolor" : "text-ink-950 hover:bg-paper-100"
                }`}
              >
                {optionLabel(option)}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
