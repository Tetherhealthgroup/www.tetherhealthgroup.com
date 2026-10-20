// Functional — the draft account-deletion page (WEB-009).
//
// Play needs a public web resource that explains how to delete an account
// without the app. The draft describes an earlier version of the app, so it
// must not be built or deployed until it is rewritten for the final app and
// counsel signs off. It lives at src/pages/_delete-account.astro: Astro skips
// files whose name starts with an underscore, so the route does not exist.
// These tests prove the route is absent from the build and keep the source
// checks that still mean something while it waits.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { dist, projectRoot, htmlFiles, readPage } from "../helpers/dist.js";

const ROUTE = "delete-account";
const SOURCE = join(projectRoot, "src/pages/_delete-account.astro");
const PUBLISHED_SOURCE = join(projectRoot, "src/pages/delete-account.astro");
const source = () => readFileSync(SOURCE, "utf8");

test("the account-deletion draft is not built", () => {
  assert.ok(existsSync(SOURCE), "the draft source is missing");
  assert.ok(
    !existsSync(PUBLISHED_SOURCE),
    "src/pages/delete-account.astro would be built and deployed",
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

test("the draft source names the app and the developer", () => {
  const src = source();
  assert.match(src, /const appName = "Tether Health";/, "app name missing");
  assert.match(src, /developed by \$\{site\.legalName\}/, "developer missing");
});

test("the draft keeps its in-app deletion steps in order", () => {
  // The in-app path, verbatim as drafted. WEB-903 replaces it with the final
  // app's flow and updates this list in the same change.
  const list = source().match(/const inAppSteps = \[([\s\S]*?)\];/)?.[1];
  assert.ok(list, "no inAppSteps list in the draft");
  const steps = [...list.matchAll(/^\s*[`'"](.*)[`'"],$/gm)].map((m) => m[1]);
  assert.deepEqual(steps, [
    "Open the ${appName} app and sign in.",
    "Go to Home.",
    "Tap your profile avatar at the top right.",
    'Tap "Settings & privacy".',
    'Scroll to "Your data".',
    'Tap "Delete account and data".',
    "Enter your current password and type DELETE to confirm.",
  ]);
});

test("the cannot-sign-in route uses only a mailbox the site already publishes", () => {
  // <SupportEmail /> with no mailbox prop renders support@.
  const src = source();
  assert.match(src, /<SupportEmail subject=\{emailSubject\} \/>/);
  assert.doesNotMatch(src, /mailbox=/, "the draft names another mailbox");
  assert.doesNotMatch(src, /@[a-z0-9.-]+\.[a-z]{2,}/i, "a literal address");
});

test("unconfirmed facts stay visibly marked as to be confirmed", () => {
  // Each is asserted on its own so removing one cannot hide behind the others.
  const text = source().replace(/\s+/g, " ");
  for (const placeholder of [
    /To be confirmed: who handles email requests, and how we check that a request comes from the account holder\./,
    /To be confirmed: how long it takes to complete a request\./,
    /To be confirmed: how long backups and logs are kept\./,
    /To be confirmed: which data made as a guest is cleared from the device when a signed-in account is deleted\./,
  ])
    assert.match(text, placeholder);
});

test("the draft describes no unverified security or privacy weakness", () => {
  // Public text states scope ("To be confirmed: …"), never a gap that has
  // not been verified on the final app.
  const text = source().replace(/\s+/g, " ");
  for (const weakness of [
    /whether email requests are being handled/i,
    /no in-app way/i,
    /removes only/i,
    /signing out does not remove/i,
    /but not Heartwise/i,
    /whether a mailbox process exists/i,
    /works end to end/i,
  ])
    assert.doesNotMatch(text, weakness);
});

test("the draft makes none of the banned claims and ships no comment", () => {
  const src = source();
  for (const pattern of [
    /\bsecure(ly)?\b/i,
    /\bHIPAA\b/i,
    /clinically\s+reviewed/i,
    /works?\s+offline/i,
  ])
    assert.doesNotMatch(src, pattern);
  assert.doesNotMatch(src, /<!--/, "an HTML comment would ship in the page");
});

test("the draft adds no inline script or style of its own", () => {
  assert.doesNotMatch(source(), /<(script|style)\b/);
});
