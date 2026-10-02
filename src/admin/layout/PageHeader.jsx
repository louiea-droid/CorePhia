// Shared by every admin page so the title/subtitle stay pinned while the
// page's own content scrolls underneath — Dashboard in particular runs long.
// <main> in AdminChrome carries no top padding, so this owns its top
// spacing directly via plain padding rather than a negative margin trying
// to cancel a value that lives in a different file — one less place for
// that number to drift out of sync.
export default function PageHeader({ title, description }) {
  return (
    <div className="sticky top-0 z-10 -mx-4 mb-4 shrink-0 border-b border-ink-950/10 bg-paper-50/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6">
      <h1 className="font-serif text-lg text-ink-950">{title}</h1>
      <p className="mt-0.5 text-xs text-ink-950/55"></p>
    </div>
  )
}
