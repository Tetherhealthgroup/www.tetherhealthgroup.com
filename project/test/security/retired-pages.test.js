// Security — the pages that exposed the app's design are gone (WEB-914).
//
// /breathefree/, /breathefree/how-it-works/ and /breathefree/tour/ showed the
// app's full screen sequence and step-by-step flows. They are not built, not
// in the sitemap, not linked from any page, and .htaccess sends their old URLs
// to /programs/tobacco/ with a 301. No app screen image (screen-NN) ships.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  dist,
  projectRoot,
  htmlFiles,
  readPage,
  htaccess,
} from "../helpers/dist.js";

const RETIRED = ["breathefree", "breathefree/how-it-works", "breathefree/tour"];

test("the retired routes are not built", () => {
  for (const route of RETIRED)
    assert.equal(
      existsSync(join(dist, route, "index.html")),
      false,
      `dist/${route}/ exists`,
    );
});

test("the retired routes are not in the sitemap", () => {
  const sitemap = readdirSync(dist)
    .filter((f) => /^sitemap.*\.xml$/.test(f))
    .map((f) => readFileSync(join(dist, f), "utf8"))
    .join("\n");
  assert.ok(sitemap.includes("<loc>"), "no sitemap found");
  assert.doesNotMatch(sitemap, /\/breathefree\//);
});

test("no page links to a retired route", () => {
  for (const rel of htmlFiles())
    assert.doesNotMatch(
      readPage(rel),
      /href="\/breathefree(?:\/[^"]*)?"/,
      `${rel} links a retired page`,
    );
});

test(".htaccess 301s every retired URL, with and without the slash, to the program page", () => {
  const rule = htaccess()
    .match(/^\s*RewriteRule\s+(\S+)\s+(\S+)\s+\[([^\]]*)\]/gm)
    ?.find((l) => /breathefree/.test(l));
  assert.ok(rule, "no RewriteRule for the retired pages");
  const [, pattern, target, flags] = rule
    .trim()
    .match(/^RewriteRule\s+(\S+)\s+(\S+)\s+\[([^\]]*)\]/);
  assert.equal(target, "https://www.tetherhealthgroup.com/programs/tobacco/");
  assert.match(flags, /R=301/);
  const re = new RegExp(pattern);
  for (const path of [
    "breathefree",
    "breathefree/",
    "breathefree/how-it-works",
    "breathefree/how-it-works/",
    "breathefree/tour",
    "breathefree/tour/",
  ])
    assert.ok(re.test(path), `${path} is not redirected`);
  for (const path of ["breathefree/other", "programs/tobacco/", "breathefreex"])
    assert.equal(re.test(path), false, `${path} should not be redirected`);
});

test("no app screen image or screen id ships, and the screen catalog is gone", () => {
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
    );
  const offenders = walk(dist).filter((f) => /screen-\d\d/.test(f));
  assert.deepEqual(offenders, []);
  for (const rel of htmlFiles())
    assert.doesNotMatch(
      readPage(rel),
      /screen-\d\d/,
      `${rel} references a screen id`,
    );
  assert.equal(existsSync(join(projectRoot, "src/data/screens.ts")), false);
  assert.equal(existsSync(join(projectRoot, "src/assets/screens")), false);
});
