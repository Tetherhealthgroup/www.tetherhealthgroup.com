// Regression — one case per defect actually fixed. Nothing speculative.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dist, htmlFiles } from "../helpers/dist.js";

test("the 404 document claims no canonical URL of its own", () => {
  // ErrorDocument serves this file for every missing path, so a canonical
  // derived from its build path claimed https://.../404/ — a URL that itself
  // returns 404. Both tags must stay absent; pointing a canonical or an
  // og:url at a non-existent page is a dead reference on every 404 served.
  const html = readFileSync(join(dist, "404.html"), "utf8");
  assert.doesNotMatch(
    html,
    /<link rel="canonical"/,
    "the 404 page must not assert a canonical URL",
  );
  assert.doesNotMatch(
    html,
    /property="og:url"/,
    "the 404 page must not assert an og:url",
  );
  assert.doesNotMatch(
    html,
    /\/404\//,
    "no tag may reference /404/, which is not a route the site serves",
  );
});

test("the waitlist form is never shown as a control that cannot submit", async () => {
  /* Delivery is entirely the form script's job: the site is static, so the
     form has no action and no method. Submitting it without the script
     therefore GETs the current URL — the page reloads and everything typed is
     discarded, which is a submit button that lies about what it does.
     Whenever the form carries no action, the page must also hide it and print
     the address when scripting is unavailable. */
  let pagesWithForm = 0;

  for (const page of await htmlFiles()) {
    const html = readFileSync(join(dist, page), "utf8");
    if (!html.includes('id="waitlist-form"')) continue;
    pagesWithForm++;

    const form = html.match(/<form[^>]*id="waitlist-form"[^>]*>/)[0];
    if (/\saction=/.test(form)) continue; // a real endpoint needs no fallback

    const noscript = html.match(/<noscript>[\s\S]*?<\/noscript>/);
    assert.ok(noscript, `${page} has an actionless form and no <noscript>`);
    assert.match(
      noscript[0],
      /#waitlist-form\s*\{\s*display:\s*none/,
      `${page} leaves an actionless form visible with scripting off`,
    );
    assert.match(
      noscript[0],
      /mailto:support@tetherhealthgroup\.com/,
      `${page} hides the form without offering the address instead`,
    );
  }

  assert.ok(pagesWithForm > 0, "no page carried the waitlist form at all");
});

test("nothing links to the removed updates page", async () => {
  /* Deleting a page is only half the job — a link left pointing at it is a
     404 for a real visitor, and the build will not complain. */
  const offenders = [];
  for (const page of await htmlFiles()) {
    const html = readFileSync(join(dist, page), "utf8");
    if (/href="\/updates\/?"/.test(html)) offenders.push(page);
  }
  assert.deepEqual(
    offenders,
    [],
    `these pages still link to the removed /updates/ page: ${offenders.join(", ")}`,
  );
});

test("no page carries a personal, safecodeg.com or legacy contact address", () => {
  // Public contacts are the role mailboxes only. Personal addresses and
  // safecodeg.com (the hosting account's domain) must never be published.
  const allowed =
    /^(support|privacy|security|partnerships|careers)@tetherhealthgroup\.com$/;
  const offenders = [];
  for (const page of htmlFiles()) {
    const html = readFileSync(join(dist, page), "utf8");
    if (/safecodeg/i.test(html)) offenders.push(`${page} mentions safecodeg`);
    for (const address of html.match(
      /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g,
    ) ?? []) {
      // The waitlist form's placeholder is an example address, not a contact.
      if (address === "you@example.com") continue;
      if (!allowed.test(address)) offenders.push(`${page} -> ${address}`);
    }
  }
  assert.deepEqual(offenders, []);
});
