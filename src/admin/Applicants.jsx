import { useMemo, useState } from "react"
import Select from "../components/Select"
import ConfirmDialog from "./ConfirmDialog"
import { PAGE_SIZE_OPTIONS } from "./constants"
import { AUDIT_ACTIONS, INTAKE_COLLECTION, recordAuditEvent } from "./firebase"
import PageHeader from "./PageHeader"
import Pagination from "./Pagination"
import ApplicantModal from "./ApplicantModal"
import ApplicantsTable from "./ApplicantsTable"
import { setApplicantStatus } from "./chartStore"
import { ApplicantsSkeleton } from "./Skeleton"
import { TEMP_FAKE_RECORDS } from "./tempFakeRecords"
import { useIntakeRecords } from "./useIntakeRecords"

const PAGE_SIZE_KEY = "corephia-admin-patients-page-size"
const PLAN_OPTIONS = ["Core", "Core+", "Core Complete"]
const STATUS_FILTER_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "admitted", label: "Admitted" },
  { value: "declined", label: "Declined" },
]

function readStoredPageSize() {
  try {
    const saved = Number(localStorage.getItem(PAGE_SIZE_KEY))
    return PAGE_SIZE_OPTIONS.includes(saved) ? saved : 10
  } catch {
    return 10
  }
}

export default function Applicants({ role, actor }) {
  const { records, error, removeRecord, patchRecord, patchLocal } = useIntakeRecords()
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [pageSize, setPageSize] = useState(readStoredPageSize)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [planFilter, setPlanFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")

  const usingSampleFallback = records && records.length === 0
  const baseRecords = usingSampleFallback ? TEMP_FAKE_RECORDS : records
  // Sample fallback rows aren't real Firestore documents — deleting one would
  // either no-op against a nonexistent id or (worse) collide with an unrelated
  // real id, so the option is hidden rather than wired to something misleading.
  const canDelete = role === "superAdmin" && !usingSampleFallback
  // Admitting/declining isn't destructive, so both admin tiers can do it —
  // just not against the sample fallback rows, same reasoning as canDelete.
  const canReview = Boolean(role) && !usingSampleFallback

  // Admitting starts (or reactivates) the patient's chart; moving away from
  // admitted marks it inactive. Both happen with the status in one batch.
  const updateStatus = async (record, status) => {
    await setApplicantStatus(record, status, actor)
    patchLocal(record.id, { status })
    recordAuditEvent({
      action: AUDIT_ACTIONS.updateIntakeStatus,
      targetCollection: INTAKE_COLLECTION,
      targetId: record.id,
      targetLabel: [record.demographics?.firstName, record.demographics?.lastName].filter(Boolean).join(" "),
    })
    setSelectedRecord((current) => (current?.id === record.id ? { ...current, status } : current))
  }

  const saveNote = async (record, adminNote) => {
    await patchRecord(record.id, { adminNote })
    setSelectedRecord((current) => (current?.id === record.id ? { ...current, adminNote } : current))
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await removeRecord(pendingDelete.id)
      // Logged after the delete succeeds, not before: an attempt that Firestore
      // refused isn't a deletion, and recording it as one would misrepresent
      // what actually happened to the record.
      recordAuditEvent({
        action: AUDIT_ACTIONS.deleteIntake,
        targetCollection: INTAKE_COLLECTION,
        targetId: pendingDelete.id,
        targetLabel: [pendingDelete.demographics?.firstName, pendingDelete.demographics?.lastName]
          .filter(Boolean)
          .join(" "),
      })
      setPendingDelete(null)
      setSelectedRecord(null)
    } catch (cause) {
      setDeleteError(cause.code ?? cause.message ?? "Something went wrong deleting this record.")
    } finally {
      setDeleting(false)
    }
  }

  const filteredRecords = useMemo(() => {
    if (!baseRecords) return null
    const query = search.trim().toLowerCase()
    return baseRecords.filter((record) => {
      if (planFilter && record.visit?.membershipPlan !== planFilter) return false
      if (statusFilter && (record.status ?? "pending") !== statusFilter) return false
      if (!query) return true
      const name = `${record.demographics?.firstName ?? ""} ${record.demographics?.lastName ?? ""}`.toLowerCase()
      return name.includes(query)
    })
  }, [baseRecords, search, planFilter, statusFilter])

  const totalPages = filteredRecords ? Math.max(1, Math.ceil(filteredRecords.length / pageSize)) : 1
  // Clamped at render time rather than synced back into state via an effect
  // — e.g. after switching to a larger page size, or if a filter narrows the
  // result set, this always reflects a valid page without a render lag.
  const currentPage = Math.min(page, totalPages)

  const changePageSize = (nextSize) => {
    setPageSize(nextSize)
    setPage(1)
    try {
      localStorage.setItem(PAGE_SIZE_KEY, String(nextSize))
    } catch {
      /* private browsing / storage disabled */
    }
  }

  const updateSearch = (value) => {
    setSearch(value)
    setPage(1)
  }

  const updatePlanFilter = (value) => {
    setPlanFilter(value)
    setPage(1)
  }

  const updateStatusFilter = (value) => {
    setStatusFilter(value)
    setPage(1)
  }

  const pageRecords = filteredRecords
    ? filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : []

  return (
    // h-full: <main> in AdminChrome is the flex-sized scroll container: this
    // page fills exactly that space rather than growing past it, so only
    // the table rows below get their own scrollbar — the page itself, the
    // header, the search/filter row and pagination never move.
    <div className="flex h-full flex-col">
      <PageHeader title="Applicants" description="Everyone who has submitted the intake form. Review each one, then admit or decline." />

      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-ink-950/10 bg-white p-6 text-center">
          <h2 className="font-semibold text-ink-950">Could not load intake records</h2>
          <p className="mt-2 text-sm text-ink-950/60">{error}</p>
        </div>
      ) : !records ? (
        <ApplicantsSkeleton />
      ) : !baseRecords.length ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-ink-950/10 bg-white p-8 text-center">
          <h2 className="font-serif text-2xl text-ink-950">No intakes yet</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-ink-950/60">
            Completed patient intake forms will appear here.
          </p>
        </div>
      ) : (
        <section className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-ink-950/10 bg-white">
          <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-ink-950/10 p-4">
            <input
              type="search"
              value={search}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Search by applicant name…"
              className="min-w-0 flex-1 rounded-lg border border-ink-950/15 bg-paper-50 px-3 py-2 text-sm text-ink-950 outline-none transition-colors duration-200 placeholder:text-ink-950/40 focus:border-ink-950/40"
            />
            <div className="w-40 shrink-0">
              <Select
                value={planFilter}
                onChange={updatePlanFilter}
                options={[{ value: "", label: "All plans" }, ...PLAN_OPTIONS.map((plan) => ({ value: plan, label: plan }))]}
                triggerClassName="px-3 py-2 text-sm"
              />
            </div>
            <div className="w-44 shrink-0">
              <Select
                value={statusFilter}
                onChange={updateStatusFilter}
                options={[{ value: "", label: "All statuses" }, ...STATUS_FILTER_OPTIONS]}
                triggerClassName="px-3 py-2 text-sm"
              />
            </div>
          </div>

          {!filteredRecords.length ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <p className="font-medium text-ink-950">No applicants match your search</p>
              <p className="mt-1 text-sm text-ink-950/50">Try a different name or plan filter.</p>
            </div>
          ) : (
            // px-4: ApplicantsTable's own wrapper uses a -mx-4/px-4 bleed
            // trick for its horizontal scroll edge, which needs a padded
            // parent to cancel against — without it, the negative margin
            // pokes past this section's rounded, overflow-hidden edge.
            // pt-3: breathing room above the (sticky) column headers, so
            // they don't sit flush against the search/filter row's border
            // — sticky respects an ancestor's padding-top as its stick
            // offset, so this gap holds even once the header is pinned.
            <div className="scrollbar-thin flex-1 overflow-y-auto px-4 pt-3">
              {/* Fixed at the default page size (10) — the common case,
                  kept stable so a short last page doesn't shrink the row
                  area. A deliberately larger "Show" is the person opting
                  into more content, so those sizes just size to whatever
                  actually renders instead of padding to 100 blank rows. */}
              <ApplicantsTable
                records={pageRecords}
                onSelect={setSelectedRecord}
                minRows={pageSize === 10 ? 10 : 0}
                rankOffset={(currentPage - 1) * pageSize}
              />
            </div>
          )}

          <div className="shrink-0 px-4 pb-4">
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={changePageSize}
              totalRecords={filteredRecords.length}
            />
          </div>
        </section>
      )}

      <ApplicantModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
        canDelete={canDelete}
        onRequestDelete={setPendingDelete}
        canReview={canReview}
        onUpdateStatus={updateStatus}
        onSaveNote={saveNote}
        // Sample fallback rows aren't real records, so opening one isn't a
        // real access event — keeping them out stops the audit trail filling
        // with entries that point at documents that never existed.
        audit={!usingSampleFallback}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this intake record?"
        description={
          deleteError ??
          `This permanently deletes ${pendingDelete ? `${pendingDelete.demographics?.firstName ?? "this applicant"}'s` : "this"} intake record. This cannot be undone.`
        }
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        confirmDisabled={deleting}
        onConfirm={confirmDelete}
        onCancel={() => {
          setPendingDelete(null)
          setDeleteError(null)
        }}
      />
    </div>
  )
}
