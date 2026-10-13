// Regression — one case per defect actually fixed. Nothing speculative.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { dist, htmlFiles, projectRoot } from "../helpers/dist.js";

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

test("the legal-page 'Last updated' date reads the same in every time zone", () => {
  /* Legal.astro formatted new Date("2026-10-12") in the machine's own zone.
     That is UTC midnight, so a build west of UTC (the release Mac, Pacific
     time) printed "11 October 2026" beside datetime="2026-10-12". CI builds
     in UTC and never saw it. The zone is fixed per child process through TZ,
     because Intl reads it once at start-up; one process cannot test two. */
  const script = `
    import { formatLegalDate } from ${JSON.stringify(
      pathToFileURL(join(projectRoot, "src/lib/legal-date.ts")).href,
    )};
    process.stdout.write(
      [formatLegalDate("2026-10-12"), formatLegalDate("2026-08-29"),
       new Date(2026, 9, 12).getTimezoneOffset()].join("|"));
  `;
  /* The offset (minutes, sign as Date reports it) proves the zone took effect:
     PDT is +420, IST is -330. A TZ the runtime ignored would show 0. */
  const zones = [
    ["America/Los_Angeles", 420],
    ["Asia/Kolkata", -330],
    ["UTC", 0],
  ];
  for (const [tz, offset] of zones) {
    const out = execFileSync(
      process.execPath,
      ["--experimental-strip-types", "--input-type=module", "-e", script],
      { env: { ...process.env, TZ: tz }, encoding: "utf8" },
    );
    assert.equal(
      out,
      `12 October 2026|29 August 2026|${offset}`,
      `date label wrong when built under TZ=${tz}`,
    );
  }
});

test("formatLegalDate rejects anything but a real YYYY-MM-DD date", async () => {
  const { formatLegalDate } = await import("../../src/lib/legal-date.ts");
  for (const bad of [
    "",
    "2026-10-12T00:00:00Z",
    "12/10/2026",
    "2026-1-5",
    "2026-02-30",
    "2026-13-01",
  ]) {
    assert.throws(() => formatLegalDate(bad), /updated/, `accepted: ${bad}`);
  }
});

test("each legal page's visible date matches its datetime attribute", () => {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  for (const rel of ["privacy", "security", "terms", "accessibility"]) {
    const html = readFileSync(join(dist, rel, "index.html"), "utf8");
    const m = html.match(
      /<time datetime="(\d{4})-(\d{2})-(\d{2})">([^<]*)<\/time>/,
    );
    assert.ok(m, `${rel}: no <time> element found`);
    const [, y, mo, d, text] = m;
    assert.equal(
      text,
      `${Number(d)} ${months[Number(mo) - 1]} ${y}`,
      `${rel}: visible date disagrees with datetime`,
    );
  }
});
