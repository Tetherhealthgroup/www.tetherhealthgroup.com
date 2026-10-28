// Security — the FHIR OAuth redirect pages at /fhir/callback/<provider>/.
//
// These URLs arrive carrying a one-time authorization code. They must never
// be indexed, listed in the sitemap, cached, or sent onward as a Referer, and
// the page must never print the code. The Android package the page hands the
// redirect to must be the one assetlinks.json trusts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dist, projectRoot, htaccess, readPage } from "../helpers/dist.js";

const CALLBACKS = [
  "fhir/callback/bluebutton/index.html",
  "fhir/callback/epic/index.html",
];

test("each callback page is noindex", () => {
  for (const page of CALLBACKS)
    assert.match(
      readPage(page),
      /<meta name="robots" content="noindex/,
      `${page} is indexable`,
    );
});

test("no callback page is listed in the sitemap", () => {
  const sitemap = readFileSync(join(dist, "sitemap-0.xml"), "utf8");
  assert.doesNotMatch(sitemap, /\/fhir\/callback\//);
});

test("no callback page renders the authorization code or the OAuth parameters", () => {
  // The script reads location.search; the markup must not echo it, and the
  // script must never write it into the document.
  for (const page of CALLBACKS) {
    const html = readPage(page);
    assert.doesNotMatch(html, /innerHTML|document\.write|insertAdjacentHTML/);
    assert.doesNotMatch(html, /textContent\s*=\s*[^;]*search/);
  }
});

test("each callback page sets a no-referrer policy of its own", () => {
  for (const page of CALLBACKS)
    assert.match(
      readPage(page),
      /<meta name="referrer" content="no-referrer"/,
      page,
    );
});

test("the callback script strips the query from the address bar", () => {
  for (const page of CALLBACKS)
    assert.match(readPage(page), /history\.replaceState\(/, page);
});

test(".htaccess forbids caching, indexing and referrers for the callbacks", () => {
  const block = htaccess().match(
    /<If "%\{REQUEST_URI\} =~ m#\^\/fhir\/callback\/#">([\s\S]*?)<\/If>/,
  )?.[1];
  assert.ok(block, "no <If> block for /fhir/callback/ in .htaccess");
  assert.match(block, /Header set Cache-Control "no-store"/);
  assert.match(block, /Header always set Referrer-Policy "no-referrer"/);
  assert.match(block, /Header always set X-Robots-Tag "noindex, nofollow"/);
});

test("the package the callback hands off to is the one assetlinks.json trusts", async () => {
  const { androidApp } = await import("../../src/data/site.ts");
  const [statement] = JSON.parse(
    readFileSync(
      join(projectRoot, "public", ".well-known", "assetlinks.json"),
      "utf8",
    ),
  );
  assert.equal(androidApp.packageName, statement.target.package_name);
  for (const page of CALLBACKS)
    assert.ok(
      readPage(page).includes(`data-package="${androidApp.packageName}"`),
      page,
    );
});
