import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ageFrom, asDate } from "./chartMath"
import { loadCharts, setApplicantStatus } from "./chartStore"
import ConfirmDialog from "../ui/ConfirmDialog"
import { AUDIT_ACTIONS, INTAKE_COLLECTION, recordAuditEvent } from "../lib/firebase"
import { canAdmit } from "../staff/roles"
import { useIntakeRecords } from "../applicants/useIntakeRecords"
import { PAGE_SIZE_OPTIONS } from "../lib/constants"
import PageHeader from "../layout/PageHeader"
import { NOTE_TYPE_LABELS } from "./noteUi"
import Pagination from "../ui/Pagination"
import { ApplicantsSkeleton } from "../ui/Skeleton"

const PAGE_SIZE_KEY = "corephia-admin-charts-page-size"

const formatDate = (value) =>
  asDate(value)?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) ?? "—"

function readStoredPageSize() {
  try {
    const saved = Number(localStorage.getItem(PAGE_SIZE_KEY))
    return PAGE_SIZE_OPTIONS.includes(saved) ? saved : 10
  } catch {
    return 10
  }
}

// Admitted applicants only: their charts, newest admission first. A chart
// marked inactive (the applicant was moved off admitted) is kept, never
// deleted, and shows under "Inactive".
export default function Patients({ actor, role }) {
  const navigate = useNavigate()
  const [charts, setCharts] = useState(null)
  const [error, setError] = useState(null)
  const { records } = useIntakeRecords()
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState(null)

  // Applicants admitted before charts existed (2026-10-01) have no chart, and
  // pressing Admit again does nothing for someone already admitted. Offer to
  // start them, through the same admission batch as the Applicants page.
  const unchartered =
    charts && records ? records.filter((record) => record.status === "admitted" && !charts.some((chart) => chart.id === record.id)) : []

  const startMissingCharts = async () => {
    setStarting(true)
    setStartError(null)
    try {
      for (const record of unchartered) await setApplicantStatus(record, "admitted", actor)
      setCharts(await loadCharts())
    } catch (cause) {
      setStartError(cause?.code === "permission-denied" ? "Your role can't do this." : "Couldn't start every chart. Try again.")
    } finally {
      setStarting(false)
    }
  }
  const [pendingInactive, setPendingInactive] = useState(null)
  const [changing, setChanging] = useState(false)
  const [statusError, setStatusError] = useState(null)

  // Same path as Decline and Admit on Applicants: the chart and the
  // applicant's status change together, and nothing is deleted.
  const changeStatus = async (chart, makeActive) => {
    const record = makeActive ? records?.find((item) => item.id === chart.id) : { id: chart.id }
    if (!record) return setStatusError("Couldn't find this patient's intake record. Re-admit them from Applicants.")
    setChanging(true)
    setStatusError(null)
    try {
      await setApplicantStatus(record, makeActive ? "admitted" : "discharged", actor)
      setCharts((list) => list.map((item) => (item.id === chart.id ? { ...item, status: makeActive ? "active" : "inactive" } : item)))
      recordAuditEvent({
        action: AUDIT_ACTIONS.updateIntakeStatus,
        targetCollection: INTAKE_COLLECTION,
        targetId: chart.id,
        targetLabel: `${chart.firstName} ${chart.lastName}`.trim(),
      })
      setPendingInactive(null)
    } catch (cause) {
      setStatusError(cause?.code === "permission-denied" ? "Your role can't do this." : "Couldn't change the status. Try again.")
    } finally {
      setChanging(false)
    }
  }
  const [search, setSearch] = useState("")
  const [showInactive, setShowInactive] = useState(false)
  const [pageSize, setPageSize] = useState(readStoredPageSize)
  const [page, setPage] = useState(1)

  useEffect(() => {
    let active = true
    loadCharts()
      .then((result) => active && setCharts(result))
      .catch((cause) => active && setError(cause.code ?? cause.message))
    return () => {
      active = false
    }
  }, [])

  const filtered = useMemo(() => {
    if (!charts) return null
    const query = search.trim().toLowerCase()
    return charts
      .filter((chart) => (chart.status === "inactive") === showInactive)
      .filter((chart) => !query || `${chart.firstName} ${chart.lastName}`.toLowerCase().includes(query))
      .sort((a, b) => (asDate(b.admittedAt)?.getTime() ?? 0) - (asDate(a.admittedAt)?.getTime() ?? 0))
  }, [charts, search, showInactive])

  const inactiveCount = charts?.filter((chart) => chart.status === "inactive").length ?? 0
  const totalPages = filtered ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1
  const currentPage = Math.min(page, totalPages)
  const pageCharts = filtered ? filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize) : []

  const changePageSize = (nextSize) => {
    setPageSize(nextSize)
    setPage(1)
    try {
      localStorage.setItem(PAGE_SIZE_KEY, String(nextSize))
    } catch {
      /* private browsing / storage disabled */
    }
  }

  const open = (chart) => navigate(`/admin/patients/${chart.id}`)

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Patients" description="Admitted applicants and their charts." />

      {canAdmit(role) && unchartered.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent-dark/25 bg-white px-5 py-4">
          <p className="text-sm text-ink-950/75">
            {unchartered.length === 1 ? "1 applicant was" : `${unchartered.length} applicants were`} admitted before
            charts existed, so they don't have one yet.
            {startError && <span className="ml-1 text-brand-dark">{startError}</span>}
          </p>
          <button
            type="button"
            onClick={startMissingCharts}
            disabled={starting}
            className="cursor-pointer rounded-lg bg-ink-950 px-3.5 py-2 text-sm font-semibold whitespace-nowrap text-paper-50 transition-colors duration-200 hover:bg-brand-dark disabled:opacity-50"
          >
            {starting ? "Starting…" : unchartered.length === 1 ? "Start their chart" : "Start their charts"}
          </button>
        </div>
      )}

      {statusError && !pendingInactive && <p className="mb-3 text-sm text-brand-dark">{statusError}</p>}

      <ConfirmDialog
        open={Boolean(pendingInactive)}
        title="Make this patient inactive?"
        description={`${pendingInactive?.firstName ?? ""} ${pendingInactive?.lastName ?? ""}'s chart stays as a record, but notes and messaging close and they show as discharged on Applicants. Nothing is deleted. You can reactivate them any time.`}
        confirmLabel={changing ? "Saving…" : "Make inactive"}
        confirmDisabled={changing}
        onConfirm={() => changeStatus(pendingInactive, false)}
        onCancel={() => setPendingInactive(null)}
      >
        {statusError && <p className="text-sm text-brand-dark">{statusError}</p>}
      </ConfirmDialog>

      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-ink-950/10 bg-white p-6 text-center">
          <h2 className="font-semibold text-ink-950">Could not load patients</h2>
          <p className="mt-2 text-sm text-ink-950/60">{error}</p>
        </div>
      ) : !charts ? (
        <ApplicantsSkeleton />
      ) : !charts.length ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-ink-950/10 bg-white p-8 text-center">
          <h2 className="font-serif text-2xl text-ink-950">No patients yet</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-ink-950/60">
            Admitting an applicant starts their chart, and they appear here.
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
              placeholder="Search by patient name…"
              className="min-w-0 flex-1 rounded-lg border border-ink-950/15 bg-paper-50 px-3 py-2 text-sm text-ink-950 outline-none transition-colors duration-200 placeholder:text-ink-950/40 focus:border-ink-950/40"
            />
            <div role="group" aria-label="Chart status" className="flex shrink-0 rounded-lg bg-paper-100 p-0.5">
              {[
                [false, "Active"],
                [true, `Inactive${inactiveCount ? ` (${inactiveCount})` : ""}`],
              ].map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={showInactive === value}
                  onClick={() => {
                    setShowInactive(value)
                    setPage(1)
                  }}
                  className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-200 ${
                    showInactive === value ? "bg-white text-ink-950 shadow-sm" : "text-ink-950/55 hover:text-ink-950"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {!filtered.length ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <p className="font-medium text-ink-950">
                {search ? "No patients match your search" : showInactive ? "No inactive charts" : "No active patients"}
              </p>
            </div>
          ) : (
            <div className="scrollbar-thin flex-1 overflow-y-auto px-4 pt-3">
              <div className="scrollbar-thin -mx-4 overflow-x-auto px-4">
                <table className="w-full min-w-xl table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[26%]" />
                    <col className="w-[9%]" />
                    <col className="w-[18%]" />
                    <col className="w-[24%]" />
                    <col className="w-[23%]" />
                  </colgroup>
                  <thead>
                    <tr className="sticky top-0 z-10 border-b border-ink-950/10 bg-white text-xs tracking-wide text-ink-950/45 uppercase">
                      <th scope="col" className="pb-2 font-medium">
                        Patient
                      </th>
                      <th scope="col" className="pb-2 font-medium">
                        Age
                      </th>
                      <th scope="col" className="pb-2 font-medium">
                        Admitted
                      </th>
                      <th scope="col" className="pb-2 font-medium">
                        Last note
                      </th>
                      <th scope="col" className="pb-2 font-medium">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-950/5">
                    {pageCharts.map((chart) => {
                      const name = `${chart.firstName} ${chart.lastName}`.trim() || "Unnamed patient"
                      return (
                        <tr
                          key={chart.id}
                          onClick={() => open(chart)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              open(chart)
                            }
                          }}
                          tabIndex={0}
                          role="link"
                          aria-label={`Open ${name}'s chart`}
                          className="cursor-pointer outline-none transition-colors duration-150 hover:bg-paper-50 focus-visible:bg-paper-100"
                        >
                          <td className="truncate py-4 font-medium text-ink-950">{name}</td>
                          <td className="py-4 tabular-nums text-ink-950/60">{ageFrom(chart.dateOfBirth) ?? "—"}</td>
                          <td className="truncate py-4 whitespace-nowrap text-ink-950/60">
                            {formatDate(chart.admittedAt)}
                          </td>
                          <td className="truncate py-4 text-ink-950/60">
                            {chart.lastNote
                              ? `${NOTE_TYPE_LABELS[chart.lastNote.type] ?? "Note"}, ${formatDate(chart.lastNote.signedAt)}`
                              : "No notes yet"}
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors duration-300 ease-out ${
                                  chart.status === "inactive" ? "bg-ink-950/10 text-ink-950/60" : "bg-accent-dark/15 text-accent-text"
                                }`}
                              >
                                {/* A ripple rings out from the dot while the chart is active; it stops under reduced motion. */}
                                <span className="relative flex size-2" aria-hidden="true">
                                  {chart.status !== "inactive" && (
                                    <span className="absolute inset-0 rounded-full bg-accent-text opacity-60 motion-safe:animate-ping" />
                                  )}
                                  <span
                                    className={`relative size-2 rounded-full transition-colors duration-300 ${
                                      chart.status === "inactive" ? "bg-ink-950/40" : "bg-accent-text"
                                    }`}
                                  />
                                </span>
                                {chart.status === "inactive" ? "Inactive" : "Active"}
                              </span>
                              {canAdmit(role) && (
                                <button
                                  type="button"
                                  disabled={changing}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    if (chart.status === "inactive") changeStatus(chart, true)
                                    else setPendingInactive(chart)
                                  }}
                                  onKeyDown={(event) => event.stopPropagation()}
                                  className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50 ${
                                    chart.status === "inactive"
                                      ? "border-accent-dark/40 text-accent-text hover:bg-accent-dark hover:text-oncolor"
                                      : "border-ink-950/15 text-ink-950/70 hover:border-brand-dark hover:bg-brand-dark/20 hover:text-brand-dark"
                                  }`}
                                >
                                  {chart.status === "inactive" ? "Reactivate" : "Make inactive"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
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
              totalRecords={filtered.length}
            />
          </div>
        </section>
      )}
    </div>
  )
}
