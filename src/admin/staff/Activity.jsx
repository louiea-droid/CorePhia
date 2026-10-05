import { useMemo, useState } from "react"
import Select from "../../components/Select"
import { PAGE_SIZE_OPTIONS } from "../lib/constants"
import { AUDIT_ACTIONS } from "../lib/firebase"
import PageHeader from "../layout/PageHeader"
import Pagination from "../ui/Pagination"
import { ApplicantsSkeleton } from "../ui/Skeleton"
import { useAuditLog } from "./useAuditLog"

const PAGE_SIZE_KEY = "corephia-admin-activity-page-size"

// Stored actions are machine-readable strings; these are what a person
// reviewing the trail actually reads.
const ACTION_LABELS = {
  [AUDIT_ACTIONS.viewIntake]: "Opened intake record",
  [AUDIT_ACTIONS.deleteIntake]: "Deleted intake record",
  [AUDIT_ACTIONS.updateIntakeStatus]: "Changed applicant status",
  [AUDIT_ACTIONS.viewMessage]: "Opened query",
  [AUDIT_ACTIONS.deleteMessage]: "Deleted query",
  [AUDIT_ACTIONS.viewChart]: "Opened patient chart",
  [AUDIT_ACTIONS.signNote]: "Signed a note",
  [AUDIT_ACTIONS.addAmendment]: "Added an addendum",
  [AUDIT_ACTIONS.addStaff]: "Added staff",
  [AUDIT_ACTIONS.changeStaffRole]: "Changed a staff role",
  [AUDIT_ACTIONS.deleteStaff]: "Deleted a staff account",
  [AUDIT_ACTIONS.bookAppointment]: "Booked an appointment",
  [AUDIT_ACTIONS.moveAppointment]: "Changed an appointment",
  [AUDIT_ACTIONS.cancelAppointment]: "Cancelled an appointment",
  [AUDIT_ACTIONS.updateAppointmentStatus]: "Marked an appointment",
  [AUDIT_ACTIONS.sendPortalInvite]: "Sent a portal invite",
}

const DESTRUCTIVE_ACTIONS = new Set([AUDIT_ACTIONS.deleteIntake, AUDIT_ACTIONS.deleteMessage, AUDIT_ACTIONS.deleteStaff])

function formatTimestamp(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function readStoredPageSize() {
  try {
    const saved = Number(localStorage.getItem(PAGE_SIZE_KEY))
    return PAGE_SIZE_OPTIONS.includes(saved) ? saved : 20
  } catch {
    return 20
  }
}

export default function Activity({ role }) {
  const { entries, error } = useAuditLog()
  const [pageSize, setPageSize] = useState(readStoredPageSize)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [actionFilter, setActionFilter] = useState("")

  const filteredEntries = useMemo(() => {
    if (!entries) return null
    const query = search.trim().toLowerCase()
    return entries.filter((entry) => {
      if (actionFilter && entry.action !== actionFilter) return false
      if (!query) return true
      return `${entry.actorEmail ?? ""} ${entry.targetLabel ?? ""}`.toLowerCase().includes(query)
    })
  }, [entries, search, actionFilter])

  const totalPages = filteredEntries ? Math.max(1, Math.ceil(filteredEntries.length / pageSize)) : 1
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

  const pageEntries = filteredEntries
    ? filteredEntries.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : []

  // The rules allow superAdmin only, so a plain admin arriving here directly
  // would otherwise just see a raw permission error.
  if (role !== "superAdmin") {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Activity" description="Who opened or deleted a record, and when." />
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-ink-950/10 bg-white p-8 text-center">
          <h2 className="font-serif text-2xl text-ink-950">Super admin only</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-ink-950/60">
            The activity trail records who accessed patient data. Only a super admin can review it.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Activity" description="Who opened or deleted a record, and when." />

      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-ink-950/10 bg-white p-6 text-center">
          <h2 className="font-semibold text-ink-950">Could not load the activity trail</h2>
          <p className="mt-2 text-sm text-ink-950/60">{error}</p>
        </div>
      ) : !entries ? (
        <ApplicantsSkeleton />
      ) : !entries.length ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-ink-950/10 bg-white p-8 text-center">
          <h2 className="font-serif text-2xl text-ink-950">No activity yet</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-ink-950/60">
            Opening or deleting an intake record will be recorded here.
          </p>
        </div>
      ) : (
        <section className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-ink-950/10 bg-white">
          <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-ink-950/10 p-4">
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Search by staff email or record…"
              className="min-w-0 flex-1 rounded-lg border border-ink-950/15 bg-paper-50 px-3 py-2 text-sm text-ink-950 outline-none transition-colors duration-200 placeholder:text-ink-950/40 focus:border-ink-950/40"
            />
            <div className="w-52 shrink-0">
              <Select
                value={actionFilter}
                onChange={(next) => {
                  setActionFilter(next)
                  setPage(1)
                }}
                options={[
                  { value: "", label: "All activity" },
                  ...Object.entries(ACTION_LABELS).map(([action, label]) => ({ value: action, label })),
                ]}
                triggerClassName="px-3 py-2 text-sm"
              />
            </div>
          </div>

          {!filteredEntries.length ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <p className="font-medium text-ink-950">No activity matches your search</p>
              <p className="mt-1 text-sm text-ink-950/50">Try a different email, record or activity type.</p>
            </div>
          ) : (
            <div className="scrollbar-thin flex-1 overflow-y-auto px-4 pt-3">
              <div className="-mx-4 overflow-x-auto px-4">
                <table className="w-full min-w-xl table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[24%]" />
                    <col className="w-[28%]" />
                    <col className="w-[26%]" />
                    <col className="w-[22%]" />
                  </colgroup>
                  <thead>
                    <tr className="sticky top-0 z-10 border-b border-ink-950/10 bg-white text-xs tracking-wide text-ink-950/45 uppercase">
                      <th scope="col" className="pb-2 font-medium">
                        When
                      </th>
                      <th scope="col" className="pb-2 font-medium">
                        Staff member
                      </th>
                      <th scope="col" className="pb-2 font-medium">
                        Action
                      </th>
                      <th scope="col" className="pb-2 font-medium">
                        Record
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-950/5">
                    {pageEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td className="truncate py-3 whitespace-nowrap text-ink-950/60">
                          {formatTimestamp(entry.at)}
                        </td>
                        <td className="truncate py-3 font-medium text-ink-950">{entry.actorEmail || "—"}</td>
                        <td
                          className={`truncate py-3 ${
                            DESTRUCTIVE_ACTIONS.has(entry.action) ? "font-medium text-brand-dark" : "text-ink-950/60"
                          }`}
                        >
                          {ACTION_LABELS[entry.action] ?? entry.action}
                        </td>
                        <td className="truncate py-3 text-ink-950/60">{entry.targetLabel || entry.targetId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="shrink-0 px-4 pb-4">
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={changePageSize}
              totalRecords={filteredEntries.length}
            />
          </div>
        </section>
      )}
    </div>
  )
}
