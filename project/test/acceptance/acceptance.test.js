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

test("every health area has a page listing all of its services", async () => {
  const { programs } = await import("../../src/data/programs.ts");
  for (const program of programs) {
    const html = readFileSync(
      join(dist, `programs/${program.id}/index.html`),
      "utf8",
    );
    for (const service of program.services) {
      assert.ok(
        html.includes(service.name),
        `programs/${program.id}/ is missing the "${service.name}" service`,
      );
    }
  }
});

test("no health area is thinner than the others", async () => {
  // The areas are meant to read as one product, not as one real area and
  // ten stubs. A floor of four service lines keeps a half-filled area from
  // shipping unnoticed.
  const { programs } = await import("../../src/data/programs.ts");
  for (const program of programs) {
    assert.ok(
      program.services.length >= 4,
      `${program.id} has ${program.services.length} services, floor is 4`,
    );
  }
});

test("the services page lists every service and keeps the medical boundary", async () => {
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
    /None diagnoses, treats\s+or prescribes/,
    "the services page no longer states the medical boundary",
  );
});

// ---------------------------------------------------------------------------
// Product presentation and availability wording.
//
// Owner direction (2026-10-27): present the site as a finished product. No
// development-status language, no status badges, and early access as the one
// call to action. What has NOT changed is the fact underneath: nothing is
// released, so nothing may be presented as downloadable, installable, live or
// available now, no store may be named or linked, and no date is promised.
// These cases scan the built HTML so a regression in any template, data file
// or inline script fails the build.
// ---------------------------------------------------------------------------

/** Built page as one line, with hashed /_astro/ asset URLs removed. */
const pageText = (rel) =>
  readFileSync(join(dist, rel), "utf8")
    .replace(/\/_astro\/[^"'\s)]+/g, "")
    .replace(/\s+/g, " ");

/** Visible text only: scripts, styles and tags removed. */
const visibleText = (rel) =>
  pageText(rel)
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

/** The quitline sentence is about a third-party service, not the app. */
const QUITLINE_NOW =
  /Trained quitline counsellors[^<]*they are available now\./g;

/**
 * Overclaim filters, applied to every built page. Shape is [pattern, reason];
 * the self-check test below proves each sample claim is caught, so a loosened
 * pattern fails here rather than silently.
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
  [/Google Play/i, "store presence"],
  [/\bplay\s?store\b/i, "store presence"],
  [
    /(?<!\b(?:not|none|no|nothing)\b[^.<]{0,60})(?:\bnow\s+available\b|\bout\s+now\b|\b(?:breathefree|app|application|it)\s+(?:is\s+)?available\s+(?:today|now)\b)/i,
    "availability claim",
  ],
  [
    /\bready\s+to\s+(?:use|download)\b|\b(?:start|begin)\s+using\s+(?:it|breathefree|the\s+app)\b|(?<!\b(?:can|could)\s+(?:i|you)\s+)\buse\s+(?:it|breathefree|the\s+app)\s+(?:today|now)\b/i,
    "availability claim",
  ],
  [
    /\b(?:app|breathefree)\s+is\s+(?:now\s+)?(?:live|out)\b/i,
    "availability claim",
  ],
  [
    /\btesting\s+(?:has\s+)?(?:begun|started|is\s+underway)\b|\b(?:now\s+)?accepting\s+testers\b|\bjoin\s+(?:the\s+)?(?:test(?:ing)?|pilot)\s+(?:now|today)\b|\bopen\s+(?:beta|testing|pilot)\b/i,
    "testing is open",
  ],
  [
    /"@type":"(SoftwareApplication|MobileApplication)"|downloadUrl|installUrl/,
    "app structured data",
  ],
  // No month, season or year near a status verb.
  [
    /\b(20[2-3]\d|spring|summer|autumn|fall|winter|january|february|march|april|june|july|august|september|october|november|december)\b[^.<]{0,40}\b(launch|release|available|open)|\b(launch|release|available|open)[^.<]{0,40}\b(20[2-3]\d|spring|summer|autumn|winter|january|february|march|april|june|july|august|september|october|november|december)\b/i,
    "date or season near status wording",
  ],
];

/** Claims the filters above must catch (sample set). */
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
  "Now available for Android",
  "BreatheFree is available today",
  "Out now",
  "Ready to use",
  "Start using BreatheFree this week",
  "Use the app today",
  "The app is now live",
  "Testing has begun",
  "Now accepting testers",
  "Join the pilot now",
  "Open testing for everyone",
  "Find us on the Play Store",
];

/**
 * Counsel-owned retention sentence on the privacy notice (privacy.astro:88).
 * Remove this exemption when counsel updates the page.
 */
const PRIVACY_RETENTION = /until the relevant product has launched/g;

/**
 * P-108 (owner decision): a beta waitlist for the mobile app, at /beta/. The
 * beta pages, the privacy notice's beta section and the security page's note
 * on the form's handler may name the beta, iPhone and TestFlight, because the
 * form asks which phone someone uses. Every other page may name it only as
 * "beta waitlist" or a link to /beta/. All other filters still apply to these
 * pages: no dates, no availability, no store presence.
 */
const BETA_WORDING_PAGES = new Set([
  "beta/index.html",
  "beta/thanks/index.html",
  "beta/confirmed/index.html",
  "privacy/index.html",
  "security/index.html",
]);
const BETA_CTA = /\bbeta waitlist\b|href="\/beta\/"/gi;
const BETA_WORDS = /\bbeta\b|\biPhone\b|\bTestFlight\b/gi;

/** Text a page may contain even though a filter would otherwise match. */
function scrub(text, page = "") {
  const scrubbed = text
    .replace(QUITLINE_NOW, "")
    .replace(PRIVACY_RETENTION, "")
    .replace(BETA_CTA, "");
  return BETA_WORDING_PAGES.has(page)
    ? scrubbed.replace(BETA_WORDS, "")
    : scrubbed;
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
    const text = scrub(pageText(page), page);
    for (const [pattern, why] of OVERCLAIMS) {
      assert.ok(!pattern.test(text), `${page} matches ${pattern} (${why})`);
    }
  }
});

test("beta wording outside the beta pages is still caught", () => {
  // The exemption is scoped: the same words on any other page still fail.
  for (const claim of ["Join our beta", "Test it on iPhone", "Via TestFlight"])
    assert.ok(
      OVERCLAIMS.some(([pattern]) =>
        pattern.test(scrub(`<p>${claim}</p>`, "index.html")),
      ),
      `not caught outside the beta pages: ${claim}`,
    );
  // On the beta pages the other filters still apply.
  for (const claim of ["The beta is now open", "Beta launch in spring"])
    assert.ok(
      OVERCLAIMS.some(([pattern]) =>
        pattern.test(scrub(`<p>${claim}</p>`, "beta/index.html")),
      ),
      `not caught on the beta page: ${claim}`,
    );
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

test("'download' does not appear on any page", () => {
  for (const page of htmlFiles()) {
    assert.ok(
      !/download/i.test(pageText(page)),
      `${page} uses "download" while nothing is released`,
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

/**
 * Development-status wording the owner asked to remove, in visible text. The
 * app's own status labels are included verbatim, so a badge reintroduced from
 * data/programs.ts statusLabels fails here.
 */
const DEV_STATUS = [
  [/Approved · in build|Prototype on develop/, "app status label"],
  [/\b(?:Proposed|Planned)\b(?=\s*(?:<|$|\.|·))/, "app status label"],
  [/\bin development\b|\bin build\b|\bin design\b/i, "development status"],
  [/\bprototypes?\b/i, "prototype wording"],
  [/not (?:yet )?available to (?:use|download)/i, "not-available notice"],
  [/\bnothing is available\b/i, "not-available notice"],
  [/testing has not opened/i, "testing status notice"],
  [/\bwaitlist\b/i, "waitlist wording (the call to action is early access)"],
  [/\broadmap\b/i, "roadmap wording"],
];

/**
 * Counsel-owned legal pages keep their text until counsel revises it: the
 * terms still say "Products described here are in development".
 */
const DEV_STATUS_EXEMPT = new Set(["terms/index.html", "privacy/index.html"]);

test("no page presents development status", () => {
  const offenders = [];
  for (const page of htmlFiles()) {
    if (DEV_STATUS_EXEMPT.has(page)) continue;
    const text = visibleText(page);
    for (const [pattern, why] of DEV_STATUS)
      if (pattern.test(text)) offenders.push(`${page}: ${why}`);
  }
  assert.deepEqual(offenders, []);
});

test("early access is the call to action in the header and on the pages with the form", () => {
  for (const page of htmlFiles()) {
    const header = pageText(page).match(/<header[\s\S]*?<\/header>/)?.[0];
    if (!header) continue;
    assert.ok(
      header.includes("Get early access"),
      `${page}: header lacks "Get early access"`,
    );
  }
  for (const page of [
    "index.html",
    "breathefree/index.html",
    "support/index.html",
  ]) {
    assert.ok(
      visibleText(page).includes("Request early access"),
      `${page} lacks "Request early access"`,
    );
  }
});

test("the support FAQ explains early access and testing, without saying testing is open", () => {
  const html = pageText("support/index.html");
  for (const q of [
    "How do I get BreatheFree?",
    "How do I join the testing list?",
    "What about other platforms and the other health areas?",
  ]) {
    assert.equal(
      html.split(q).length - 1,
      1,
      `support FAQ must contain "${q}" exactly once`,
    );
  }
  // P-108: testers join the beta waitlist at /beta/, not the email form.
  const answer = html.match(/<div id="testing-list">[\s\S]*?<\/div>/)?.[0];
  assert.ok(answer, "the testing-list answer is missing");
  assert.match(answer, /href="\/beta\/"/, "the answer does not link to /beta/");
  for (const clause of [
    "We cannot promise a date,",
    "joining does not guarantee a place.",
  ]) {
    assert.ok(answer.includes(clause), `testing-list answer lacks: ${clause}`);
  }
  assert.doesNotMatch(
    answer,
    /message box/,
    "the answer still sends testers to the email form",
  );
  assert.ok(html.includes('id="testing-list"'), "the FAQ answer has no anchor");
  assert.ok(html.includes('id="waitlist"'), "support has no form anchor");
  assert.ok(
    pageText("breathefree/index.html").includes(
      'href="/support/#testing-list"',
    ),
    "the BreatheFree page does not link to the testing-list FAQ",
  );
});

test("no page still says testing has not opened, and home invites testers to /beta/", () => {
  for (const page of htmlFiles())
    assert.ok(
      !/Testing has not opened yet/i.test(pageText(page)),
      `${page} still says testing has not opened`,
    );
  const home = pageText("index.html");
  const waitlist = home.match(/id="waitlist"[\s\S]*?<\/section>/)?.[0] ?? "";
  assert.match(waitlist, /<a href="\/beta\/"[^>]*>\s*Get early access\s*<\/a>/);
  assert.ok(
    home.includes(
      "Early access asks for your first name, email, phone type and, if you choose, how you heard about us.",
    ),
    "home does not say what the beta waitlist asks for",
  );
  assert.ok(!home.includes("We ask for an email address and nothing else"));
});

test("each program page opens with its own summary", async () => {
  const { programs } = await import("../../src/data/programs.ts");
  for (const program of programs) {
    const text = visibleText(`programs/${program.id}/index.html`);
    assert.ok(
      text.includes(`${program.name} is the Tether Health program for `),
      `programs/${program.id}/ lacks its summary`,
    );
  }
});

test("Unplug is described as part of BreatheFree, not as a health area of its own", async () => {
  // The code lives inside the BreatheFree application, so the module belongs
  // to tobacco.
  const { programs } = await import("../../src/data/programs.ts");
  const html = readFileSync(join(dist, "breathefree/index.html"), "utf8");
  assert.match(html, /Unplug is a module inside BreatheFree/);
  assert.ok(
    !programs.some((p) => /unplug/i.test(p.name)),
    "Unplug has been listed as a program",
  );
});
