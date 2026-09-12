/**
 * The health areas Tether Health Group intends to support.
 *
 * Content is the health-area plan supplied by the project owner, kept in that
 * wording. `status` is deliberately conservative and reflects what this
 * repository actually evidences:
 *
 *   "building"  — code exists and is under active development. Only tobacco
 *                 and nicotine qualifies: the BreatheFree application repo has
 *                 28 approved screens and an in-progress `develop` branch
 *                 converting them to native responsive screens.
 *   "planned"   — described in the programme plan, no implementation exists.
 *
 * Do not promote an area to "building" before there is something to point at.
 * A health company that overstates what it has built is the one thing this
 * site must never do.
 *
 * `services` and `upcoming` elaborate the same programme plan; they are scope,
 * not availability. Every one of them is intent until an area reaches
 * "building" and there is code to point at. Phrase them that way — no dates,
 * no promises, and nothing that reads as a service a visitor can use today.
 */

import type { IconName } from "../components/Icon.astro";

export type ProgramStatus = "building" | "planned";

/** How far out a project sits. Deliberately not dates. */
export type Horizon = "In development" | "Next" | "Later";

/** A line of work inside a health area. Scope, not an offer. */
export interface ProgramService {
  name: string;
  description: string;
}

/** A specific piece of work intended within a health area. */
export interface UpcomingProject {
  title: string;
  description: string;
  horizon: Horizon;
}

export interface Program {
  id: string;
  /** Health area. */
  area: string;
  /** Examples within the area. */
  examples: string;
  /** What the system or programme could address. */
  addresses: string[];
  status: ProgramStatus;
  icon: IconName;
  /** One-paragraph description of the area, used on its own page. */
  summary: string;
  /** The lines of work intended within the area. */
  services: ProgramService[];
  /** Specific projects intended next. */
  upcoming: UpcomingProject[];
  /** Set when a shipping product covers this area. */
  product?: { name: string; href: string };
}

export const statusLabels: Record<ProgramStatus, string> = {
  building: "In development",
  planned: "Planned",
};

export const programs: Program[] = [
  {
    id: "tobacco",
    area: "Tobacco & nicotine",
    examples: "Cigarettes, vaping, smokeless tobacco",
    addresses: [
      "Prevention",
      "Cessation support",
      "Relapse prevention",
      "Exposure reduction",
    ],
    status: "building",
    icon: "leaf",
    summary:
      "Tobacco and nicotine is the first area we are building, because the need is large, the evidence for behavioural support is settled, and it is the area where a calm, private tool most obviously helps. BreatheFree is the application; it is in development and not yet available.",
    services: [
      {
        name: "Prevention",
        description:
          "Plain-language material on how dependence forms, aimed at people who have not started or have started recently.",
      },
      {
        name: "Cessation support",
        description:
          "Day-to-day help through a quit attempt: a plan the person owns, craving tools that work offline, and check-ins that take under two minutes.",
      },
      {
        name: "Relapse prevention",
        description:
          "Treating a slip as information rather than failure, keeping prior progress intact and helping the person restart the same day.",
      },
      {
        name: "Exposure reduction",
        description:
          "Support for reducing exposure where stopping outright is not the immediate goal, without presenting reduction as a safe endpoint.",
      },
    ],
    upcoming: [
      {
        title: "Native responsive screens",
        description:
          "Converting the 28 approved screens from approved artwork to native responsive Flutter views, screen by screen, keeping the artwork as golden-test references.",
        horizon: "In development",
      },
      {
        title: "Quitline and safety routing",
        description:
          "Both approved quitlines and the emergency route wired to one source of truth, so a number can never be corrected in one place and left stale in another.",
        horizon: "In development",
      },
      {
        title: "Unplug — the digital-wellbeing module",
        description:
          "Screen-time support built alongside cessation: an intercept that asks rather than scolds, a tier ladder that is quick to tighten and slow to loosen, and a baseline report designed around what a phone will actually report rather than what we would like it to.",
        horizon: "In development",
      },
      {
        title: "Clinical and privacy review",
        description:
          "The review gates that must pass before anything reaches a person: clinical content review, privacy assessment, security review and an accessibility audit.",
        horizon: "Next",
      },
    ],
    product: { name: "BreatheFree", href: "/breathefree/" },
  },
  {
    id: "metabolic",
    area: "Diabetes & metabolic health",
    examples: "Type 2 diabetes, prediabetes, metabolic syndrome",
    addresses: [
      "Screening",
      "Lifestyle support",
      "Glucose management education",
      "Complication prevention",
    ],
    status: "planned",
    icon: "wave",
    summary:
      "Diabetes and metabolic health is planned. Nothing is built. The area is on the plan because the burden is large and much of the day-to-day work sits with the person rather than the clinic.",
    services: [
      {
        name: "Screening",
        description:
          "Helping people understand whether they are at risk and what a screening conversation with a clinician involves.",
      },
      {
        name: "Lifestyle support",
        description:
          "Everyday support for the changes that sit outside appointments, built around what a person can actually sustain.",
      },
      {
        name: "Glucose management education",
        description:
          "Plain-language education about glucose management. Education and self-management support only \u2014 never dosing advice.",
      },
      {
        name: "Complication prevention",
        description:
          "Material on the checks and habits that reduce the risk of complications, and when to raise something with a clinician.",
      },
    ],
    upcoming: [
      {
        title: "Area scoping",
        description:
          "Deciding what the shared system already covers and what this area genuinely needs of its own, before any code is written.",
        horizon: "Next",
      },
      {
        title: "Clinical content review",
        description:
          "Commissioning review of the educational content by qualified clinicians, ahead of any build.",
        horizon: "Later",
      },
      {
        title: "Shared education review",
        description:
          "Putting the education content through clinical review once, so it can be reused across the metabolic, cardiovascular and nutrition areas rather than reviewed three times.",
        horizon: "Later",
      },
    ],
  },
  {
    id: "cancer",
    area: "Cancer",
    examples: "Lung, colorectal, breast, prostate, skin and other cancers",
    addresses: [
      "Risk reduction",
      "Screening awareness",
      "Treatment-support resources",
      "Survivorship",
    ],
    status: "planned",
    icon: "shield",
    summary:
      "Cancer is planned. Nothing is built. This area needs the most care of any on the list: the boundary between useful information and implied diagnosis is narrow, and we will not cross it.",
    services: [
      {
        name: "Risk reduction",
        description:
          "Information on modifiable risk, connected to the tobacco and nutrition work rather than duplicating it.",
      },
      {
        name: "Screening awareness",
        description:
          "What screening exists, who it is offered to, and how to raise it with a clinician. Awareness only \u2014 we do not screen.",
      },
      {
        name: "Treatment-support resources",
        description:
          "Practical, reviewed material for people in treatment and the people supporting them.",
      },
      {
        name: "Survivorship",
        description:
          "Support for the period after treatment, which is long, under-served, and rarely designed for.",
      },
    ],
    upcoming: [
      {
        title: "Scope and safety boundaries",
        description:
          "Writing down, before anything is built, exactly what this area will and will not do \u2014 particularly around anything that could be read as diagnosis.",
        horizon: "Next",
      },
      {
        title: "Clinical partnership",
        description:
          "Finding clinical partners willing to own the content, because this is not an area to build from secondary sources.",
        horizon: "Later",
      },
      {
        title: "Survivorship scope",
        description:
          "Deciding what the survivorship period actually needs, which is the part most often left out of both care and software.",
        horizon: "Later",
      },
    ],
  },
  {
    id: "cardiovascular",
    area: "Cardiovascular health",
    examples: "High blood pressure, heart disease, stroke",
    addresses: [
      "Risk assessment",
      "Diet and activity support",
      "Monitoring and prevention",
    ],
    status: "planned",
    icon: "progress",
    summary:
      "Cardiovascular health is planned. Nothing is built. It shares most of its machinery with the metabolic and nutrition areas, which is part of why the shared system is being built once.",
    services: [
      {
        name: "Risk assessment",
        description:
          "Helping a person understand their own risk factors and what changes them, without presenting it as a clinical assessment.",
      },
      {
        name: "Diet and activity support",
        description:
          "The same behaviour-change machinery as the other areas, shaped to what this one needs.",
      },
      {
        name: "Monitoring and prevention",
        description:
          "Support for readings a person takes at home, and clear guidance on when a number means calling someone rather than logging it.",
      },
      {
        name: "Care-team coordination",
        description:
          "Letting a person hand readings and history to a clinician when they choose to, and never by default.",
      },
    ],
    upcoming: [
      {
        title: "Shared behaviour-change core",
        description:
          "Proving the shared plan, check-in and progress components on a second area once BreatheFree has shown they work on the first.",
        horizon: "Later",
      },
      {
        title: "Home-reading safety rules",
        description:
          "Deciding the thresholds at which the product stops logging and starts telling someone to seek help.",
        horizon: "Later",
      },
      {
        title: "Consent and sharing model",
        description:
          "Reusing the sharing controls from BreatheFree so nothing reaches a care team unless the person sends it.",
        horizon: "Later",
      },
    ],
  },
  {
    id: "nutrition",
    area: "Obesity & nutrition",
    examples: "Obesity, poor diet, nutritional deficiencies",
    addresses: [
      "Nutrition education",
      "Healthy-weight programs",
      "Physical activity",
    ],
    status: "planned",
    icon: "spark",
    summary:
      "Obesity and nutrition is planned. Nothing is built. It is also the area where tone matters most: this is a subject people have usually been shamed about before they reach any software.",
    services: [
      {
        name: "Nutrition education",
        description:
          "Practical, non-prescriptive education that does not depend on tracking every meal.",
      },
      {
        name: "Healthy-weight programs",
        description:
          "Structured support built around what a person can sustain, with no judgment when a week goes badly.",
      },
      {
        name: "Physical activity",
        description:
          "Activity support that starts from what the person can do now, not from a target.",
      },
      {
        name: "Support between appointments",
        description:
          "The long stretches where nothing is scheduled and most of the difficulty actually sits.",
      },
    ],
    upcoming: [
      {
        title: "Tone and content review",
        description:
          "Reviewing every line for the judgment this area attracts by default, before it is built rather than after.",
        horizon: "Next",
      },
      {
        title: "Shared progress model",
        description:
          "Reusing the progress model from BreatheFree, which is designed so a bad day never erases prior progress.",
        horizon: "Later",
      },
      {
        title: "Non-tracking baseline",
        description:
          "Establishing what the area can do for someone who will not log meals, before building anything that assumes they will.",
        horizon: "Later",
      },
    ],
  },
  {
    id: "respiratory",
    area: "Respiratory health",
    examples: "COPD, asthma, smoking-related lung disease",
    addresses: [
      "Trigger and risk reduction",
      "Symptom monitoring",
      "Care coordination",
    ],
    status: "planned",
    icon: "wave",
    summary:
      "Respiratory health is planned. Nothing is built. It sits closest to the tobacco work, and much of what BreatheFree learns should carry over.",
    services: [
      {
        name: "Trigger and risk reduction",
        description:
          "Identifying and reducing the exposures that drive symptoms, connected to the tobacco work.",
      },
      {
        name: "Symptom monitoring",
        description:
          "Light-touch symptom tracking that is useful to a clinician and not a burden to the person.",
      },
      {
        name: "Care coordination",
        description:
          "Helping a person keep a care team informed, with nothing shared unless they choose to share it.",
      },
      {
        name: "Education and self-management",
        description:
          "Reviewed, plain-language material on managing a long-term respiratory condition day to day.",
      },
    ],
    upcoming: [
      {
        title: "Carry-over from BreatheFree",
        description:
          "Assessing which BreatheFree components apply directly here, since the populations overlap heavily.",
        horizon: "Later",
      },
      {
        title: "Clinician-facing summary",
        description:
          "A summary a person can choose to hand to a clinician, reviewed before release.",
        horizon: "Later",
      },
      {
        title: "Symptom model",
        description:
          "Deciding what is worth tracking and what is noise, with clinicians, before building any tracking at all.",
        horizon: "Later",
      },
    ],
  },
  {
    id: "kidney-liver",
    area: "Kidney & liver health",
    examples: "Chronic kidney disease, fatty liver disease",
    addresses: ["Risk identification", "Monitoring", "Prevention education"],
    status: "planned",
    icon: "info",
    summary:
      "Kidney and liver health is planned. Nothing is built. Both conditions are often advanced before they are noticed, which makes identification and plain explanation the useful contribution.",
    services: [
      {
        name: "Risk identification",
        description:
          "Helping people understand whether they are in a group that should be asking about these conditions at all.",
      },
      {
        name: "Monitoring",
        description:
          "Support for keeping track of results over time and understanding what they mean.",
      },
      {
        name: "Prevention education",
        description:
          "Plain-language education on what protects these organs, without overstating what any single change achieves.",
      },
      {
        name: "Care-team coordination",
        description:
          "Helping a person keep results and history in one place and share them with a clinician on their terms.",
      },
    ],
    upcoming: [
      {
        title: "Area scoping",
        description:
          "Establishing what is genuinely useful here versus what belongs in the cardiovascular and metabolic areas.",
        horizon: "Later",
      },
      {
        title: "Results explanation",
        description:
          "Plain-language explanation of the common test results, reviewed clinically, as the first useful thing this area could ship.",
        horizon: "Later",
      },
      {
        title: "Overlap review",
        description:
          "Settling what belongs here versus in the cardiovascular and metabolic areas, so the same work is not built twice.",
        horizon: "Later",
      },
    ],
  },
  {
    id: "behavioral",
    area: "Mental & behavioral health",
    examples: "Stress, anxiety, depression, substance-use concerns",
    addresses: [
      "Screening",
      "Support resources",
      "Referral to qualified professionals",
    ],
    status: "planned",
    icon: "users",
    summary:
      "Mental and behavioural health is planned. Nothing is built. Our role here is support and routing to qualified people \u2014 not therapy, and not crisis care. The safety routing on every page of this site exists because of areas like this one.",
    services: [
      {
        name: "Screening",
        description:
          "Validated screening instruments used as a prompt to seek help, never as a diagnosis.",
      },
      {
        name: "Support resources",
        description:
          "Reviewed self-management material for the periods between appointments.",
      },
      {
        name: "Referral to qualified professionals",
        description:
          "Clear, fast routes to qualified people, and unambiguous escalation to emergency services when that is what is needed.",
      },
      {
        name: "Crisis routing",
        description:
          "Unambiguous escalation to emergency services and crisis lines, designed before anything else in this area.",
      },
    ],
    upcoming: [
      {
        title: "Crisis-routing design",
        description:
          "Designing the escalation path first, before any other part of this area, and having it reviewed by clinicians.",
        horizon: "Next",
      },
      {
        title: "Scope boundary",
        description:
          "Writing down what this area will never attempt, so scope cannot drift towards therapy by accident.",
        horizon: "Next",
      },
      {
        title: "Who may see what",
        description:
          "A written capability matrix for clinician-led, coach-led and self-guided delivery. The rule it exists to enforce: a sign of distress can never come to rest with someone who is not qualified to act on it.",
        horizon: "Next",
      },
      {
        title: "Screen time as a health area",
        description:
          "Deciding whether the Unplug module being built inside BreatheFree belongs to this area as well, and what would have to be true clinically before it is offered as behavioural-health support rather than a habit tool.",
        horizon: "Later",
      },
      {
        title: "Instrument selection",
        description:
          "Choosing which validated screening instruments are appropriate, with clinicians, and how results are worded so they prompt help rather than imply diagnosis.",
        horizon: "Later",
      },
    ],
  },
  {
    id: "preventive",
    area: "Preventive health",
    examples: "Vaccinations, routine screenings, checkups",
    addresses: [
      "Reminders",
      "Education",
      "Age- and risk-appropriate screening",
    ],
    status: "planned",
    icon: "calendar",
    summary:
      "Preventive health is planned. Nothing is built. It is the least glamorous area on the list and possibly the highest-yield: most of it is remembering things at the right time.",
    services: [
      {
        name: "Reminders",
        description:
          "Timely, private prompts for the checks a person is due, with notification copy that gives nothing away on a lock screen.",
      },
      {
        name: "Education",
        description:
          "Why a given check exists and what it involves, in plain language.",
      },
      {
        name: "Age- and risk-appropriate screening",
        description:
          "Guidance shaped to the person rather than a generic checklist.",
      },
      {
        name: "A record the person owns",
        description:
          "One place to see what has been done and what is due, exportable and deletable by the person it describes.",
      },
    ],
    upcoming: [
      {
        title: "Private notification model",
        description:
          "Reusing the notification privacy model from BreatheFree, where the default copy reveals nothing about the subject.",
        horizon: "Later",
      },
      {
        title: "Guideline sourcing",
        description:
          "Deciding whose guidelines are followed and how updates to them reach the product.",
        horizon: "Later",
      },
      {
        title: "Reminder engine",
        description:
          "Reusing the notification model from BreatheFree, whose default copy reveals nothing about the subject on a lock screen.",
        horizon: "Later",
      },
    ],
  },
  {
    id: "aging",
    area: "Healthy aging",
    examples: "Mobility, cognitive health, falls",
    addresses: ["Prevention", "Monitoring", "Exercise and support programs"],
    status: "planned",
    icon: "accessibility",
    summary:
      "Healthy aging is planned. Nothing is built. It is the area where accessibility stops being a compliance exercise and becomes the whole product.",
    services: [
      {
        name: "Prevention",
        description:
          "Support for the things that keep people independent longer, particularly falls.",
      },
      {
        name: "Monitoring",
        description:
          "Light monitoring that a person or a family member can act on, without turning a home into a ward.",
      },
      {
        name: "Exercise and support programs",
        description:
          "Structured activity and support built for the range of ability this area actually covers.",
      },
      {
        name: "Supporter involvement",
        description:
          "Letting a family member or carer help without taking the person's decisions away from them.",
      },
    ],
    upcoming: [
      {
        title: "Accessibility-first design",
        description:
          "Starting from large type, high contrast, switch control and screen readers rather than retrofitting them.",
        horizon: "Later",
      },
      {
        title: "Supporter roles",
        description:
          "Extending the supporter model from BreatheFree so a family member can help without taking over.",
        horizon: "Later",
      },
      {
        title: "Falls scope",
        description:
          "Deciding what is genuinely useful on falls without turning a home into a monitored ward.",
        horizon: "Later",
      },
    ],
  },
];

export const programCount = programs.length;
export const buildingPrograms = programs.filter((p) => p.status === "building");
export const plannedPrograms = programs.filter((p) => p.status === "planned");
