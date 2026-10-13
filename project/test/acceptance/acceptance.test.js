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

const pageText = (rel) =>
  readFileSync(join(dist, rel), "utf8").replace(/\s+/g, " ");

test("no page overclaims availability, timing, platforms or a store presence", async () => {
  const banned = [
    [/coming soon/i, "implies timing"],
    [/download now|launch date|launching|launches (on|in)/i, "launch promise"],
    [/get the app/i, "store call to action"],
    [/\b(iPhone|iOS|App Store|TestFlight)\b/, "Apple platform promise"],
    [
      /play\.google\.com|market:\/\/|apps\.apple\.com|itunes\.apple/i,
      "store link",
    ],
    [/badge/i, "store badge"],
    [
      /"@type":"(SoftwareApplication|MobileApplication)"|downloadUrl|installUrl/,
      "app structured data",
    ],
    [
      /Nothing is built|no implementation/i,
      "contradicts the planned/scaffold status",
    ],
  ];
  for (const page of htmlFiles()) {
    const text = pageText(page);
    for (const [pattern, why] of banned) {
      assert.ok(!pattern.test(text), `${page} matches ${pattern} (${why})`);
    }
    // "early access" implied a programme nobody has confirmed. The privacy
    // notice is counsel-owned legal text and is deliberately not edited here.
    if (page !== "privacy/index.html") {
      assert.ok(
        !/early access/i.test(text),
        `${page} still says "early access" (implies an access programme)`,
      );
    }
  }
});

test("'download' appears only as a negated availability statement", async () => {
  const negated =
    /not (yet )?available to download( yet| or use)?|not available to download/gi;
  for (const page of htmlFiles()) {
    const leftover = pageText(page).replace(negated, "");
    assert.ok(
      !/download/i.test(leftover),
      `${page} uses "download" other than to say it is not available`,
    );
  }
});

test("'available now' only refers to the third-party quitlines", async () => {
  for (const page of htmlFiles()) {
    const text = pageText(page);
    if (page === "support/index.html") {
      // The one allowed hit is the quitline sentence.
      const stripped = text.replace(
        /Trained quitline counsellors[^<]*they are available now\./,
        "",
      );
      assert.ok(
        !/available now/i.test(stripped),
        `${page} says "available now" outside the quitline sentence`,
      );
    } else {
      assert.ok(!/available now/i.test(text), `${page} says "available now"`);
    }
  }
});

test("the Android-first status line is on the home and BreatheFree pages", () => {
  assert.ok(
    pageText("index.html").includes("In development — Android first"),
    "home page lacks the status line",
  );
  assert.ok(
    pageText("index.html").includes("is in development for Android"),
    "home page description lacks the Android-first status",
  );
  const bf = pageText("breathefree/index.html");
  assert.ok(
    bf.includes("in development, for Android first"),
    "BreatheFree page lacks the status card line",
  );
  assert.ok(
    bf.includes("Not available to download yet"),
    "BreatheFree page lacks the hero status line",
  );
  assert.ok(
    bf.includes("we intend to release it through Google Play"),
    "BreatheFree page lacks the intent-only Play wording",
  );
  assert.ok(
    pageText("programs/tobacco/index.html").includes(
      "in development for Android first and is not available to download yet",
    ),
    "the tobacco area page lacks the Android-first status",
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
  assert.ok(
    html.includes(
      "Use the waitlist form below and say in the message box that you would like to test BreatheFree on Android. Testing has not opened yet. When it does, we may write to the address you give us to ask whether you would like to take part. Joining does not guarantee a place.",
    ),
    "the testing-list answer is missing or changed",
  );
  assert.ok(html.includes('id="testing-list"'), "the FAQ answer has no anchor");
  assert.ok(html.includes('id="waitlist"'), "support has no waitlist anchor");
  assert.ok(
    html.includes("We have not opened testing yet"),
    "support must say testing has not opened",
  );
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
