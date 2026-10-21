// Acceptance — what the site says about the app matches what exists today.
//
// The app is in development and its design is still changing. Features the
// design includes (screen-reader labels, larger text, a Spanish option,
// audio lessons) are described as designed or planned, not as things the app
// does; the BreatheFree screens on this site are design artwork; there is no
// review process the site can point to as a gate; no claim is made about
// the strength of the evidence behind the content; and the site says nothing
// about using the app offline or without a connection.
//
// Scope: the whole built HTML of every page (text, attributes and meta tags),
// on one line, against the phrase families below. Offline wording fails
// however it is phrased, hedged or not. For the other families a claim counts
// as hedged when "designed", "planned", "intend" or "must" comes earlier in
// the same sentence, within 80 characters, or when "not" (or "not yet")
// directly precedes it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { htmlFiles, readPage } from "../helpers/dist.js";

/** Built page as one line, with hashed /_astro/ asset URLs removed. */
const pageText = (rel) =>
  readPage(rel)
    .replace(/\/_astro\/[^"'\s)]+/g, "")
    .replace(/\s+/g, " ");

const HEDGE =
  String.raw`(?<!\b(?:designed|planned|intend(?:ed|s)?|must)\b[^.<]{0,80})` +
  String.raw`(?<!\bnot\s+(?:yet\s+)?)`;
const unhedged = (source) => new RegExp(`${HEDGE}(?:${source})`, "i");

/** [pattern, reason]. */
const CLAIMS = [
  // The tour and other screen artwork.
  [
    /\bcomplete\s+(?:approved|designed|finished)\s+(?:\w+\s+)?experience\b/i,
    "complete approved experience",
  ],
  [
    /\b(?:same|identical|exact)\s+(?:artwork|screens?|images?|pixels?)\b[^.<]{0,60}\b(?:app|application)\b/i,
    "artwork presented as the app's own rendering",
  ],
  [
    unhedged(
      String.raw`\b(?:real|actual|live)\s+(?:app\s+)?screenshots?\b|\bscreenshots?\s+(?:from|of)\s+the\s+(?:live\s+|real\s+)?app(?:lication)?\b`,
    ),
    "screens presented as screenshots",
  ],
  // Offline use, with no hedge.
  [/\boff[- ]?line\b/i, "offline wording"],
  [
    new RegExp(
      String.raw`\b(?:no|without|even\s+with(?:out)?)\s+(?:a\s+|an\s+|any\s+)?(?:mobile\s+|cell(?:ular)?\s+|phone\s+)?` +
        String.raw`(?:signal|reception|coverage|internet|wi-?fi|connectivity|connection|(?:network|data)\s+connection)\b` +
        String.raw`|\b(?:wait|waiting)\s+for\s+(?:a\s+)?(?:signal|connection)\b` +
        String.raw`|\b(?:airplane|aeroplane|flight)\s+mode\b` +
        String.raw`|\b(?:works?|working|available|usable|runs?)\s+anywhere\b|\balways\s+available\b`,
      "i",
    ),
    "use without a connection",
  ],
  // Accessibility and language, in the present tense.
  [
    unhedged(
      String.raw`\b(?:screen[- ]reader|voiceover|talkback)\s+support\b|\b(?:supports?|works\s+with|compatible\s+with)\s+(?:screen[- ]readers?|voiceover|talkback)\b`,
    ),
    "screen-reader support stated as present",
  ],
  [
    unhedged(
      String.raw`\b(?:supports?|with)\s+(?:text[- ]scaling|reduced[- ]motion|dynamic\s+type|large\s+text)\b|\b(?:reduced[- ]motion|text[- ]scaling)\s+support\b`,
    ),
    "display settings support stated as present",
  ],
  [
    unhedged(
      String.raw`\b(?:available|offered|written|delivered|translated)\s+in\s+(?:english\s+and\s+)?spanish\b|\bspanish\s+(?:alongside|as\s+well\s+as)\s+english\b|\bbilingual\b`,
    ),
    "Spanish stated as present",
  ],
  [
    new RegExp(
      String.raw`(?<=\b(?:lessons?|content|education|app|application|screens?)\b[^.<]{0,80})` +
        HEDGE +
        String.raw`\bin\s+english\s+and\s+spanish\b`,
      "i",
    ),
    "Spanish content stated as present",
  ],
  [
    unhedged(
      String.raw`\bwith\s+audio\b|\baudio\s+(?:lessons|versions?|and\s+transcripts|guidance)\b`,
    ),
    "audio stated as present",
  ],
  // Process and evidence.
  [
    /\brelease[- ]gates?\b|\bgated\s+release\b|\b(?:nothing|no\s+product|no\s+release)\s+ships\b|\bship-blocking\b/i,
    "review presented as a release gate",
  ],
  [
    /\bevidence[- ](?:informed|based|led|backed|driven)\b|\bclinically\s+(?:proven|validated|tested|reviewed|approved)\b|\bscientifically\s+(?:proven|backed|validated)\b|\bproven\s+to\b/i,
    "claim about the evidence behind the content",
  ],
];

/** Wording each family must catch, including paraphrases. */
const SAMPLES = [
  "This is the complete approved BreatheFree experience.",
  "A complete designed onboarding experience.",
  "Every screen here is the same artwork the application itself renders.",
  "Identical screens to the ones in the app.",
  "Real screenshots from the app.",
  "Quick tools that work anywhere",
  "Rescue works offline.",
  "Tether will work offline.",
  "Core support tools are designed to work offline.",
  "Offline use has not yet been tested.",
  "Available without a signal.",
  "Offline-first craving tools.",
  "No signal needed.",
  "Help even with no internet.",
  "The hardest moments do not wait for a signal.",
  "Works in airplane mode.",
  "Always available, day or night.",
  "The app will support VoiceOver.",
  "It is not finished, but it supports VoiceOver.",
  "Plain language and screen-reader support.",
  "BreatheFree supports VoiceOver and TalkBack.",
  "Works with screen readers.",
  "With text-scaling and reduced-motion support.",
  "Spanish alongside English.",
  "Lessons are available in Spanish.",
  "A bilingual app.",
  "Short lessons on cravings and sleep — in English and Spanish.",
  "Every lesson comes with audio and transcripts.",
  "Audio lessons for every topic.",
  "Clinical review is a release gate.",
  "These are release gates.",
  "No product ships until review is complete.",
  "Calm, evidence-informed digital health tools.",
  "Evidence-based support.",
  "Clinically proven to help.",
];

/** Hedged or unrelated wording the families must leave alone. */
const ALLOWED = [
  "Core support tools are designed to work one-handed.",
  "Designed for plain language, screen readers, larger text, and a choice of English or Spanish.",
  "Short lessons on cravings, designed to be offered in English and Spanish, with audio and transcripts.",
  "Quitlines in English and Spanish, your named supporter, a quit coach.",
  "Before release it must support VoiceOver, TalkBack and reduced motion.",
  "They are design artwork, not screenshots of a released app.",
  "BreatheFree does not yet support VoiceOver.",
  "Nothing is sent anywhere until you preview it and confirm.",
  "Where the evidence is settled.",
];

/**
 * Counsel-owned legal text, unchanged by this suite: page → wording that
 * stays until counsel revises it. Each entry is stale-checked below.
 */
const COUNSEL_OWNED = new Map([
  ["security/index.html", /These are release gates\./g],
]);

const hits = (text) =>
  CLAIMS.filter(([pattern]) => pattern.test(text)).map(([, why]) => why);

test("the claim families catch every sample and leave hedged wording alone", () => {
  for (const sample of SAMPLES)
    assert.ok(hits(sample).length > 0, `not caught: ${sample}`);
  for (const sample of ALLOWED)
    assert.deepEqual(hits(sample), [], `wrongly caught: ${sample}`);
});

test("no page states a product claim beyond what exists today", () => {
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

test("the tour presents its screens as design artwork", () => {
  const text = pageText("breathefree/tour/index.html");
  assert.ok(
    text.includes("They are design artwork, not screenshots of a released app"),
    "the tour no longer says its screens are design artwork",
  );
});
