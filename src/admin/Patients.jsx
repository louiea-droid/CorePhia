import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ageFrom, asDate } from "./chartMath"
import { loadCharts, setApplicantStatus } from "./chartStore"
import { useIntakeRecords } from "./useIntakeRecords"
import { PAGE_SIZE_OPTIONS } from "./constants"
import PageHeader from "./PageHeader"
import { NOTE_TYPE_LABELS } from "./noteUi"
import Pagination from "./Pagination"
import { ApplicantsSkeleton } from "./Skeleton"

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
export default function Patients({ actor }) {
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

      {unchartered.length > 0 && (
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
                    <col className="w-[34%]" />
                    <col className="w-[12%]" />
                    <col className="w-[22%]" />
                    <col className="w-[32%]" />
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
