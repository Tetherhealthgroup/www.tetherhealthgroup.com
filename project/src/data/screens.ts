/**
 * The approved 28-screen BreatheFree catalog.
 *
 * Ported verbatim from the mobile application's canonical catalog at
 * Tether-Smoking-cessation-breath-free/lib/models/screen_spec.dart — same
 * numbers, same titles, same descriptions, same phase grouping. Keeping the
 * numbering identical means a screen can be discussed once and found in both
 * the app and the site.
 *
 * The artwork itself is the same 1290 x 2796 source the app ships in
 * assets/screens/, copied to src/assets/screens/ and optimised by Astro.
 */

import type { ImageMetadata } from "astro";

export type PhaseId =
  | "welcome"
  | "onboarding"
  | "quitPlan"
  | "dailySupport"
  | "cravingRescue"
  | "quitDay"
  | "resources"
  | "account";

export interface Phase {
  id: PhaseId;
  /** Label as written in JourneyPhase (screen_spec.dart). */
  label: string;
  /** Site-only summary of what this phase does for the person using the app. */
  summary: string;
}

/** Mirrors the JourneyPhase enum, in the same order. */
export const phases: Phase[] = [
  {
    id: "welcome",
    label: "Welcome",
    summary:
      "A private, judgment-free opening that asks for nothing before it gives something.",
  },
  {
    id: "onboarding",
    label: "Onboarding",
    summary:
      "Informed consent in plain language, then a picture of today's smoking and its triggers — recorded without judgment.",
  },
  {
    id: "quitPlan",
    label: "Quit plan",
    summary:
      "A plan the person builds themselves: a path, a date, their own reasons, and one named supporter.",
  },
  {
    id: "dailySupport",
    label: "Daily support",
    summary:
      "A check-in that takes under ninety seconds, and one manageable next step chosen from the answer.",
  },
  {
    id: "cravingRescue",
    label: "Craving rescue",
    summary:
      "Immediate, one-handed help that works offline, followed by an honest recheck of how it went.",
  },
  {
    id: "quitDay",
    label: "Quit day",
    summary:
      "Support through the hardest day, and a slip response that keeps every piece of prior progress.",
  },
  {
    id: "resources",
    label: "Resources",
    summary:
      "Medication education without prescribing, reviewed lessons, patterns without punishment, and real human support.",
  },
  {
    id: "account",
    label: "Account",
    summary:
      "Notification privacy, consent, export, accessibility and deletion — in one place, under the person's control.",
  },
];

export const phaseById = new Map(phases.map((phase) => [phase.id, phase]));

export interface Screen {
  number: number;
  title: string;
  description: string;
  phase: PhaseId;
  /** Filename stem, matching _slugFor() in screen_spec.dart. */
  slug: string;
}

export const screens: Screen[] = [
  {
    number: 1,
    title: "Welcome",
    description:
      "Introduces BreatheFree, language choice and the private, judgment-free promise.",
    phase: "welcome",
    slug: "welcome",
  },
  {
    number: 2,
    title: "Why BreatheFree",
    description:
      "Explains how the app supports cravings, planning and progress.",
    phase: "onboarding",
    slug: "why-breathefree",
  },
  {
    number: 3,
    title: "Consent & privacy",
    description:
      "Collects informed consent and explains data choices in plain language.",
    phase: "onboarding",
    slug: "consent-privacy",
  },
  {
    number: 4,
    title: "Baseline assessment",
    description: "Records current smoking patterns without judgment.",
    phase: "onboarding",
    slug: "baseline-assessment",
  },
  {
    number: 5,
    title: "Trigger map",
    description: "Identifies situations and feelings linked to smoking.",
    phase: "onboarding",
    slug: "trigger-map",
  },
  {
    number: 6,
    title: "Readiness result",
    description: "Reflects readiness and recommends a flexible next step.",
    phase: "onboarding",
    slug: "readiness-result",
  },
  {
    number: 7,
    title: "Choose quit path",
    description:
      "Lets the patient choose a quit-date or gradual-reduction path.",
    phase: "quitPlan",
    slug: "choose-quit-path",
  },
  {
    number: 8,
    title: "Select quit date",
    description: "Selects a realistic quit date with planning guidance.",
    phase: "quitPlan",
    slug: "select-quit-date",
  },
  {
    number: 9,
    title: "My reasons",
    description: "Captures personal reasons the patient wants to quit.",
    phase: "quitPlan",
    slug: "my-reasons",
  },
  {
    number: 10,
    title: "Support preparation",
    description: "Chooses a supporter and a specific help phrase.",
    phase: "quitPlan",
    slug: "support-preparation",
  },
  {
    number: 11,
    title: "Review quit plan",
    description: "Reviews every plan choice before activation.",
    phase: "quitPlan",
    slug: "review-quit-plan",
  },
  {
    number: 12,
    title: "Preparation home",
    description:
      "Daily home before quit day with tasks, check-in and craving support.",
    phase: "dailySupport",
    slug: "home-preparation",
  },
  {
    number: 13,
    title: "Daily check-in",
    description:
      "Records a quick, nonpunitive daily status in under 90 seconds.",
    phase: "dailySupport",
    slug: "daily-check-in",
  },
  {
    number: 14,
    title: "Personalized next step",
    description: "Recommends one manageable action based on the check-in.",
    phase: "dailySupport",
    slug: "personalized-next-step",
  },
  {
    number: 15,
    title: "Guided stress reset",
    description: "Runs a calm, guided breathing exercise.",
    phase: "dailySupport",
    slug: "guided-stress-reset",
  },
  {
    number: 16,
    title: "Exercise complete & recheck",
    description:
      "Measures how the exercise felt and recommends what to do next.",
    phase: "dailySupport",
    slug: "exercise-complete-recheck",
  },
  {
    number: 17,
    title: "Craving rescue start",
    description: "Starts immediate, one-handed help that also works offline.",
    phase: "cravingRescue",
    slug: "craving-rescue-start",
  },
  {
    number: 18,
    title: "Recommended rescue tool",
    description: "Suggests a short coping tool matched to the craving.",
    phase: "cravingRescue",
    slug: "recommended-rescue-tool",
  },
  {
    number: 19,
    title: "Active craving rescue",
    description: "Guides the selected coping tool in real time.",
    phase: "cravingRescue",
    slug: "active-craving-rescue",
  },
  {
    number: 20,
    title: "Craving recheck",
    description:
      "Rechecks craving intensity without claiming a clinical measurement.",
    phase: "cravingRescue",
    slug: "craving-recheck",
  },
  {
    number: 21,
    title: "Rescue result & next step",
    description:
      "Shows the patient-reported change and offers another safe option.",
    phase: "cravingRescue",
    slug: "rescue-result-next-step",
  },
  {
    number: 22,
    title: "Quit-day home",
    description:
      "Supports the patient through quit day with immediate help and check-ins.",
    phase: "quitDay",
    slug: "quit-day-home",
  },
  {
    number: 23,
    title: "Slip recovery",
    description:
      "Responds to a slip with support while preserving all prior progress.",
    phase: "quitDay",
    slug: "slip-recovery",
  },
  {
    number: 24,
    title: "Medication center",
    description: "Provides education and self-tracking without prescribing.",
    phase: "resources",
    slug: "medication-center",
  },
  {
    number: 25,
    title: "Learn library",
    description:
      "Offers clinically reviewed, plain-language learning resources.",
    phase: "resources",
    slug: "learn-library",
  },
  {
    number: 26,
    title: "Progress dashboard",
    description: "Shows patterns and estimates without punishment after slips.",
    phase: "resources",
    slug: "progress-dashboard",
  },
  {
    number: 27,
    title: "Support hub",
    description:
      "Connects the patient to quitlines, supporters, coaches and care teams.",
    phase: "resources",
    slug: "support-hub",
  },
  {
    number: 28,
    title: "Settings & privacy",
    description:
      "Centralizes notification privacy, consent, exports, accessibility and deletion.",
    phase: "account",
    slug: "settings-privacy",
  },
];

/**
 * Eagerly-resolved artwork, keyed by screen number.
 *
 * import.meta.glob with eager:true resolves at build time, so Astro's <Image>
 * receives real ImageMetadata and can emit responsive, optimised output. The
 * filename shape is screen-NN-<slug>-iphone.png, matching ScreenSpec.assetPath.
 */
const artwork = import.meta.glob<{ default: ImageMetadata }>(
  "../assets/screens/*.png",
  { eager: true },
);

const artworkByNumber = new Map<number, ImageMetadata>();
for (const [path, module] of Object.entries(artwork)) {
  const match = path.match(/screen-(\d{2})-/);
  if (match) {
    artworkByNumber.set(Number(match[1]), module.default);
  }
}

/**
 * Returns the approved artwork for a screen number.
 *
 * Throws rather than returning undefined: a missing asset is a build-time
 * repository error, and failing the build is more useful than shipping a page
 * with a hole in it.
 *
 * @param number Screen number, 1-28.
 * @returns Astro image metadata for that screen's approved PNG.
 *
 * @example
 * const art = artworkFor(1); // welcome screen, 1290 x 2796
 */
export function artworkFor(number: number): ImageMetadata {
  const image = artworkByNumber.get(number);
  if (!image) {
    throw new Error(
      `No approved artwork found for screen ${number}. Expected a file matching ` +
        `src/assets/screens/screen-${String(number).padStart(2, "0")}-*.png`,
    );
  }
  return image;
}

/** Screens belonging to one journey phase, in catalog order. */
export function screensInPhase(phase: PhaseId): Screen[] {
  return screens.filter((screen) => screen.phase === phase);
}

/** Look up a single screen by its catalog number. */
export function screenByNumber(number: number): Screen {
  const screen = screens.find((entry) => entry.number === number);
  if (!screen) {
    throw new Error(`No screen numbered ${number} in the approved catalog.`);
  }
  return screen;
}
