// Functional — the Tether Health account-deletion page (draft for counsel
// review).
//
// Google Play needs a public web resource that explains how to delete an
// account and its data, including without the app. The page is built at
// /delete-account/ so it can be given to Play, but it is a draft: it stays
// noindex, out of the sitemap and visibly marked as a draft, and anything the
// sources do not settle is a visible "To be confirmed" line. Publishing it for
// real means removing noindex and the draft notice and updating this file in
// the same change.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { dist, projectRoot, readPage } from "../helpers/dist.js";

const ROUTE = "delete-account";
const SOURCE = join(projectRoot, "src/pages/delete-account.astro");
const source = () => readFileSync(SOURCE, "utf8");
const built = () => readPage(`${ROUTE}/index.html`);
const builtText = () =>
  built()
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ");

/** The string items of one `const name = [ ... ];` list in the source. */
const listOf = (name) => {
  const list = source().match(
    new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`),
  )?.[1];
  assert.ok(list, `no ${name} list`);
  return [...list.matchAll(/^\s*([`'"])(.*)\1,$/gm)].map((m) =>
    m[2].replace(/\\'/g, "'"),
  );
};

/**
 * The wording of the source, one piece per paragraph: element text, every
 * attribute string value except class (quoted, or a template literal in
 * braces, such as PageHero's intro), every string literal in the
 * frontmatter (its comments skipped), and every expression comment ({/* ... *\/}).
 */
function textOf(src) {
  const frontmatter = src.match(/^---\n([\s\S]*?)\n---\n/);
  const fm = (frontmatter?.[1] ?? "")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");
  const body = frontmatter ? src.slice(frontmatter[0].length) : src;
  const pieces = [];
  for (const m of fm.matchAll(
    /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g,
  ))
    pieces.push(m[1] ?? m[2] ?? m[3]);
  for (const m of body.matchAll(/\{\/\*([\s\S]*?)\*\/\}/g)) pieces.push(m[1]);
  for (const m of body.matchAll(
    /\s([A-Za-z][\w:-]*)=(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g,
  ))
    if (m[1] !== "class") pieces.push(m[2] ?? m[3] ?? m[4]);
  pieces.push(
    body.replace(/\{\/\*[\s\S]*?\*\/\}/g, " ").replace(/<[^>]+>/g, " "),
  );
  return pieces.map((p) => p.replace(/\s+/g, " ").trim()).join("\n\n");
}

/**
 * Wording that says a capability is missing or unchecked, whatever its
 * subject. Public drafts state scope ("To be confirmed: …") instead.
 */
const GAP_WORDING = [
  /\b(has|have) not (yet )?been (checked|verified|tested|confirmed)\b/i,
  /\b(does|do) not (currently |yet )?(check|verify|protect|encrypt|remove|delete|handle)\b/i,
  /\bno (in-app )?way\b/i,
  /\bwhether .{0,40} (is|are) (being )?(handled|checked|protected|removed)\b/i,
];

const sentencesOf = (text) =>
  text
    .split(/(?<=[.!?])\s+|\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);

const gapSentences = (text) =>
  sentencesOf(text).filter((s) => GAP_WORDING.some((p) => p.test(s)));

/**
 * Scope statements that read like the patterns above but describe the
 * user's own copies, not a gap in the app.
 */
const SCOPE_STATEMENTS = [
  "Deleting your account does not delete any copy you exported yourself.",
];

test("the account-deletion page is built, noindex and out of the sitemap", () => {
  assert.ok(existsSync(SOURCE), "the source is missing");
  assert.ok(
    !existsSync(join(projectRoot, "src/pages/_delete-account.astro")),
    "the old unbuilt draft is still in the tree",
  );
  assert.ok(existsSync(join(dist, ROUTE, "index.html")), "not built");
  assert.match(built(), /<meta name="robots" content="noindex, follow">/);
  const sitemaps = readdirSync(dist).filter((f) => /^sitemap.*\.xml$/.test(f));
  assert.ok(sitemaps.length > 0, "no sitemap emitted");
  for (const file of sitemaps)
    assert.doesNotMatch(
      readFileSync(join(dist, file), "utf8"),
      new RegExp(`/${ROUTE}/`),
      `${file} lists the draft`,
    );
});

test("the page is reachable from the support page and the app privacy policy", () => {
  for (const page of ["support/index.html", "app-privacy/index.html"])
    assert.ok(
      readPage(page).includes('href="/delete-account/"'),
      `${page} does not link /delete-account/`,
    );
});

test("the page is marked as a draft for counsel review, visibly and in the HTML", () => {
  assert.match(
    source(),
    /Draft for review by \{site\.legalName\} and its counsel\./,
  );
  assert.ok(
    builtText().includes(
      "Draft for review by Tether Health LLC and its counsel.",
    ),
  );
  assert.match(
    built(),
    /<!-- Draft for counsel review\. This page is not final legal text\. -->/,
  );
});

test("the page names the app and the developer", () => {
  const src = source();
  assert.match(src, /const appName = "Tether Health";/, "app name missing");
  assert.match(src, /developed by \$\{site\.legalName\}/, "developer missing");
  assert.ok(builtText().includes("developed by Tether Health LLC"));
});

test("the in-app steps follow the app's Account and Your data screens, in order", () => {
  // The labels in quotes are the app's own: Account > "Your data" >
  // "Delete account and all data" > "Type DELETE to confirm" + password (or
  // Apple / Google re-authentication) > "Delete everything" > receipt.
  assert.deepEqual(listOf("inAppSteps"), [
    "Open the ${appName} app and sign in.",
    "On Today, tap your avatar at the top to open Account.",
    'Tap "Your data".',
    'Under Delete, tap "Delete account and all data".',
    "Type DELETE to confirm, then enter your password. If you signed in with Apple or Google, confirm with that same account instead.",
    'Tap "Delete everything".',
    "The app shows a deletion receipt and signs you out on that phone. Keep the receipt ID if you contact support.",
  ]);
});

test("the page also covers versions of the app with a Settings & privacy screen", () => {
  assert.deepEqual(listOf("settingsSteps"), [
    'Open "Settings & privacy".',
    'Under "Your data", tap "Delete account and data".',
    "Enter your password, type DELETE and confirm.",
  ]);
});

test("the page explains deleting a single program's data", () => {
  const steps = listOf("programSteps");
  assert.equal(steps.length, 3);
  assert.match(steps[0], /"Programs & sharing"/);
  assert.match(steps[1], /"Leave BreatheFree"/);
  assert.match(steps[2], /"Delete BreatheFree data now"/);
});

test("the cannot-sign-in route uses only the support mailbox and needs no app", () => {
  // <SupportEmail /> with no mailbox prop renders support@.
  const src = source();
  assert.match(src, /<SupportEmail subject=\{emailSubject\} \/>/);
  assert.doesNotMatch(src, /mailbox=/, "the page names another mailbox");
  assert.doesNotMatch(src, /@[a-z0-9.-]+\.[a-z]{2,}/i, "a literal address");
  assert.ok(builtText().includes("You do not need the app to ask."));
  assert.match(
    built(),
    /href="mailto:support@tetherhealthgroup\.com\?subject=/,
  );
});

test("the page says what is deleted and what is kept", () => {
  const text = builtText();
  for (const item of [
    "your profile, display name and profile photo",
    "the programs you joined, with their plans and setup answers",
    "your check-ins, readings, logs and other program entries",
    "your sign-in account",
    "Copies in backups and logs are kept until those backups and logs expire.",
    "stays with the people who received it",
  ])
    assert.ok(text.includes(item), `missing: ${item}`);
});

test("unconfirmed facts stay visibly marked as to be confirmed", () => {
  // Each is asserted on its own so removing one cannot hide behind the others.
  const text = source().replace(/\s+/g, " ");
  for (const placeholder of [
    /To be confirmed: who handles email requests, and how we check that a request comes from the account holder\./,
    /To be confirmed: how long it takes to complete a request\./,
    /To be confirmed: how long copies remain in backups and logs after deletion\./,
    /To be confirmed: which data on the phone is cleared when a signed-in account is deleted\./,
  ])
    assert.match(text, placeholder);
});

test("the draft describes no unverified security or privacy weakness", () => {
  // Public text states scope ("To be confirmed: …"), never a gap that has
  // not been verified on the final app.
  const found = gapSentences(textOf(source()));
  assert.deepEqual(
    found.filter((s) => !SCOPE_STATEMENTS.includes(s)),
    [],
  );
  for (const statement of SCOPE_STATEMENTS)
    assert.ok(found.includes(statement), `stale allowance: ${statement}`);
});

test("the draft's to-be-confirmed lines state scope, not a gap", () => {
  const marker = "To be confirmed:";
  const open = sentencesOf(textOf(source()))
    .filter((s) => s.includes(marker))
    .map((s) => s.slice(s.indexOf(marker)));
  assert.ok(open.length >= 4, `only ${open.length} open items found`);
  assert.deepEqual(
    open.filter((s) => gapSentences(s).length > 0),
    [],
  );
});

test("the gap-wording patterns catch generic samples", () => {
  for (const sample of [
    "It has not yet been verified.",
    "It does not currently verify that.",
    "There is no way to undo it.",
    "It is unclear whether these are being handled.",
  ])
    assert.deepEqual(gapSentences(sample), [sample], `not caught: ${sample}`);
});

test("the draft makes none of the banned claims", () => {
  const text = textOf(source());
  for (const pattern of [
    /\bsecure(ly)?\b/i,
    /\bHIPAA\b/i,
    /clinically\s+reviewed/i,
    /works?\s+offline/i,
  ])
    assert.doesNotMatch(text, pattern);
});

test("the draft adds no inline script or style of its own", () => {
  assert.doesNotMatch(source(), /<(script|style)\b/);
  assert.doesNotMatch(source(), /\sstyle="/, "inline style attribute");
});
