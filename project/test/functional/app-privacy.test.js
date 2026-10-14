// Functional — the draft app privacy policy page (WEB-014).
//
// Google Play and the App Store both need a privacy policy URL that covers the
// app (R-054). This page is a DRAFT for counsel and the owner: it must exist in
// the build, but stay out of search, navigation and the sitemap until counsel
// signs off. The owner removes `noindex`, adds links and drops the sitemap
// filter then, and updates these tests in the same change.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { dist, htmlFiles, readPage } from "../helpers/dist.js";

const PAGE = "app-privacy/index.html";

/** Visible text: comments, tags and the common entities removed. */
const textOf = (html) =>
  html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\s+/g, " ");

const main = (html) => html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? "";

test("the app privacy policy page is built", () => {
  assert.ok(existsSync(join(dist, PAGE)), `${PAGE} was not emitted`);
});

test("the app privacy policy page is kept out of search", () => {
  assert.match(
    readPage(PAGE),
    /<meta name="robots" content="noindex[^"]*"/,
    "the draft must carry robots noindex until counsel signs off",
  );
});

test("no built page, sitemap or robots.txt links to the app privacy draft", () => {
  const offenders = htmlFiles()
    .filter((page) => page !== PAGE)
    .filter((page) => /app-privacy/.test(readPage(page)));
  assert.deepEqual(offenders, [], `pages linking the draft: ${offenders}`);

  const sitemaps = readdirSync(dist).filter((f) => /^sitemap.*\.xml$/.test(f));
  assert.ok(sitemaps.length > 0, "no sitemap emitted");
  for (const file of [...sitemaps, "robots.txt"])
    assert.doesNotMatch(
      readFileSync(join(dist, file), "utf8"),
      /app-privacy/,
      `${file} lists the draft page`,
    );
});

test("the page carries a visible draft notice", () => {
  assert.match(
    textOf(main(readPage(PAGE))),
    /Draft for review by Tether Health LLC and its counsel\./,
  );
});

test("the page names the app, its package and the developer", () => {
  const text = textOf(main(readPage(PAGE)));
  assert.match(text, /\bTether Health app\b/, "app name missing");
  assert.match(text, /\bTether Health LLC\b/, "developer missing");
  assert.match(text, /com\.TetherHealthLLC\.tetherhealth/, "package missing");
});

test("each required topic has its own heading", () => {
  const headings = [
    ...main(readPage(PAGE)).matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g),
  ].map((m) => textOf(m[1]).trim());
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
  const text = textOf(main(readPage(PAGE)));
  for (const placeholder of [
    /To be confirmed: the date this policy takes effect\./,
    /To be confirmed: whether this policy also covers an iOS version of the app\./,
    /To be confirmed: whether a photo you add carries location data from your phone/,
    /To be confirmed: which service sends the sign-up confirmation and password-reset emails\./,
    /To be confirmed: what our service providers record when the app connects/,
    /To be confirmed: which company hosts the production application server/,
    /To be confirmed: the contract terms we have with our service providers\./,
    /To be confirmed: how the data kept on your phone is protected/,
    /To be confirmed: whether the production service addresses use HTTPS/,
    /To be confirmed: how long we keep your account data if you never delete your account\./,
    /To be confirmed: how long backups and logs are kept\./,
    /To be confirmed: which privacy laws apply to the app/,
    /To be confirmed: who answers these emails, how we check who you are/,
    /To be confirmed: the minimum age for the app/,
    /To be confirmed: how people who already have an account will be told/,
  ])
    assert.match(text, placeholder);
});

test("the page links to the account-deletion page and uses only role mailboxes", () => {
  const html = main(readPage(PAGE));
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(
    hrefs.filter((h) => h === "/delete-account/").length,
    1,
    "expected exactly one link to /delete-account/",
  );
  const mailtos = hrefs
    .filter((h) => h.startsWith("mailto:"))
    .map((h) => h.slice(7).split("?")[0]);
  assert.ok(mailtos.length > 0, "no contact route");
  for (const address of mailtos)
    assert.ok(
      [
        "privacy@tetherhealthgroup.com",
        "support@tetherhealthgroup.com",
      ].includes(address),
      `unexpected mailbox ${address}`,
    );
  assert.ok(mailtos.includes("privacy@tetherhealthgroup.com"));
});

test("the page makes none of the banned words, comments included", () => {
  // They ship in the built HTML, so the scan covers the whole document and
  // the source file. Substring match on purpose: "securely" and "insecure"
  // are caught too.
  const banned = /HIPAA|compliant|secure|clinically|guarantee/i;
  assert.doesNotMatch(readPage(PAGE), banned);
  assert.doesNotMatch(
    readFileSync(join(dist, "..", "src/pages/app-privacy.astro"), "utf8"),
    banned,
  );
});

test("the page claims no encryption at rest", () => {
  // The sources evidence HTTPS in transit only (A.1:186). How data is kept on
  // the phone or at the providers is Unknown (A.4:224-227).
  const text = textOf(main(readPage(PAGE)));
  assert.doesNotMatch(text, /\bat rest\b/i);
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences.filter((s) => /encrypt/i.test(s)))
    assert.match(sentence, /in transit|HTTPS/i, `unsupported: ${sentence}`);
});

test("the page adds no inline script or style, and the build's hash set is unchanged", () => {
  // The set of SHA-256 hashes of inline scripts and styles in the whole build
  // is pinned to what 1c28a63 (WEB-009) produced: 3 scripts and 1 style, the
  // same four WEB-008 recorded. Method as in WEB-008: SHA-256, base64, over
  // every <script> without src and every <style>, unique across all pages.
  const found = new Set();
  for (const page of htmlFiles()) {
    const html = readPage(page);
    for (const [kind, re] of [
      ["script", /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g],
      ["style", /<style[^>]*>([\s\S]*?)<\/style>/g],
    ])
      for (const m of html.matchAll(re))
        found.add(
          `${kind} sha256-${createHash("sha256").update(m[1], "utf8").digest("base64")}`,
        );
  }
  assert.deepEqual([...found].sort(), [
    "script sha256-4daKGa3Y2Vbk8v2Ug+z6rdJ/5ObNaArcWP53uY/D+zk=",
    "script sha256-ZvHI7dAQf+RvTh3JR4SKvDIB2OD5V8b4f3ytqXhQVZQ=",
    "script sha256-gdjihLHRG1fy+YCgLIPIT42ERkPDjf0O/Pu+J5eE3hA=",
    "style sha256-wDwVjjkLCCm5dg6R9Ec0DdJ+kdA84JuZaWuuH0jYcQo=",
  ]);
  assert.doesNotMatch(readPage(PAGE), /\sstyle="/, "inline style attribute");
});
