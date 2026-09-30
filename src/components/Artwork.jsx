let uid = 0
function nextGradientId(prefix) {
  uid += 1
  return `${prefix}-${uid}`
}

/** Round embossed tablet, evokes a branded weight-loss pill. */
export function TabletArt({ className = "", label = "co" }) {
  const id = nextGradientId("tablet")
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="Weight loss tablet">
      <defs>
        <radialGradient id={id} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#e7ecf6" />
          <stop offset="100%" stopColor="#c3d0e8" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="96" fill={`url(#${id})`} />
      <circle cx="100" cy="100" r="96" fill="none" stroke="#8fa4cc" strokeWidth="1.5" opacity="0.4" />
      <text
        x="100"
        y="115"
        textAnchor="middle"
        fontFamily="Georgia, serif"
        fontSize="34"
        fill="#2c4a86"
        opacity="0.85"
      >
        {label}
      </text>
    </svg>
  )
}

/** Slim injector pen, evokes a GLP-1 auto-injector. */
export function PenArt({ className = "", dose = "7.2 mg", accent = "#60a5fa" }) {
  const bodyId = nextGradientId("penbody")
  const capId = nextGradientId("pencap")
  return (
    <svg viewBox="0 0 120 420" className={className} role="img" aria-label={`Injector pen, ${dose} dose`}>
      <defs>
        <linearGradient id={bodyId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f5f7fb" />
          <stop offset="45%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#d0daee" />
        </linearGradient>
        <linearGradient id={capId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#e7ecf6" />
          <stop offset="50%" stopColor="#f5f7fb" />
          <stop offset="100%" stopColor="#c3d0e8" />
        </linearGradient>
      </defs>

      <rect x="20" y="10" width="80" height="120" rx="18" fill={`url(#${capId})`} />
      <rect x="20" y="120" width="80" height="18" fill="#c3d0e8" opacity="0.6" />

      <rect x="16" y="130" width="88" height="230" rx="20" fill={`url(#${bodyId})`} stroke="#b6c5e2" strokeWidth="1" />

      <rect x="16" y="205" width="88" height="46" fill={accent} opacity="0.9" />
      <text x="60" y="233" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="600" fontSize="15" fill="#0d1a3d">
        {dose}
      </text>

      <rect x="30" y="360" width="60" height="14" rx="4" fill="#e7ecf6" />
      <rect x="34" y="374" width="52" height="30" rx="6" fill="#d0daee" />
    </svg>
  )
}

/** Shield with a care cross — physician oversight, without depicting a drug. */
export function CareShieldArt({ className = "" }) {
  const id = nextGradientId("shield")
  return (
    <svg viewBox="0 0 200 220" className={className} role="img" aria-label="Physician-guided care">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#e7ecf6" />
          <stop offset="100%" stopColor="#c3d0e8" />
        </linearGradient>
      </defs>
      <path
        d="M100 8 182 40v78c0 48-36 78-82 94-46-16-82-46-82-94V40Z"
        fill={`url(#${id})`}
        stroke="#b6c5e2"
        strokeWidth="2"
      />
      <path
        d="M100 22 168 48v70c0 40-30 66-68 80-38-14-68-40-68-80V48Z"
        fill="none"
        stroke="#60a5fa"
        strokeWidth="2"
        opacity="0.55"
      />
      <rect x="84" y="62" width="32" height="92" rx="12" fill="#2563eb" />
      <rect x="54" y="92" width="92" height="32" rx="12" fill="#2563eb" />
      <rect x="84" y="62" width="32" height="92" rx="12" fill="#3b5bdb" opacity="0.35" />
    </svg>
  )
}

/** Balanced meal plate, evokes personalized nutrition coaching. */
export function MealPlateArt({ className = "" }) {
  const id = nextGradientId("plate")
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="Balanced meal plate">
      <defs>
        <radialGradient id={id} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#eef1f6" />
          <stop offset="100%" stopColor="#c7cedd" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="96" fill={`url(#${id})`} />
      <circle cx="100" cy="100" r="96" fill="none" stroke="#a9b2c4" strokeWidth="1.5" opacity="0.5" />
      <path d="M100 20a80 80 0 0 1 69 40H100Z" fill="#3b5bdb" opacity="0.85" />
      <path d="M169 60a80 80 0 0 1-11 100l-58-100Z" fill="#1e3a8a" opacity="0.85" />
      <path d="M158 160a80 80 0 0 1-116 0l58-100Z" fill="#60a5fa" opacity="0.9" />
      <path d="M42 160A80 80 0 0 1 31 60l58 100Z" fill="#2563eb" opacity="0.85" />
      <circle cx="100" cy="100" r="34" fill="#ffffff" opacity="0.85" />
    </svg>
  )
}

/** Stethoscope, evokes ongoing check-ins with a provider. */
export function HealthCheckArt({ className = "" }) {
  const tubeId = nextGradientId("tube")
  const drumId = nextGradientId("drum")
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="Follow-ups">
      <defs>
        <linearGradient id={tubeId} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#e7ecf6" />
          <stop offset="100%" stopColor="#c3d0e8" />
        </linearGradient>
        <radialGradient id={drumId} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#eef1f6" />
          <stop offset="100%" stopColor="#c7cedd" />
        </radialGradient>
      </defs>

      {/* Binaural tubing: both ear tubes and the U joining them. */}
      <path
        d="M52 30v34a48 48 0 0 0 96 0V30"
        fill="none"
        stroke={`url(#${tubeId})`}
        strokeWidth="17"
        strokeLinecap="round"
      />
      {/* Down to the chest piece, curving off-centre so the whole thing reads
          as a stethoscope rather than a symmetric pair of headphones. */}
      <path
        d="M100 112v16a34 34 0 0 1-34 34"
        fill="none"
        stroke={`url(#${tubeId})`}
        strokeWidth="17"
        strokeLinecap="round"
      />

      <circle cx="52" cy="30" r="12" fill="#2563eb" />
      <circle cx="148" cy="30" r="12" fill="#2563eb" />

      <circle cx="66" cy="162" r="27" fill={`url(#${drumId})`} stroke="#b6c5e2" strokeWidth="2" />
      <circle cx="66" cy="162" r="15" fill="#3b5bdb" opacity="0.85" />
    </svg>
  )
}

/** Dumbbell silhouette, evokes structured exercise plans. */
export function ActivityArt({ className = "" }) {
  const barId = nextGradientId("bar")
  return (
    <svg viewBox="0 0 200 120" className={className} role="img" aria-label="Dumbbell">
      <defs>
        <linearGradient id={barId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f5f7fb" />
          <stop offset="50%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#d0daee" />
        </linearGradient>
      </defs>
      <rect x="10" y="26" width="30" height="68" rx="10" fill={`url(#${barId})`} />
      <rect x="160" y="26" width="30" height="68" rx="10" fill={`url(#${barId})`} />
      <rect x="0" y="40" width="16" height="40" rx="6" fill="#3b5bdb" />
      <rect x="184" y="40" width="16" height="40" rx="6" fill="#3b5bdb" />
      <rect x="40" y="50" width="120" height="20" rx="10" fill="#2563eb" />
    </svg>
  )
}
