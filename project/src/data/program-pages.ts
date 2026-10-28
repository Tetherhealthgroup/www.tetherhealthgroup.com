/**
 * Marketing detail for each program page (WEB-915, owner decision P-113):
 * three screens from the app design, a short intro video, an introduction to
 * the health area, what the app helps with, and the recovery plan.
 *
 * Sources, so each line can be checked:
 *
 * - `screens`: rendered from the Tether Health design kit
 *   (Tether-Health, specs-and-design/tether_ui/flutter at commit 417ee8c) in
 *   preview mode at 390 x 844 pt, 1.5x. The design's example person and clinic
 *   names were replaced with neutral synthetic text for these renders, and
 *   the health-record row on the Heartwise home was hidden. Elements behind
 *   a feature switch that is off in store builds (lib/config/
 *   feature_switches.dart: Unplug, records import, lesson drafts and others)
 *   are left out, as the store app leaves them out. `specId` records which
 *   design screen was rendered; the PNGs are stored under neutral names,
 *   src/assets/programs/<id>/<role>.png, so no built asset carries it.
 * - `helpsWith` and `recovery`: tether_ui/spec (flows.json, screens/*.json)
 *   at the same commit. Step names are the app's own labels. Nothing here may
 *   describe a feature the spec does not have.
 * - `area` (What it is) and `learnMore`: general, non-diagnostic website copy.
 *   needs-clinical-review: P-113. No statistics. Every Learn more URL answered
 *   HTTP 200 when this file was written (2026-10-28).
 * - `video`: the narration and captions of the intro video, one array of
 *   sentences per scene (title, home, primary action, recovery). The end card
 *   is shared and lives in `videoEndCard`. scripts/build-program-videos.mjs
 *   reads this file, so changing a sentence here means rebuilding the videos.
 *
 * This module has no Astro imports so that the video build script can import
 * it with plain Node.
 */

export type ScreenRole = "home" | "action" | "recovery";

export interface ProgramScreen {
  /** Screen id in the app spec, also the PNG file stem. */
  specId: string;
  role: ScreenRole;
  /** The screen's name in the app. */
  title: string;
  /** Describes what the screen shows, for people who cannot see it. */
  alt: string;
}

export interface LearnMoreLink {
  publisher: string;
  label: string;
  href: string;
}

export interface Feature {
  name: string;
  description: string;
}

export interface RecoveryStep {
  name: string;
  detail: string;
}

export interface ProgramPage {
  /** Website URL slug, matching programs.ts `id`. */
  id: string;
  screens: [ProgramScreen, ProgramScreen, ProgramScreen];
  /** What it is: the health area and common contributing factors. */
  area: string[];
  learnMore: LearnMoreLink[];
  helpsWith: Feature[];
  recovery: {
    /** The recovery screen's name in the app. */
    screen: string;
    /** The app's own heading on that screen. */
    heading: string;
    steps: RecoveryStep[];
    /** What the recovery screen says about safety or the care team. */
    note: string;
  };
  video: {
    /** Narration sentences per scene: title, home, action, recovery. */
    scenes: [string[], string[], string[], string[]];
  };
}

/** Text of the video end card. */
export const videoEndCard = {
  title: "Coming to iPhone and Android",
  cta: "Get early access",
  url: "tetherhealthgroup.com/beta",
};

/** The medical boundary every program page states. */
export const programDisclaimer =
  "Tether Health supports everyday self-care and does not diagnose, treat or replace your clinician.";

/** Review marker carried by the health-area block on every page. */
export const clinicalReviewMarker = "needs-clinical-review: P-113";

const SMOKEFREE = {
  publisher: "Smokefree.gov (National Cancer Institute)",
  label: "Smokefree.gov",
  href: "https://smokefree.gov/",
};

export const programPages: ProgramPage[] = [
  {
    id: "tobacco",
    screens: [
      {
        specId: "bf_home",
        role: "home",
        title: "BreatheFree home",
        alt: "BreatheFree home screen. A coral Rescue button for cravings sits at the top, then today's one mission (stock gum, water or healthy snacks), the person's top reason in their own words, a countdown of seven days to their quit day, and links to the daily check-in, the medication center and progress.",
      },
      {
        specId: "rescue_active",
        role: "action",
        title: "Rescue: slow breathing",
        alt: "Rescue screen running a slow-breathing tool. A breathing circle counts down five seconds with the prompt to breathe out slowly and the line: the urge is a wave, let it rise and pass. Below are options to switch tool or get support, and an I'm done button.",
      },
      {
        specId: "bf_slip",
        role: "recovery",
        title: "Slip recovery",
        alt: "Slip recovery screen headed: a slip is information, not the end. It shows smoke-free days kept, asks what happened and what was going on, and recommends continuing from this moment, with a button to save and start a two-minute Rescue.",
      },
    ],
    area: [
      "Tobacco and nicotine use includes cigarettes, vaping and smokeless tobacco. Nicotine is addictive, so cravings and withdrawal can make stopping hard, and many people make several attempts before they stop.",
      "Common things that keep the habit going include stress, daily routines such as a coffee or a drive, being around other people who smoke or vape, and alcohol.",
    ],
    learnMore: [
      SMOKEFREE,
      {
        publisher: "National Cancer Institute",
        label: "Tobacco and cancer risk",
        href: "https://www.cancer.gov/about-cancer/causes-prevention/risk/tobacco",
      },
    ],
    helpsWith: [
      {
        name: "Choose your path",
        description:
          "Set a quit date, quit today, reduce gradually on a step-down schedule, or explore first with lessons and Rescue only.",
      },
      {
        name: "Rescue for cravings",
        description:
          "One tap from home, with no typing. It asks what is pulling at you, offers the tool that helped last time, such as two minutes of slow breathing, and keeps a person one tap away.",
      },
      {
        name: "One mission a day",
        description:
          "A small task tied to your own top reason, and a daily check-in of about a minute.",
      },
      {
        name: "Medication center",
        description:
          "A place to record the quit-medication plan you agreed with your clinician. Education and self-tracking only; the app never prescribes.",
      },
      {
        name: "Progress",
        description:
          "Smoke-free days and money not spent on tobacco, which a slip never erases.",
      },
    ],
    recovery: {
      screen: "Slip recovery",
      heading: "A slip is information, not the end.",
      steps: [
        {
          name: "What happened?",
          detail:
            "Pick one: a puff or two, one cigarette, more, or prefer not to say. The smoke-free days you already have stay on screen.",
        },
        {
          name: "What was going on? (optional)",
          detail: "Stress, around smokers, alcohol or scrolling late.",
        },
        {
          name: "Continue from this moment",
          detail:
            "The recommended next step keeps your plan. You can choose a new quit time instead.",
        },
        {
          name: "Save and start a 2-min Rescue",
          detail:
            "Saving adds the slip to your record without taking anything away, then opens a short Rescue tool.",
        },
      ],
      note: "Nothing resets: the app adds a record of the slip and never lowers a count.",
    },
    video: {
      scenes: [
        ["BreatheFree is the Tether Health program for tobacco and nicotine."],
        [
          "Home shows one small mission for today, your own reason for quitting, and the days to your quit day.",
        ],
        [
          "When a craving hits, Rescue is one tap away, with a short guided tool such as slow breathing.",
        ],
        [
          "If you slip, it is treated as information, not failure.",
          "Your smoke-free days stay counted, and you choose how to continue.",
        ],
      ],
    },
  },
  {
    id: "social-media",
    screens: [
      {
        specId: "sf_home",
        role: "home",
        title: "ScrollFree home",
        alt: "ScrollFree home screen. A dark card shows yesterday's time on social media against a 90-minute goal, followed by a coral Pause 60 button for the urge to scroll, today's step (charge your phone outside the bedroom), and links to this week, long-scroll recovery, goal and windows, and the buddy.",
      },
      {
        specId: "sf_pause",
        role: "action",
        title: "Pause 60",
        alt: "Pause 60 screen on a deep blue background: before you open it, one breath. A 60-second countdown circle shows 42 seconds left, with choices for why the phone was picked up and a suggestion to try instead, then an I'm good, put it down button and an open-anyway link with no judgment.",
      },
      {
        specId: "sf_slip",
        role: "recovery",
        title: "Long-scroll recovery",
        alt: "Long scroll screen headed: that happens, what pulled you in? It says nothing resets and phone-free nights still count, offers reasons such as couldn't sleep or bored, and recommends keeping the goal and trying again tonight, with options to make the goal easier or change the bedtime window.",
      },
    ],
    area: [
      "Social media and endless scrolling are designed to hold attention, and it is easy to spend more time than you meant to. Heavy use can crowd out sleep, time with people and other things you care about.",
      "Common pulls include boredom, stress, trouble sleeping, notifications, and simply not noticing the time pass.",
    ],
    learnMore: [
      {
        publisher: "National Institute of Mental Health",
        label: "Caring for your mental health",
        href: "https://www.nimh.nih.gov/health/topics/caring-for-your-mental-health",
      },
    ],
    helpsWith: [
      {
        name: "Self-report first",
        description:
          "It starts from what you say about your own use and what pulls you in.",
      },
      {
        name: "Goal and app-free windows",
        description:
          "A daily minute goal that feels doable and the phone-free times you choose, such as a bedtime window.",
      },
      {
        name: "Pause 60",
        description:
          "A 60-second pause for the moment the urge to scroll hits, with something else to try and no judgment if you open the app anyway.",
      },
      {
        name: "Buddy and weekly reflection",
        description:
          "An optional accountability buddy who sees only what you choose to send, and a weekly look back at how the week went.",
      },
    ],
    recovery: {
      screen: "Long-scroll recovery",
      heading: "That happens. What pulled you in?",
      steps: [
        {
          name: "What pulled you in?",
          detail:
            "Pick a reason: couldn't sleep, bored, stressed or didn't notice time.",
        },
        {
          name: "Keep my goal, try again tonight",
          detail: "The recommended next step keeps the goal you set.",
        },
        {
          name: "Make my goal easier or change my bedtime window",
          detail: "Either option takes you to your goal screen to adjust it.",
        },
        {
          name: "Save",
          detail: "Your phone-free nights still count.",
        },
      ],
      note: "Nothing resets after a long scroll.",
    },
    video: {
      scenes: [
        ["ScrollFree is the Tether Health program for social media use."],
        [
          "Home shows yesterday's time against a goal you chose, and one small step for today.",
        ],
        [
          "When the urge to scroll hits, Pause 60 gives you one minute and something else to try.",
        ],
        [
          "After a long scroll, nothing resets.",
          "You say what pulled you in, then keep your goal or make it easier.",
        ],
      ],
    },
  },
  {
    id: "respiratory",
    screens: [
      {
        specId: "ca_home",
        role: "home",
        title: "ClearAir home",
        alt: "ClearAir home screen. A dark card shows today's zone as green with a peak-flow reading, checked from your plan. Below are a Check my zone button, a red-zone plan card that opens fast, and links to log symptoms, progress, my action plan and missed checks.",
      },
      {
        specId: "ca_zone",
        role: "action",
        title: "Zone check",
        alt: "Zone check screen asking: how is your breathing? It has an optional peak-flow field, symptom choices such as coughing, wheezing and can't speak in full sentences, and a green, yellow or red zone that updates as you type, worked out only from the plan you entered.",
      },
      {
        specId: "ca_setback",
        role: "recovery",
        title: "Missed checks",
        alt: "Missed checks screen headed: missed a few days? Pick up from today. It says earlier zone checks still count, asks what happened, such as missed controller doses or ran out of medicine, and recommends checking your zone now, with a button to save and take one step.",
      },
    ],
    area: [
      "Respiratory health covers long-term lung conditions such as asthma and COPD (chronic obstructive pulmonary disease), where breathing can be harder on some days than others.",
      "Common contributing factors include smoking and secondhand smoke, air pollution, dust and fumes at work, respiratory infections, and allergens. Many people work from a written action plan agreed with their clinician.",
    ],
    learnMore: [
      {
        publisher: "National Heart, Lung, and Blood Institute",
        label: "COPD",
        href: "https://www.nhlbi.nih.gov/health/copd",
      },
      {
        publisher: "National Heart, Lung, and Blood Institute",
        label: "Asthma",
        href: "https://www.nhlbi.nih.gov/health/asthma",
      },
    ],
    helpsWith: [
      {
        name: "Your clinician's action plan",
        description:
          "Copy in the plan your clinician gave you. ClearAir never creates or changes zones; without a plan you can still learn, log symptoms and prepare questions.",
      },
      {
        name: "Zone check",
        description:
          "Enter peak flow if you use it and how you feel. The zone comes only from your plan, and “can't speak in full sentences” always opens your red-zone plan.",
      },
      {
        name: "Yellow- and red-zone steps",
        description:
          "Your own yellow-zone steps with a re-check, and a red-zone plan that is quick to open and stays open until you close it.",
      },
      {
        name: "Symptom log and progress",
        description:
          "A light symptom log, and progress against your own zones with notes worth raising at your next visit.",
      },
    ],
    recovery: {
      screen: "Missed checks",
      heading: "Missed a few days? Pick up from today.",
      steps: [
        {
          name: "What happened? (optional)",
          detail:
            "Missed controller doses, missed peak-flow checks, ran out of medicine, felt fine so I stopped, or busy or away.",
        },
        {
          name: "Check my zone now",
          detail: "The recommended next step: start again from today.",
        },
        {
          name: "Ask my care team about doses or refills",
          detail:
            "Shown when you have connected a care team. You can also go back to your daily routine.",
        },
        {
          name: "Save and take one step",
          detail: "Your earlier zone checks still count.",
        },
      ],
      note: "ClearAir never changes your medicines or doses; it asks you to check with your clinician or pharmacist about missed doses. Getting worse leads straight to your red-zone plan.",
    },
    video: {
      scenes: [
        ["ClearAir is the Tether Health program for respiratory health."],
        [
          "Home shows today's zone from the action plan your clinician gave you, with your red-zone plan close at hand.",
        ],
        [
          "A zone check asks how your breathing is, and works out your zone only from your plan.",
        ],
        [
          "Missed a few days? Nothing resets.",
          "Pick up from today with one step, and ask your clinician about any missed doses.",
        ],
      ],
    },
  },
  {
    id: "cardiovascular",
    screens: [
      {
        specId: "hw_home",
        role: "home",
        title: "Heartwise home",
        alt: "Heartwise home screen. A dark card shows the last blood pressure reading as the average of two, next to the target from your clinician. Below are a Log blood pressure button, then links to trends, cholesterol panel, visit summary, my targets and missed or high readings, and an urgent card to call 911 for chest pain, pressure or trouble breathing.",
      },
      {
        specId: "hw_log",
        role: "action",
        title: "Log blood pressure",
        alt: "Log blood pressure screen, reading one of two: sit quietly for five minutes first. Fields for top and bottom numbers and an optional pulse, a choice of left or right arm, and a tip to take a second reading after one minute so the app can average them.",
      },
      {
        specId: "hw_setback",
        role: "recovery",
        title: "Missed or high readings",
        alt: "Start again screen headed: missed readings or a few high ones? Start again today. It says one reading is information, not a grade, asks what happened, and recommends taking a reading now, with options to message the care team or send a visit summary to the clinic.",
      },
    ],
    area: [
      "Cardiovascular health is about the heart and blood vessels, including high blood pressure, heart disease and stroke. High blood pressure often has no symptoms, which is why regular checks matter.",
      "Common contributing factors include smoking, a diet high in salt, low physical activity, stress, diabetes, high cholesterol, and family history.",
    ],
    learnMore: [
      {
        publisher: "National Heart, Lung, and Blood Institute",
        label: "High blood pressure",
        href: "https://www.nhlbi.nih.gov/health/high-blood-pressure",
      },
      {
        publisher: "National Heart, Lung, and Blood Institute",
        label: "Coronary heart disease",
        href: "https://www.nhlbi.nih.gov/health/coronary-heart-disease",
      },
    ],
    helpsWith: [
      {
        name: "Your clinician's targets",
        description:
          "Copy in the targets from your visit. Only your clinician sets targets; Heartwise never sets or grades them.",
      },
      {
        name: "Two-reading blood pressure log",
        description:
          "Sit quietly first, take two readings a minute apart, and the app averages them, with a check on numbers that look mistyped.",
      },
      {
        name: "Crisis-range route",
        description:
          "A very high reading asks about symptoms such as chest pain or trouble speaking, routes to 911 when they are present, and otherwise offers a timed re-check.",
      },
      {
        name: "Trends, cholesterol and visit summary",
        description:
          "Trends over time, a cholesterol panel you enter, and a visit summary you preview before anything is sent to your clinic.",
      },
    ],
    recovery: {
      screen: "Missed or high readings",
      heading: "Missed readings or a few high ones? Start again today.",
      steps: [
        {
          name: "What happened? (optional)",
          detail:
            "Missed readings, several high readings, ran out of medicine, monitor problems, or busy or away.",
        },
        {
          name: "Take a reading now",
          detail:
            "The recommended next step, starting with five quiet minutes.",
        },
        {
          name: "Message my care team or send a visit summary",
          detail: "Shown when you have a care team or a clinic set up.",
        },
        {
          name: "Save and take one step",
          detail: "Your earlier readings are still here.",
        },
      ],
      note: "Heartwise never changes your medicines or targets. Several readings above target may be worth telling your clinician, and chest pain, pressure or trouble breathing means calling 911.",
    },
    video: {
      scenes: [
        ["Heartwise is the Tether Health program for cardiovascular health."],
        [
          "Home shows your last blood pressure reading next to the target your clinician set.",
        ],
        [
          "Logging takes two readings a minute apart, after five quiet minutes, and averages them.",
        ],
        [
          "Missed readings, or a few high ones? Nothing resets.",
          "Take one step today, and share with your care team when you choose.",
        ],
      ],
    },
  },
  {
    id: "metabolic",
    screens: [
      {
        specId: "st_home",
        role: "home",
        title: "Steady home",
        alt: "Steady home screen. A dark card shows the last glucose reading, two hours after lunch, within the after-meal range. Below are a Log a reading button, links to a meal energy reset, patterns, A1C history, my range and low plan, and out-of-range days, and a note that Steady never counts calories.",
      },
      {
        specId: "st_log",
        role: "action",
        title: "Log a reading",
        alt: "Log a reading screen with a glucose field in mg/dL from a meter or CGM, a choice of when (fasting, before meal, two hours after meal, bedtime or other), how you feel, and an optional note that is never shared unless you choose.",
      },
      {
        specId: "st_setback",
        role: "recovery",
        title: "Out-of-range days",
        alt: "Start again screen headed: out-of-range days happen. It says a high reading is information, not failure, asks what happened, such as a sick day or changed routine, and recommends logging a reading now, with options to look at patterns or message the care team.",
      },
    ],
    area: [
      "Diabetes and metabolic health cover type 2 diabetes, prediabetes and related conditions, where the body has trouble keeping blood glucose in a healthy range. Much of the day-to-day management happens at home, between appointments.",
      "Common contributing factors include family history, carrying extra weight, low physical activity, eating patterns, poor sleep, and some medicines.",
    ],
    learnMore: [
      {
        publisher:
          "National Institute of Diabetes and Digestive and Kidney Diseases",
        label: "Diabetes",
        href: "https://www.niddk.nih.gov/health-information/diabetes",
      },
      {
        publisher: "American Diabetes Association",
        label: "diabetes.org",
        href: "https://diabetes.org/",
      },
    ],
    helpsWith: [
      {
        name: "Your range and low plan",
        description:
          "Enter the range your clinician gave you and your own plan for a low.",
      },
      {
        name: "Reading log",
        description:
          "Log readings from a meter or CGM with when you took them and how you felt.",
      },
      {
        name: "Low-reading route",
        description:
          "A reading below your low opens your low plan with a 15-minute timer to recheck, and a 911 route for confusion, trouble swallowing or passing out.",
      },
      {
        name: "Meal energy reset, patterns and A1C",
        description:
          "A short reset for the post-meal slump, patterns over time, and an A1C history you enter. No calorie counting, and no dosing advice.",
      },
    ],
    recovery: {
      screen: "Out-of-range days",
      heading: "Out-of-range days happen.",
      steps: [
        {
          name: "What happened? (optional)",
          detail:
            "Higher than my range, lower than my range, missed readings, sick day, or changed routine.",
        },
        {
          name: "Log a reading now",
          detail: "The recommended next step.",
        },
        {
          name: "Look at my patterns or message my care team",
          detail: "Messaging is shown when you have connected a care team.",
        },
        {
          name: "Save and take one step",
          detail: "Your earlier readings are still here.",
        },
      ],
      note: "Being sick or a change in routine can change readings; the screen suggests asking your care team for a sick-day plan. A reading below your low still opens your low plan.",
    },
    video: {
      scenes: [
        [
          "Steady is the Tether Health program for diabetes and metabolic health.",
        ],
        [
          "Home shows your last reading against the range your clinician gave you, without judgment.",
        ],
        [
          "Logging a reading takes a few taps: the number, when you took it, and how you feel.",
        ],
        [
          "Out-of-range days happen, and nothing resets.",
          "Log a reading, look at your patterns, or message your care team.",
        ],
      ],
    },
  },
  {
    id: "kidney-liver",
    screens: [
      {
        specId: "re_home",
        role: "home",
        title: "Renew home",
        alt: "Renew home screen. A dark card shows the latest eGFR value and notes that your clinician sets your next check. Below is today's checklist (medicine as entered from your clinician, and water only if fluids are not limited) and links to add lab results, lab history, check symptoms, and missed labs or a diet slip.",
      },
      {
        specId: "re_labs",
        role: "action",
        title: "Add lab results",
        alt: "Add lab results screen: copy each number exactly as printed. Fields for eGFR, urine ACR and an optional liver value, each with a plain-language note such as higher is usually better, a lab date, and a card explaining that your clinician explains what your numbers mean.",
      },
      {
        specId: "re_setback",
        role: "recovery",
        title: "Missed labs or a diet slip",
        alt: "Start again screen headed: missed labs or a diet slip? Start again today. It says one missed check or meal doesn't undo your plan, asks what happened, and recommends asking the care team to rebook labs, with options to add results you already have or go back to Renew home.",
      },
    ],
    area: [
      "Kidney and liver health covers conditions such as chronic kidney disease and fatty liver disease. Both can develop quietly, often without symptoms until they are advanced, so knowing your risk and keeping up with checks matters.",
      "Common contributing factors include diabetes, high blood pressure, carrying extra weight, heavy alcohol use, some medicines, and family history.",
    ],
    learnMore: [
      {
        publisher:
          "National Institute of Diabetes and Digestive and Kidney Diseases",
        label: "Kidney disease",
        href: "https://www.niddk.nih.gov/health-information/kidney-disease",
      },
      {
        publisher:
          "National Institute of Diabetes and Digestive and Kidney Diseases",
        label: "Liver disease",
        href: "https://www.niddk.nih.gov/health-information/liver-disease",
      },
    ],
    helpsWith: [
      {
        name: "Risk check",
        description:
          "A few questions about factors that raise the chance of kidney or liver problems, and a plain-language result about what to ask your clinician.",
      },
      {
        name: "Labs and trends",
        description:
          "Copy in lab results as printed and see them over time. Renew shows trends only, never grades; your clinician explains what the numbers mean.",
      },
      {
        name: "Daily checklist",
        description:
          "A simple checklist for the day to tick off: medicine as entered from your clinician, and water only if your clinician has not limited fluids.",
      },
      {
        name: "Warning-symptom guidance",
        description:
          "A symptom check that points severe symptoms to 911 and others to your care team the same day. Nothing on it is saved or sent.",
      },
    ],
    recovery: {
      screen: "Missed labs or a diet slip",
      heading: "Missed labs or a diet slip? Start again today.",
      steps: [
        {
          name: "What happened? (optional)",
          detail:
            "Missed a lab check, missed a visit, diet slip, missed medicine, or busy or away.",
        },
        {
          name: "Ask my care team to rebook my labs",
          detail:
            "The recommended next step when you have connected a care team.",
        },
        {
          name: "Add lab results I already have",
          detail: "Or go back to Renew home.",
        },
        {
          name: "Save and take one step",
          detail: "Nothing resets.",
        },
      ],
      note: "Renew never sets diet or fluid limits; it asks you to follow the plan from your clinician or dietitian. Warning signs lead to the symptom check.",
    },
    video: {
      scenes: [
        ["Renew is the Tether Health program for kidney and liver health."],
        [
          "Home brings together your latest lab value and a simple checklist for the day.",
        ],
        [
          "You copy in lab results exactly as printed, and see your trends over time.",
        ],
        [
          "Missed labs or a diet slip? Nothing resets.",
          "Start again today, and ask your care team to rebook your labs.",
        ],
      ],
    },
  },
  {
    id: "nutrition",
    screens: [
      {
        specId: "nu_home",
        role: "home",
        title: "Nourish home",
        alt: "Nourish home screen. A card shows this week's habit, add a vegetable to dinner, on three of five nights, with a Done today button. Below are a tip that frozen vegetables count, and links for when food feels hard, a busy week, the week 4 milestone, changing the habit, and a gentle restart.",
      },
      {
        specId: "nu_habit",
        role: "action",
        title: "This week's habit",
        alt: "This week's habit screen: pick one habit for this week. Options include add a vegetable to dinner (suggested), water before each meal, cook at home, and a 10-minute walk after a meal. A weight-tracking switch is off by default and can stay off forever.",
      },
      {
        specId: "nu_restart",
        role: "recovery",
        title: "Gentle restart",
        alt: "Gentle restart screen headed: welcome back, start again, small. It says days away don't undo the ones you did, asks what got in the way, and recommends restarting the habit today, with options to pick a smaller habit, get support with food, or talk to someone.",
      },
    ],
    area: [
      "Obesity and nutrition cover the everyday food and activity patterns that shape long-term health. Weight is influenced by many things beyond willpower, and shame tends to make change harder, not easier.",
      "Common contributing factors include genetics, sleep, stress, some medicines, the cost and availability of healthy food, time to cook, and how much daily movement a routine allows.",
    ],
    learnMore: [
      {
        publisher:
          "National Institute of Diabetes and Digestive and Kidney Diseases",
        label: "Weight management",
        href: "https://www.niddk.nih.gov/health-information/weight-management",
      },
      {
        publisher:
          "National Institute of Diabetes and Digestive and Kidney Diseases",
        label: "Healthy eating and physical activity for life",
        href: "https://www.niddk.nih.gov/health-information/weight-management/healthy-eating-physical-activity-for-life",
      },
    ],
    helpsWith: [
      {
        name: "One weekly habit",
        description:
          "Pick one small habit a week, such as adding a vegetable to dinner, and mark it done with one tap.",
      },
      {
        name: "Weight-neutral by default",
        description:
          "Nourish never asks for your weight unless you turn weight tracking on, and it can stay off.",
      },
      {
        name: "Protective mode",
        description:
          "If eating has been a struggle, Nourish does not set food amounts or show before-and-after comparisons, and offers support options, including help preparing what to say to a clinician.",
      },
      {
        name: "Off-track reset and week 4 milestone",
        description:
          "A reset without guilt after a busy week, and a check-in after four weeks of small habits.",
      },
    ],
    recovery: {
      screen: "Gentle restart",
      heading: "Start again, small.",
      steps: [
        {
          name: "What got in the way? (optional)",
          detail:
            "Busy, stress, felt unwell, lost interest, or prefer not to say.",
        },
        {
          name: "Restart my habit today",
          detail: "The recommended next step.",
        },
        {
          name: "Pick a smaller habit or get support with food",
          detail: "Or talk to someone: your care team or a person in Support.",
        },
        {
          name: "Save and take one step",
          detail: "Days away don't undo the ones you did.",
        },
      ],
      note: "Nothing resets, and weight is never asked.",
    },
    video: {
      scenes: [
        ["Nourish is the Tether Health program for obesity and nutrition."],
        ["Home shows one small habit for this week, marked done with one tap."],
        [
          "You pick one habit at a time. Weight tracking is off by default, and can stay off.",
        ],
        [
          "Been away a while? Days away don't undo the ones you did.",
          "Restart today, or pick a smaller habit.",
        ],
      ],
    },
  },
  {
    id: "aging",
    screens: [
      {
        specId: "sd_home",
        role: "home",
        title: "Stride home",
        alt: "Stride home screen. A dark card shows today's session, a ten-minute chair strength session, with a Start button. Below are an I fell card to get help or log a fall, and links to the home safety checklist, caregiver access, the movement plan, and missed sessions or a fall, plus counts of sessions this week and falls logged.",
      },
      {
        specId: "sd_session",
        role: "action",
        title: "Session player",
        alt: "Session player for an eight-minute balance session. The exercise is a heel-to-toe stand: hold the chair, place one foot in front of the other and hold ten seconds, with a seven-second countdown and a Finish session button.",
      },
      {
        specId: "sd_restart",
        role: "recovery",
        title: "Gentle restart",
        alt: "Restart screen headed: after a fall or a missed week, start gently. It says sessions you did still count, asks what happened, such as I had a fall or felt unsteady, and recommends doing the next session near a sturdy chair at your own pace, with a reminder to check with your clinician before restarting exercise after a fall.",
      },
    ],
    area: [
      "Healthy aging is about staying active, steady and independent for longer. Falls are a common concern as people get older, and losing strength and balance can make everyday tasks harder.",
      "Common contributing factors include muscle weakness, balance problems, some medicines, vision changes, long periods of sitting, and hazards at home such as loose rugs or poor lighting.",
    ],
    learnMore: [
      {
        publisher: "National Institute on Aging",
        label: "Falls and falls prevention",
        href: "https://www.nia.nih.gov/health/falls-and-falls-prevention",
      },
      {
        publisher: "National Institute on Aging",
        label: "Exercise and physical activity",
        href: "https://www.nia.nih.gov/health/exercise-and-physical-activity",
      },
    ],
    helpsWith: [
      {
        name: "Falls check",
        description:
          "A short check at the start. A fall plus feeling unsteady is added to your list of things to mention to your clinician.",
      },
      {
        name: "Weekly movement plan",
        description:
          "Short sessions on the days you choose, played one move at a time with a countdown.",
      },
      {
        name: "I fell",
        description:
          "Asks whether you are hurt, routes to emergency help, shows how to get up safely, and lets you log the fall.",
      },
      {
        name: "Home safety and caregiver access",
        description:
          "A home safety checklist, and access for one person you choose, limited to Stride and removable at any time.",
      },
    ],
    recovery: {
      screen: "Gentle restart",
      heading: "After a fall or a missed week, start gently.",
      steps: [
        {
          name: "What happened? (optional)",
          detail:
            "I had a fall, missed sessions, felt unwell, felt unsteady, or busy or away.",
        },
        {
          name: "Do my next session",
          detail:
            "The recommended next step: near a sturdy chair, at your own pace.",
        },
        {
          name: "Go over my home safety list or talk to my clinician first",
          detail:
            "Talking to your clinician is shown when you have a care team.",
        },
        {
          name: "Save and take one step",
          detail: "Sessions you did still count.",
        },
      ],
      note: "After a fall, the screen asks you to check with your clinician before you restart exercise. Hurt, a hit to the head, or not being able to get up leads to getting help now.",
    },
    video: {
      scenes: [
        ["Stride is the Tether Health program for healthy aging."],
        [
          "Home shows today's short session, with help after a fall one tap away.",
        ],
        [
          "Sessions are short and steady, one move at a time, with a chair for support.",
        ],
        [
          "After a fall or a missed week, start gently. Sessions you did still count.",
          "After a fall, check with your clinician before you restart.",
        ],
      ],
    },
  },
  {
    id: "behavioral",
    screens: [
      {
        specId: "ea_home",
        role: "home",
        title: "Ease home",
        alt: "Ease home screen. A dark card offers a 30-second mood check-in with a Start button. Below are links to my safety plan, check-back, find a professional and having a hard week, a coral Help now card with grounding, your safety plan and crisis lines, and a crisis card to call or text 988, or call 911.",
      },
      {
        specId: "ea_mood",
        role: "action",
        title: "Mood check-in",
        alt: "Mood check-in screen asking how are you right now, from very low to great, and what's going on, with choices such as work, money, family, sleep and thoughts of harming myself. A card suggests trying a two-minute grounding exercise.",
      },
      {
        specId: "ea_week",
        role: "recovery",
        title: "Hard week",
        alt: "Hard week screen headed: nothing is lost, a hard week doesn't undo anything. It says check-ins and the safety plan are still here, asks how you are and what has been hard, links to my safety plan and talk to a person, shows a crisis card, and offers a two-minute grounding tool.",
      },
    ],
    area: [
      "Mental and behavioral health includes stress, anxiety, low mood and depression, and concerns about substance use. These are common, they affect how people feel, think and cope day to day, and they are not a personal failing.",
      "Common contributing factors include ongoing stress, money or work pressure, loneliness, poor sleep, physical illness, major life changes, and family history. Support from a qualified professional can help.",
    ],
    learnMore: [
      {
        publisher: "National Institute of Mental Health",
        label: "Mental health topics",
        href: "https://www.nimh.nih.gov/health/topics",
      },
      {
        publisher: "988 Suicide & Crisis Lifeline",
        label: "988lifeline.org",
        href: "https://988lifeline.org/",
      },
    ],
    helpsWith: [
      {
        name: "Optional screener",
        description:
          "Short validated questions (PHQ-2 and GAD-2) that you can skip. The result is a prompt to talk to someone, never a diagnosis.",
      },
      {
        name: "Safety plan",
        description:
          "A plan for hard moments based on the Stanley-Brown safety plan: warning signs, what helps and who to reach. It is kept on your phone, and only you can see it.",
      },
      {
        name: "Mood check-in and grounding",
        description:
          "A 30-second check-in and a two-minute grounding tool: breathing and noticing five things you can see.",
      },
      {
        name: "Help now and check-back",
        description:
          "Grounding, your safety plan and a person, one tap from the crisis screen (988 and 911), and a check-back after two weeks.",
      },
    ],
    recovery: {
      screen: "Hard week",
      heading: "A hard week doesn’t undo anything.",
      steps: [
        {
          name: "How are you right now?",
          detail: "From very low to great.",
        },
        {
          name: "What's been hard? (optional)",
          detail:
            "Work, money, family, health, lonely, sleep, thoughts of harming myself, or not sure.",
        },
        {
          name: "My safety plan or talk to a person",
          detail: "Both are one tap away on this screen.",
        },
        {
          name: "Save and try a 2-minute grounding tool",
          detail: "Your check-ins and your safety plan are still here.",
        },
      ],
      note: "Thoughts of harming yourself: call or text 988. In an emergency, call 911. Ease is support and routing, not therapy or crisis care.",
    },
    video: {
      scenes: [
        ["Ease is the Tether Health program for mental and behavioral health."],
        [
          "Home offers a 30-second mood check-in, your own safety plan, and help right now.",
        ],
        [
          "A mood check-in asks how you are and what is going on, and can suggest a short grounding exercise.",
        ],
        [
          "A hard week doesn't undo anything.",
          "Your safety plan and a person stay one tap away. If you are in crisis, call or text 988.",
        ],
      ],
    },
  },
  {
    id: "preventive",
    screens: [
      {
        specId: "ck_list",
        role: "home",
        title: "Due list",
        alt: "Checkup due list headed three due, one to ask about. A general-guidance card for a yearly flu vaccine has Find a pharmacy and I got it buttons, followed by screenings many adults need, such as colorectal screening, a mammogram and lung cancer screening, a note that this is general guidance and to ask your clinician what is due for you, and a link for being behind on screenings.",
      },
      {
        specId: "ck_done",
        role: "action",
        title: "Mark done",
        alt: "Mark as done screen with fields for what was done (flu vaccine), the date, an optional place, an optional next due date from your clinician or pharmacist, and a remind me next year option.",
      },
      {
        specId: "ck_catchup",
        role: "recovery",
        title: "Catching up",
        alt: "Catching up screen headed: no judgment, behind on screenings? Many people are. It says nothing on your list is lost, asks what got in the way, such as cost, time or nerves, and recommends seeing the options for one screening, with a note to check screening costs with your insurer.",
      },
    ],
    area: [
      "Preventive health is about vaccines, screenings and routine checkups that can catch problems early or stop them starting. What is recommended depends on your age, sex, health history and other risk factors.",
      "Common reasons people fall behind include cost, not having time, feeling nervous, not knowing where to go, and simply forgetting.",
    ],
    learnMore: [
      {
        publisher: "U.S. Preventive Services Task Force",
        label: "Recommendations",
        href: "https://www.uspreventiveservicestaskforce.org/uspstf/",
      },
      {
        publisher: "National Cancer Institute",
        label: "Cancer screening",
        href: "https://www.cancer.gov/about-cancer/screening",
      },
    ],
    helpsWith: [
      {
        name: "A due list in one place",
        description:
          "Vaccines and screenings many adults need, grouped by what to do next. It is general guidance, not a diagnosis; your clinician says what fits you.",
      },
      {
        name: "Item detail",
        description:
          "For each item, the options there are, a note on cost, and the public guidance it comes from.",
      },
      {
        name: "Mark done",
        description:
          "Record what you had and when, and note when you'd like your next check.",
      },
      {
        name: "Screening-day prep",
        description:
          "The next appointment you entered, and what to expect on the day.",
      },
    ],
    recovery: {
      screen: "Catching up",
      heading: "Behind on screenings? Many people are.",
      steps: [
        {
          name: "What got in the way? (optional)",
          detail:
            "Cost, time, nervous about it, not sure where to go, or forgot.",
        },
        {
          name: "See my options for one screening",
          detail: "The recommended next step: pick one to start.",
        },
        {
          name: "Ask my care team which to do first",
          detail:
            "Shown when you have connected a care team. Or go back to your list.",
        },
        {
          name: "Save and take one step",
          detail: "Nothing on your list is lost.",
        },
      ],
      note: "If cost was the reason, the screen notes that screening is often covered with no cost-sharing and suggests checking with your insurer.",
    },
    video: {
      scenes: [
        ["Checkup is the Tether Health program for preventive health."],
        [
          "Your due list keeps common vaccines and screenings in one place, as general guidance to discuss with your clinician.",
        ],
        [
          "When you have one, mark it done, and note when you would like your next check.",
        ],
        [
          "Behind on screenings? Many people are, and nothing on your list is lost.",
          "Pick one to start.",
        ],
      ],
    },
  },
  {
    id: "cancer",
    screens: [
      {
        specId: "be_home",
        role: "home",
        title: "Beacon home",
        alt: "Beacon home screen on the lowering-risk journey, headed three steps that lower risk, listing quitting smoking with BreatheFree (active) and asking about genetic counseling if cancer runs in your family. Below are a card to open Checkup for screenings, and links to change the journey stage and program settings.",
      },
      {
        specId: "be_diary",
        role: "action",
        title: "Treatment diary",
        alt: "Treatment diary screen asking how are you feeling today, with a fatigue slider and choices such as nausea, pain, mouth sores, numbness and low mood. Red cards say to call the oncology team now for a fever of 100.4 degrees Fahrenheit (38 Celsius) or higher, and to call 911 for severe symptoms or an emergency.",
      },
      {
        specId: "be_setback",
        role: "recovery",
        title: "Rough patch",
        alt: "Rough patch screen headed: nothing is lost, side effects or a missed diary? That's okay. It says earlier entries are still here, asks what happened, and recommends filling in today's diary, with options to add questions for the care team or get support for how you feel, and a fever warning for people on chemotherapy.",
      },
    ],
    area: [
      "Cancer is a group of diseases in which abnormal cells grow out of control. It affects people at every stage: lowering risk, going through screening and treatment, life after treatment, and caring for someone else.",
      "Common contributing factors include tobacco use, alcohol, too much sun, carrying extra weight, low physical activity, some infections, getting older, and family history. Some risks can be changed and some cannot.",
    ],
    learnMore: [
      {
        publisher: "National Cancer Institute",
        label: "Causes and prevention",
        href: "https://www.cancer.gov/about-cancer/causes-prevention",
      },
      {
        publisher: "National Cancer Institute",
        label: "Cancer screening",
        href: "https://www.cancer.gov/about-cancer/screening",
      },
    ],
    helpsWith: [
      {
        name: "Four journeys",
        description:
          "Choose the one that fits: lowering risk, in treatment, after treatment, or caring for someone. You can change it at any time.",
      },
      {
        name: "Treatment diary",
        description:
          "A quick daily diary of how you feel, with a fever rule that says to call your oncology team now, and the care-team number you saved.",
      },
      {
        name: "Visit questions",
        description:
          "Write down questions for your care team before an appointment.",
      },
      {
        name: "Survivorship plan",
        description:
          "What to ask your care team for after treatment, kept where you can find it.",
      },
    ],
    recovery: {
      screen: "Rough patch",
      heading: "Side effects or a missed diary? That’s okay.",
      steps: [
        {
          name: "What happened? (optional)",
          detail:
            "Side effects got worse, missed my diary, missed an appointment, feeling low, or too tired.",
        },
        {
          name: "Fill in today's diary",
          detail: "The recommended next step: about a minute.",
        },
        {
          name: "Add questions for my care team or get support for how I feel",
          detail: "Support for how you feel opens the tools in Ease.",
        },
        {
          name: "Save and take one step",
          detail: "Your earlier entries are still here.",
        },
      ],
      note: "A fever of 100.4°F (38°C) or higher during chemotherapy means calling your oncology team now, day or night. Severe symptoms or an emergency mean calling 911.",
    },
    video: {
      scenes: [
        ["Beacon is the Tether Health program for cancer."],
        ["Home follows the journey you choose. Here, steps that lower risk."],
        [
          "During treatment, a quick daily diary keeps track of how you feel, and says when to call your team.",
        ],
        [
          "Side effects, or a missed diary? That's okay. Your earlier entries are still here.",
          "Start again with today's diary.",
        ],
      ],
    },
  },
];

export const programPageById = new Map(
  programPages.map((page) => [page.id, page]),
);

/** Public URL of a program's media folder. */
export const mediaBase = (id: string) => `/media/programs/${id}`;
