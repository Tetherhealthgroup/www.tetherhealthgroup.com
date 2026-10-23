// Functional — the Tether Health app privacy policy (draft for counsel review).
//
// Google Play and the App Store both need a privacy policy URL that covers the
// app. The page describes the multi-program app and is built at /app-privacy/
// so it can be linked, but it is a draft: it stays noindex, out of the
// sitemap, visibly marked as a draft, and every fact the sources do not settle
// is a visible "To be confirmed" line. Publishing it for real means removing
// noindex and the draft notice and updating this file in the same change.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { dist, projectRoot, readPage } from "../helpers/dist.js";

const ROUTE = "app-privacy";
const SOURCE = join(projectRoot, "src/pages/app-privacy.astro");
const source = () => readFileSync(SOURCE, "utf8");
const built = () => readPage(`${ROUTE}/index.html`);
/** Built page as one line of text, tags removed, entities decoded. */
const builtText = () =>
  built()
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");

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

test("the app privacy policy is built, noindex and out of the sitemap", () => {
  assert.ok(existsSync(SOURCE), "the source is missing");
  assert.ok(
    !existsSync(join(projectRoot, "src/pages/_app-privacy.astro")),
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

test("the page is marked as a draft for counsel review, visibly and in the HTML", () => {
  assert.match(
    source(),
    /Draft for review by \{site\.legalName\} and its counsel\./,
  );
  assert.ok(
    builtText().includes(
      "Draft for review by Tether Health LLC and its counsel.",
    ),
    "the visible draft notice is missing from the built page",
  );
  assert.match(
    built(),
    /<!-- Draft for counsel review\. This page is not final legal text\. -->/,
  );
});

test("the page names the app, its package, the developer and the 11 programs", () => {
  const src = source();
  assert.match(src, /const appName = "Tether Health";/, "app name missing");
  assert.match(src, /"com\.TetherHealthLLC\.tetherhealth"/, "package missing");
  assert.match(src, /developed by \$\{site\.legalName\}/, "developer missing");
  const text = builtText();
  assert.ok(text.includes("11 programs"), "the program count is missing");
});

test("every program is described, under its app name and area", async () => {
  const { programs } = await import("../../src/data/programs.ts");
  const text = builtText();
  for (const program of programs) {
    assert.ok(
      text.includes(`${program.name} (${program.area}) :`) ||
        text.includes(`${program.name} (${program.area}):`),
      `no entry for ${program.name}`,
    );
  }
  const keys = [...source().matchAll(/^\s{2}([a-z]{2}): "/gm)].map((m) => m[1]);
  assert.deepEqual(
    keys,
    programs.map((p) => p.appId),
    "programData keys differ from the app program ids",
  );
});

test("each required topic has its own heading", () => {
  const headings = [...source().matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map(
    (m) => m[1].trim(),
  );
  assert.deepEqual(headings, [
    "About this policy",
    "The short version",
    "Using the app on this phone only",
    "Your account and sign-in",
    "Information shared by all your programs",
    "Information each program keeps",
    "Health records",
    "Sharing, only when you choose",
    "Reminders and notifications",
    "Permissions the app asks for",
    "How we use your information",
    "Who handles your information for us",
    "Protection",
    "Exporting your data",
    "Keeping and deleting your information",
    "Your rights",
    "Contact us",
    "Children",
    "Changes to this policy",
  ]);
});

test("the multi-program facts the policy must state are present", () => {
  const text = builtText();
  for (const fact of [
    // sign-in
    "sign in with Apple or Google",
    "We never see your Apple or Google password.",
    // age
    "You must be 18 or older to use the app.",
    // health records
    "Epic MyChart",
    "Oracle Health (Cerner)",
    "Medicare Blue Button 2.0",
    "SMART on FHIR",
    "Apple Health Records",
    "Health Connect",
    "Access is read-only.",
    "Ease and ScrollFree get nothing.",
    "encrypted on our servers, never on your phone",
    // the app's own privacy copy
    "No ads. We never sell your health data.",
    // processors
    "Supabase",
    "Render",
    // reminders
    "You have a Tether reminder.",
  ])
    assert.ok(text.includes(fact), `missing: ${fact}`);
});

test("unconfirmed facts stay visibly marked as to be confirmed", () => {
  // Each is an owner or counsel decision, or a fact the code does not yet
  // settle. Each is asserted on its own so removing one cannot hide behind
  // the others.
  const text = textOf(source());
  for (const placeholder of [
    /To be confirmed: the date this policy takes effect\./,
    /To be confirmed: whether this policy also covers a version of the app for Apple devices\./,
    /To be confirmed: which of the programs above can save information to an account/,
    /To be confirmed: the date health-record import is offered in the app, and that token encryption on our servers is in place on that date\./,
    /To be confirmed: when care-team connections, caregiver invites and quitline call-backs are offered/,
    /To be confirmed: what the optional "De-identified research" and "Anonymous app diagnostics" choices collect/,
    /To be confirmed: which service, if any, delivers notifications/,
    /To be confirmed: that our production application server is hosted by Render/,
    /To be confirmed: which service sends the sign-up confirmation and password-reset emails\./,
    /To be confirmed: the contract terms we have with our service providers/,
    /To be confirmed: how your data is protected on your phone, in transit and at our service providers\./,
    /To be confirmed: the format of the full export and which data it includes\./,
    /To be confirmed: how long we keep your account data if you stop using the app without deleting your account\./,
    /To be confirmed: how long copies remain in backups and logs after you delete your account\./,
    /To be confirmed: which privacy and health-data laws apply to the app/,
    /To be confirmed: who answers these emails, how we check who you are/,
    /To be confirmed: what we do if we learn that a child has an account\./,
    /To be confirmed: how people who already have an account will be told/,
  ])
    assert.match(text, placeholder);
});

test("the draft describes no unverified security or privacy weakness", () => {
  // Public text states scope ("To be confirmed: …"), never a gap that has
  // not been verified on the final app.
  assert.deepEqual(gapSentences(textOf(source())), []);
});

test("the draft's to-be-confirmed lines state scope, not a gap", () => {
  const marker = "To be confirmed:";
  const open = sentencesOf(textOf(source()))
    .filter((s) => s.includes(marker))
    .map((s) => s.slice(s.indexOf(marker)));
  assert.ok(open.length >= 18, `only ${open.length} open items found`);
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

test("the page links only site pages and uses only role mailboxes", () => {
  const src = source();
  const hrefs = [...src.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(hrefs, ["/privacy/", "/delete-account/", "/support/"]);
  // <SupportEmail /> renders support@; mailbox="privacy" renders privacy@.
  const mailboxes = [...src.matchAll(/mailbox="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(mailboxes.length > 0, "no privacy contact route");
  for (const mailbox of mailboxes) assert.equal(mailbox, "privacy");
  assert.doesNotMatch(src, /@[a-z0-9.-]+\.[a-z]{2,}/i, "a literal address");
});

test("the draft makes none of the banned words", () => {
  // Substring match on purpose: "securely" and "insecure" are caught too.
  assert.doesNotMatch(
    textOf(source()),
    /HIPAA|compliant|secure|clinically|guarantee/i,
  );
});

test("every encryption statement is attributed to the app's design or copy", () => {
  // The code at the time of writing does not settle encryption on the phone
  // or for record-import tokens, so each such sentence says it is the app's
  // design or what the app's consent screen states, and protection itself is
  // a "To be confirmed" line.
  const text = textOf(source());
  assert.doesNotMatch(text, /\bat rest\b/i);
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences.filter(
    (s) => /encrypt/i.test(s) && !s.includes("To be confirmed:"),
  ))
    assert.match(
      sentence,
      /the app's design|the app's consent screen/i,
      `unattributed: ${sentence}`,
    );
});

test("the draft adds no inline script or style", () => {
  // It must not add a CSP hash; style attributes too.
  const src = source();
  assert.doesNotMatch(src, /<(script|style)\b/);
  assert.doesNotMatch(src, /\sstyle="/, "inline style attribute");
});
