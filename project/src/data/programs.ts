/**
 * The programs of the Tether Health app, one per health area.
 *
 * The app's own program list (tether_ui/spec/programs.json in the
 * Tether-Health repository) is the source for each program's app id, name,
 * area, archetype, tagline and status, and the app's design tokens
 * (tether_ui/design/tokens.json, "program") for its colour and letter. Those
 * fields are copied verbatim and must not be reworded here: the pinned copy in
 * test/fixtures/app-programs.json and test/functional/programs-match-app.test.js
 * fail the build if they drift. The order is the app's catalog order.
 *
 * `id` is the website URL slug (/programs/<id>/). It predates the app ids and
 * stays stable so existing links keep working; `appId` is the app's id.
 *
 * `status` mirrors the app's internal status text through `statusLabels`
 * ("Approved · in build", "Prototype on develop", "Proposed", "Planned"). It is
 * kept so the pinned app fixture can be checked, and is never rendered: the
 * site presents every program as part of one finished product (owner
 * direction, 2026-10-27).
 *
 * `examples`, `addresses`, `summary` and `services` are website copy
 * describing what each program does. Present tense is fine; claims that it can
 * be downloaded or used today are not, because no program is released yet (the
 * site's call to action is early access). No dates, no medical claims.
 */

import type { IconName } from "../components/Icon.astro";

export type ProgramStatus = "in-build" | "prototype" | "proposed" | "planned";

/** A line of work inside a health area. */
export interface ProgramService {
  name: string;
  description: string;
}

export interface Program {
  /** Website URL slug: /programs/<id>/. */
  id: string;
  /** The app's program id (programs.json "id"). */
  appId: string;
  /** Program name in the app (programs.json "name"). */
  name: string;
  /** Health area (programs.json "area"). */
  area: string;
  /** Program type in the app (programs.json "archetype"). */
  archetype: string;
  /** The app's one-line description (programs.json "tagline"). */
  tagline: string;
  /** Program colour (tokens.json program.<appId>.color). */
  color: string;
  /** Program letter (tokens.json program.<appId>.letter). */
  letter: string;
  /** Examples within the area. */
  examples: string;
  /** What the program addresses. */
  addresses: string[];
  status: ProgramStatus;
  icon: IconName;
  /** One-paragraph description of the area, used on its own page. */
  summary: string;
  /** The lines of work within the area. */
  services: ProgramService[];
  /** Set when a website product page covers this program. */
  product?: { name: string; href: string };
}

/** The app's internal status text for each status, verbatim. Not rendered. */
export const statusLabels: Record<ProgramStatus, string> = {
  "in-build": "Approved · in build",
  prototype: "Prototype on develop",
  proposed: "Proposed",
  planned: "Planned",
};

export const programs: Program[] = [
  {
    id: "tobacco",
    appId: "bf",
    name: "BreatheFree",
    area: "Tobacco & nicotine",
    archetype: "Quit / Reduce",
    tagline: "Your next breath can be different.",
    color: "#B5432A",
    letter: "B",
    examples: "Cigarettes, vaping, smokeless tobacco",
    addresses: [
      "Prevention",
      "Cessation support",
      "Relapse prevention",
      "Exposure reduction",
    ],
    status: "in-build",
    icon: "leaf",
    summary:
      "BreatheFree is the Tether Health program for tobacco and nicotine: a calm, private companion for quitting cigarettes, vaping or smokeless tobacco. It pairs a quit plan you build yourself with one-tap craving rescue, progress a slip never erases, and a direct route to quitlines and the people who can help.",
    services: [
      {
        name: "Prevention",
        description:
          "Plain-language material on how dependence forms, aimed at people who have not started or have started recently.",
      },
      {
        name: "Cessation support",
        description:
          "Day-to-day help through a quit attempt: a plan the person owns, craving tools, and check-ins that take under two minutes.",
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
    product: { name: "BreatheFree", href: "/breathefree/" },
  },
  {
    id: "social-media",
    appId: "sf",
    name: "ScrollFree",
    area: "Social media use",
    archetype: "Quit / Reduce",
    tagline: "Your attention is yours.",
    color: "#3B4CC0",
    letter: "S",
    // needs-owner: examples, addresses, summary and services are website
    // copy drawn from the app's ScrollFree screens.
    examples: "Social media and endless scrolling",
    addresses: [
      "Noticing what pulls you in",
      "Goals that feel doable",
      "Pausing the urge",
      "Recovering from a long scroll",
    ],
    status: "proposed",
    icon: "clock",
    summary:
      "ScrollFree is the Tether Health program for social media use. It starts from what you say about your own use, before asking for any screen-time permission, then turns that into goals that feel doable, a pause when the urge hits, and an easy way back after a long scroll.",
    services: [
      {
        name: "Self-report first",
        description:
          "Starting from what a person tells it about their own use and triggers, with screen-time access optional rather than required.",
      },
      {
        name: "Minute goals and app-free windows",
        description:
          "A daily minute goal and app-free windows the person chooses, set at a level that feels doable.",
      },
      {
        name: "Pause 60",
        description:
          "A 60-second pause for the moment the urge to scroll hits, with the shared Rescue one tap away.",
      },
      {
        name: "Buddy and weekly reflection",
        description:
          "An optional accountability buddy, and a weekly reflection on how the week went, without judgment after a long scroll.",
      },
      {
        name: "Unplug",
        description:
          "Optional app limits and focus sessions that the person chooses to set up and can turn off.",
      },
    ],
  },
  {
    id: "respiratory",
    appId: "ca",
    name: "ClearAir",
    area: "Respiratory health",
    archetype: "Manage",
    tagline: "Follow your action plan, day by day.",
    color: "#1D6A93",
    letter: "C",
    examples: "COPD, asthma, smoking-related lung disease",
    addresses: [
      "Trigger and risk reduction",
      "Symptom monitoring",
      "Care coordination",
    ],
    status: "prototype",
    icon: "wave",
    summary:
      "ClearAir is the Tether Health program for respiratory health. It sits right next to the tobacco work and builds on what BreatheFree learns, bringing the same calm, practical support to following an action plan, noticing triggers and keeping your care team in the loop.",
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
  },
  {
    id: "cardiovascular",
    appId: "hw",
    name: "Heartwise",
    area: "Cardiovascular health",
    archetype: "Manage",
    tagline: "Know your numbers. Share them on your terms.",
    color: "#B3263E",
    letter: "H",
    examples: "High blood pressure, heart disease, stroke",
    addresses: [
      "Risk assessment",
      "Diet and activity support",
      "Monitoring and prevention",
    ],
    status: "prototype",
    icon: "progress",
    summary:
      "Heartwise is the Tether Health program for cardiovascular health. It helps you understand your numbers, build the everyday habits that matter for your heart, and share what you choose with your care team, on your terms.",
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
  },
  {
    id: "metabolic",
    appId: "st",
    name: "Steady",
    area: "Diabetes & metabolic health",
    archetype: "Manage",
    tagline: "Notice glucose patterns, without judgment.",
    color: "#8A5A00",
    letter: "S",
    examples: "Type 2 diabetes, prediabetes, metabolic syndrome",
    addresses: [
      "Screening",
      "Lifestyle support",
      "Glucose management education",
      "Complication prevention",
    ],
    status: "prototype",
    icon: "wave",
    summary:
      "Steady is the Tether Health program for diabetes and metabolic health. Much of the day-to-day work sits with you rather than the clinic, so Steady keeps it calm: plain-language education, lifestyle support and a judgment-free view of your glucose patterns.",
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
  },
  {
    id: "kidney-liver",
    appId: "re",
    name: "Renew",
    area: "Kidney & liver health",
    archetype: "Manage",
    tagline: "Look after your kidneys and liver.",
    color: "#1E6B68",
    letter: "R",
    examples: "Chronic kidney disease, fatty liver disease",
    addresses: ["Risk identification", "Monitoring", "Prevention education"],
    status: "planned",
    icon: "info",
    summary:
      "Renew is the Tether Health program for kidney and liver health. Both conditions are often advanced before they are noticed, so Renew focuses on what helps most: understanding your risk, keeping track of what your care team asks you to monitor, and plain explanations.",
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
  },
  {
    id: "nutrition",
    appId: "nu",
    name: "Nourish",
    area: "Obesity & nutrition",
    archetype: "Build habits",
    tagline: "Food without judgment.",
    color: "#3F7426",
    letter: "N",
    examples: "Obesity, poor diet, nutritional deficiencies",
    addresses: [
      "Nutrition education",
      "Healthy-weight programs",
      "Physical activity",
    ],
    status: "planned",
    icon: "spark",
    summary:
      "Nourish is the Tether Health program for obesity and nutrition. Tone matters most here, because this is a subject people have usually been shamed about before they reach any software. Nourish offers food education, healthy-weight support and movement without judgment.",
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
  },
  {
    id: "aging",
    appId: "sd",
    name: "Stride",
    area: "Healthy aging",
    archetype: "Build habits",
    tagline: "Move well, stay well.",
    color: "#94501F",
    letter: "S",
    examples: "Mobility, cognitive health, falls",
    addresses: ["Prevention", "Monitoring", "Exercise and support programs"],
    status: "planned",
    icon: "accessibility",
    summary:
      "Stride is the Tether Health program for healthy aging. Here accessibility stops being a compliance exercise and becomes the whole product: support for staying active, keeping steady on your feet and involving the people who look out for you.",
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
  },
  {
    id: "behavioral",
    appId: "ea",
    name: "Ease",
    area: "Mental & behavioral health",
    archetype: "Support",
    tagline: "Support for how you feel.",
    color: "#5B4FB8",
    letter: "E",
    examples: "Stress, anxiety, depression, substance-use concerns",
    addresses: [
      "Screening",
      "Support resources",
      "Referral to qualified professionals",
    ],
    status: "planned",
    icon: "users",
    summary:
      "Ease is the Tether Health program for mental and behavioral health. Its role is support and routing to qualified people — not therapy, and not crisis care. The safety routing on every page of this site exists because of areas like this one.",
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
  },
  {
    id: "preventive",
    appId: "ck",
    name: "Checkup",
    area: "Preventive health",
    archetype: "Prevent",
    tagline: "What’s due for you, in one place.",
    color: "#5A661A",
    letter: "C",
    examples: "Vaccinations, routine screenings, checkups",
    addresses: [
      "Reminders",
      "Education",
      "Age- and risk-appropriate screening",
    ],
    status: "planned",
    icon: "calendar",
    summary:
      "Checkup is the Tether Health program for preventive health. Most of prevention is remembering the right thing at the right time, so Checkup keeps what is due for you in one place, with plain explanations and a record you own.",
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
  },
  {
    id: "cancer",
    appId: "be",
    name: "Beacon",
    area: "Cancer",
    archetype: "Prevent",
    tagline: "Lower your risk. Know your options.",
    color: "#74428F",
    letter: "B",
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
      "Beacon is the Tether Health program for cancer. It helps you lower your risk, stay on top of screening, find treatment-support resources and plan for life after treatment — while staying firmly on the right side of the line between useful information and diagnosis.",
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
  },
];

export const programCount = programs.length;
