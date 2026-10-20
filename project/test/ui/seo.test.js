// UI — search and share metadata, the sitemap and robots.txt, read from the
// build. Scope: the tags each built page declares in its <head>, the URLs
// the emitted sitemaps list, and the rules robots.txt states.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { dist, htmlFiles, readPage, routeOf } from "../helpers/dist.js";

const SITE = "https://www.tetherhealthgroup.com";

/** Content of the first <meta> whose name or property is `key`, decoded. */
function metaOf(html, key) {
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/g)) {
    const which = tag.match(/\b(?:name|property)="([^"]*)"/)?.[1];
    if (which === key)
      return (tag.match(/\bcontent="([^"]*)"/)?.[1] ?? "")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&");
  }
  return null;
}

const countOf = (html, re) => (html.match(re) ?? []).length;

const titleOf = (html) =>
  html
    .match(/<title>([^<]*)<\/title>/)?.[1]
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

const canonicalOf = (html) =>
  html.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? null;

const isNoindex = (html) =>
  /<meta name="robots" content="[^"]*\bnoindex\b/.test(html);

/** Every <loc> in the emitted sitemaps, following the index. */
function sitemapUrls() {
  const index = readFileSync(join(dist, "sitemap-index.xml"), "utf8");
  const files = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(files.length > 0, "the sitemap index lists no sitemap");
  const urls = [];
  for (const url of files) {
    assert.ok(url.startsWith(`${SITE}/`), `sitemap off-site: ${url}`);
    const file = join(dist, new URL(url).pathname);
    assert.ok(existsSync(file), `the index lists a missing sitemap: ${url}`);
    for (const m of readFileSync(file, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g))
      urls.push(m[1]);
  }
  return urls;
}

/** The pages meant to be indexed: every built page except noindex ones. */
const indexedPages = () => htmlFiles().filter((p) => !isNoindex(readPage(p)));

test("every page has one title, description, and the share tags that match them", () => {
  const offenders = [];
  for (const page of htmlFiles()) {
    const html = readPage(page);
    const title = titleOf(html);
    const description = metaOf(html, "description");
    if (countOf(html, /<title>/g) !== 1) offenders.push(`${page}: title count`);
    if (countOf(html, /<meta name="description"/g) !== 1)
      offenders.push(`${page}: description count`);
    if (!title?.trim()) offenders.push(`${page}: empty title`);
    if (!description?.trim()) offenders.push(`${page}: empty description`);
    if (metaOf(html, "og:title") !== title)
      offenders.push(`${page}: og:title differs from the title`);
    if (metaOf(html, "og:description") !== description)
      offenders.push(`${page}: og:description differs from the description`);
    if (metaOf(html, "og:type") !== "website")
      offenders.push(`${page}: og:type is not website`);
    if (metaOf(html, "twitter:title") !== title)
      offenders.push(`${page}: twitter:title differs from the title`);
    if (metaOf(html, "twitter:description") !== description)
      offenders.push(`${page}: twitter:description differs`);
  }
  assert.deepEqual(offenders, []);
});

test("no two pages share a title or a description", () => {
  const seen = new Map();
  const duplicates = [];
  for (const page of htmlFiles()) {
    const html = readPage(page);
    for (const [kind, value] of [
      ["title", titleOf(html)],
      ["description", metaOf(html, "description")],
    ]) {
      const key = `${kind}\u0000${value}`;
      if (seen.has(key))
        duplicates.push(`${page} and ${seen.get(key)}: ${kind}`);
      else seen.set(key, page);
    }
  }
  assert.deepEqual(duplicates, []);
});

test("each indexed page's canonical and og:url are its own absolute URL", () => {
  const offenders = [];
  for (const page of indexedPages()) {
    const html = readPage(page);
    const own = SITE + routeOf(page);
    if (countOf(html, /<link rel="canonical"/g) !== 1)
      offenders.push(`${page}: canonical count`);
    if (canonicalOf(html) !== own)
      offenders.push(
        `${page}: canonical ${canonicalOf(html)}, expected ${own}`,
      );
    if (metaOf(html, "og:url") !== own)
      offenders.push(`${page}: og:url ${metaOf(html, "og:url")}`);
  }
  assert.deepEqual(offenders, []);
});

test("the share image is an absolute URL to a file the build emits", () => {
  const offenders = [];
  for (const page of htmlFiles()) {
    const html = readPage(page);
    for (const key of ["og:image", "twitter:image"]) {
      const url = metaOf(html, key);
      if (!url?.startsWith(`${SITE}/`)) {
        offenders.push(`${page}: ${key} is ${url}`);
        continue;
      }
      if (!existsSync(join(dist, new URL(url).pathname)))
        offenders.push(`${page}: ${key} points at a missing file: ${url}`);
    }
    if (!metaOf(html, "og:image:alt")?.trim())
      offenders.push(`${page}: og:image:alt is empty`);
  }
  assert.deepEqual(offenders, []);
});

test("the sitemap lists exactly the indexed pages, once each", () => {
  const listed = sitemapUrls();
  assert.equal(new Set(listed).size, listed.length, "a URL is listed twice");
  const expected = indexedPages().map((p) => SITE + routeOf(p));
  assert.deepEqual(listed.slice().sort(), expected.slice().sort());
});

test("no noindex page, 404 document or unbuilt draft is in the sitemap", () => {
  const listed = sitemapUrls();
  const noindex = htmlFiles().filter((p) => isNoindex(readPage(p)));
  assert.ok(noindex.includes("404.html"), "the 404 document is not noindex");
  for (const page of noindex)
    assert.ok(
      !listed.includes(SITE + routeOf(page)),
      `${page} is noindex but listed`,
    );
  assert.ok(
    !listed.some((url) => /\/404(\.html|\/)|\/_/.test(new URL(url).pathname)),
    "the sitemap lists a 404 or underscore route",
  );
});

test("robots.txt points at the emitted sitemap and blocks no listed URL", () => {
  const robots = readFileSync(join(dist, "robots.txt"), "utf8");
  const sitemaps = [...robots.matchAll(/^Sitemap:\s*(\S+)\s*$/gim)].map(
    (m) => m[1],
  );
  assert.deepEqual(sitemaps, [`${SITE}/sitemap-index.xml`]);
  assert.ok(existsSync(join(dist, "sitemap-index.xml")));
  const disallowed = [...robots.matchAll(/^Disallow:\s*(\S*)\s*$/gim)]
    .map((m) => m[1])
    .filter(Boolean);
  const blocked = sitemapUrls().filter((url) =>
    disallowed.some((rule) => new URL(url).pathname.startsWith(rule)),
  );
  assert.deepEqual(blocked, [], "robots.txt disallows a URL the sitemap lists");
});
