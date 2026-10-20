import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// The prerendered page (scripts/prerender.mjs) put its head tags in the HTML for
// crawlers. React adds its own, so drop those or they would go stale on navigation.
document.head.querySelectorAll('[data-prerender]').forEach((tag) => tag.remove())

// After a deploy the old hashed chunks are gone, so a tab opened before it fails
// to load the intake, portal or login. Reload once to get the new build; the
// stored time stops a reload loop if the chunk is missing for another reason.
window.addEventListener('vite:preloadError', (event) => {
  let last = 0
  try {
    last = Number(sessionStorage.getItem('corephia-chunk-reload')) || 0
    sessionStorage.setItem('corephia-chunk-reload', String(Date.now()))
  } catch {
    // No storage (private mode): let the ErrorBoundary show instead of risking a loop.
    return
  }
  if (Date.now() - last < 30000) return
  event.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </HelmetProvider>
    </ErrorBoundary>
  </StrictMode>,
)
