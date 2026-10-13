// Acceptance — one case per user-facing criterion, phrased as an outcome.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dist, htmlFiles } from "../helpers/dist.js";

test("safety routing appears on every page", async () => {
  // The footer carries the emergency number and both quitlines. A visitor in
  // difficulty must find them from wherever they landed.
  for (const page of await htmlFiles()) {
    const html = readFileSync(join(dist, page), "utf8");
    assert.match(html, /tel:911/, `${page} is missing the emergency number`);
    assert.match(
      html,
      /1-800-QUIT-NOW/,
      `${page} is missing the English quitline`,
    );
    assert.match(html, /1-855-D/, `${page} is missing the Spanish quitline`);
  }
});

test("no page claims the product is available to download", async () => {
  // The site is pre-launch. App-store links would be a false availability
  // claim; this fails the build if one is added before launch.
  const banned = [/apps\.apple\.com/i, /play\.google\.com/i, /itunes\.apple/i];
  for (const page of await htmlFiles()) {
    const html = readFileSync(join(dist, page), "utf8");
    for (const pattern of banned) {
      assert.ok(
        !pattern.test(html),
        `${page} links to an app store while the product is pre-launch`,
      );
    }
  }
});

test("every health area has a page, and it is honest about status", async () => {
  // Nine of the ten areas have no implementation. The page for each must not
  // read like the one area that does, so the status label is asserted per page
  // rather than assumed from the template.
  const { programs, statusLabels } = await import("../../src/data/programs.ts");
  for (const program of programs) {
    const html = readFileSync(
      join(dist, `programs/${program.id}/index.html`),
      "utf8",
    );
    assert.match(
      html,
      new RegExp(statusLabels[program.status]),
      `programs/${program.id}/ does not state its status`,
    );
    for (const service of program.services) {
      assert.ok(
        html.includes(service.name),
        `programs/${program.id}/ is missing the "${service.name}" service`,
      );
    }
    assert.ok(
      program.upcoming.length > 0,
      `${program.id} has no upcoming work listed`,
    );
  }
});

test("no health area is thinner than the others", async () => {
  // The areas are meant to read as one programme, not as one real area and
  // nine stubs. A floor of four service lines and three projects keeps a
  // half-filled area from shipping unnoticed.
  const { programs } = await import("../../src/data/programs.ts");
  for (const program of programs) {
    assert.ok(
      program.services.length >= 4,
      `${program.id} has ${program.services.length} services, floor is 4`,
    );
    assert.ok(
      program.upcoming.length >= 3,
      `${program.id} has ${program.upcoming.length} upcoming projects, floor is 3`,
    );
  }
});

test("the services page lists every service and does not read as an offer", async () => {
  const { programs } = await import("../../src/data/programs.ts");
  const html = readFileSync(join(dist, "services/index.html"), "utf8");
  for (const program of programs) {
    for (const service of program.services) {
      assert.ok(
        html.includes(service.name),
        `services page is missing "${service.name}" (${program.id})`,
      );
    }
  }
  assert.match(
    html,
    /None of them is available today/,
    "the services page does not say the services are unavailable",
  );
});

// ---------------------------------------------------------------------------
// WEB-005 — app status and waitlist wording.
//
// Owner-stated truth: BreatheFree is in development, Android first, intended
// for Google Play. The other nine areas are planned. Nothing is available to
// download or use, no testing programme has opened, and no date is promised.
// These cases scan the built HTML so a regression in any template, data file
// or inline script fails the build. The wording itself is needs-counsel.
// ---------------------------------------------------------------------------

/** Built page as one line, with hashed /_astro/ asset URLs removed. */
const pageText = (rel) =>
  readFileSync(join(dist, rel), "utf8")
    .replace(/\/_astro\/[^"'\s)]+/g, "")
    .replace(/\s+/g, " ");

/** The single sentence that may name Google Play (BreatheFree page). */
const ALLOWED_PLAY = /We intend to release it through Google Play\./g;
/** The quitline sentence is about a third-party service, not the app. */
const QUITLINE_NOW =
  /Trained quitline counsellors[^<]*they are available now\./g;

/**
 * Overclaim filters, applied to every built page. Exported shape is
 * [pattern, reason]; the self-check test below proves each sample claim is
 * caught, so a loosened pattern fails here rather than silently.
 */
const OVERCLAIMS = [
  [/coming soon/i, "implies timing"],
  [/download now|launch date/i, "launch promise"],
  [/get the app|get it on/i, "store call to action"],
  [/\binstall\b/i, "install call to action"],
  [/\bbeta\b|testing is (now )?open|\bnow open\b/i, "testing is open"],
  [/\blaunch(es|ed|ing)?\b/i, "launch wording"],
  [/\breleas(e|ing) in\b/i, "release timing"],
  [/\bavailable on (android|google play)\b/i, "availability claim"],
  [/\b(iphone|ios|app store|testflight)\b/i, "Apple platform promise"],
  [
    /play\.google\.com|market:\/\/|apps\.apple\.com|itunes\.apple/i,
    "store link",
  ],
  [/Google Play/i, "store presence beyond the one allowed intent sentence"],
  [
    /"@type":"(SoftwareApplication|MobileApplication)"|downloadUrl|installUrl/,
    "app structured data",
  ],
  [
    /Nothing is built|no implementation/i,
    "contradicts the planned/scaffold status",
  ],
  // Spec A7: no month, season or year near a status verb.
  [
    /\b(20[2-3]\d|spring|summer|autumn|fall|winter|january|february|march|april|june|july|august|september|october|november|december)\b[^.<]{0,40}\b(launch|release|available|open)|\b(launch|release|available|open)[^.<]{0,40}\b(20[2-3]\d|spring|summer|autumn|winter|january|february|march|april|june|july|august|september|october|november|december)\b/i,
    "date or season near status wording",
  ],
];

/** Claims the filters above must catch (reviewer's sample set). */
const SAMPLE_CLAIMS = [
  "Get it on Google Play",
  "Now on Google Play",
  "Available on Android",
  "Install BreatheFree today",
  "BreatheFree will launch in 2027",
  "Releasing in spring",
  "Testing is now open",
  "Join our beta",
  "ios app soon",
];

/**
 * Counsel-owned retention sentence on the privacy notice (privacy.astro:88).
 * Remove this exemption when counsel updates the page.
 */
const PRIVACY_RETENTION = /until the relevant product has launched/g;

/** Text a page may contain even though a filter would otherwise match. */
function scrub(text) {
  return text
    .replace(ALLOWED_PLAY, "")
    .replace(QUITLINE_NOW, "")
    .replace(PRIVACY_RETENTION, "");
}

test("the overclaim filters catch every sample claim", () => {
  for (const claim of SAMPLE_CLAIMS) {
    const text = scrub(`<p>${claim}</p>`);
    assert.ok(
      OVERCLAIMS.some(([pattern]) => pattern.test(text)),
      `no filter catches: ${claim}`,
    );
  }
});

test("no page overclaims availability, timing, platforms or a store presence", () => {
  for (const page of htmlFiles()) {
    const text = scrub(pageText(page));
    for (const [pattern, why] of OVERCLAIMS) {
      assert.ok(!pattern.test(text), `${page} matches ${pattern} (${why})`);
    }
  }
});

test("store badges and store assets are not present", () => {
  for (const page of htmlFiles()) {
    const html = readFileSync(join(dist, page), "utf8");
    for (const tag of html.match(/<(img|a|source)\b[^>]*>/gi) ?? []) {
      assert.ok(
        !/badge|google-play|app-store|play-store/i.test(tag),
        `${page} has a store badge or asset: ${tag}`,
      );
    }
  }
});

// "early access" implied a programme nobody has confirmed. Privacy and terms
// are counsel-owned legal text and are deliberately not edited by WEB-005.
const EARLY_ACCESS_EXEMPT = new Set(["privacy/index.html", "terms/index.html"]);

test("'early access' is gone everywhere except counsel-owned pages", () => {
  for (const page of htmlFiles()) {
    if (EARLY_ACCESS_EXEMPT.has(page)) continue;
    assert.ok(
      !/early[\s-]access/i.test(pageText(page)),
      `${page} still says "early access" (implies an access programme)`,
    );
  }
});

test("the 'early access' exemption is still needed", () => {
  // Remove this exemption when counsel updates the page.
  for (const page of EARLY_ACCESS_EXEMPT) {
    assert.ok(
      /early[\s-]access/i.test(pageText(page)),
      `${page} no longer says "early access": remove it from EARLY_ACCESS_EXEMPT`,
    );
  }
});

test("'download' appears only as a negated availability statement", () => {
  const negated = /not (yet )?available to download( yet| or use)?/gi;
  for (const page of htmlFiles()) {
    const leftover = pageText(page).replace(negated, "");
    assert.ok(
      !/download/i.test(leftover),
      `${page} uses "download" other than to say it is not available`,
    );
  }
});

test("'available now' only refers to the third-party quitlines", () => {
  for (const page of htmlFiles()) {
    assert.ok(
      !/available now/i.test(pageText(page).replace(QUITLINE_NOW, "")),
      `${page} says "available now" outside the quitline sentence`,
    );
  }
});

test("'Google Play' appears once, as an intent, on the BreatheFree page only", () => {
  for (const page of htmlFiles()) {
    const count = (pageText(page).match(/Google Play/gi) ?? []).length;
    assert.equal(
      count,
      page === "breathefree/index.html" ? 1 : 0,
      `${page} names Google Play ${count} time(s)`,
    );
  }
  assert.match(
    pageText("breathefree/index.html"),
    ALLOWED_PLAY,
    "the Play mention must be the intent-only sentence",
  );
});

test("one Android-first sentence is used on the BreatheFree surfaces", () => {
  const sentence = "BreatheFree is in development for Android first.";
  assert.ok(
    pageText("index.html").includes("In development — Android first"),
    "home page lacks the status line",
  );
  for (const page of [
    "breathefree/index.html",
    "support/index.html",
    "programs/tobacco/index.html",
  ]) {
    assert.ok(pageText(page).includes(sentence), `${page} lacks: ${sentence}`);
  }
  assert.ok(
    pageText("breathefree/index.html").includes(
      `${sentence} It is not available to download yet.`,
    ),
    "BreatheFree page lacks the not-available line",
  );
  const description = pageText("index.html").match(
    /<meta name="description" content="([^"]*)"/,
  )?.[1];
  assert.ok(
    description?.includes("in development for Android first"),
    "home meta description lacks the Android-first status",
  );
});

test("the waitlist is called a waitlist on the pages that carry it", () => {
  for (const page of [
    "index.html",
    "breathefree/index.html",
    "support/index.html",
  ]) {
    assert.ok(
      pageText(page).includes("Join the waitlist"),
      `${page} lacks "Join the waitlist"`,
    );
  }
});

test("the support FAQ explains how to join the testing list, without saying testing is open", () => {
  const html = pageText("support/index.html");
  for (const q of [
    "Can I use BreatheFree today?",
    "How do I join the testing list?",
    "What about other platforms and the other health areas?",
  ]) {
    assert.equal(
      html.split(q).length - 1,
      1,
      `support FAQ must contain "${q}" exactly once`,
    );
  }
  for (const clause of [
    "say in the message box that you would like to test BreatheFree on Android",
    "Testing has not opened yet.",
    "Joining does not guarantee a place.",
  ]) {
    assert.ok(html.includes(clause), `testing-list answer lacks: ${clause}`);
  }
  assert.ok(html.includes('id="testing-list"'), "the FAQ answer has no anchor");
  assert.ok(html.includes('id="waitlist"'), "support has no waitlist anchor");
  assert.ok(
    pageText("breathefree/index.html").includes(
      'href="/support/#testing-list"',
    ),
    "the BreatheFree page does not link to the testing-list FAQ",
  );
});

test("the nine non-BreatheFree areas are described as planned and not available to use", async () => {
  const { programs } = await import("../../src/data/programs.ts");
  const planned = programs.filter((p) => p.status === "planned");
  assert.equal(planned.length, 9, "expected nine planned areas");
  for (const program of planned) {
    assert.ok(
      pageText(`programs/${program.id}/index.html`).includes(
        "is planned. Nothing is available to use.",
      ),
      `programs/${program.id}/ lacks the planned / not available wording`,
    );
  }
  assert.ok(
    pageText("programs/index.html").includes("Planned. Not available to use."),
  );
  assert.ok(
    pageText("services/index.html").includes(
      "nine are planned. None is available to use.",
    ),
  );
});
