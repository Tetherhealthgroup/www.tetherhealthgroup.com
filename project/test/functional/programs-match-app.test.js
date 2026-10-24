// Functional — the website's programs match the Tether Health app's programs.
//
// test/fixtures/app-programs.json is a byte-for-byte copy of the app's
// tether_ui/spec/programs.json, and test/fixtures/app-program-tokens.json is
// the "program" block of the app's tether_ui/design/tokens.json, both taken
// from the Tether-Health repository at commit 274dd69. When the app's program
// list changes, replace the fixtures with the new files and update
// src/data/programs.ts in the same change; these tests then say exactly which
// field drifted.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dist, projectRoot } from "../helpers/dist.js";

const fixture = (name) =>
  JSON.parse(readFileSync(join(projectRoot, "test/fixtures", name), "utf8"));
const appPrograms = fixture("app-programs.json");
const appTokens = fixture("app-program-tokens.json").program;

const { programs, statusLabels } = await import("../../src/data/programs.ts");

/** Built page as one line of text, tags removed, entities decoded. */
const pageText = (rel) =>
  readFileSync(join(dist, rel), "utf8")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");

test("the pinned app program list has eleven programs", () => {
  assert.equal(appPrograms.length, 11);
  assert.deepEqual(
    Object.keys(appTokens),
    appPrograms.map((p) => p.id),
    "tokens and programs.json list different programs",
  );
});

test("the site lists the app's programs, in the app's order", () => {
  assert.deepEqual(
    programs.map((p) => p.appId),
    appPrograms.map((p) => p.id),
  );
});

test("each program's name, area, archetype and tagline are the app's, verbatim", () => {
  for (const [i, app] of appPrograms.entries()) {
    const site = programs[i];
    for (const field of ["name", "area", "archetype", "tagline"])
      assert.equal(site[field], app[field], `${app.id}.${field}`);
  }
});

test("each program's status label is the app's status, verbatim", () => {
  for (const [i, app] of appPrograms.entries())
    assert.equal(statusLabels[programs[i].status], app.status, app.id);
});

test("each program's colour and letter are the app's design tokens", () => {
  for (const site of programs) {
    const token = appTokens[site.appId];
    assert.ok(token, `no design token for ${site.appId}`);
    assert.equal(site.color.toUpperCase(), token.color.toUpperCase());
    assert.equal(site.letter, token.letter, `${site.appId}.letter`);
    assert.equal(site.name, token.name, `${site.appId}: token name`);
  }
});

test("programs.json colours agree with the design tokens", () => {
  for (const app of appPrograms)
    assert.equal(
      app.color.toUpperCase(),
      appTokens[app.id].color.toUpperCase(),
    );
});

test("URL slugs are unique and stable", () => {
  const slugs = programs.map((p) => p.id);
  assert.equal(new Set(slugs).size, slugs.length, "duplicate slug");
  for (const slug of slugs) assert.match(slug, /^[a-z]+(-[a-z]+)*$/);
});

test("the built programs index shows every program's name, area, tagline and status", () => {
  const text = pageText("programs/index.html");
  for (const app of appPrograms)
    for (const value of [app.name, app.area, app.tagline, app.status])
      assert.ok(text.includes(value), `/programs/ lacks "${value}"`);
  assert.ok(text.includes("11 programs"), "/programs/ does not count 11");
});

test("the built programs index shows the programs in the app's order", () => {
  const text = pageText("programs/index.html");
  const positions = appPrograms.map((app) =>
    text.indexOf(`${app.name} ${app.area} · ${app.archetype}`),
  );
  assert.ok(
    positions.every((p) => p >= 0),
    `a card heading is missing: ${positions}`,
  );
  assert.deepEqual(
    [...positions].sort((a, b) => a - b),
    positions,
    "cards are out of order",
  );
});

test("each built program page carries the app's name, tagline, status and colour", () => {
  for (const site of programs) {
    const app = appPrograms.find((p) => p.id === site.appId);
    const rel = `programs/${site.id}/index.html`;
    const html = readFileSync(join(dist, rel), "utf8");
    const text = pageText(rel);
    assert.match(html, new RegExp(`<h1[^>]*>\\s*${app.name}\\s*</h1>`), rel);
    for (const value of [app.tagline, app.status, app.area])
      assert.ok(text.includes(value), `${rel} lacks "${value}"`);
    assert.ok(
      html
        .toLowerCase()
        .includes(`background-color: ${app.color.toLowerCase()}`),
      `${rel} does not use the program colour ${app.color}`,
    );
  }
});

test("the home page lists every program by name and area", () => {
  const text = pageText("index.html");
  for (const app of appPrograms) {
    assert.ok(text.includes(app.name), `home lacks ${app.name}`);
    assert.ok(text.includes(app.area), `home lacks ${app.area}`);
  }
});
