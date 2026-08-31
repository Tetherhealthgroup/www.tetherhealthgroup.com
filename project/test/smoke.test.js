/**
 * Smoke tests against the built site in dist/.
 *
 * These run on real build output rather than source, so they catch a route
 * that stopped being emitted, a sitemap that stopped being generated, or a
 * third-party request that crept into a page. Run `npm run build` first.
 *
 * The third-party check is the important one. The site tells visitors, in its
 * privacy notice, that it "loads no third-party scripts, fonts or images".
 * That is a promise a future edit could quietly break by adding a font link or
 * an analytics snippet, so it is asserted rather than trusted.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(projectRoot, "dist");

/** Routes the site must emit. Update deliberately, not to make a test pass. */
const REQUIRED_PAGES = [
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
const ALLOWED_ORIGINS = [
  "https://www.tetherhealthgroup.com",
  "https://schema.org",
];

function distExists() {
  return existsSync(dist);
}

async function htmlFiles(dir = dist, prefix = "") {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      found.push(...(await htmlFiles(join(dir, entry.name), rel)));
    } else if (entry.name.endsWith(".html")) {
      found.push(rel);
    }
  }
  return found;
}

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

test("no page loads a third-party resource", async () => {
  const offenders = [];

  for (const page of await htmlFiles()) {
    const html = readFileSync(join(dist, page), "utf8");
    for (const url of html.match(/https?:\/\/[a-zA-Z0-9.-]+/g) ?? []) {
      if (!ALLOWED_ORIGINS.some((origin) => url.startsWith(origin))) {
        offenders.push(`${page} -> ${url}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    "the privacy notice promises no third-party requests; these break it",
  );
});

test("every page carries a title, description and canonical URL", async () => {
  for (const page of await htmlFiles()) {
    const html = readFileSync(join(dist, page), "utf8");
    assert.match(html, /<title>[^<]+<\/title>/, `${page} has no title`);
    assert.match(
      html,
      /<meta name="description" content="[^"]+"/,
      `${page} has no meta description`,
    );
    assert.match(
      html,
      /<link rel="canonical" href="[^"]+"/,
      `${page} has no canonical URL`,
    );
  }
});

test("the waitlist form points at the support address", () => {
  const html = readFileSync(join(dist, "index.html"), "utf8");
  assert.match(
    html,
    /support@tetherhealthgroup\.com/,
    "the home page must carry the support address the waitlist delivers to",
  );
});

test("safety routing appears on every page", async () => {
  // The footer carries the emergency number and both quitlines. A visitor in
  // difficulty must find them from wherever they landed.
  for (const page of await htmlFiles()) {
    const html = readFileSync(join(dist, page), "utf8");
    assert.match(html, /tel:911/, `${page} is missing the emergency number`);
    assert.match(
      html,
      /1-800-QUIT-NOW/,
      `${page} is missing the English quitline`,
    );
    assert.match(html, /1-855-D/, `${page} is missing the Spanish quitline`);
  }
});

test("no page claims the product is available to download", async () => {
  // The site is pre-launch. App-store links would be a false availability
  // claim; this fails the build if one is added before launch.
  const banned = [/apps\.apple\.com/i, /play\.google\.com/i, /itunes\.apple/i];
  for (const page of await htmlFiles()) {
    const html = readFileSync(join(dist, page), "utf8");
    for (const pattern of banned) {
      assert.ok(
        !pattern.test(html),
        `${page} links to an app store while the product is pre-launch`,
      );
    }
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

test("every health area has a page, and it is honest about status", async () => {
  // Nine of the ten areas have no implementation. The page for each must not
  // read like the one area that does, so the status label is asserted per page
  // rather than assumed from the template.
  const { programs, statusLabels } = await import("../src/data/programs.ts");
  for (const program of programs) {
    const html = readFileSync(
      join(dist, `programs/${program.id}/index.html`),
      "utf8",
    );
    assert.match(
      html,
      new RegExp(statusLabels[program.status]),
      `programs/${program.id}/ does not state its status`,
    );
    for (const service of program.services) {
      assert.ok(
        html.includes(service.name),
        `programs/${program.id}/ is missing the "${service.name}" service`,
      );
    }
    assert.ok(
      program.upcoming.length > 0,
      `${program.id} has no upcoming work listed`,
    );
  }
});

test("area updates describe work that has happened, not work that is planned", () => {
  /* The dedicated /updates/ page has been removed. The same entries now render
     only in the "Already done" section of a health-area page, so that section
     is what has to stay checkable: if it ever starts carrying intent, the
     distinction the site rests on has collapsed.

     The slice is the point. The same page legitimately describes future work
     further down, under "Coming up", so scanning the whole document would
     either fail on correct content or have to drop the check entirely. */
  const html = readFileSync(join(dist, "programs/tobacco/index.html"), "utf8");

  const start = html.indexOf("Already done");
  assert.notEqual(start, -1, "the 'Already done' section is missing");
  const end = html.indexOf("</section>", start);
  assert.notEqual(end, -1, "the 'Already done' section is never closed");
  const landed = html.slice(start, end);

  assert.match(landed, /What has landed here/);
  for (const banned of [/coming soon/i, /will launch/i, /launching soon/i]) {
    assert.ok(
      !banned.test(landed),
      `the 'Already done' section promises future work: ${banned}`,
    );
  }
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

test("no health area is thinner than the others", async () => {
  // The areas are meant to read as one programme, not as one real area and
  // nine stubs. A floor of four service lines and three projects keeps a
  // half-filled area from shipping unnoticed.
  const { programs } = await import("../src/data/programs.ts");
  for (const program of programs) {
    assert.ok(
      program.services.length >= 4,
      `${program.id} has ${program.services.length} services, floor is 4`,
    );
    assert.ok(
      program.upcoming.length >= 3,
      `${program.id} has ${program.upcoming.length} upcoming projects, floor is 3`,
    );
  }
});

test("the services page lists every service and does not read as an offer", async () => {
  const { programs } = await import("../src/data/programs.ts");
  const html = readFileSync(join(dist, "services/index.html"), "utf8");
  for (const program of programs) {
    for (const service of program.services) {
      assert.ok(
        html.includes(service.name),
        `services page is missing "${service.name}" (${program.id})`,
      );
    }
  }
  assert.match(
    html,
    /None of them is available today/,
    "the services page does not say the services are unavailable",
  );
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
