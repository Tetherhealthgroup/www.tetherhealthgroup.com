// Acceptance — what the site says about regulation, integrations and partners.
//
// Owner-stated (2026-10-27): Tether Health is working in the CMS Blue Button
// and Epic FHIR sandboxes and adopting FHIR, SMART on FHIR, and HIPAA- and
// FDA-aligned practice. None of that is a certification, a clearance or a live
// connection, and nothing in this repository evidences one. So the site may
// say "designed to meet HIPAA's requirements" and "building connections to
// Epic", and may not say "HIPAA compliant", "FDA cleared" or "integrated with
// Epic". See src/data/integrations.ts.
//
// Scope: the visible text and attributes of every built page.

import { test } from "node:test";
import assert from "node:assert/strict";
import { htmlFiles, readPage } from "../helpers/dist.js";

const pageText = (rel) =>
  readPage(rel)
    .replace(/\/_astro\/[^"'\s)]+/g, "")
    .replace(/\s+/g, " ");

const CLAIMS = [
  [
    /\bHIPAA[- ](?:compliant|certified|approved|accredited)\b|\bcompl(?:y|ies|iant)\s+with\s+HIPAA\b|\bHIPAA\s+compliance\s+(?:achieved|certified)\b/i,
    "HIPAA compliance claimed",
  ],
  [
    /\bFDA[- ](?:approved|cleared|certified|compliant|registered|authori[sz]ed)\b|\b(?:approved|cleared|authori[sz]ed)\s+by\s+(?:the\s+)?FDA\b|\bcompl(?:iant|ies)\s+with\s+(?:the\s+)?FDA\b/i,
    "FDA status claimed",
  ],
  [
    /\b(?:integrated|integrates|connected|connects)\s+with\s+(?:the\s+)?(?:Epic|CMS|Medicare|Blue Button)\b|\b(?:live|production)\s+(?:on|with)\s+(?:Epic|Blue Button)\b/i,
    "live integration claimed",
  ],
  [
    /\b(?:partner(?:ed|s|ship)?|endorsed|certified|approved)\s+(?:with|by)\s+(?:Epic|CMS|HL7|Medicare|HHS)\b|\bEpic[- ](?:approved|certified|partner)\b|\bofficial\s+(?:Epic|CMS|Medicare)\s+partner\b/i,
    "partnership or endorsement claimed",
  ],
  [
    /(?<!\bso\s+(?:that\s+)?[^.<]{0,60})\b(?:can|may)\s+(?:now\s+)?(?:choose\s+to\s+)?(?:connect|link|import|bring\s+in)\b[^.<]{0,80}\b(?:Medicare|Epic|Blue Button|claims data|records)\b/i,
    "connection presented as available today",
  ],
  [/\bBlue Button\s+(?:[23]\.0|v[23])\b/i, "unverified Blue Button version"],
  [/\bSOC\s*2\b|\bHITRUST\b|\bISO\s*27001\b/i, "unevidenced certification"],
];

const SAMPLES = [
  "Tether Health is HIPAA compliant.",
  "A HIPAA-certified platform.",
  "We comply with HIPAA.",
  "FDA-cleared digital therapeutic.",
  "Approved by the FDA.",
  "FDA compliant software.",
  "Integrated with Epic.",
  "Connects with Medicare today.",
  "Live on Epic.",
  "Partnered with Epic.",
  "Endorsed by CMS.",
  "An Epic-approved app.",
  "Built on Blue Button 3.0.",
  "SOC 2 Type II certified.",
  "People with Medicare can choose to connect their claims data.",
  "You can now import your Epic records.",
];

const ALLOWED = [
  "Designed to meet HIPAA's requirements",
  "Designed with FDA digital health guidance in mind",
  "We are building connections to the CMS Blue Button API",
  "We are building our connection to Epic's FHIR APIs in Epic's sandbox",
  "it does not imply endorsement by, or partnership with, any of their owners",
  "We are building the connection so people with Medicare can bring in their claims data",
];

/**
 * Counsel-owned legal text, unchanged by this suite: page → wording that stays
 * until counsel revises it. The app privacy policy draft names "Medicare Blue
 * Button 2.0"; the owner has since referred to a 3.0 gateway, and which is
 * current is Unknown. Each entry is stale-checked below.
 */
const COUNSEL_OWNED = new Map([
  [
    "app-privacy/index.html",
    /Medicare Blue Button 2\.0|You can choose to connect your health records\./g,
  ],
]);

const hits = (text) =>
  CLAIMS.filter(([pattern]) => pattern.test(text)).map(([, why]) => why);

test("the regulatory claim families catch every sample and allow the commitments", () => {
  for (const sample of SAMPLES)
    assert.ok(hits(sample).length > 0, `not caught: ${sample}`);
  for (const sample of ALLOWED)
    assert.deepEqual(hits(sample), [], `wrongly caught: ${sample}`);
});

test("no page claims a certification, clearance, live integration or partnership", () => {
  const offenders = [];
  for (const page of htmlFiles()) {
    let text = pageText(page);
    if (COUNSEL_OWNED.has(page))
      text = text.replace(COUNSEL_OWNED.get(page), "");
    for (const why of hits(text)) offenders.push(`${page}: ${why}`);
  }
  assert.deepEqual(offenders, []);
});

test("each counsel-owned exemption still matches its page", () => {
  for (const [page, pattern] of COUNSEL_OWNED)
    assert.match(
      pageText(page),
      pattern,
      `${page} changed: remove its entry from COUNSEL_OWNED`,
    );
});

test("no page uses a CMS, Epic, HL7 or Blue Button logo", () => {
  for (const page of htmlFiles()) {
    for (const tag of readPage(page).match(/<(?:img|source|svg)\b[^>]*>/gi) ??
      []) {
      assert.ok(
        !/epic|cms|hl7|fhir|blue-?button|medicare/i.test(tag),
        `${page} has a third-party mark: ${tag}`,
      );
    }
  }
});

test("the integrations page carries the trademark and non-endorsement notice", () => {
  const text = pageText("integrations/index.html");
  for (const phrase of [
    "registered trademarks of Health Level Seven International",
    "Epic is a trademark of Epic Systems Corporation",
    "does not imply endorsement by, or partnership with",
  ])
    assert.ok(text.includes(phrase), `integrations page lacks: ${phrase}`);
});
