// Regression — one case per defect actually fixed. Nothing speculative.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { dist, htmlFiles, projectRoot } from "../helpers/dist.js";
import { builtCss, colorTokens, contrast, over } from "../helpers/contrast.js";

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

test("no built page claims offline use or clinical review as fact", async () => {
  /* WEB-002 (R-018, R-044): per R-018 the app blocks signed-in users offline
     at startup, and clinical review has not happened, so the site must not
     say "works offline" or "clinically reviewed". Replacement wording is a
     needs-counsel draft; this test only guards the unhedged phrases.
     The negative lookbehind (?<!designed\s+to\s+) lets the hedged
     "designed to work offline" through while still flagging "work offline"
     and "works offline" anywhere else. */
  const banned = [
    /(?<!designed\s+to\s+)works?\s+offline/i,
    /clinically\s+reviewed/i,
  ];
  const offenders = [];
  const pages = await htmlFiles();
  assert.ok(pages.length > 0, "expected built pages in dist/");
  for (const page of pages) {
    const html = readFileSync(join(dist, page), "utf8");
    for (const pattern of banned) {
      if (pattern.test(html)) offenders.push(`${page} matches ${pattern}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `unhedged offline or clinical-review claims in: ${offenders.join(", ")}`,
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

/* ---------------------------------------------------------------------------
   WEB-004 — accessibility and performance pass. Each case below reproduces a
   defect measured on the build before it was fixed.
--------------------------------------------------------------------------- */

// Read lazily so a missing dist/ fails the test that needs it, not the import.
let tokenCache;
const token = (name) => {
  tokenCache ??= colorTokens();
  const hex = tokenCache.get(name);
  assert.ok(hex, `design token --color-${name} is not in the built CSS`);
  return hex;
};
const classOf = (tag) => tag.match(/\sclass="([^"]*)"/)?.[1] ?? "";
const pageHtml = (rel) => readFileSync(join(dist, rel), "utf8");

// Surfaces the keyboard focus ring can land on, light and dark.
const LIGHT_SURFACES = ["cream", "paper", "mint", "mint-pale", "white"];
const DARK_SURFACES = ["teal-deep", "teal-raised"];

test("the focus ring is at least 3:1 on every surface it lands on", () => {
  // WCAG 1.4.11. The ring was --color-coral: 2.30:1 on cream, 2.47:1 on
  // paper, 2.15:1 on mint — a focus indicator a low-vision keyboard user
  // could not reliably see. The ring is now a dark teal on light surfaces and
  // switches to lime inside the dark teal panels.
  const css = builtCss();
  const light = css.match(
    /(?:^|\})\s*:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--color-([a-z-]+)\)/,
  );
  assert.ok(light, "no global :focus-visible outline rule found");
  for (const surface of LIGHT_SURFACES) {
    const ratio = contrast(token(light[1]), token(surface));
    assert.ok(
      ratio >= 3,
      `focus ring ${light[1]} is ${ratio.toFixed(2)}:1 on ${surface}`,
    );
  }

  // The override is `:is(<dark classes>) :focus-visible{outline-color:...}`.
  // Match the :is() list and require both dark classes, in any order.
  const darkRule = css.match(
    /:is\(([^)]*)\)\s*:focus-visible\s*\{[^}]*outline-color:\s*var\(--color-([a-z-]+)\)/,
  );
  assert.ok(darkRule, "no focus-ring override for the dark teal panels");
  const darkClasses = darkRule[1].split(",").map((c) => c.trim());
  for (const cls of [".bg-teal-deep", ".bg-teal-raised"])
    assert.ok(darkClasses.includes(cls), `dark override omits ${cls}`);
  const dark = [null, darkRule[2]];
  for (const surface of DARK_SURFACES) {
    const ratio = contrast(token(dark[1]), token(surface));
    assert.ok(
      ratio >= 3,
      `focus ring ${dark[1]} is ${ratio.toFixed(2)}:1 on ${surface}`,
    );
  }
});

test("waitlist fields have a visible border, readable placeholder and readable error", () => {
  // WCAG 1.4.11 / 1.4.3. The field border was --color-hairline (1.72:1 on
  // paper), the placeholder was teal-mid at 70% opacity (2.93:1) and the
  // validation message was coral text (2.47:1 on paper).
  const html = pageHtml("index.html");
  const paper = token("paper");

  const input = html.match(/<input[^>]*id="wl-email"[^>]*>/)?.[0];
  assert.ok(input, "the email field is missing from the home page");
  const cls = classOf(input);

  const border = cls.match(/(?:^|\s)border-(?!2\b)([a-z-]+)(?=\s|$)/)?.[1];
  assert.ok(border, "the email field declares no border colour");
  assert.ok(
    contrast(token(border), paper) >= 3,
    `field border ${border} is ${contrast(token(border), paper).toFixed(2)}:1 on paper`,
  );

  const ph = cls.match(/placeholder:text-([a-z-]+)(?:\/(\d+))?(?=\s|$)/);
  assert.ok(ph, "the email field declares no placeholder colour");
  const placeholder = ph[2]
    ? over(token(ph[1]), paper, Number(ph[2]) / 100)
    : token(ph[1]);
  assert.ok(
    contrast(placeholder, paper) >= 4.5,
    `placeholder is ${contrast(placeholder, paper).toFixed(2)}:1 on paper`,
  );

  const error = html.match(/<p[^>]*id="wl-email-error"[^>]*>/)?.[0];
  assert.ok(error, "the email error message is missing");
  const text = classOf(error).match(
    /(?:^|\s)text-(?!sm\b)([a-z-]+)(?=\s|$)/,
  )?.[1];
  assert.ok(text, "the email error declares no text colour");
  assert.ok(
    contrast(token(text), paper) >= 4.5,
    `error text ${text} is ${contrast(token(text), paper).toFixed(2)}:1 on paper`,
  );
});

test("the home link's accessible name comes from the logo text it shows", () => {
  // WCAG 2.5.3. The link carried aria-label="Tether Health Group — home" while
  // the logo renders "Tether Health" and "GROUP" as two blocks, so the
  // visible text ("Tether Health\nGROUP") was not contained in the name;
  // Lighthouse flagged label-content-name-mismatch on all 25 runs. With no
  // aria-label the name is computed from the content, which includes a
  // visually hidden "— home".
  for (const page of htmlFiles()) {
    const html = pageHtml(page);
    const link = html.match(
      /<header[\s\S]*?(<a href="\/"[^>]*>[\s\S]*?<\/a>)/,
    )?.[1];
    assert.ok(link, `${page} has no home link in the header`);
    assert.doesNotMatch(
      link,
      /aria-label=/,
      `${page}: home link overrides its name`,
    );
    const name = link
      .replace(/<svg[\s\S]*?<\/svg>/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    assert.equal(name, "Tether Health Group — home", `${page}: ${name}`);
  }
});

test("repeated links and controls are at least 44px tall", () => {
  // Requested bar is 44px (WCAG 2.5.5 AAA; 2.5.8 AA only needs 24px).
  // Measured before: header nav links 39px, header CTA 43px, tour jump chips
  // 40px, emergency/quitline phone links 28-32px, footer links 17px.
  // Rendered height cannot be read from static HTML, so this asserts the
  // min-h-11 utility (2.75rem = 44px) is on each of them.
  const hasMin = (tag) => /(?:^|\s)!?min-h-11(?=\s|$)/.test(classOf(tag));
  const missing = [];

  for (const page of htmlFiles()) {
    const html = pageHtml(page);

    const header = html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? "";
    for (const tag of header.match(/<a [^>]*>/g) ?? [])
      if (!hasMin(tag)) missing.push(`${page} header ${tag.slice(0, 60)}`);

    const footer =
      html.match(/<footer class="[^"]*bg-teal-deep[\s\S]*?<\/footer>/)?.[0] ??
      "";
    for (const nav of footer.match(/<nav[\s\S]*?<\/nav>/g) ?? [])
      for (const tag of nav.match(/<a [^>]*>/g) ?? [])
        if (!hasMin(tag)) missing.push(`${page} footer ${tag.slice(0, 60)}`);

    // The footer's 911 link sits inside a sentence, where WCAG 2.5.8 exempts
    // inline targets; every other phone link stands on its own line.
    const phoneLinks = html.match(/<a [^>]*href="tel:[^"]*"[^>]*>/g) ?? [];
    for (const tag of phoneLinks) {
      const inFooterSentence =
        footer.includes(tag) && tag.includes('href="tel:911"');
      if (!inFooterSentence && !hasMin(tag))
        missing.push(`${page} ${tag.slice(0, 60)}`);
    }
  }

  const tour = pageHtml("breathefree/tour/index.html");
  for (const tag of tour.match(/<a [^>]*href="#tour-[^"]*"[^>]*>/g) ?? [])
    if (!hasMin(tag)) missing.push(`tour ${tag.slice(0, 60)}`);

  assert.deepEqual(
    missing,
    [],
    `links under the 44px bar:\n${missing.join("\n")}`,
  );
});

test("phone screenshots are encoded for the size they are displayed at", () => {
  // The device frame is `width` px wide with border-box padding, so the
  // screenshot is shown at width - 2*padding. It was encoded at 2*width, i.e.
  // the 1x candidate was already ~2.1x the display size and the 2x candidate
  // ~4.3x; Lighthouse image-delivery flagged ~60 KB wasted per image on six
  // pages. The 1x width must equal the displayed width, with 2x and 3x
  // candidates for high-density screens.
  let frames = 0;
  for (const page of htmlFiles()) {
    const html = pageHtml(page);
    for (const m of html.matchAll(
      /<div class="relative bg-teal-deep[^"]*" style="width:(\d+)px;padding:(\d+)px;[^"]*">\s*(<img[^>]*>)/g,
    )) {
      frames += 1;
      const displayed = Number(m[1]) - 2 * Number(m[2]);
      const width = Number(m[3].match(/\swidth="(\d+)"/)?.[1]);
      assert.equal(
        width,
        displayed,
        `${page}: image declares ${width}px for a ${displayed}px slot`,
      );
      assert.match(m[3], /\s3x"?[ >]|\s3x,|\s3x"/, `${page}: no 3x candidate`);
    }
  }
  assert.ok(frames > 0, "no phone frame found to check");
});

test("a field marked invalid keeps a border of at least 3:1 on paper", () => {
  // WCAG 1.4.11. The form script marks a bad address with aria-invalid and
  // also toggles the `border-coral` utility (2.47:1 on paper). The border the
  // visitor actually sees is the unlayered `input[aria-invalid=true]` rule in
  // global.css if there is one, otherwise the toggled utility.
  const paper = token("paper");
  const css = builtCss();
  const rule = css.match(
    /input\[aria-invalid=["']?true["']?\]\s*\{[^}]*border-color:\s*var\(--color-([a-z-]+)\)/,
  );

  const script = pageHtml("index.html").match(
    /classList\.toggle\(\s*["'`]border-([a-z-]+)["'`]/,
  );
  const effective = rule?.[1] ?? script?.[1];
  assert.ok(effective, "no invalid-state border colour could be found");

  const ratio = contrast(token(effective), paper);
  assert.ok(
    ratio >= 3,
    `invalid-state border ${effective} is ${ratio.toFixed(2)}:1 on paper`,
  );
});
