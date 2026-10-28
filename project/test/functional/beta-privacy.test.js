// Functional — what the site says about the beta waitlist's data (P-108).
//
// The privacy notice must say what the beta form collects, why, who else sees
// it, how long it is kept and how to have it deleted; and the security page
// must no longer say the site runs no server-side code. Wording is a draft for
// counsel review.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readPage } from "../helpers/dist.js";

/** Page text, tags removed, whitespace collapsed. */
const textOf = (html) =>
  html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");

/** The privacy notice's beta section: from its heading to the next h2. */
function betaSection() {
  const html = readPage("privacy/index.html");
  const section = html.match(/<h2 id="beta-waitlist">[\s\S]*?(?=<h2\b)/)?.[0];
  assert.ok(section, 'privacy notice has no <h2 id="beta-waitlist">');
  return { html: section, text: textOf(section) };
}

test("the privacy notice has a Beta waitlist section", () => {
  assert.match(betaSection().text, /^\s*Beta waitlist\b/);
});

test("it lists exactly what is collected, and that health is not asked", () => {
  const { text } = betaSection();
  for (const item of [
    "first name",
    "email address",
    "which kind of phone you use (iPhone or Android)",
    "how you heard about us",
    "18 or over",
  ])
    assert.ok(text.includes(item), `beta section does not mention: ${item}`);
  assert.match(text, /does not ask about your health or which program/);
});

test("it says why, who else sees it, retention, deletion and that it is never sold", () => {
  const { html, text } = betaSection();
  assert.match(text, /To invite you to test the app/);
  assert.match(text, /Apple \(TestFlight, for iPhone\) or Google/);
  assert.match(
    text,
    /delete the waitlist after the beta ends, or sooner if you ask/,
  );
  assert.match(html, /mailto:privacy@tetherhealthgroup\.com/);
  assert.match(text, /reply "unsubscribe"/);
  assert.match(text, /never sell/);
  assert.match(text, /IP address, deleted within a day/);
});

test("the beta form links to that section", () => {
  assert.match(readPage("beta/index.html"), /href="\/privacy\/#beta-waitlist"/);
});

test("the security page no longer says there is no server-side code", () => {
  const text = textOf(readPage("security/index.html"));
  assert.doesNotMatch(text, /no server-side code/);
  assert.match(text, /The only server-side code is the small handler/);
});
