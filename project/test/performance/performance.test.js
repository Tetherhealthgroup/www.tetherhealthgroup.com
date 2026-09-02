// Performance — budgets on what the visitor actually downloads.
//
// This site has no webfont, no analytics and no third-party request, so its
// performance story is almost entirely "how much HTML, and how many images".
// Both grow silently: a new section adds markup to every page that includes
// it, and a new screen adds a responsive image set.
//
// Every budget below is set from a measurement of the current build, with
// headroom, and the measured value is recorded next to it. The point is to
// catch a step change — a webfont, an un-optimised PNG, a render-blocking
// stylesheet — not to police kilobytes.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { dist, htmlFiles } from "../helpers/dist.js";

const KB = 1024;

test("no single page ships more HTML than its budget", () => {
  // Measured largest: index.html at 67.2 KB. 120 KB leaves room for another
  // long page without letting one grow without limit.
  const over = [];
  for (const page of htmlFiles()) {
    const bytes = statSync(join(dist, page)).size;
    if (bytes > 120 * KB) over.push(`${page} ${(bytes / KB).toFixed(1)}KB`);
  }
  assert.deepEqual(over, [], `pages over the 120KB HTML budget: ${over}`);
});

test("the whole site's HTML stays inside its budget", () => {
  // Measured: 789 KB across 24 pages. 1.5 MB catches a page count or a
  // per-page size that has roughly doubled.
  const total = htmlFiles().reduce(
    (sum, page) => sum + statSync(join(dist, page)).size,
    0,
  );
  assert.ok(
    total < 1.5 * KB * KB,
    `total HTML is ${(total / KB / KB).toFixed(2)}MB, over the 1.5MB budget`,
  );
});

test("no page carries more inline script than its budget", () => {
  // Measured largest: 3226 bytes, on the pages with the waitlist form.
  // Inline script is CSP-hashed, so growth here also means policy churn.
  const over = [];
  for (const page of htmlFiles()) {
    const html = readFileSync(join(dist, page), "utf8");
    const bytes = [
      ...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g),
    ].reduce((sum, m) => sum + m[1].length, 0);
    if (bytes > 8 * KB) over.push(`${page} ${bytes}B`);
  }
  assert.deepEqual(
    over,
    [],
    `pages over the 8KB inline-script budget: ${over}`,
  );
});

test("every page blocks rendering on exactly one stylesheet", () => {
  // Measured: 1 per page. A second stylesheet is a second render-blocking
  // round trip, and is how a webfont or an icon set usually arrives.
  for (const page of htmlFiles()) {
    const html = readFileSync(join(dist, page), "utf8");
    const sheets = html.match(/<link[^>]*rel="stylesheet"/g) ?? [];
    assert.equal(
      sheets.length,
      1,
      `${page} blocks on ${sheets.length} stylesheets, not 1`,
    );
  }
});

test("every emitted image is in a modern format", () => {
  // Measured: 94 of 95 build assets are .webp, the other is the stylesheet.
  // A .png or .jpg here means an image bypassed astro:assets.
  const stale = readdirSync(join(dist, "_astro")).filter((f) =>
    /\.(png|jpe?g|gif|bmp|tiff?)$/i.test(f),
  );
  assert.deepEqual(
    stale,
    [],
    `assets that skipped image optimisation: ${stale}`,
  );
});

test("every image declares its own size, so nothing reflows on load", () => {
  // Cumulative Layout Shift: an <img> with no intrinsic size collapses to
  // zero height until it loads, then pushes the page down. Astro emits
  // width/height for every optimised image; this asserts none slipped
  // through as raw markup.
  const bad = [];
  for (const page of htmlFiles()) {
    const html = readFileSync(join(dist, page), "utf8");
    for (const tag of html.match(/<img\b[^>]*>/g) ?? []) {
      if (!/\swidth="\d+"/.test(tag) || !/\sheight="\d+"/.test(tag)) {
        bad.push(`${page}: ${tag.slice(0, 80)}`);
      }
    }
  }
  assert.deepEqual(bad, [], `images with no declared size: ${bad}`);
});

test("offscreen images are deferred and decoded off the main thread", () => {
  // The screen tour renders 28 phone screenshots. If they all loaded eagerly
  // the page would fetch every one before settling.
  const bad = [];
  for (const page of htmlFiles()) {
    const html = readFileSync(join(dist, page), "utf8");
    for (const tag of html.match(/<img\b[^>]*>/g) ?? []) {
      if (!/\sloading="(lazy|eager)"/.test(tag))
        bad.push(`${page}: no loading=`);
      if (!/\sdecoding="/.test(tag)) bad.push(`${page}: no decoding=`);
    }
    // At most one image per page may be eager: the one above the fold.
    const eager = (html.match(/loading="eager"/g) ?? []).length;
    assert.ok(
      eager <= 1,
      `${page} loads ${eager} images eagerly; at most one should be`,
    );
  }
  assert.deepEqual(bad, [], `images missing loading/decoding hints: ${bad}`);
});

test("the deployed payload stays inside its budget", () => {
  // Measured: 5.8 MB, almost entirely the 94 responsive screenshots.
  // 12 MB catches the whole screen catalog being duplicated or shipped
  // un-optimised, which is the realistic regression.
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).reduce((sum, entry) => {
      const full = join(dir, entry.name);
      return sum + (entry.isDirectory() ? walk(full) : statSync(full).size);
    }, 0);

  const bytes = walk(dist);
  assert.ok(
    bytes < 12 * KB * KB,
    `dist/ is ${(bytes / KB / KB).toFixed(1)}MB, over the 12MB budget`,
  );
});
