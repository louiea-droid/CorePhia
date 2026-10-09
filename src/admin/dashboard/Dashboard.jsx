import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { calorieBucket, deriveMetrics, goalBucket, medicationInterestLabel } from "../analytics/analytics"
import { BarList, Card, ColumnChart, Histogram, RankedList, StackedBar, StatTile, TagCloud } from "../ui/charts"
import { ChevronLeftIcon } from "../ui/icons"
import PageHeader from "../layout/PageHeader"
import ApplicantListModal from "../applicants/ApplicantListModal"
import ApplicantModal from "../applicants/ApplicantModal"
import ApplicantsTable from "../applicants/ApplicantsTable"
import { DashboardSkeleton } from "../ui/Skeleton"
import SampleDataNotice from "../ui/SampleDataNotice"
import TodayStrip from "./TodayStrip"
import { TEMP_FAKE_RECORDS } from "../lib/tempFakeRecords"
import { useIntakeRecords } from "../applicants/useIntakeRecords"

export default function Dashboard({ actor }) {
  const { records, error } = useIntakeRecords()
  const [selectedRecord, setSelectedRecord] = useState(null)
  // Which BarList row a patient list is currently drilled into: title/
  // description for the modal header, plus the predicate that finds the
  // matching records. A function rather than a {field, label} pair because
  // the cards don't all filter the same way — multi-select conditions need
  // an array .includes, single-select fields need ===, and the weight
  // histogram needs a numeric range — so each card just supplies the check
  // that's actually correct for its own data instead of the drilldown trying
  // to guess it from a shared shape.
  const [drilldown, setDrilldown] = useState(null)

  // See tempFakeRecords.js — same real-but-empty fallback Patients.jsx uses,
  // so the charts here have something to render instead of sitting at zero.
  const usingSampleFallback = Boolean(records && records.length === 0)
  const baseRecords = usingSampleFallback ? TEMP_FAKE_RECORDS : records
  const metrics = useMemo(() => (baseRecords ? deriveMetrics(baseRecords) : null), [baseRecords])

  const drilldownMatches = useMemo(() => {
    if (!drilldown || !baseRecords) return []
    return baseRecords.filter(drilldown.match)
  }, [baseRecords, drilldown])

  return (
    <div>
      <PageHeader
        title="Dashboard"
      />

      {/* Real records only: the sample fallback below is for the charts, and
          a made-up pending count here would send staff to an empty page. */}
      <div className="mb-4">
        <TodayStrip
          actor={actor}
          pending={error ? "error" : records ? records.filter((record) => (record.status ?? "pending") === "pending").length : null}
        />
      </div>

      {usingSampleFallback && <SampleDataNotice />}

      {error ? (
        <div className="rounded-2xl border border-ink-950/10 bg-white p-6">
          <h2 className="font-semibold text-ink-950">Could not load intake records</h2>
          <p className="mt-2 text-sm text-ink-950/60">{error}</p>
        </div>
      ) : !metrics ? (
        <DashboardSkeleton />
      ) : !metrics.total ? (
        <div className="rounded-2xl border border-ink-950/10 bg-white p-8 text-center">
          <h2 className="font-serif text-2xl text-ink-950">No intakes yet</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-ink-950/60">
            Completed patient intake forms will appear here, with a breakdown of what applicants reported.
          </p>
        </div>
      ) : (
        // overflow-x-clip so the hover tooltips, which are absolutely positioned
        // and can sit past a card's edge, never widen the page on a narrow screen.
        <div className="space-y-4 overflow-x-clip">
          {/* Six tiles: two full rows of three. Pending moved up into the
              Today strip, and "Avg intended loss" was just goal minus current
              weight, so the two averages beside it already say it. */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatTile label="Total intakes" value={metrics.total} caption="All forms submitted to date" />
            <StatTile label="Last 30 days" value={metrics.last30} caption="New patient intakes this month" />
            <StatTile label="Admitted" value={metrics.admitted} caption="Cleared to start the program" />
            <StatTile
              label="Consent complete"
              value={metrics.consentCompleteRate}
              unit="%"
              caption="Telehealth + HIPAA acknowledged"
            />
            <StatTile
              label="Avg current weight"
              value={metrics.avgCurrentWeight ?? "—"}
              unit="lb"
              caption="Self-reported at intake"
            />
            <StatTile
              label="Avg goal weight"
              value={metrics.avgGoalWeight ?? "—"}
              unit="lb"
              caption="What applicants are aiming for"
            />
          </div>

          {/* Paired by chart type, not by topic: both are bar/column
              distributions over a numeric or ordered axis, so they read as
              one visual language. Weekly gets more width for its 10 columns;
              weight spread only has 5 bins and reads fine narrower. */}
          <div className="grid gap-4 lg:grid-cols-5">
            <Card title="Intakes submitted per week" hint="Last 10 weeks" className="lg:col-span-3">
              <ColumnChart data={metrics.weekly} />
            </Card>
            <Card title="Current weight spread" hint="Self-reported at intake" className="lg:col-span-2">
              <Histogram
                data={metrics.currentWeightBands}
                unit="lb"
                onSelect={(item) =>
                  setDrilldown({
                    title: item.label,
                    description: "Current weight",
                    match: (record) => {
                      const weight = Number(record.vitals?.currentWeightLb)
                      return Number.isFinite(weight) && weight >= item.min && weight < item.max
                    },
                  })
                }
              />
            </Card>
          </div>

          {/* Paired by shape, not by topic: both are compact ranked
              summaries (a handful of rows, a count, a share) rather than the
              taller detail breakdowns below — keeping them together instead
              of next to a much taller neighbor is what stops either one
              looking like it's floating in leftover space. */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Plans are switched off until real ones exist (data/pricingTiers.js),
                so new intakes carry no plan. Show the split only if some do. */}
            {metrics.plans.length ? (
              <Card title="Membership plan requested">
                <StackedBar data={metrics.plans} total={metrics.total} />
              </Card>
            ) : (
              <Card title="Weight loss goal" hint="Typed goals are grouped into the same ranges">
                <BarList
                  data={metrics.goals}
                  total={metrics.total}
                  onSelect={(item) =>
                    setDrilldown({
                      title: item.label,
                      description: "Weight loss goal",
                      match: (record) => goalBucket(record) === item.label,
                    })
                  }
                />
              </Card>
            )}
            <Card title="Where applicants are" hint="By state on the intake address">
              <RankedList
                data={metrics.states}
                total={metrics.total}
                onSelect={(item) =>
                  setDrilldown({
                    title: item.label,
                    description: "State on the intake address",
                    match: (record) => record.demographics?.address?.state === item.label,
                  })
                }
              />
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Reason for the visit">
              <BarList
                data={metrics.reasons}
                total={metrics.total}
                onSelect={(item) =>
                  setDrilldown({
                    title: item.label,
                    description: "Reason for visit",
                    match: (record) => record.visit?.reason === item.label,
                  })
                }
              />
            </Card>
            <Card title="Current exercise">
              <BarList
                data={metrics.exercise}
                total={metrics.total}
                onSelect={(item) =>
                  setDrilldown({
                    title: item.label,
                    description: "Current exercise",
                    match: (record) => record.socialHistory?.exerciseFrequency === item.label,
                  })
                }
              />
            </Card>
            <Card title="Tobacco use">
              <BarList
                data={metrics.tobacco}
                total={metrics.total}
                onSelect={(item) =>
                  setDrilldown({
                    title: item.label,
                    description: "Tobacco use",
                    match: (record) => record.socialHistory?.tobacco === item.label,
                  })
                }
              />
            </Card>
          </div>

          {/* The intake's newer questions: medication interest, meals and
              calories. Medication interest is a preference the provider
              weighs, never a request to fill (CLAUDE.md). */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Interest in medication" hint="Discussed with the provider">
              <BarList
                data={metrics.medicationInterest}
                total={metrics.total}
                emptyLabel="No answers yet"
                onSelect={(item) =>
                  setDrilldown({
                    title: item.label,
                    description: "Interest in medication",
                    match: (record) => medicationInterestLabel(record.medicalHistory?.medicationInterest) === item.label,
                  })
                }
              />
            </Card>
            <Card title="Meals per day">
              <BarList
                data={metrics.meals}
                total={metrics.total}
                emptyLabel="No answers yet"
                onSelect={(item) =>
                  setDrilldown({
                    title: item.label === "1" ? "1 meal a day" : `${item.label} meals a day`,
                    description: "Meals per day",
                    match: (record) => record.nutrition?.mealsPerDay === item.label,
                  })
                }
              />
            </Card>
            <Card title="Estimated daily calories" hint="Self-reported">
              <BarList
                data={metrics.calories}
                total={metrics.total}
                emptyLabel="No answers yet"
                onSelect={(item) =>
                  setDrilldown({
                    title: item.label,
                    description: "Estimated daily calories",
                    match: (record) => calorieBucket(record) === item.label,
                  })
                }
              />
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Conditions applicants reported" hint="Applicants may report more than one">
              <TagCloud
                data={metrics.conditions}
                emptyLabel="No conditions reported yet"
                onSelect={(item) =>
                  setDrilldown({
                    title: item.label,
                    description: "Condition reported",
                    match: (record) => (record.medicalHistory?.conditions ?? []).includes(item.label),
                  })
                }
              />
            </Card>
            <Card title="Family history reported" hint="Applicants may report more than one">
              <TagCloud
                data={metrics.familyHistory}
                emptyLabel="No family history reported yet"
                onSelect={(item) =>
                  setDrilldown({
                    title: item.label,
                    description: "Family history reported",
                    match: (record) => (record.familyHistory?.conditions ?? []).includes(item.label),
                  })
                }
              />
            </Card>
          </div>

          <Card
            title="Most recent intakes"
            hint={
              <Link
                to="/admin/applicants"
                className="inline-flex items-center gap-1 font-medium text-accent-text hover:opacity-70"
              >
                See all applicants
                <ChevronLeftIcon className="size-3.5 rotate-180" />
              </Link>
            }
          >
            <ApplicantsTable records={baseRecords.slice(0, 8)} onSelect={setSelectedRecord} />
          </Card>
        </div>
      )}

      <ApplicantListModal
        title={drilldown?.title}
        subtitle={
          drilldown &&
          `${drilldown.description}: ${drilldownMatches.length} applicant${drilldownMatches.length === 1 ? "" : "s"}`
        }
        records={drilldownMatches}
        onSelectPatient={(record) => {
          setDrilldown(null)
          setSelectedRecord(record)
        }}
        onClose={() => setDrilldown(null)}
      />

      <ApplicantModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
        audit={!usingSampleFallback}
      />
    </div>
  )
}
