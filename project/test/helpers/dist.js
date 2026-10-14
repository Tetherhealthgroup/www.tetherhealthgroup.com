/**
 * Shared fixtures for the test matrix.
 *
 * Every category under test/ asserts against the same build output, so the
 * paths, the route list and the HTML walkers live here rather than being
 * copied per file. The route list in particular is a contract: it is updated
 * deliberately when a route is added or removed, never to make a test pass.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** project/ — two levels up from test/helpers/. */
export const projectRoot = dirname(
  dirname(dirname(fileURLToPath(import.meta.url))),
);
export const dist = join(projectRoot, "dist");

export const distExists = () => existsSync(dist);

/** Routes the site must emit. Update deliberately, not to make a test pass. */
export const REQUIRED_PAGES = [
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
  "services/index.html",
  // WEB-009 draft: built, but noindex, unlinked and out of the sitemap
  "delete-account/index.html",
  // WEB-014 draft: built, but noindex, unlinked and out of the sitemap
  "app-privacy/index.html",
  // one page per health area, generated from programs.ts
  "programs/tobacco/index.html",
  "programs/metabolic/index.html",
  "programs/cancer/index.html",
  "programs/cardiovascular/index.html",
  "programs/nutrition/index.html",
  "programs/respiratory/index.html",
  "programs/kidney-liver/index.html",
  "programs/behavioral/index.html",
  "programs/preventive/index.html",
  "programs/aging/index.html",
];

/**
 * Hosts allowed to appear in built HTML.
 *
 * schema.org is a JSON-LD vocabulary identifier: it names the vocabulary and
 * is never fetched by the browser, so it costs the visitor no request.
 */
export const ALLOWED_ORIGINS = [
  "https://www.tetherhealthgroup.com",
  "https://schema.org",
];

/** Every built HTML page, as paths relative to dist/. */
export function htmlFiles(dir = dist, prefix = "") {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory())
      found.push(...htmlFiles(join(dir, entry.name), rel));
    else if (entry.name.endsWith(".html")) found.push(rel);
  }
  return found;
}

/** Every built HTML page, as absolute paths. */
export const htmlFilesAbsolute = (dir = dist) =>
  htmlFiles(dir).map((rel) => join(dir, rel));

export const readPage = (rel) => readFileSync(join(dist, rel), "utf8");

/** Map a dist-relative HTML path to the URL path it is served at. */
export function routeOf(rel) {
  if (rel === "404.html") return "/404.html";
  return "/" + rel.replace(/index\.html$/, "");
}

/** Every distinct inline <script> body in the build, as a CSP hash source. */
export function inlineScriptHashes() {
  const hashes = new Map();
  for (const file of htmlFilesAbsolute()) {
    const html = readFileSync(file, "utf8");
    for (const match of html.matchAll(
      /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g,
    )) {
      const body = match[1];
      const hash = createHash("sha256").update(body, "utf8").digest("base64");
      if (!hashes.has(hash)) hashes.set(hash, { file, bytes: body.length });
    }
  }
  return hashes;
}

export const htaccess = () => readFileSync(join(dist, ".htaccess"), "utf8");

export const cspLine = () =>
  htaccess().match(
    /^\s*Header always set Content-Security-Policy "(.+)"$/m,
  )?.[1] ?? "";

/** The ten health areas, read from source so the list cannot drift. */
export function programAreas() {
  const src = readFileSync(join(projectRoot, "src/data/programs.ts"), "utf8");
  return [...src.matchAll(/^\s*id:\s*"([^"]+)"/gm)].map((m) => m[1]);
}
