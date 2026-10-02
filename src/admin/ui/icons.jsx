// Local to the admin so src/admin/ stays dependency-free from the marketing
// components and can be lifted into its own app without untangling imports.
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.75",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
}

export function DashboardIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 19V11M9.5 19V5M15 19v-6M20.5 19V8" />
    </svg>
  )
}

export function TrafficIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  )
}

export function PatientsIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.5 19.5c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
      <circle cx="17.5" cy="8.5" r="2.5" />
      <path d="M15.3 14.3c1.9.4 3.4 2 3.7 4.7" />
    </svg>
  )
}

// A checklist: To-do lists renewals, follow-ups and first consultations due.
export function TodoIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="m4 6.5 1.5 1.5L8.5 5" />
      <path d="m4 12.5 1.5 1.5 3-3" />
      <path d="M11.5 6.5H20M11.5 12.5H20M11.5 18.5H20" />
      <circle cx="6" cy="18.5" r="1.5" />
    </svg>
  )
}

export function CalendarIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </svg>
  )
}

// An inbox tray: Applicants is where new intake submissions arrive for review.
export function ApplicantsIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 13.5 6 5.5h12l2.5 8V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18v-4.5Z" />
      <path d="M3.5 13.5h4.25l1.25 2.25h6l1.25-2.25h4.25" />
    </svg>
  )
}

// A badge with a key-shaped clip: who has access, and at what level.
export function StaffIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="4.5" y="4" width="15" height="16.5" rx="2" />
      <path d="M9.5 4V2.75h5V4" />
      <circle cx="12" cy="10.5" r="2.25" />
      <path d="M8 17c.6-2 2.1-3 4-3s3.4 1 4 3" />
    </svg>
  )
}

export function ActivityIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 12h4l2.5-6 4 13 2.5-7H21" />
    </svg>
  )
}

export function MailIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <path d="M4.5 6.5l7.5 6 7.5-6" />
    </svg>
  )
}

export function MenuIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

export function CloseIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function ChevronLeftIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M14 6l-6 6 6 6" />
    </svg>
  )
}

export function PersonIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.5 3.1-5.5 7-5.5s7 2 7 5.5" />
    </svg>
  )
}

export function SignOutIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3" />
      <path d="M10 8l-4 4 4 4M6 12h9" />
    </svg>
  )
}

export function TrashIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2" />
      <path d="M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

export function NoteIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 3.5h9l3.5 3.5V20a1 1 0 01-1 1H6a1 1 0 01-1-1V4.5a1 1 0 011-1Z" />
      <path d="M15 3.5V7a1 1 0 001 1h3.5" />
      <path d="M8 12.5h8M8 16h5.5" />
    </svg>
  )
}

export function EyeIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  )
}

export function EyeOffIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.64A10.7 10.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a15.6 15.6 0 0 1-3.15 3.99M6.5 6.98A15.6 15.6 0 0 0 2.5 12S6 18.5 12 18.5a10.5 10.5 0 0 0 4.24-.9" />
      <path d="M9.9 10.1a2.75 2.75 0 0 0 3.9 3.9" />
    </svg>
  )
}
