import { DEMO_SCENARIOS, portalDemo, switchDemoScenario } from "./lib/portalDemo"

// Development only: switches the pretend patient's situation (see portalDemo.js).
export default function PortalDemoBar() {
  if (!portalDemo) return null
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex flex-wrap items-center justify-center gap-2 border-t border-ink-950/10 bg-ink-950 px-4 py-2.5 text-sm text-paper-50">
      <span className="font-semibold">Portal demo</span>
      <label className="flex items-center gap-2">
        <span className="text-paper-50/70">Patient situation</span>
        <select
          value={portalDemo}
          onChange={(event) => switchDemoScenario(event.target.value)}
          className="cursor-pointer rounded-lg border border-paper-50/20 bg-ink-900 px-2.5 py-1.5 text-paper-50"
        >
          {Object.entries(DEMO_SCENARIOS).map(([key, scenario]) => (
            <option key={key} value={key}>
              {scenario.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
