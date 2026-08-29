/**
 * Smoke tests against the built site in dist/.
 *
 * These run on real build output rather than source, so they catch a route
 * that stopped being emitted, a sitemap that stopped being generated, or a
 * third-party request that crept into a page. Run `npm run build` first.
 *
 * The third-party check is the important one. The site tells visitors, in its
 * privacy notice, that it "loads no third-party scripts, fonts or images".
 * That is a promise a future edit could quietly break by adding a font link or
 * an analytics snippet, so it is asserted rather than trusted.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(projectRoot, "dist");

/** Routes the site must emit. Update deliberately, not to make a test pass. */
const REQUIRED_PAGES = [
  "index.html",
  "404.html",
  "about/index.html",
  "accessibility/index.html",
  "breathefree/index.html",
  "breathefree/how-it-works/index.html",
  "breathefree/tour/index.html",
  "for-clinicians/index.html",
  "privacy/index.html",
  "programs/index.html",
  "security/index.html",
  "support/index.html",
  "terms/index.html",
];

/**
 * Hosts allowed to appear in built HTML.
 *
 * schema.org is a JSON-LD vocabulary identifier: it names the vocabulary and
 * is never fetched by the browser, so it costs the visitor no request.
 */
const ALLOWED_ORIGINS = [
  "https://www.tetherhealthgroup.com",
  "https://schema.org",
];

function distExists() {
  return existsSync(dist);
}

async function htmlFiles(dir = dist, prefix = "") {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      found.push(...(await htmlFiles(join(dir, entry.name), rel)));
    } else if (entry.name.endsWith(".html")) {
      found.push(rel);
    }
  }
  return found;
}

test("the build output exists", () => {
  assert.ok(
    distExists(),
    "dist/ is missing — run `npm run build` before the smoke tests",
  );
});

test("every required route is emitted", async () => {
  for (const page of REQUIRED_PAGES) {
    assert.ok(existsSync(join(dist, page)), `missing route: ${page}`);
  }
});

test("no unexpected extra pages appear", async () => {
  const emitted = await htmlFiles();
  assert.deepEqual(
    emitted.slice().sort(),
    REQUIRED_PAGES.slice().sort(),
    "the set of emitted pages changed; update REQUIRED_PAGES deliberately",
  );
});

test("a sitemap is generated and lists the site's own URLs", () => {
  assert.ok(
    existsSync(join(dist, "sitemap-index.xml")),
    "sitemap-index.xml is missing",
  );
  const sitemap = readFileSync(join(dist, "sitemap-0.xml"), "utf8");
  assert.match(sitemap, /https:\/\/www\.tetherhealthgroup\.com\//);
});

test("no page loads a third-party resource", async () => {
  const offenders = [];

  for (const page of await htmlFiles()) {
    const html = readFileSync(join(dist, page), "utf8");
    for (const url of html.match(/https?:\/\/[a-zA-Z0-9.-]+/g) ?? []) {
      if (!ALLOWED_ORIGINS.some((origin) => url.startsWith(origin))) {
        offenders.push(`${page} -> ${url}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    "the privacy notice promises no third-party requests; these break it",
  );
});

test("every page carries a title, description and canonical URL", async () => {
  for (const page of await htmlFiles()) {
    const html = readFileSync(join(dist, page), "utf8");
    assert.match(html, /<title>[^<]+<\/title>/, `${page} has no title`);
    assert.match(
      html,
      /<meta name="description" content="[^"]+"/,
      `${page} has no meta description`,
    );
    assert.match(
      html,
      /<link rel="canonical" href="[^"]+"/,
      `${page} has no canonical URL`,
    );
  }
});

test("the waitlist form points at the support address", () => {
  const html = readFileSync(join(dist, "index.html"), "utf8");
  assert.match(
    html,
    /support@tetherhealthgroup\.com/,
    "the home page must carry the support address the waitlist delivers to",
  );
});

test("safety routing appears on every page", async () => {
  // The footer carries the emergency number and both quitlines. A visitor in
  // difficulty must find them from wherever they landed.
  for (const page of await htmlFiles()) {
    const html = readFileSync(join(dist, page), "utf8");
    assert.match(html, /tel:911/, `${page} is missing the emergency number`);
    assert.match(
      html,
      /1-800-QUIT-NOW/,
      `${page} is missing the English quitline`,
    );
    assert.match(html, /1-855-D/, `${page} is missing the Spanish quitline`);
  }
});

test("no page claims the product is available to download", async () => {
  // The site is pre-launch. App-store links would be a false availability
  // claim; this fails the build if one is added before launch.
  const banned = [/apps\.apple\.com/i, /play\.google\.com/i, /itunes\.apple/i];
  for (const page of await htmlFiles()) {
    const html = readFileSync(join(dist, page), "utf8");
    for (const pattern of banned) {
      assert.ok(
        !pattern.test(html),
        `${page} links to an app store while the product is pre-launch`,
      );
    }
  }
});
