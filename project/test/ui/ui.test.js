// UI — rendered output: document metadata, heading order, and text that
// must reflow rather than overflow a narrow viewport.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dist, htmlFiles } from "../helpers/dist.js";

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

test("the account-deletion draft has one h1 and one main landmark", () => {
  // WEB-009: the page is reached directly from a store listing, not from the
  // site's navigation, so its outline must stand on its own.
  const page = "delete-account/index.html";
  assert.ok(htmlFiles().includes(page), `${page} was not built`);
  const html = readFileSync(join(dist, page), "utf8");
  assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, "expected one h1");
  assert.equal(
    (html.match(/<main[\s>]/g) ?? []).length,
    1,
    "expected one main",
  );
  assert.match(html, /<main id="main">/, "main lost the skip-link target");
});

test("the app privacy policy draft has one h1 and one main landmark", () => {
  // WEB-014: reached directly from a store listing, so its outline must stand
  // on its own.
  const page = "app-privacy/index.html";
  assert.ok(htmlFiles().includes(page), `${page} was not built`);
  const html = readFileSync(join(dist, page), "utf8");
  assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, "expected one h1");
  assert.equal(
    (html.match(/<main[\s>]/g) ?? []).length,
    1,
    "expected one main",
  );
  assert.match(html, /<main id="main">/, "main lost the skip-link target");
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
