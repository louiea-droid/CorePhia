// The "medically reviewed" line on the program pages, the FAQ and the guides.
// The site does not name the provider (CLAUDE.md), so it names the credential.
// Only true once the provider has read the page: update the date when they
// review it again.
export const LAST_REVIEWED = "2026-10-13"

const label = new Date(`${LAST_REVIEWED}T12:00:00`).toLocaleDateString("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
})

export default function ReviewedLine({ className = "" }) {
  return (
    <p className={`text-sm text-ink-950/70 ${className}`}>
      Medically reviewed by a board-certified physician. Last reviewed{" "}
      <time dateTime={LAST_REVIEWED}>{label}</time>.
    </p>
  )
}
