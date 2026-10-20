// Runs after `vite build` and `vite build --ssr`: renders each public page to
// real HTML (dist/<route>.html, served at /<route> by cleanUrls in firebase.json) so crawlers that skip JavaScript see the
// content. Browsers still mount the app with createRoot and replace it.
import assert from "node:assert/strict"
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { pathToFileURL } from "node:url"
import { guides } from "../src/data/guides.js"
import { programs } from "../src/data/programs.js"

const SITE = "https://corephia.com"
const routes = [
  "/",
  "/about",
  "/contact",
  "/faq",
  "/membership",
  "/privacy",
  "/terms",
  "/privacy-practices",
  ...programs.map(({ slug }) => `/programs/${slug}`),
  ...guides.map(({ slug }) => `/guides/${slug}`),
]

const { render } = await import(pathToFileURL(join("dist-ssr", "entry-server.js")).href)
const template = readFileSync("dist/index.html", "utf8")
// The rewrite target for every other address (admin, portal, intake, 404s): the
// plain app with no page baked in, so none of them shows the home page to crawlers.
writeFileSync("dist/app.html", template.replace("</head>", '    <meta name="robots" content="noindex" />\n  </head>'))

for (const route of routes) {
  const output = render(route)
  // React 19 hoists the page's head tags to the front of the output. They move
  // into <head>, tagged so main.jsx can drop them before React adds its own.
  const [, hoisted, html] = /^((?:<(?:title|meta|link)\b[^>]*>(?:[^<]*<\/title>)?)*)([\s\S]*)$/.exec(output)
  const head = hoisted.replace(/<(title|meta|link)\b/g, "<$1 data-prerender")
  const title = /<title[^>]*>([^<]*)<\/title>/.exec(hoisted)?.[1]
  const description = /name="description" content="([^"]*)"/.exec(hoisted)?.[1]

  let page = template
    .replace(/<title>[\s\S]*?<\/title>/, "")
    .replace("</head>", `    ${head}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${html}</div>`)
  // Link-preview scrapers read these instead of the page's own tags.
  page = page
    .replace(/(property="og:url" content=")[^"]*/, `$1${SITE}${route}`)
    .replace(/(property="og:title" content=")[^"]*/, `$1${title}`)
    .replace(/(name="twitter:title" content=")[^"]*/, `$1${title}`)
  if (description) {
    page = page
      .replace(/(property="og:description"\s+content=")[^"]*/, `$1${description}`)
      .replace(/(name="twitter:description"\s+content=")[^"]*/, `$1${description}`)
  }

  // The check: every page needs its own title, canonical, and one <h1> in the body.
  assert.match(page, /<title[^>]*>[^<]+<\/title>/, `${route}: no title`)
  assert.ok(page.includes(`<link data-prerender rel="canonical" href="${SITE}${route}"`), `${route}: wrong canonical`)
  assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, `${route}: needs exactly one <h1>`)
  // A heading inside a hidden Reveal paints only after the script runs (use <Reveal eager>).
  // shortcut: checks the nearest data-reveal before the <h1>, not real nesting; fine while heroes come first.
  const revealBeforeH1 = html.slice(0, html.search(/<h1[\s>]/)).match(/data-reveal="(\w+)"(?![\s\S]*data-reveal=)/)?.[1]
  assert.notEqual(revealBeforeH1, "hidden", `${route}: the <h1> is inside a hidden Reveal`)

  const file = route === "/" ? "dist/index.html" : `dist${route}.html`
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, page)
  console.log(`prerendered ${route}`)
}

rmSync("dist-ssr", { recursive: true, force: true })
