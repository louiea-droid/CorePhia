import { Helmet } from "react-helmet-async"
import { Link } from "react-router-dom"
import { SUPPORT_PHONE } from "../lib/siteContact"

const UPDATED = "October 13, 2026"
const EMAIL = "info@corephia.com"

// Each section is a heading plus a body. A string in the body is a paragraph and
// an array is a bullet list, in the order written. Everything stated here has to
// match what the site really does (intake fields, portal, analytics, email
// notices, hosting). Change the system, change this.
const privacy = [
  {
    h: "The short version",
    body: [
      [
        "We collect what you give us so that a licensed provider can review your health and care for you.",
        "We do not sell your information, and we do not use it for advertising.",
        "Visit counts and Google Analytics run only on our public pages, only if you accept them, and you can change your mind at any time. They never run on the intake or the patient portal.",
        "Only people who need your records to do their job can open them.",
        "You can ask us for a copy of your information or ask us to correct it.",
      ],
    ],
  },
  {
    h: "Who this covers",
    body: [
      "This policy is from CorePhia, a weight loss program based in Tampa, Florida. It covers this website, the patient intake, the contact form, and the patient portal. It applies to visitors, people who apply, and patients.",
      "Information you give us as a patient is also covered by our Notice of Privacy Practices (linked at the end of this page), which explains your rights over your health records. If anything in that notice is more protective than this page, the notice controls for your health information.",
    ],
  },
  {
    h: "What we collect",
    body: [
      "Information you give us:",
      [
        "On the intake: your name, date of birth, sex assigned at birth, phone, email, and home address; your height, current and goal weight, and highest adult weight; your medical conditions, medications, allergies, surgeries, past weight loss treatment, and interest in medication; your family medical history; your tobacco and alcohol use and how often you exercise; what and how much you eat and drink; the plan you are interested in and when you would like a visit; any notes you add; and your agreement to the telehealth consent and privacy acknowledgement with your typed signature and the date.",
        "On the contact form: your name, phone, email, what you are interested in, and your message.",
        "In the patient portal: your login email, the weights you log, and the messages you send. Your password is handled by our sign-in service. Our staff cannot see it.",
        "When you call or email us: what you tell us and your contact details.",
      ],
      "Information our care team creates about you once you are a patient: appointment records, visit notes, plans, prescriptions and vitals, and the updates and messages they send you through the portal.",
      "Information collected automatically:",
      [
        "Visit counts, only if you press Accept on the privacy banner. We record which page was viewed or which link or button was clicked, and the day. We do not use cookies for this, and we do not record your IP address or give you a visitor ID, so these counts cannot be tied to you. We do not count anything you do inside the intake, the patient portal, or the staff area.",
        "Server logs. Our hosting provider keeps routine logs of requests to the site (such as IP address, browser type, and the pages requested) for security and to keep the site running.",
        "Google Analytics, only if you press Accept, and only on our public pages (such as the home, program, guide, FAQ, and membership pages). It uses cookies to tell Google which pages were visited, how long, the kind of device and browser, the approximate location (city level), and how you arrived at the site. It never runs on the intake, the patient portal, or the staff area, so it never receives anything you tell us about your health. We have turned off Google's advertising features. Google handles this data under its own privacy policy. If you later press Decline, it stops and its cookies are removed.",
      ],
      "Until you press Send, what you type into the intake stays in your own browser. We receive it only when you submit.",
    ],
  },
  {
    h: "How we use it",
    body: [
      [
        "To review your intake, decide with you whether the program fits, and arrange your first visit.",
        "To provide and document your care, including prescriptions when a provider decides they are appropriate.",
        "To run your patient portal, schedule visits, and answer your messages and questions.",
        "To send you notification emails that something is waiting for you in your portal.",
        "To understand, in anonymous counts, which pages people use, so we can improve the site.",
        "To keep the site and patient records secure, to prevent misuse, and to meet legal and professional obligations.",
      ],
      "We do not use your health information to market to you, and we do not sell it.",
    ],
  },
  {
    h: "Who we share it with",
    body: [
      [
        "Your care team. The licensed providers, dietitian, and staff involved in your care, and only as much as each needs.",
        "Service providers that help us run the program. They handle information for us and not for their own purposes. Today these are Google Firebase (our database, sign-in, and site hosting), EmailJS (which delivers our notification emails), and, if you accept, Google Analytics on our public pages. The notification emails go to your address and say only that something is waiting for you. They never contain health details.",
        "Pharmacies and other health professionals, when a provider sends a prescription or refers you, as your care requires.",
        "People you ask us to share with, and anyone you give written permission to. For example, we publish a patient's story only with their written permission.",
        "Authorities or others when the law requires it, to respond to a valid legal process, or to protect someone from serious harm.",
        "A buyer or successor, if CorePhia is ever sold or reorganized. Patient records would stay protected by law.",
      ],
      "We do not sell your personal information and we do not share it for advertising.",
    ],
  },
  {
    h: "Health information and HIPAA",
    body: [
      "We treat the health information you give us as confidential. Where HIPAA applies to us, we follow it, and our Notice of Privacy Practices describes how your health information may be used and disclosed and your rights over it. Florida law on the confidentiality of patient records also applies.",
      "Submitting an intake does not make you a patient. Your records are part of a medical record once a CorePhia provider accepts you.",
    ],
  },
  {
    h: "Browser storage and tracking",
    id: "browser-storage", // the cookie banner links here
    body: [
      "We set no advertising cookies. If you accept on the privacy banner, Google Analytics sets its cookies (named _ga) on our public pages. Otherwise the site stores a few small items in your browser so it can work: your answer on the privacy banner, whether you are signed in to the patient portal on this device, and the sign-in your portal login needs. The intake keeps a note that you have seen its intro screen for the length of your visit.",
      "We do not track you across other websites, so we do not respond to \"Do Not Track\" signals. You can clear stored items in your browser settings at any time. Use \"Privacy choices\" in the footer to change your answer about visit counts.",
    ],
  },
  {
    h: "How long we keep it",
    body: [
      "Patient records are kept for as long as Florida law and professional rules require medical records to be kept, even after you stop the program. Other information, such as a contact message or an intake from someone who did not become a patient, is kept only as long as we need it for the reasons above. Visit counts contain no personal information and may be kept as totals.",
    ],
  },
  {
    h: "How we protect it",
    body: [
      "Patient records can be opened only by signed-in staff, and each person sees only what their role allows. Staff sign-ins time out when they go idle, and we keep an activity log of what staff do in the system. Information you send to us travels over an encrypted connection.",
      "No website or storage system is completely secure. If a breach affects your information, we will tell you and the authorities as the law requires, and without unreasonable delay. Please do not send health details by regular email. Use the patient portal or call us.",
    ],
  },
  {
    h: "Your choices and rights",
    body: [
      [
        "Ask for a copy of your records. Patients have a right to see and receive a copy of their medical record.",
        "Ask us to correct information that is wrong or incomplete.",
        "Ask us to delete information we are not required to keep. We cannot delete medical records we must keep by law.",
        "Change your answer about visit counts at any time with \"Privacy choices\" in the footer.",
        "Ask about, or complain about, how we handled your information. We will not retaliate against you for doing so.",
      ],
      `To use any of these, write to ${EMAIL} or call ${SUPPORT_PHONE}. We may need to confirm who you are first, because we will not give a person's records to someone else. We aim to answer within 30 days. If a request takes longer, we will tell you why and when to expect an answer.`,
    ],
  },
  {
    h: "Where your information is kept",
    body: [
      "CorePhia serves patients in the United States, and the intake, contact, portal, and chart information you give us is stored in the United States. If you use the site from another country, you understand that your information will be handled here under US law.",
    ],
  },
  {
    h: "Children",
    body: [
      "The program is for adults, and the site is not directed to children under 13. We do not knowingly collect information from children. If you believe a child has sent us information, contact us and we will remove it.",
    ],
  },
  {
    h: "Changes to this policy",
    body: [
      "When we change this policy, we change the date at the top. If a change materially affects how we treat your health information, we will tell current patients through the portal or by email before it takes effect.",
    ],
  },
]

const terms = [
  {
    h: "Agreeing to these terms",
    body: [
      "These terms govern your use of the CorePhia website, patient intake, contact form, and patient portal. By using them, you agree to these terms and to our privacy policy. If you do not agree, please do not use them.",
    ],
  },
  {
    h: "What CorePhia is",
    body: [
      "CorePhia is a physician-built weight loss program based in Tampa, Florida. The program is made up of medical care, dietitian services, a comprehensive exercise plan, and follow-ups. You are joining a program, not buying a product.",
      "Weight loss medication is one part of the program for some patients. It is prescribed only if a licensed provider decides it is clinically appropriate for you. Nobody is promised medication in advance, and you can be part of the program without taking it. Providers make their own medical decisions.",
    ],
  },
  {
    h: "Not medical advice, and no provider relationship until you are accepted",
    body: [
      "The information on this site is general and is not medical advice. It does not replace advice from a licensed provider who knows your history.",
      "Using the site, sending a message, or submitting an intake does not create a provider and patient relationship. That relationship starts only when a CorePhia provider accepts you as a patient. A provider may decide that the program is not right for you, may ask for more information, or may refer you elsewhere.",
      "If you think you are having a medical emergency, call 911 or go to the nearest emergency room. Do not use this site, the contact form, or portal messages for emergencies or urgent symptoms.",
    ],
  },
  {
    h: "Who can enroll",
    body: [
      [
        "You must be 18 or older.",
        "You must give accurate and complete information, including your health history, medications, and allergies. Your safety depends on it. Tell your provider promptly if anything changes.",
        "Right now we can only enroll patients who are located in Florida, where our provider is licensed. You must be in Florida at the time of each visit.",
      ],
    ],
  },
  {
    h: "Telehealth",
    body: [
      "Much of your care may be given by video, phone, or secure messages. Telehealth can make care easier to reach, and it also has limits. A provider cannot examine you in person, technology can fail or be interrupted, and in some cases a provider may decide you need an in-person visit or different care. The telehealth consent you sign in the intake explains this, and it applies together with these terms.",
    ],
  },
  {
    h: "Intake and enrollment",
    body: [
      "Submitting an intake is a request to be considered. It is not enrollment and it is not a promise of treatment. After a provider reviews it, our team will contact you about next steps. We can accept or decline any request.",
    ],
  },
  {
    h: "Cost and payment",
    body: [
      [
        "The program is cash pay. We do not bill insurance, and we do not promise that any insurer or plan will reimburse you.",
        "Memberships are billed monthly. The plans and prices on the Membership page are what we offer now. A price can change, but not for a membership you have already started, unless we tell you first. The price and terms that apply to you are confirmed when you enroll.",
        "Cancellation and refund terms are confirmed in writing when you enroll.",
      ],
      "What you pay for is the program. Medication is only one part of it, and it is never sold on its own through this site.",
    ],
  },
  {
    h: "Your patient portal account",
    body: [
      "Portal accounts are by invitation after you are accepted. Keep your password private and do not share your login. Tell us right away if you think someone else has used your account. You are responsible for activity under your login until you tell us.",
    ],
  },
  {
    h: "Messages and notifications",
    body: [
      "You agree that we may contact you electronically, by email and through the portal, and by phone about scheduling and your care. Notification emails only tell you that something is waiting for you, and the details stay in the portal.",
      "We read portal messages during working hours and reply as soon as we reasonably can. Messages are not monitored around the clock, so do not use them for anything urgent. For an emergency, call 911.",
    ],
  },
  {
    h: "Results vary, and your part in your care",
    body: [
      "We cannot promise any amount of weight loss or any health result. Results depend on your health, your habits, and how closely you follow your plan. Follow your provider's instructions, keep your follow-ups, and contact your provider about side effects or health changes. If a symptom is severe or sudden, get emergency care first.",
    ],
  },
  {
    h: "Using the site",
    body: [
      [
        "Do not try to break into, overload, or interfere with the site, the portal, or other people's accounts.",
        "Do not use the site to send anything unlawful, harmful, or misleading, or to pretend to be someone else.",
        "Do not copy, scrape, or reuse our content except as the law allows.",
      ],
      "We may suspend access to the site or the portal if these rules are broken or to protect other people. You may stop using CorePhia at any time. Medical records are kept as the privacy policy describes.",
    ],
  },
  {
    h: "Our content",
    body: [
      "The text, designs, images, and logos on this site belong to CorePhia or are used with permission. We give you a limited right to view the site for your personal use. Anything you send us, such as a message, may be used by us only to provide your care and run the program.",
      "Links on the site may lead to other websites. We do not control them and are not responsible for what they say or do.",
    ],
  },
  {
    h: "Disclaimers and limits on responsibility",
    body: [
      "We work to keep the site accurate and available, but it is provided as it is, and we do not promise that it will always be available or free of errors.",
      "To the extent the law allows, CorePhia is not liable for indirect or consequential losses from using the site, and our total responsibility for claims about the site or the portal is limited to the amount you paid us in the three months before the claim. Nothing in these terms limits a provider's responsibility for the medical care they give you, and nothing limits rights the law does not allow to be limited.",
    ],
  },
  {
    h: "Governing law",
    body: [
      "These terms follow the laws of the State of Florida, without regard to its conflict of laws rules. Any dispute about them will be brought in the state or federal courts that serve Hillsborough County, Florida, unless the law gives you the right to bring it elsewhere. Before either of us files a claim, we agree to try to resolve it by contacting each other in good faith.",
    ],
  },
  {
    h: "General",
    body: [
      "These terms, the privacy policy, and the consents you sign in the intake are the whole agreement about the site. If a part of these terms cannot be enforced, the rest still applies. If we do not enforce a term right away, we have not given it up. You may not transfer your rights under these terms without our written consent.",
    ],
  },
  {
    h: "Changes to these terms",
    body: [
      "When we change these terms, we change the date at the top. If a change materially affects patients, we will tell them through the portal or by email before it takes effect. Using the site after a change means you accept it.",
    ],
  },
]

// HIPAA's required notice (45 CFR 164.520): how health information may be used
// and disclosed, the patient's rights, our duties, and how to complain. The
// intake asks patients to acknowledge it, so it must stay published.
const privacyPractices = [
  {
    h: "Why you are getting this notice",
    body: [
      "This notice describes how medical information about you may be used and disclosed and how you can get access to this information. Please review it carefully.",
      "It applies to the health information CorePhia creates or receives about you as a patient: in the intake, your chart, the patient portal, and our messages with you.",
    ],
  },
  {
    h: "Our duties",
    body: [
      [
        "We are required by law to keep your health information private and to give you this notice of our legal duties and privacy practices.",
        "We must follow the notice that is currently in effect.",
        "We must tell you if a breach occurs that may have compromised the privacy or security of your information.",
        "We will not use or share your information other than as described here unless you tell us in writing that we can. You can change your mind at any time by telling us in writing.",
      ],
    ],
  },
  {
    h: "How we use and share your health information",
    body: [
      "For treatment. Your providers, dietitian, and care staff use your information to evaluate you, build your plan, prescribe when appropriate, and follow up. We may share it with a pharmacy that fills a prescription or with another health professional who treats you.",
      "For payment. CorePhia is cash pay. We use the information needed to bill you for your membership. We do not send your information to a health insurer.",
      "For health care operations. We use information to run the program, for example to check the quality of care, train staff, keep records, and keep our systems secure. We may share it with companies that provide services to us, such as our database and hosting provider.",
      "To contact you. We may contact you about appointments, follow-ups, and your care by phone, email, or the patient portal. Notification emails do not contain health details.",
    ],
  },
  {
    h: "Other ways we may share your information",
    body: [
      "We may share your information in these situations, only as the law allows and only as much as needed:",
      [
        "When a law requires it.",
        "For public health activities, such as reporting adverse reactions to medications or preventing disease.",
        "To report suspected abuse, neglect, or domestic violence to the proper authorities.",
        "For health oversight activities, such as audits and inspections by government agencies.",
        "In response to a court order, subpoena, or other lawful process.",
        "To law enforcement officials, in limited circumstances.",
        "To prevent a serious and imminent threat to someone's health or safety.",
        "To coroners, medical examiners, and funeral directors, and for organ and tissue donation.",
        "For workers' compensation claims, and for special government functions such as military or national security, as the law provides.",
        "For research, only when the law's privacy protections are met.",
      ],
    ],
  },
  {
    h: "Uses that need your written permission",
    body: [
      "We will never sell your health information or use it for marketing without your written permission. We will not publish your story, photos, or results without your written permission. Any other use or disclosure not described in this notice also needs your written permission, which you may take back in writing at any time, except for actions already taken.",
    ],
  },
  {
    h: "Your rights",
    body: [
      [
        "See and get a copy of your record. Ask us, and we will give you a copy, electronic or paper, usually within 30 days. We may charge a reasonable, cost-based fee.",
        "Ask us to correct your record if you think it is wrong or incomplete. We may say no, but we will tell you why in writing within 60 days.",
        "Ask us to contact you in a certain way, for example only by email or at a different phone number. We will agree to reasonable requests.",
        "Ask us to limit what we use or share. We are not required to agree, except that if you pay for a service in full yourself, you can ask us not to share that information with your health insurer, and we will agree unless a law requires us to share it.",
        "Get a list of the times we shared your information in the six years before you ask, other than for treatment, payment, operations, and certain other disclosures. One list a year is free.",
        "Get a paper copy of this notice at any time, even if you agreed to receive it electronically.",
        "Choose someone to act for you, such as a legal guardian or someone with medical power of attorney. We will check that the person has this authority before we act.",
      ],
      `To use any of these rights, write to ${EMAIL} or call ${SUPPORT_PHONE}.`,
    ],
  },
  {
    h: "Complaints",
    body: [
      `If you believe your privacy rights have been violated, you can complain to us at ${EMAIL} or ${SUPPORT_PHONE}. You can also file a complaint with the U.S. Department of Health and Human Services Office for Civil Rights at hhs.gov/ocr/complaints or by calling 1-877-696-6775. We will not retaliate against you for filing a complaint.`,
    ],
  },
  {
    h: "Changes to this notice",
    body: [
      "We can change the terms of this notice, and the changes will apply to all information we have about you. The new notice will be available on this page, and we will tell current patients through the portal or by email. The date at the top shows when it took effect.",
    ],
  },
]

function LegalPage({ title, description, path, sections, others }) {
  return (
    <>
      <Helmet>
        <title>{`${title} | CorePhia`}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={`https://corephia.com${path}`} />
      </Helmet>

      <article aria-labelledby="legal-heading" className="mx-auto max-w-3xl px-4 pt-12 pb-20 sm:px-6 sm:pt-16">
        <h1 id="legal-heading" className="font-serif text-4xl leading-tight text-ink-950 sm:text-5xl">
          {title}
        </h1>
        <p className="mt-3 text-sm text-ink-950/70">Last updated {UPDATED}</p>

        {sections.map(({ h, id, body }) => (
          <section key={h} id={id} className="mt-10 scroll-mt-28">
            <h2 className="font-serif text-2xl text-ink-950">{h}</h2>
            <div className="mt-3 space-y-4 text-lg leading-relaxed text-ink-950/75">
              {body.map((item) =>
                Array.isArray(item) ? (
                  <ul key={item[0]} className="list-disc space-y-2 pl-6">
                    {item.map((text) => (
                      <li key={text}>{text}</li>
                    ))}
                  </ul>
                ) : (
                  <p key={item}>{item}</p>
                ),
              )}
            </div>
          </section>
        ))}

        <section className="mt-12 border-t border-ink-950/10 pt-8">
          <h2 className="font-serif text-2xl text-ink-950">Contact us</h2>
          <p className="mt-3 text-lg leading-relaxed text-ink-950/75">
            CorePhia, Tampa, Florida. Email{" "}
            <a href={`mailto:${EMAIL}`} className="font-medium text-accent-dark underline underline-offset-4">
              {EMAIL}
            </a>{" "}
            or call {SUPPORT_PHONE}. You can also read our{" "}
            {others.map(({ to, label }, index) => (
              <span key={to}>
                {index > 0 && " and "}
                <Link to={to} className="font-medium text-accent-dark underline underline-offset-4">
                  {label}
                </Link>
              </span>
            ))}
            .
          </p>
        </section>
      </article>
    </>
  )
}

export function Privacy() {
  return (
    <LegalPage
      title="Privacy policy"
      description="What CorePhia collects through the site, intake and patient portal, how it is used and shared, and the choices and rights you have."
      path="/privacy"
      sections={privacy}
      others={[
        { to: "/privacy-practices", label: "notice of privacy practices" },
        { to: "/terms", label: "terms of service" },
      ]}
    />
  )
}

export function Terms() {
  return (
    <LegalPage
      title="Terms of service"
      description="Terms for using CorePhia's website, intake and patient portal: the program, telehealth, eligibility, cost, accounts and Florida law."
      path="/terms"
      sections={terms}
      others={[{ to: "/privacy", label: "privacy policy" }]}
    />
  )
}

export function PrivacyPractices() {
  return (
    <LegalPage
      title="Notice of privacy practices"
      description="How CorePhia may use and share your health information, your rights over your medical records, and how to file a complaint."
      path="/privacy-practices"
      sections={privacyPractices}
      others={[
        { to: "/privacy", label: "privacy policy" },
        { to: "/terms", label: "terms of service" },
      ]}
    />
  )
}
