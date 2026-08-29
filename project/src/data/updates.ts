/**
 * Product and programme updates.
 *
 * Ground rules, because this is the page a visitor will use to judge whether
 * the company does what it says:
 *
 *   - An entry describes something that has actually happened. Intent belongs
 *     in `upcoming` on a health area, not here.
 *   - No entry implies a product is available. Nothing is, yet.
 *   - `area` ties an entry to a health area id from programs.ts, where one
 *     applies. Company-wide entries leave it unset.
 *   - Newest first. Dates are ISO so they sort and format predictably.
 *
 * The seed entries below are the ones this repository evidences. Add to them
 * as work lands; do not backfill a history that did not happen.
 */

import type { IconName } from "../components/Icon.astro";

export type UpdateKind = "product" | "programme" | "company";

export interface Update {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  title: string;
  body: string;
  kind: UpdateKind;
  icon: IconName;
  /** Health-area id from programs.ts, where the entry belongs to one. */
  area?: string;
}

export const updateKindLabels: Record<UpdateKind, string> = {
  product: "Product",
  programme: "Programme",
  company: "Company",
};

export const updates: Update[] = [
  {
    date: "2026-08-29",
    title: "This website went up",
    body: "A first public description of the company, the ten health areas we intend to support, and where each one actually stands. The site makes no availability claim, because there is nothing to download yet.",
    kind: "company",
    icon: "globe",
  },
  {
    date: "2026-08-29",
    title: "BreatheFree: all 28 screens approved",
    body: "Every screen of the smoking-cessation application has been designed and approved at App Store resolution, and the work of converting them into native, responsive screens is under way. It has not been through the clinical, privacy, security and accessibility review a release requires.",
    kind: "product",
    icon: "leaf",
    area: "tobacco",
  },
  {
    date: "2026-08-29",
    title: "Safety routing put behind one source of truth",
    body: "Both approved quitlines, the emergency number and the support address now live in one place in the application, so a number cannot be corrected in one file and left stale in another. The Spanish-language quitline is reachable in the app for the first time.",
    kind: "product",
    icon: "phone",
    area: "tobacco",
  },
  {
    date: "2026-08-29",
    title: "Accessibility pass across the site",
    body: "Contrast raised to the WCAG 2.2 AA minimum on captions and eyebrows, a missing heading level restored, standalone links given 44px touch targets, and a focus indicator restored on the early-access form for Safari users, where it was invisible. An independent audit has still not been commissioned.",
    kind: "company",
    icon: "accessibility",
  },
];

/** Newest first, whatever order they were written in. */
export const updatesByDate = [...updates].sort((a, b) =>
  b.date.localeCompare(a.date),
);

export const latestUpdate = updatesByDate[0];

/** Updates belonging to one health area. */
export function updatesForArea(areaId: string): Update[] {
  return updatesByDate.filter((u) => u.area === areaId);
}

/** "29 August 2026", matching the date style used elsewhere on the site. */
export function formatUpdateDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
