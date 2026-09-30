// Synthetic page views and clicks for reviewing the Analytics page in the
// dev server before real data exists. Only ever loaded when usingSeedData is
// true (see firebase.js), never in a production build.
const PAGES = [
  ["/", 40],
  ["/programs/medical-care", 12],
  ["/programs/dietitian-services", 10],
  ["/programs/exercise-plan", 9],
  ["/programs/follow-ups", 6],
  ["/membership", 14],
  ["/about", 8],
  ["/faq", 7],
  ["/success-stories", 5],
  ["/contact", 4],
  ["/intake", 9],
]
const CLICKS = [
  ["Get started", 14],
  ["Explore our weight loss programs", 6],
  ["Learn about membership", 5],
  ["Medical care", 4],
  ["Read about our provider", 3],
  ["Log in", 2],
]

// Deterministic, so the charts don't reshuffle on every reload.
function seeded(seed) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

export function sampleSiteEvents(days) {
  const random = seeded(7)
  const events = []
  for (let back = 0; back < days; back += 1) {
    const day = new Date(Date.now() - back * 86400000).toLocaleDateString("en-CA")
    const weight = 0.6 + random() * 0.8
    for (const [path, perDay] of PAGES) {
      const count = Math.round((perDay / 3) * weight * (0.5 + random()))
      for (let i = 0; i < count; i += 1) events.push({ type: "pageview", path, label: "", day })
    }
    for (const [label, perDay] of CLICKS) {
      const count = Math.round((perDay / 3) * weight * (0.5 + random()))
      for (let i = 0; i < count; i += 1) events.push({ type: "click", path: "/", label, day })
    }
  }
  return events
}
