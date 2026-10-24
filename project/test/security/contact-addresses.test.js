// Security — published contact addresses. The site may publish the seven
// role mailboxes and nothing else: in site data, in any mailto: URL in the
// built markup, in the address the waitlist form sends to, and in any address
// at the company domain written in a tracked text file.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dist, htmlFiles, decodeEntities } from "../helpers/dist.js";
import { repoFiles, repoTextOf } from "../helpers/repo.js";

/** The seven role mailboxes, the only addresses the site may publish. */
const ROLE_MAILBOXES = [
  "admin",
  "careers",
  "finance",
  "partnerships",
  "privacy",
  "security",
  "support",
].map((box) => `${box}@tetherhealthgroup.com`);

const SUPPORT = "support@tetherhealthgroup.com";

/**
 * Removes ASCII tab and newline, as the URL parser does before reading a
 * URL, so "mai&#10;lto:" is read as the mailto: a browser would follow.
 */
const urlInput = (text) => text.replace(/[\t\n\r]/g, "");

/** Markup with script and style bodies removed; their tags stay. */
const markupOf = (html) =>
  html
    .replace(/(<script\b[^>]*>)[\s\S]*?(<\/script\s*>)/gi, "$1$2")
    .replace(/(<style\b[^>]*>)[\s\S]*?(<\/style\s*>)/gi, "$1$2");

/** Every attribute of every tag, value entity-decoded. */
function attributesOf(html) {
  const found = [];
  const tagRe = /<[A-Za-z][^\s/>]*((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
  const attrRe =
    /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+)))?/g;
  for (const [, rest] of markupOf(html).matchAll(tagRe))
    for (const [, name, dq, sq, bare] of rest.matchAll(attrRe))
      found.push({
        name: name.toLowerCase(),
        value: decodeEntities(dq ?? sq ?? bare ?? ""),
      });
  return found;
}

/** Each mailto: URL in an attribute value, as the text after "mailto:". */
function mailtoUrlsIn(attributeValue) {
  const value = urlInput(attributeValue);
  const lead = /^\s*mailto:/i.exec(value);
  if (lead) return [value.slice(lead[0].length)];
  return [...value.matchAll(/mailto:([^\s"'<>()`]*)/gi)].map((m) => m[1]);
}

/** Percent-decoded text, or null if it does not decode. */
function percentDecoded(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    return null;
  }
}

/** Addresses in a decoded recipient list, split on "," and ";". */
const splitAddresses = (list) =>
  list
    .split(/[,;]/)
    .map((a) => a.trim())
    .filter(Boolean);

/**
 * Recipients of one mailto: URL: the path plus every to, cc and bcc query
 * parameter. Returns { primary, all } or { error }.
 */
function recipientsOf(url) {
  const q = url.indexOf("?");
  const path = q === -1 ? url : url.slice(0, q);
  const query = q === -1 ? "" : url.slice(q + 1);
  const decodedPath = percentDecoded(path);
  if (decodedPath === null) return { error: "undecodable path" };
  const primary = splitAddresses(decodedPath);
  const all = [...primary];
  for (const pair of query ? query.split("&") : []) {
    const eq = pair.indexOf("=");
    const key = percentDecoded(eq === -1 ? pair : pair.slice(0, eq));
    const value = percentDecoded(eq === -1 ? "" : pair.slice(eq + 1));
    if (key === null || value === null) return { error: "undecodable query" };
    const field = key.trim().toLowerCase();
    if (field !== "to" && field !== "cc" && field !== "bcc") continue;
    const addresses = splitAddresses(value);
    if (field === "to") primary.push(...addresses);
    all.push(...addresses);
  }
  return { primary, all };
}

test("site data holds exactly the seven role mailboxes", async () => {
  const { contact } = await import("../../src/data/site.ts");
  assert.deepEqual(Object.values(contact).sort(), ROLE_MAILBOXES);
});

test("the waitlist delivers to the support mailbox in site data", async () => {
  const { contact, waitlist } = await import("../../src/data/site.ts");
  assert.equal(waitlist.email, contact.support);
  assert.equal(waitlist.email, SUPPORT);
});

test("every mailto: URL on every built page names only role mailboxes", () => {
  const offenders = [];
  let seen = 0;
  for (const page of htmlFiles()) {
    const html = readFileSync(join(dist, page), "utf8");
    let inAttributes = 0;
    for (const { name, value } of attributesOf(html)) {
      for (const url of mailtoUrlsIn(value)) {
        inAttributes += 1;
        const where = `${page} ${name}="mailto:${url.slice(0, 80)}"`;
        const result = recipientsOf(url);
        if (result.error) {
          offenders.push(`${where}: ${result.error}`);
          continue;
        }
        if (result.primary.length === 0)
          offenders.push(`${where}: no recipient in the path or a to= field`);
        for (const address of result.all)
          if (!ROLE_MAILBOXES.includes(address))
            offenders.push(`${where}: ${address}`);
      }
    }
    // Every mailto: in the markup must be one the loop above examined.
    const inMarkup = (
      urlInput(decodeEntities(markupOf(html))).match(/mailto:/gi) ?? []
    ).length;
    if (inMarkup !== inAttributes)
      offenders.push(
        `${page}: ${inMarkup} mailto: in the markup, ${inAttributes} in attributes`,
      );
    seen += inAttributes;
  }
  assert.ok(seen > 0, "no mailto: URLs found in the build");
  assert.deepEqual(offenders, []);
});

test("every waitlist form in the build sends to the support mailbox", () => {
  // The form's script composes its mailto: from data-email at run time.
  const offenders = [];
  let seen = 0;
  for (const page of htmlFiles()) {
    const html = readFileSync(join(dist, page), "utf8");
    for (const { name, value } of attributesOf(html)) {
      if (name !== "data-email") continue;
      seen += 1;
      const decoded = percentDecoded(value);
      if (decoded !== SUPPORT)
        offenders.push(`${page} data-email="${value.slice(0, 80)}"`);
    }
  }
  assert.ok(seen > 0, "no waitlist form found in the build");
  assert.deepEqual(offenders, []);
});

// ---------------------------------------------------------------------------
// Tracked text. Scope: addresses at the company domain, or a subdomain of it,
// written out in any tracked or untracked-but-not-ignored text file, read
// as written, with character references decoded and with %40 read as "@".
// ---------------------------------------------------------------------------

const COMPANY_DOMAIN = "tetherhealthgroup" + ".com";

/** Every address at the company domain in one text, lower-cased. */
function companyAddressesIn(text) {
  const domain = COMPANY_DOMAIN.replace(".", "\\.");
  const re = new RegExp(
    `([A-Za-z0-9._%+-]+)@((?:[A-Za-z0-9-]+\\.)*${domain})(?![A-Za-z0-9-])`,
    "gi",
  );
  const found = new Set();
  for (const form of [text, decodeEntities(text), text.replace(/%40/gi, "@")])
    for (const [, local, host] of form.matchAll(re))
      found.add(`${local}@${host}`.toLowerCase());
  return [...found];
}

/** Addresses in a text that are not one of the seven role mailboxes. */
const unpublishable = (text) =>
  companyAddressesIn(text).filter((a) => !ROLE_MAILBOXES.includes(a));

test("the tracked-text address check catches a non-role address", () => {
  // Made-up local parts, assembled so this file never contains them whole.
  const at = "@";
  for (const sample of [
    `write to jordan.sample${at}${COMPANY_DOMAIN}`,
    `Jordan.Sample${at}${COMPANY_DOMAIN.toUpperCase()}`,
    `jordan${at}mail.${COMPANY_DOMAIN}`,
    `jordan&#64;${COMPANY_DOMAIN}`,
    `mailto:jordan%40${COMPANY_DOMAIN}`,
  ])
    assert.equal(unpublishable(sample).length, 1, `not caught: ${sample}`);
  for (const sample of [
    `support${at}${COMPANY_DOMAIN}`,
    `Privacy${at}${COMPANY_DOMAIN}`,
    `jordan${at}example.com`,
  ])
    assert.deepEqual(unpublishable(sample), [], sample);
});

test("no tracked text file holds a company address other than a role mailbox", () => {
  const files = repoFiles();
  assert.ok(files.length > 50, `only ${files.length} files listed`);
  const offenders = [];
  let seen = 0;
  for (const path of files) {
    const text = repoTextOf(path);
    if (text === null) continue;
    seen += companyAddressesIn(text).length;
    for (const address of unpublishable(text))
      offenders.push(`${path}: ${address}`);
  }
  assert.ok(seen > 0, "no company address found in any tracked file");
  assert.deepEqual(offenders, []);
});
