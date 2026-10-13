// Smoke — the fastest "is anything fundamentally broken" pass.
// Runs first: if a route stopped being emitted, nothing below matters.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  dist,
  distExists,
  htmlFiles,
  REQUIRED_PAGES,
} from "../helpers/dist.js";

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

test("the share card and robots.txt ship, and the card is not just promised", () => {
  // twitter:card is "summary_large_image", which promises an image. Declaring
  // it without one renders an empty card — worse than not declaring it. The
  // file is asserted to exist, not merely referenced.
  assert.ok(existsSync(join(dist, "og-image.png")), "og-image.png is missing");
  assert.ok(existsSync(join(dist, "robots.txt")), "robots.txt is missing");

  const robots = readFileSync(join(dist, "robots.txt"), "utf8");
  assert.match(
    robots,
    /Sitemap:\s*https:\/\/www\.tetherhealthgroup\.com\/sitemap-index\.xml/,
  );

  for (const page of [
    "index.html",
    "programs/index.html",
    "services/index.html",
  ]) {
    const html = readFileSync(join(dist, page), "utf8");
    assert.match(
      html,
      /<meta property="og:image" content="https:\/\/www\.tetherhealthgroup\.com\/og-image\.png"/,
      `${page} does not point at the share card`,
    );
    assert.match(html, /og:image:alt/, `${page} share card has no alt text`);
  }
});

test("security.txt is emitted at /.well-known/security.txt", () => {
  // Astro copies public/ verbatim, dot-directories included. A build that
  // drops it publishes no vulnerability-reporting route at all.
  const file = join(dist, ".well-known", "security.txt");
  assert.ok(existsSync(file), "dist/.well-known/security.txt is missing");
  assert.match(readFileSync(file, "utf8"), /^Contact: mailto:security@/m);
});
