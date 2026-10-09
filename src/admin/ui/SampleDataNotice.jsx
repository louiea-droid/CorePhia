// Shown wherever TEMP_FAKE_RECORDS (lib/tempFakeRecords.js) stand in for an
// empty intake collection, so nobody reads made-up applicants as real ones.
export default function SampleDataNotice() {
  return (
    <p role="note" className="mb-4 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <span className="font-semibold">Sample data.</span> No real intakes have been submitted yet, so the applicants and
      numbers here are made up for preview. They'll be replaced by real ones as soon as the first intake arrives.
    </p>
  )
}
