import { openPrivacyChoices } from "../lib/analyticsConsent"
import { Link } from "react-router-dom"
import {
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  XIcon,
} from "./icons"
import { LOCATION, LOCATION_MAP_URL, SUPPORT_PHONE } from "../lib/siteContact"

const contactDetails = [
  { icon: MailIcon, text: "info@corephia.com", href: "mailto:info@corephia.com" },
  { icon: PhoneIcon, text: SUPPORT_PHONE, href: `tel:${SUPPORT_PHONE.replace(/\D/g, "")}` },
  { icon: MapPinIcon, text: LOCATION, href: LOCATION_MAP_URL },
]

// TODO: real profile URLs. The Social block stays hidden while every link is "#".
const socialLinks = [
  { label: "Facebook", icon: FacebookIcon, href: "#" },
  { label: "X", icon: XIcon, href: "#" },
  { label: "Instagram", icon: InstagramIcon, href: "#" },
  { label: "LinkedIn", icon: LinkedInIcon, href: "#" },
]

// Entries without `to`/`href` are not built yet and render as plain text.
const columns = [
  {
    title: "Programs",
    links: [
      { label: "Medical care", to: "/programs/medical-care" },
      { label: "Dietitian services", to: "/programs/dietitian-services" },
      { label: "Comprehensive Exercise Plan", to: "/programs/exercise-plan" },
      { label: "Follow-ups", to: "/programs/follow-ups" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About us", to: "/about" },
      { label: "Success stories", to: "/success-stories" },
      { label: "Membership", to: "/membership" },
      { label: "Contact us", to: "/contact" },
    ],
  },
  {
    title: "Patients",
    links: [
      { label: "FAQs", to: "/faq" },
      { label: "Privacy policy", to: "/privacy" },
      { label: "Terms of service", to: "/terms" },
      { label: "Notice of privacy practices", to: "/privacy-practices" },
      { label: "Privacy choices", onClick: openPrivacyChoices },
    ],
  },
]

export default function Footer() {
  return (
    <footer data-header-theme="dark" className="bg-ink-950 pt-12 pb-8 text-paper-100/70 sm:pt-16 sm:pb-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:gap-10 lg:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <Link to="/" className="font-serif text-2xl text-paper-100">
              CorePhia
            </Link>

            <ul className="mt-4 space-y-2 text-sm text-paper-100/60">
              {contactDetails.map(({ icon: Icon, text, href }) => (
                <li key={text} className="flex items-center gap-2">
                  <Icon className="size-4 shrink-0 text-accent" />
                  {href ? (
                    <a
                      href={href}
                      target={href.startsWith("http") ? "_blank" : undefined}
                      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                      aria-label={href.startsWith("http") ? `${text}, opens in Google Maps` : undefined}
                      className="transition-colors duration-200 ease-out-smooth hover:text-paper-100"
                    >
                      {text}
                    </a>
                  ) : (
                    text
                  )}
                </li>
              ))}
            </ul>
          </div>

          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className="text-sm font-semibold text-paper-100">{col.title}</h3>
              <ul className="mt-4 space-y-2 text-sm">
                {col.links.map(({ label, to, href, onClick }) => (
                  <li key={label}>
                    {onClick ? (
                      <button
                        type="button"
                        onClick={onClick}
                        className="inline-block cursor-pointer transition-colors duration-200 ease-out-smooth hover:text-paper-100"
                      >
                        {label}
                      </button>
                    ) : to || href ? (
                      to ? (
                        <Link
                          to={to}
                          className="inline-block transition-colors duration-200 ease-out-smooth hover:text-paper-100"
                        >
                          {label}
                        </Link>
                      ) : (
                        <a
                          href={href}
                          className="inline-block transition-colors duration-200 ease-out-smooth hover:text-paper-100"
                        >
                          {label}
                        </a>
                      )
                    ) : (
                      <span className="inline-block text-paper-100/30">{label}</span>
                    )}
                  </li>
                ))}
              </ul>

              {col.title === "Patients" && socialLinks.some(({ href }) => href !== "#") && (
                <>
                  <h3 className="mt-6 text-sm font-semibold text-paper-100">Social</h3>
                  <ul className="mt-4 flex items-center gap-3">
                    {socialLinks.map(({ label, icon: Icon, href }) => (
                      <li key={label}>
                        <a
                          href={href}
                          aria-label={label}
                          className="flex size-10 items-center justify-center rounded-full bg-paper-100/10 text-paper-100 transition-colors duration-200 ease-out-smooth hover:bg-paper-100/20"
                        >
                          <Icon className="size-4" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-paper-100/10 pt-6 sm:mt-14 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="text-xs leading-relaxed text-paper-100/60">
          {/* <p>
              CorePhia is a telehealth platform connecting patients with independent, licensed healthcare providers.
              CorePhia does not itself provide medical care and is not a substitute for the independent judgment of
              a healthcare provider. Prescription products require an online consultation with a provider who will
              determine if a prescription is appropriate. Not all products or doses are appropriate for all
              patients.
            </p> */}
           
            <p className="mt-2">
              &copy; {new Date().getFullYear()} CorePhia. All rights reserved.
            </p>
          </div>
        </div>
      </div>


    </footer>
  )
}
