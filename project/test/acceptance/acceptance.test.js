// Acceptance — one case per user-facing criterion, phrased as an outcome.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dist, htmlFiles } from "../helpers/dist.js";

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

test("every health area has a page, and it is honest about status", async () => {
  // Nine of the ten areas have no implementation. The page for each must not
  // read like the one area that does, so the status label is asserted per page
  // rather than assumed from the template.
  const { programs, statusLabels } = await import("../../src/data/programs.ts");
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

test("no health area is thinner than the others", async () => {
  // The areas are meant to read as one programme, not as one real area and
  // nine stubs. A floor of four service lines and three projects keeps a
  // half-filled area from shipping unnoticed.
  const { programs } = await import("../../src/data/programs.ts");
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
  const { programs } = await import("../../src/data/programs.ts");
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

test("the Unplug section says what is not built, next to what is", async () => {
  // The intercept now exists in code, which makes the section more tempting to
  // overstate, not less: what is missing has moved from "unwritten" to "Apple
  // has not granted the permission, and nobody has run it on a real phone".
  // Both caveats are asserted rather than trusted to survive a copy edit.
  const html = readFileSync(join(dist, "breathefree/index.html"), "utf8");
  assert.match(html, /Unplug/, "the BreatheFree page does not mention Unplug");
  assert.match(
    html,
    /What is still missing/,
    "the Unplug section does not name what is missing",
  );
  assert.match(
    html,
    /has never run on anyone/,
    "the Unplug section does not say it is untested on a real device",
  );
  assert.match(
    html,
    /Apple requires a specific permission/,
    "the Unplug section does not say the iPhone permission is ungranted",
  );
});

test("Unplug is on a roadmap, and not sold as a health area of its own", async () => {
  // The code lives inside the BreatheFree application, so the work belongs to
  // tobacco. Mental & behavioural health carries the open question instead —
  // whether screen time is an area at all — and stays "planned".
  const { programs, statusLabels } = await import("../../src/data/programs.ts");
  const tobacco = readFileSync(
    join(dist, "programs/tobacco/index.html"),
    "utf8",
  );
  assert.match(
    tobacco,
    /digital-wellbeing module/,
    "the tobacco roadmap does not list the Unplug module",
  );

  const behavioral = programs.find((program) => program.id === "behavioral");
  assert.equal(
    behavioral.status,
    "planned",
    "mental & behavioural health has been promoted without code to point at",
  );
  const behavioralHtml = readFileSync(
    join(dist, "programs/behavioral/index.html"),
    "utf8",
  );
  assert.match(
    behavioralHtml,
    new RegExp(statusLabels.planned),
    "the behavioural health page does not state its status",
  );
  assert.match(
    behavioralHtml,
    /Screen time as a health area/,
    "the behavioural health roadmap does not carry the open question",
  );
});
