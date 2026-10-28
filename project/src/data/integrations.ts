/**
 * Health-record integrations and the standards beneath them.
 *
 * Owner-stated (2026-10-27): Tether Health is working in the CMS Blue Button
 * and Epic FHIR sandboxes and is adopting FHIR, SMART on FHIR, and HIPAA- and
 * FDA-aligned practice. Neither integration has production access, so every
 * line here describes work we are doing, never a live connection. P-110:
 * record import is coming in the app (Epic, Medicare Blue Button, Apple
 * Health, Health Connect); it is opt-in, and records are reviewed before
 * anything is added. It is not available today. Do not write
 * "integrated with", "HIPAA compliant", "FDA approved", "FDA cleared" or "FDA
 * compliant": nothing in this repository evidences any of them, and
 * test/acceptance/regulatory-claims.test.js fails the build if one appears.
 *
 * No CMS, Epic or HL7 logo is used anywhere. Their names appear in text only,
 * with the trademark notice below, and nothing suggests endorsement — Epic's
 * developer terms in particular forbid implying a partnership from sandbox
 * access. The Blue Button API is named without a version number because the
 * current version could not be verified when this was written.
 */

import type { IconName } from "../components/Icon.astro";

export interface Integration {
  icon: IconName;
  title: string;
  body: string;
}

/** The four-card summary on the home page. */
export const integrationHighlights: Integration[] = [
  {
    icon: "globe",
    title: "Open standards",
    body: "HL7® FHIR® and SMART on FHIR, the standards US health records use to share data.",
  },
  {
    icon: "shield",
    title: "CMS Blue Button API",
    body: "We are building the connection so people with Medicare can bring in their claims data, signing in with Medicare rather than with us.",
  },
  {
    icon: "stethoscope",
    title: "Epic FHIR APIs",
    body: "We are building the connection so patients of health systems that use Epic can bring in their records through their own patient sign-in.",
  },
  {
    icon: "lock",
    title: "Opt-in, reviewed first",
    body: "Coming in the app. Import stays off until you turn it on, and you review what came in before anything is added.",
  },
];

/** The detailed cards on /integrations/. */
export const integrations: Integration[] = [
  {
    icon: "globe",
    title: "HL7® FHIR®",
    body: "FHIR is the standard US health records use to describe and exchange clinical data — conditions, medications, results and claims — in a form any compliant system can read. We are building Tether Health's health-record features on FHIR so that what you bring in stays in a standard, portable shape.",
  },
  {
    icon: "lock",
    title: "SMART on FHIR",
    body: "SMART on FHIR is how an app asks for permission to read a record. You sign in with the organisation that holds your data, see exactly what Tether Health is asking to read, and approve or decline. We never see your password for that organisation: SMART on FHIR is built on OAuth 2.0, so the sign-in happens with them, not with us.",
  },
  {
    icon: "shield",
    title: "CMS Blue Button API",
    body: "Blue Button is the Centers for Medicare & Medicaid Services' API for Medicare claims data. We are building our connection in the CMS sandbox, so that people with Medicare can choose to bring their claims history into Tether Health by signing in with Medicare. Coming in the app.",
  },
  {
    icon: "stethoscope",
    title: "Epic FHIR APIs",
    body: "Many US health systems run Epic. We are building our connection to Epic's FHIR APIs in Epic's sandbox, so that patients of those health systems can choose to bring their records into Tether Health through their own patient sign-in. Coming in the app.",
  },
  {
    icon: "phone",
    title: "Apple Health and Health Connect",
    body: "On your phone, the records you already keep in Apple Health or Android's Health Connect will be importable too — only after your phone asks your permission and you agree. Coming in the app.",
  },
];

/** Privacy and regulatory commitments, worded as commitments. */
export const commitments: Integration[] = [
  {
    icon: "lock",
    title: "Designing for HIPAA's requirements",
    body: "Health information is encrypted in transit; record import is opt-in and you review every item before it is added. Our HIPAA program, including agreements with any partner that handles health information, is being reviewed with counsel before we connect real records.",
  },
  {
    icon: "stethoscope",
    title: "Designed with FDA digital health guidance in mind",
    body: "Tether Health programs educate and support self-management. They do not diagnose, treat or prescribe, and they never select a medicine or change a dose. We are building with FDA's digital health guidance in mind, and we keep the line between useful information and medical advice where it belongs.",
  },
  {
    icon: "eye-off",
    title: "Read-only, consent-first",
    body: "When import arrives, a connection will read only what you approve, only after you approve it, and nothing is added until you have reviewed it. We will not write to your health record, we do not sell health data, and you will be able to disconnect a source and ask us to delete what came from it.",
  },
  {
    icon: "users",
    title: "Your clinician stays in charge",
    body: "Records you bring in help you understand your own picture and prepare for appointments. Decisions about your care stay with you and your clinician.",
  },
];

/** Shown in full wherever the names above appear in quantity. */
export const trademarkNotice =
  "HL7® and FHIR® are registered trademarks of Health Level Seven International, and their use does not constitute endorsement by HL7. Epic is a trademark of Epic Systems Corporation. Blue Button® is a registered mark of the U.S. Department of Health and Human Services. Apple Health is a trademark of Apple Inc. Health Connect is a trademark of Google LLC. Naming these standards and services describes the technology we are building with; it does not imply endorsement by, or partnership with, any of their owners.";
