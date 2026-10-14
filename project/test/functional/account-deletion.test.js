// Functional — the draft account-deletion page (WEB-009).
//
// Play needs a public web resource that explains how to delete an account
// without the app (R-054). This page is a draft for counsel and the owner: it
// must exist in the build, but stay out of search, navigation and the sitemap
// until counsel signs off. The owner removes `noindex` and adds links then,
// and updates these tests in the same change.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { dist, htmlFiles, readPage } from "../helpers/dist.js";

const PAGE = "delete-account/index.html";

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

test("the account-deletion page is built", () => {
  assert.ok(existsSync(join(dist, PAGE)), `${PAGE} was not emitted`);
});

test("the account-deletion page is kept out of search", () => {
  assert.match(
    readPage(PAGE),
    /<meta name="robots" content="noindex[^"]*"/,
    "the draft must carry robots noindex until counsel signs off",
  );
});

test("the page names the app and the developer", () => {
  const text = textOf(main(readPage(PAGE)));
  assert.match(text, /\bTether Health app\b/, "app name missing");
  assert.match(text, /\bdeveloped by Tether Health LLC\b/, "developer missing");
});

test("the page gives the in-app deletion steps in order", () => {
  // PLAY_CONSOLE_ANSWERS.md section F, lines 449-454, verbatim as drafted.
  const steps = main(readPage(PAGE)).match(
    /<ol[^>]*id="in-app-steps"[\s\S]*?<\/ol>/,
  )?.[0];
  assert.ok(steps, 'no <ol id="in-app-steps"> on the page');
  const items = [...steps.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) =>
    textOf(m[1]).trim(),
  );
  assert.deepEqual(items, [
    "1 Open the Tether Health app and sign in.",
    "2 Go to Home.",
    "3 Tap your profile avatar at the top right.",
    '4 Tap "Settings & privacy".',
    '5 Scroll to "Your data".',
    '6 Tap "Delete account and data".',
    "7 Enter your current password and type DELETE to confirm.",
  ]);
  assert.match(
    textOf(main(readPage(PAGE))),
    /If you are signed out, the same option first asks you to sign in\./,
  );
});

test("the cannot-sign-in route uses only a mailbox the site already publishes", () => {
  const html = main(readPage(PAGE));
  const mailtos = [...html.matchAll(/href="mailto:([^"?]+)/g)].map((m) => m[1]);
  assert.ok(mailtos.length > 0, "no email route for people who cannot sign in");
  for (const address of mailtos)
    assert.equal(address, "support@tetherhealthgroup.com");
});

test("unconfirmed facts stay visibly marked as to be confirmed", () => {
  // Whether the mailbox route is staffed, any timeline and the retention
  // period are owner and counsel decisions. Until they are made, the page
  // must say so rather than guess. Each is asserted on its own so removing
  // one cannot hide behind the others.
  const text = textOf(main(readPage(PAGE)));
  for (const placeholder of [
    /To be confirmed: whether email requests are being handled yet/,
    /To be confirmed: how long it takes to complete a request\./,
    /To be confirmed: how long backups and logs are kept\./,
  ])
    assert.match(text, placeholder);
});

test("no other built page and no sitemap links to the draft page", () => {
  const offenders = htmlFiles()
    .filter((page) => page !== PAGE)
    // WEB-014: the draft app privacy policy points at this page by design,
    // but only while it is itself a noindex draft. Once it loses noindex, the
    // exemption lapses and this guard fires.
    .filter(
      (page) =>
        page !== "app-privacy/index.html" ||
        !/<meta name="robots" content="noindex/.test(readPage(page)),
    )
    .filter((page) => /delete-account/.test(readPage(page)));
  assert.deepEqual(offenders, [], `pages linking the draft: ${offenders}`);

  const sitemaps = readdirSync(dist).filter((f) => /^sitemap.*\.xml$/.test(f));
  assert.ok(sitemaps.length > 0, "no sitemap emitted");
  for (const file of sitemaps)
    assert.doesNotMatch(
      readFileSync(join(dist, file), "utf8"),
      /delete-account/,
      `${file} lists the draft page`,
    );
});

test("the page makes none of the banned claims", () => {
  // Comments included: they ship in the built HTML.
  const html = readPage(PAGE);
  const banned = [
    /\bsecure(ly)?\b/i,
    /\bHIPAA\b/i,
    /clinically\s+reviewed/i,
    /works?\s+offline/i,
  ];
  for (const pattern of banned) assert.doesNotMatch(html, pattern);
});

test("the page adds no inline script or style of its own", () => {
  const inline = (html) =>
    [
      ...html.matchAll(/<(script|style)(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/\1>/g),
    ].map((m) => m[2]);
  const elsewhere = new Set(
    htmlFiles()
      .filter((page) => page !== PAGE)
      .flatMap((page) => inline(readPage(page))),
  );
  for (const body of inline(readPage(PAGE)))
    assert.ok(elsewhere.has(body), `new inline block: ${body.slice(0, 60)}`);
});
