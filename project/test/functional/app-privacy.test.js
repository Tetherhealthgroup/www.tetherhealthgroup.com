// Functional — the draft app privacy policy page (WEB-014).
//
// Google Play and the App Store both need a privacy policy URL that covers the
// app. The draft describes an earlier version of the app, so it must not be
// built or deployed until it is rewritten for the final app and counsel signs
// off. It lives at src/pages/_app-privacy.astro: Astro skips files whose name
// starts with an underscore, so the route does not exist. These tests prove
// the route is absent from the build and keep the source checks that still
// mean something while it waits.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { dist, projectRoot, htmlFiles, readPage } from "../helpers/dist.js";

const ROUTE = "app-privacy";
const SOURCE = join(projectRoot, "src/pages/_app-privacy.astro");
const PUBLISHED_SOURCE = join(projectRoot, "src/pages/app-privacy.astro");
const source = () => readFileSync(SOURCE, "utf8");

/** Visible text of the source: expressions, tags and comments removed. */
const textOf = (src) =>
  src
    .replace(/^---[\s\S]*?\n---\n/, " ")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

test("the app privacy policy draft is not built", () => {
  assert.ok(existsSync(SOURCE), "the draft source is missing");
  assert.ok(
    !existsSync(PUBLISHED_SOURCE),
    "src/pages/app-privacy.astro would be built and deployed",
  );
  assert.ok(
    !existsSync(join(dist, ROUTE)),
    `dist/${ROUTE}/ exists: the draft was built`,
  );
  assert.ok(
    !htmlFiles().some((page) => page.startsWith(`${ROUTE}/`)),
    "a built page sits under the draft route",
  );
});

test("no built page, sitemap or robots.txt refers to the draft route", () => {
  const offenders = htmlFiles().filter((page) =>
    readPage(page).includes(`/${ROUTE}/`),
  );
  assert.deepEqual(offenders, [], `pages linking the draft: ${offenders}`);

  const sitemaps = readdirSync(dist).filter((f) => /^sitemap.*\.xml$/.test(f));
  assert.ok(sitemaps.length > 0, "no sitemap emitted");
  for (const file of [...sitemaps, "robots.txt"])
    assert.doesNotMatch(
      readFileSync(join(dist, file), "utf8"),
      new RegExp(ROUTE),
      `${file} lists the draft route`,
    );
});

test("the draft source stays marked noindex and draft", () => {
  const src = source();
  assert.match(src, /^\s*noindex\s*$/m, "the draft lost its noindex prop");
  assert.match(
    src,
    /Draft for review by \{site\.legalName\} and its counsel\./,
  );
});

test("the draft source names the app, its package and the developer", () => {
  const src = source();
  assert.match(src, /const appName = "Tether Health";/, "app name missing");
  assert.match(src, /"com\.TetherHealthLLC\.tetherhealth"/, "package missing");
  assert.match(src, /developed by \$\{site\.legalName\}/, "developer missing");
});

test("each required topic has its own heading", () => {
  const headings = [...source().matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map(
    (m) => m[1].trim(),
  );
  assert.deepEqual(headings, [
    "About this policy",
    "Using the app as a guest",
    "Information we collect when you have an account",
    "How we use your information",
    "Who handles your information for us",
    "Protection in transit",
    "Keeping and deleting your information",
    "Your rights",
    "Contact us",
    "Children",
    "Changes to this policy",
  ]);
});

test("unconfirmed facts stay visibly marked as to be confirmed", () => {
  // Each is an owner or counsel decision, or a fact the evidence does not
  // supply. Each is asserted on its own so removing one cannot hide behind
  // the others.
  const text = textOf(source());
  for (const placeholder of [
    /To be confirmed: the date this policy takes effect\./,
    /To be confirmed: whether this policy also covers an iOS version of the app\./,
    /To be confirmed: how a profile photo is handled when it is uploaded\./,
    /To be confirmed: which service sends the sign-up confirmation and password-reset emails\./,
    /To be confirmed: what our service providers record when the app connects/,
    /To be confirmed: which company hosts the production application server/,
    /To be confirmed: the contract terms we have with our service providers\./,
    /To be confirmed: how your data is protected on your phone, in transit and at our service providers\./,
    /To be confirmed: how long we keep your account data if you never delete your account\./,
    /To be confirmed: how long backups and logs are kept\./,
    /To be confirmed: which privacy laws apply to the app/,
    /To be confirmed: who answers these emails, how we check who you are/,
    /To be confirmed: the minimum age for the app/,
    /To be confirmed: how people who already have an account will be told/,
  ])
    assert.match(text, placeholder);
});

test("the draft describes no unverified security or privacy weakness", () => {
  // Public text states scope ("To be confirmed: …"), never a gap that has
  // not been verified on the final app.
  const text = textOf(source());
  for (const weakness of [
    /has not been checked/i,
    /location data/i,
    /does not currently check/i,
    /signing out does not remove/i,
    /whether the production service addresses use HTTPS/i,
  ])
    assert.doesNotMatch(text, weakness);
});

test("the draft links the account-deletion page and uses only role mailboxes", () => {
  const src = source();
  const hrefs = [...src.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(
    hrefs,
    ["/delete-account/"],
    "expected exactly one link, to /delete-account/",
  );
  // <SupportEmail /> renders support@; mailbox="privacy" renders privacy@.
  const mailboxes = [...src.matchAll(/mailbox="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(mailboxes.length > 0, "no privacy contact route");
  for (const mailbox of mailboxes) assert.equal(mailbox, "privacy");
  assert.doesNotMatch(src, /@[a-z0-9.-]+\.[a-z]{2,}/i, "a literal address");
});

test("the draft makes none of the banned words and ships no comment", () => {
  // Substring match on purpose: "securely" and "insecure" are caught too.
  const src = source();
  assert.doesNotMatch(src, /HIPAA|compliant|secure|clinically|guarantee/i);
  assert.doesNotMatch(src, /<!--/, "an HTML comment would ship in the page");
});

test("the draft claims no encryption at rest", () => {
  // The sources evidence HTTPS in transit only. How data is kept on the phone
  // or at the providers is not stated.
  const text = textOf(source());
  assert.doesNotMatch(text, /\bat rest\b/i);
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences.filter((s) => /encrypt/i.test(s)))
    assert.match(sentence, /in transit|HTTPS/i, `unsupported: ${sentence}`);
});

test("the draft adds no inline script or style", () => {
  // When it is published it must not add a CSP hash; style attributes too.
  const src = source();
  assert.doesNotMatch(src, /<(script|style)\b/);
  assert.doesNotMatch(src, /\sstyle="/, "inline style attribute");
});
