/**
 * Site-wide configuration: identity, navigation and contact routes.
 *
 * Everything here is either derived from the repository (company name, domain)
 * or from the approved BreatheFree design sources. No claim about clinical
 * outcomes, certification, funding or customers appears anywhere on this site,
 * because none is evidenced in this repository.
 */

export const site = {
  name: "Tether Health Group",
  legalName: "Tether Health LLC",
  domain: "www.tetherhealthgroup.com",
  url: "https://www.tetherhealthgroup.com",
  tagline: "Care that meets people where they are.",
  // needs-counsel: WEB-005 (feeds meta/og/twitter description and JSON-LD; changing it re-pins a CSP hash)
  description:
    "Tether Health Group is building calm, private health tools. BreatheFree, designed to help people quit smoking, is in development for Android first.",
} as const;

/**
 * Role mailboxes for Tether Health Group (owner-provided, 2026-10-12; admin and
 * finance added 2026-10-20).
 *
 * This is the only place an address is written down; pages and components
 * read it from here. Never publish a personal address, and never use
 * safecodeg.com. Whether each mailbox actually receives mail is Unknown until
 * the owner confirms a test message arrived.
 */
export const contact = {
  support: "support@tetherhealthgroup.com",
  privacy: "privacy@tetherhealthgroup.com",
  security: "security@tetherhealthgroup.com",
  partnerships: "partnerships@tetherhealthgroup.com",
  careers: "careers@tetherhealthgroup.com",
  finance: "finance@tetherhealthgroup.com",
  admin: "admin@tetherhealthgroup.com",
} as const;

export type Mailbox = keyof typeof contact;

/**
 * Leadership, names and titles only. Nothing else about a person belongs here
 * until the owner supplies and approves it.
 */
export const leadership = [
  { name: "Srikanth", title: "CEO", fullTitle: "Chief Executive Officer" },
  {
    name: "Hariharan",
    title: "COO & CTO",
    fullTitle: "Chief Operating Officer & Chief Technology Officer",
  },
  { name: "Kushal", title: "CFO", fullTitle: "Chief Financial Officer" },
] as const;

/**
 * Where the waitlist form delivers.
 *
 * The site is statically hosted and has no backend, so the form composes a
 * message to `contact.support` in the visitor's own mail client. Point
 * PUBLIC_WAITLIST_ENDPOINT at a form handler to POST instead — see
 * src/components/WaitlistForm.astro.
 */
export const waitlist = {
  email: contact.support,
  // needs-counsel: WEB-005
  subject: "BreatheFree waitlist",
} as const;

export interface NavLink {
  label: string;
  href: string;
  description?: string;
}

export const primaryNav: NavLink[] = [
  { label: "Programs", href: "/programs/" },
  { label: "Services", href: "/services/" },
  { label: "BreatheFree", href: "/breathefree/" },
  { label: "How it works", href: "/breathefree/how-it-works/" },
  { label: "For clinicians", href: "/for-clinicians/" },
  { label: "About", href: "/about/" },
];

export const footerNav: { title: string; links: NavLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "All programs", href: "/programs/" },
      { label: "All services", href: "/services/" },
      { label: "BreatheFree overview", href: "/breathefree/" },
      { label: "How it works", href: "/breathefree/how-it-works/" },
      { label: "Screen tour", href: "/breathefree/tour/" },
      { label: "For clinicians and care teams", href: "/for-clinicians/" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Tether Health", href: "/about/" },
      { label: "Support", href: "/support/" },
      { label: "Contact", href: "/support/#contact" },
    ],
  },
  {
    title: "Trust",
    links: [
      { label: "Privacy notice", href: "/privacy/" },
      { label: "App privacy policy", href: "/app-privacy/" },
      { label: "Delete your account", href: "/delete-account/" },
      { label: "Security", href: "/security/" },
      { label: "Accessibility", href: "/accessibility/" },
      { label: "Terms of use", href: "/terms/" },
    ],
  },
];

/**
 * Crisis and quitline routing shown in the site footer and support page.
 *
 * These numbers are reproduced from the approved application artwork
 * (design/approved/screen-27-support-hub-iphone.svg). They are United States
 * services; the app itself notes "Services and hours may vary" and routes by
 * state. Verify jurisdiction coverage before serving non-US traffic.
 */
export const quitlines = [
  {
    language: "English",
    name: "1-800-QUIT-NOW",
    number: "1-800-784-8669",
    tel: "+18007848669",
  },
  {
    language: "Español",
    name: "1-855-DÉJELO-YA",
    number: "1-855-335-3569",
    tel: "+18553353569",
  },
] as const;
