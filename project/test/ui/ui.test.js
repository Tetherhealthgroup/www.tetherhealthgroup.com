// UI — rendered output: document metadata, heading order, and text that
// must reflow rather than overflow a narrow viewport.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dist, projectRoot, htmlFiles } from "../helpers/dist.js";

test("every page carries a title, description and canonical URL", async () => {
  for (const page of await htmlFiles()) {
    const html = readFileSync(join(dist, page), "utf8");
    assert.match(html, /<title>[^<]+<\/title>/, `${page} has no title`);
    assert.match(
      html,
      /<meta name="description" content="[^"]+"/,
      `${page} has no meta description`,
    );

    /* The 404 document is the one exception, and it is asserted separately
       below: Apache serves it at whatever path was requested, so it has no
       URL of its own to be canonical. */
    if (page === "404.html") continue;

    assert.match(
      html,
      /<link rel="canonical" href="[^"]+"/,
      `${page} has no canonical URL`,
    );
  }
});

test("the support address can break instead of overflowing the viewport", () => {
  // At 375px the address rendered 350px wide inside a card starting at x=54,
  // pushing the document to 404px and giving /support/ a horizontal scrollbar.
  //
  // Layout cannot be measured from static HTML, so this asserts the two things
  // that prevent it: a break opportunity at the "@", and overflow-wrap as the
  // fallback for a viewport too narrow even for the domain alone. It is a proxy
  // for the real defect — it fails if the fix is removed, not if a future
  // change reintroduces overflow some other way.
  const html = readFileSync(join(dist, "support/index.html"), "utf8");
  assert.match(
    html,
    /support@<wbr>tetherhealthgroup\.com/,
    "the support address lost its break opportunity at the @",
  );
  assert.match(
    html,
    /class="[^"]*\bwrap-anywhere\b[^"]*"[^>]*>support@/,
    "the support address lost its overflow-wrap fallback",
  );
});

test("no page skips a heading level", async () => {
  // /programs/ jumped h1 -> h3: the ten area cards are h3, matching the
  // h2-section / h3-card pattern used everywhere else, but the h2 that
  // introduces the same grid on the home page is the h1 here. A skipped level
  // breaks the outline screen-reader users navigate by.
  for (const page of await htmlFiles()) {
    const html = readFileSync(join(dist, page), "utf8");
    const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) =>
      Number(m[1]),
    );
    const skips = [];
    for (let i = 1; i < levels.length; i += 1) {
      if (levels[i] - levels[i - 1] > 1)
        skips.push(`h${levels[i - 1]} -> h${levels[i]}`);
    }
    assert.deepEqual(
      skips,
      [],
      `${page} skips a heading level: ${skips.join(", ")}`,
    );
  }
});

test("each store page keeps one h1 and the shared layout", () => {
  // The account-deletion and app privacy pages are reached directly from a
  // store listing or the app, so their outline must stand on its own: Base
  // supplies the one <main id="main"> and PageHero the one h1.
  for (const name of ["delete-account.astro", "app-privacy.astro"]) {
    const src = readFileSync(join(projectRoot, "src/pages", name), "utf8");
    assert.equal((src.match(/<Base\b/g) ?? []).length, 1, `${name}: Base`);
    assert.equal(
      (src.match(/<PageHero\b/g) ?? []).length,
      1,
      `${name}: expected one PageHero (its h1)`,
    );
    assert.doesNotMatch(src, /<(h1|main)\b/, `${name}: a second h1 or main`);
  }
});

test("meta descriptions are a length a search result will actually show", async () => {
  // Four pages shipped descriptions over 165 characters, which search results
  // truncate mid-sentence. Under 50 is too thin to be useful.
  for (const page of await htmlFiles()) {
    const html = readFileSync(join(dist, page), "utf8");
    const match = html.match(/<meta name="description" content="([^"]*)"/);
    assert.ok(match, `${page} has no meta description`);
    const length = match[1].length;
    assert.ok(
      length >= 50 && length <= 165,
      `${page} description is ${length} chars; keep it between 50 and 165`,
    );
  }
});
