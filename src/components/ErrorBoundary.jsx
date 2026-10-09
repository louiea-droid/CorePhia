import { Component } from "react"

// Without this, any error while rendering (a bad page, or a lazy-loaded chunk
// that no longer exists after a redeploy) unmounts the whole app and leaves a
// blank white page. This shows a plain way back instead. It has no router or
// header of its own, so it still works when those are what broke.
export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error("Page crashed:", error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper-50 px-6 py-16">
        <div className="max-w-md text-center">
          <p className="font-serif text-3xl text-ink-950">Something went wrong</p>
          <p className="mt-3 text-base leading-relaxed text-ink-950/70">
            This page didn't load properly. Reloading usually fixes it. If it keeps happening, email{" "}
            <a href="mailto:info@corephia.com" className="font-medium text-accent-dark underline">
              info@corephia.com
            </a>
            .
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="cursor-pointer rounded-full bg-ink-950 px-5 py-2.5 text-sm font-semibold text-paper-50 transition-colors duration-200 hover:bg-ink-900"
            >
              Reload the page
            </button>
            {/* A plain link on purpose: it reloads from scratch, so it works even if the router is what failed. */}
            <a
              href="/"
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-ink-950/70 transition-colors duration-200 hover:bg-ink-950/5 hover:text-ink-950"
            >
              Go to the home page
            </a>
          </div>
        </div>
      </main>
    )
  }
}
