// Functional — the prepared app-mark logo variant.
//
// The site's header and footer use TetherLogo.astro, a site-original mark.
// The app's design uses a lime leaf on a dark-green circle. TetherAppLogo.astro
// is that mark, prepared so the owner can choose; until the owner does, it
// must not be used anywhere. Switching means changing Header.astro and
// Footer.astro and this file in the same change.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { projectRoot } from "../helpers/dist.js";

const VARIANT = join(projectRoot, "src/components/TetherAppLogo.astro");

/** Every .astro, .ts and .mjs file under src/. */
function sourceFiles(dir = join(projectRoot, "src")) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(astro|ts|mjs)$/.test(entry.name) ? [path] : [];
  });
}

test("the app-mark variant uses the app's teal circle and lime leaf", () => {
  const src = readFileSync(VARIANT, "utf8");
  assert.match(src, /const circle = "#123C37";/);
  assert.match(src, /const leaf = "#D5EF75";/);
  assert.match(src, /viewBox="0 0 32 32"/);
  assert.match(src, /aria-hidden="true"/, "the mark is decorative");
  assert.match(src, /Tether Health/, "no wordmark");
});

test("the variant is prepared but not switched in", () => {
  const importers = sourceFiles().filter(
    (file) =>
      file !== VARIANT &&
      /import\s+\w+\s+from\s+["'][^"']*TetherAppLogo\.astro["']/.test(
        readFileSync(file, "utf8"),
      ),
  );
  assert.deepEqual(importers, [], "TetherAppLogo is imported somewhere");
  for (const name of ["Header.astro", "Footer.astro"])
    assert.match(
      readFileSync(join(projectRoot, "src/components", name), "utf8"),
      /import TetherLogo from "\.\/TetherLogo\.astro";/,
      `${name} no longer uses the current mark`,
    );
});
