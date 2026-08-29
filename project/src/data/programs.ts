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
 */

import type { IconName } from "../components/Icon.astro";

export type ProgramStatus = "building" | "planned";

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
  },
  {
    id: "kidney-liver",
    area: "Kidney & liver health",
    examples: "Chronic kidney disease, fatty liver disease",
    addresses: ["Risk identification", "Monitoring", "Prevention education"],
    status: "planned",
    icon: "info",
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
  },
  {
    id: "aging",
    area: "Healthy aging",
    examples: "Mobility, cognitive health, falls",
    addresses: ["Prevention", "Monitoring", "Exercise and support programs"],
    status: "planned",
    icon: "accessibility",
  },
];

export const programCount = programs.length;
export const buildingPrograms = programs.filter((p) => p.status === "building");
export const plannedPrograms = programs.filter((p) => p.status === "planned");
