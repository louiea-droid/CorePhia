import { Suspense, lazy, useEffect } from "react"
import { Navigate, Route, Routes, useLocation, useNavigationType } from "react-router-dom"
import CookieBanner from "./components/CookieBanner"
import Footer from "./components/Footer"
import Header from "./components/Header"
import PatientIntakeForm from "./components/PatientIntakeForm"
import SiteAnalytics from "./components/SiteAnalytics"
import About from "./pages/About"
import Contact from "./pages/Contact"
import Faq from "./pages/Faq"
import Home from "./pages/Home"
import Membership from "./pages/Membership"
import ProgramPage from "./pages/ProgramPage"
import SuccessStories from "./pages/SuccessStories"

// Lazily loaded so the admin bundle — and the Firebase SDK it pulls in — is
// never downloaded by visitors to the public site.
const AdminApp = lazy(() => import("./admin/AdminApp"))

// Same reasoning as AdminApp: Account pulls in the Firebase Auth SDK via
// lib/patientAuth, so it stays out of the bundle until someone actually
// navigates to /account.
const Account = lazy(() => import("./pages/Account"))

function ScrollManager() {
  const { pathname, hash } = useLocation()
  const navigationType = useNavigationType()

  useEffect(() => {
    // On a deep link the browser resolves the hash before React has rendered the
    // target, so it never scrolls. Do it here instead, once the section exists.
    if (hash) {
      document.querySelector(hash)?.scrollIntoView({ behavior: "instant" })
      return
    }
    if (navigationType === "POP") return
    window.scrollTo({ top: 0, behavior: "instant" })
  }, [pathname, hash, navigationType])

  return null
}

function App() {
  const { pathname } = useLocation()

  // The admin is a separate surface: no marketing header, footer or theming,
  // and nothing on the public site links to it.
  if (pathname.startsWith("/admin")) {
    return (
      <Suspense fallback={null}>
        <AdminApp />
      </Suspense>
    )
  }

  // The intake is locked in (client meeting, docs/meeting-analysis.md): no
  // header, footer or nav, so the only ways out are finishing it or closing
  // the tab. PatientIntakeForm draws its own minimal top bar.
  if (pathname.replace(/\/$/, "") === "/intake") {
    return (
      <>
        <ScrollManager />
        <PatientIntakeForm />
      </>
    )
  }

  return (
    <div className="bg-paper-50">
      <ScrollManager />
      <SiteAnalytics />
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/membership" element={<Membership />} />
          <Route path="/pricing" element={<Navigate to="/membership" replace />} />
          <Route path="/programs/:slug" element={<ProgramPage />} />
          <Route path="/success-stories" element={<SuccessStories />} />
          <Route path="/intake" element={<PatientIntakeForm />} />
          <Route
            path="/account"
            element={
              <Suspense fallback={null}>
                <Account />
              </Suspense>
            }
          />
        </Routes>
      </main>
      <Footer />
      <CookieBanner />
    </div>
  )
}

export default App
