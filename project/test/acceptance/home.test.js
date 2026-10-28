// Acceptance — the landing page presents all eleven programs equally and
// says what the app does with doctors and health records (WEB-914).

import { test } from "node:test";
import assert from "node:assert/strict";
import { htmlFiles, readPage } from "../helpers/dist.js";

const { programs } = await import("../../src/data/programs.ts");

const visible = (html) =>
  html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
const home = () => readPage("index.html");
const section = (id) =>
  home().match(new RegExp(`<section[^>]*id="${id}"[\\s\\S]*?</section>`))?.[0];

test("home does not single out BreatheFree", () => {
  const text = visible(home());
  for (const phrase of [
    "Meet BreatheFree",
    "Explore BreatheFree",
    "BreatheFree spotlight",
    "starting with BreatheFree",
  ])
    assert.ok(!text.includes(phrase), `home still says "${phrase}"`);
  const main = home().match(/<main[\s\S]*?<\/main>/)?.[0] ?? "";
  assert.ok(main, "home has no <main>");
  assert.doesNotMatch(
    main,
    /<a\b[^>]*href="\/breathefree\/(?:tour|how-it-works)\/"/,
    "home links the BreatheFree tour or walkthrough",
  );
});

test("the hero's two calls to action are early access and all programs", () => {
  assert.match(home(), /<a\b[^>]*href="\/beta\/"[^>]*>\s*Get early access/);
  assert.match(
    home(),
    /<a\b[^>]*href="\/programs\/"[^>]*>\s*See all 11 programs/,
  );
});

test("all eleven programs render on home, in the app's order, presented alike", () => {
  const grid = section("programs");
  assert.ok(grid, "no #programs section");
  const names = [...grid.matchAll(/<h3[^>]*>\s*([^<]+?)\s*<\/h3>/g)].map(
    (m) => m[1],
  );
  assert.equal(programs.length, 11);
  assert.deepEqual(
    names,
    programs.map((p) => p.name),
  );
  const links = [
    ...grid.matchAll(
      /<a href="([^"]+)"[^>]*>\s*<span class="sr-only">([^<]+): <\/span>What it includes/g,
    ),
  ];
  assert.equal(links.length, 11, "every card has the same single link");
  for (const [i, program] of programs.entries())
    assert.equal(
      links[i][1],
      program.product?.href ?? `/programs/${program.id}/`,
    );
  assert.doesNotMatch(grid, /Meet BreatheFree/);
});

test("the doctor section says what the app does, with no claim about clinicians using it", () => {
  const s = section("doctor");
  assert.ok(s, "no #doctor section");
  const text = visible(s);
  for (const phrase of [
    "Work with your doctor",
    "preview first",
    "invite code",
    "single-use link that expires",
    "911 and 988",
  ])
    assert.ok(text.includes(phrase), `doctor section lacks "${phrase}"`);
  assert.match(s, /href="\/for-clinicians\/"/);
});

test("the records section names the four sources and says they are coming", () => {
  const s = section("records");
  assert.ok(s, "no #records section");
  const text = visible(s);
  for (const source of [
    "Epic MyChart",
    "Medicare Blue Button",
    "Apple Health",
    "Health Connect",
  ])
    assert.ok(text.includes(source), `records section lacks ${source}`);
  assert.match(text, /coming in the app/i);
  assert.match(text, /It is not available today\./);
  assert.match(text, /opt-in only/);
  assert.match(text, /review every item before it is added/);
  assert.match(text, /disconnect at any time/);
  assert.match(s, /href="\/integrations\/"/);
});

test("home tells people how to get help and what to do in an emergency", () => {
  const s = section("help");
  assert.ok(s, "no #help section");
  assert.match(s, /mailto:support@tetherhealthgroup\.com/);
  assert.match(s, /href="\/support\/"/);
  assert.match(s, /href="tel:911"/);
  assert.match(s, /href="tel:988"/);
});

test("no page claims to build with clinicians", () => {
  const pattern =
    /\b(?:building|build|built|working|work|designed)\s+(?:this\s+|it\s+)?with\s+clinicians\b/i;
  for (const sample of [
    "Building this with clinicians, not around them.",
    "We build with clinicians.",
  ])
    assert.match(sample, pattern);
  for (const rel of htmlFiles())
    assert.doesNotMatch(
      visible(readPage(rel)),
      pattern,
      `${rel} claims to build with clinicians`,
    );
});
