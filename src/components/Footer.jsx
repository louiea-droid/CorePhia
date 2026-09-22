import { Link } from "react-router-dom"
import { useReveal } from "../hooks/useReveal"
import {
  FacebookIcon,
  GlobeIcon,
  InstagramIcon,
  LinkedInIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  ShieldCheckIcon,
  XIcon,
} from "./icons"

const contactDetails = [
  { icon: GlobeIcon, text: "corephia.com" },
  { icon: MailIcon, text: "info@corephia.com" },
  { icon: PhoneIcon, text: "(000) 123-4567" },
  { icon: MapPinIcon, text: "Tampa, Florida" },
]

// TODO: replace with real profile URLs before launch.
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
      { label: "Weight loss programs", href: "/#programs" },
      { label: "Membership pricing", href: "/#pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About us", to: "/about" },
      { label: "Contact us", to: "/contact" },
    ],
  },
  {
    title: "Patients",
    links: [
      { label: "FAQs", to: "/faq" },
      { label: "Privacy policy" },
      { label: "Terms of service" },
    ],
  },
]

export default function Footer() {
  const [wordmarkRef, wordmarkVisible] = useReveal()

  return (
    <footer data-header-theme="dark" className="bg-ink-950 pt-16 pb-10 text-paper-100/70">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link to="/" className="font-serif text-2xl text-paper-100">
              CorePhia
            </Link>

            <ul className="mt-4 space-y-2 text-sm text-paper-100/60">
              {contactDetails.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2">
                  <Icon className="size-4 shrink-0 text-accent" />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className="text-sm font-semibold text-paper-100">{col.title}</h3>
              <ul className="mt-4 space-y-2 text-sm">
                {col.links.map(({ label, to, href }) => (
                  <li key={label}>
                    {to || href ? (
                      to ? (
                        <Link
                          to={to}
                          className="inline-block transition-[color,transform] duration-200 ease-out-smooth hover:translate-x-0.5 hover:text-paper-100"
                        >
                          {label}
                        </Link>
                      ) : (
                        <a
                          href={href}
                          className="inline-block transition-[color,transform] duration-200 ease-out-smooth hover:translate-x-0.5 hover:text-paper-100"
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

              {col.title === "Patients" && (
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

        <div className="mt-14 flex flex-col gap-6 border-t border-paper-100/10 pt-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-paper-100/60">
            <ShieldCheckIcon className="size-8 text-accent" />
            Certified
          </div>

          <div className="text-xs leading-relaxed text-paper-100/40 sm:text-right">
          {/* <p>
              Corephia is a telehealth platform connecting patients with independent, licensed healthcare providers.
              Corephia does not itself provide medical care and is not a substitute for the independent judgment of
              a healthcare provider. Prescription products require an online consultation with a provider who will
              determine if a prescription is appropriate. Not all products or doses are appropriate for all
              patients.
            </p> */}
           
            <p className="mt-2">
              &copy; {new Date().getFullYear()} CorePhia. All rights reserved. COREPHIA is a trademark of CorePhia.
            </p>
          </div>
        </div>
      </div>


    </footer>
  )
}
