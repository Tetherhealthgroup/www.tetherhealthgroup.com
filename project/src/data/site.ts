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
  description:
    "Tether Health Group builds calm, private, evidence-informed digital health tools. Our first product, BreatheFree, supports people quitting smoking without judgment.",
} as const;

/**
 * The single confirmed contact address for Tether Health Group.
 *
 * Every contact route on the site — waitlist, support, privacy, security and
 * accessibility enquiries — points here deliberately. Role addresses
 * (privacy@, security@, ...) are conventional but none has been confirmed to
 * exist, and a published address that bounces is worse than one shared inbox.
 * To split them later, add the addresses here and update the pages that read
 * this object; nothing else hard-codes an address.
 */
export const contact = {
  support: "support@tetherhealthgroup.com",
} as const;

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
  subject: "BreatheFree early access request",
} as const;

export interface NavLink {
  label: string;
  href: string;
  description?: string;
}

export const primaryNav: NavLink[] = [
  { label: "Health areas", href: "/programs/" },
  { label: "Services", href: "/services/" },
  { label: "BreatheFree", href: "/breathefree/" },
  { label: "How it works", href: "/breathefree/how-it-works/" },
  { label: "For clinicians", href: "/for-clinicians/" },
  { label: "Updates", href: "/updates/" },
  { label: "About", href: "/about/" },
];

export const footerNav: { title: string; links: NavLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "All health areas", href: "/programs/" },
      { label: "All services", href: "/services/" },
      { label: "BreatheFree overview", href: "/breathefree/" },
      { label: "How it works", href: "/breathefree/how-it-works/" },
      { label: "Screen tour", href: "/breathefree/tour/" },
      { label: "For clinicians and care teams", href: "/for-clinicians/" },
      { label: "Updates", href: "/updates/" },
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
