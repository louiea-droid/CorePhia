import { useId, useState } from "react"
import { EyeIcon, EyeOffIcon } from "./icons"

const labelClass = "mb-1.5 block text-sm font-medium text-ink-950/80"
const fieldClass =
  "w-full rounded-2xl border border-ink-950/15 bg-paper-50 px-4 py-3.5 pr-11 text-ink-950 placeholder-ink-950/40 outline-none transition-colors duration-200 ease-out-smooth focus:border-ink-950/40"

// A password input with a show/hide toggle, styled like the login panel's.
export default function PasswordField({ label, value, onChange, autoComplete = "new-password" }) {
  const id = useId()
  const [shown, setShown] = useState(false)
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={shown ? "text" : "password"}
          required
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={fieldClass}
        />
        <button
          type="button"
          onClick={() => setShown((previous) => !previous)}
          aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={shown}
          className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer rounded-lg p-1 text-ink-950/45 transition-colors duration-200 ease-out-smooth hover:text-ink-950"
        >
          {shown ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
        </button>
      </div>
    </div>
  )
}
