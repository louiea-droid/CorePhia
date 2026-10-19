import { renderToString } from "react-dom/server"
import { HelmetProvider } from "react-helmet-async"
import { StaticRouter } from "react-router-dom"
import App from "./App.jsx"

// Build-time only (scripts/prerender.mjs). React 19 puts each page's <title>,
// <meta> and <link> tags (from Helmet) at the start of the string.
export function render(url) {
  return renderToString(
    <HelmetProvider>
      <StaticRouter location={url}>
        <App />
      </StaticRouter>
    </HelmetProvider>,
  )
}
