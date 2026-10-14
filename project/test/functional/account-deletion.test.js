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
  assert.match(text, /\bTether Health\b/, "app name missing");
  assert.match(text, /\bTether Health LLC\b/, "developer name missing");
});

test("the page gives the in-app deletion steps in order", () => {
  // PLAY_CONSOLE_ANSWERS.md section F, lines 449-454.
  const steps = main(readPage(PAGE)).match(
    /<ol[^>]*id="in-app-steps"[\s\S]*?<\/ol>/,
  )?.[0];
  assert.ok(steps, 'no <ol id="in-app-steps"> on the page');
  const items = [...steps.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) =>
    textOf(m[1]).trim(),
  );
  const expected = [
    /sign in/i,
    /Home/,
    /profile avatar.*top right/i,
    /"Settings & privacy"/,
    /"Your data"/,
    /"Delete account and data"/,
    /current password.*DELETE/,
  ];
  assert.equal(items.length, expected.length, `steps: ${items.join(" | ")}`);
  expected.forEach((pattern, i) =>
    assert.match(items[i], pattern, `step ${i + 1}: ${items[i]}`),
  );
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
  // Retention period, the manual mailbox process and any timeline are owner
  // and counsel decisions. Until they are made, the page must say so rather
  // than guess.
  const text = textOf(main(readPage(PAGE)));
  const marks = text.match(/To be confirmed/g) ?? [];
  assert.ok(marks.length >= 3, `only ${marks.length} "To be confirmed" marks`);
});

test("no other built page and no sitemap links to the draft page", () => {
  const offenders = htmlFiles()
    .filter((page) => page !== PAGE)
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
