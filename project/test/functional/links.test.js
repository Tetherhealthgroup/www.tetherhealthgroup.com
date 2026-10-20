// Functional — internal references resolve in the build itself, without a
// server. Scope: href on <a> and <link>, src on <img>, <script> and <source>,
// every URL in srcset, and the canonical, og:url, og:image and twitter:image
// URLs, wherever they are relative or on the site's own origin. Each must name
// a built page or file, and an in-page #fragment must name an id on the page
// it lands on.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  dist,
  htmlFiles,
  readPage,
  routeOf,
  decodeEntities,
} from "../helpers/dist.js";

const ORIGIN = "https://www.tetherhealthgroup.com";

/** Every reference in one page: { kind, url }. */
function referencesIn(html) {
  const found = [];
  const markup = html.replace(
    /(<script\b[^>]*>)[\s\S]*?(<\/script>)/gi,
    "$1$2",
  );
  for (const [tag, name] of markup.matchAll(/<([a-z]+)\b[^>]*>/gi)) {
    const element = name.toLowerCase();
    const attr = (key) =>
      tag.match(new RegExp(`\\s${key}="([^"]*)"`, "i"))?.[1];
    if (element === "a" || element === "link") {
      const href = attr("href");
      if (href !== undefined)
        found.push({ kind: `${element} href`, url: href });
    }
    if (["img", "script", "source"].includes(element)) {
      const src = attr("src");
      if (src !== undefined) found.push({ kind: `${element} src`, url: src });
    }
    const srcset = attr("srcset");
    if (srcset !== undefined)
      for (const candidate of decodeEntities(srcset).split(","))
        found.push({
          kind: `${element} srcset`,
          url: candidate.trim().split(/\s+/)[0],
        });
    if (element === "meta") {
      const key = attr("property") ?? attr("name");
      if (["og:url", "og:image", "twitter:image"].includes(key))
        found.push({ kind: key, url: attr("content") ?? "" });
    }
  }
  return found.map(({ kind, url }) => ({
    kind,
    url: decodeEntities(url).trim(),
  }));
}

/**
 * The dist file a same-site path is served from, or null. Directory paths
 * resolve to their index.html, as the host and the preview server do.
 */
function fileFor(pathname) {
  const decoded = decodeURIComponent(pathname);
  const candidate = join(dist, decoded);
  if (!candidate.startsWith(dist)) return null;
  if (decoded.endsWith("/")) {
    const index = join(candidate, "index.html");
    return existsSync(index) ? index : null;
  }
  return existsSync(candidate) && statSync(candidate).isFile()
    ? candidate
    : null;
}

/** The dist-relative page for a file, if it is a built page. */
const pageFor = (file) => file.slice(dist.length + 1);

const idsOf = (html) =>
  new Set(
    [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => decodeEntities(m[1])),
  );

/** Problems with one reference from `page`, as strings. */
function problemsWith(page, { kind, url }) {
  if (url === "") return [`${kind} is empty`];
  if (/^(mailto|tel|sms|data|javascript):/i.test(url)) return [];
  let resolved;
  try {
    resolved = new URL(url, ORIGIN + routeOf(page));
  } catch {
    return [`${kind} does not parse: ${url}`];
  }
  if (resolved.origin !== ORIGIN) {
    // Off-site references are the security suite's concern; a protocol-
    // relative or http:// URL to this host is still this host.
    if (resolved.hostname !== new URL(ORIGIN).hostname) return [];
  }
  const file = fileFor(resolved.pathname);
  if (!file) return [`${kind} ${url} names nothing in the build`];
  if (resolved.hash && resolved.hash !== "#") {
    if (!file.endsWith(".html")) return [];
    const id = decodeURIComponent(resolved.hash.slice(1));
    if (!idsOf(readPage(pageFor(file))).has(id))
      return [`${kind} ${url}: no id "${id}" on ${pageFor(file)}`];
  }
  return [];
}

test("the link resolver accepts real targets and rejects missing ones", () => {
  const page = "index.html";
  for (const url of [
    "/",
    "/about/",
    "#main",
    "/support/#testing-list",
    "/og-image.png",
  ])
    assert.deepEqual(problemsWith(page, { kind: "a href", url }), [], url);
  for (const url of [
    "/no-such-page/",
    "/about",
    "/support/#no-such-anchor",
    "#no-such-anchor",
    `${ORIGIN}/missing.png`,
    "missing-relative/",
    "",
  ])
    assert.equal(problemsWith(page, { kind: "a href", url }).length, 1, url);
});

test("every internal reference on every built page resolves", () => {
  const problems = [];
  let checked = 0;
  for (const page of htmlFiles()) {
    for (const ref of referencesIn(readPage(page))) {
      checked += 1;
      for (const problem of problemsWith(page, ref))
        problems.push(`${page}: ${problem}`);
    }
  }
  assert.ok(checked > 500, `only ${checked} references found`);
  assert.deepEqual(problems, []);
});

test("every canonical URL names the page that declares it", () => {
  const problems = [];
  for (const page of htmlFiles()) {
    const canonical = readPage(page).match(
      /<link rel="canonical" href="([^"]*)"/,
    )?.[1];
    if (canonical === undefined) continue;
    const file = fileFor(new URL(canonical, ORIGIN).pathname);
    if (!file || pageFor(file) !== page)
      problems.push(`${page}: canonical ${canonical}`);
  }
  assert.deepEqual(problems, []);
});
