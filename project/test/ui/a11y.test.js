// UI — accessibility structure that can be read from the built markup.
// Scope: document language, the viewport declaration, one h1 that opens the
// outline, the landmark set and skip link, text alternatives on <img> and
// inline <svg>, accessible names on links, buttons and form fields, and the
// focus ring in the emitted stylesheet. Layout, contrast in context and
// keyboard behaviour need a rendered page and are not asserted here.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { dist, htmlFiles, readPage, decodeEntities } from "../helpers/dist.js";

const attrOf = (tag, key) =>
  tag.match(new RegExp(`\\s${key}="([^"]*)"`, "i"))?.[1];

/** Markup with script and style bodies removed. */
const markupOf = (html) =>
  html
    .replace(/(<script\b[^>]*>)[\s\S]*?(<\/script>)/gi, "$1$2")
    .replace(/(<style\b[^>]*>)[\s\S]*?(<\/style>)/gi, "$1$2");

/** Text a screen reader would read from a fragment: hidden SVGs dropped. */
const textOf = (fragment) =>
  decodeEntities(
    fragment
      .replace(/<svg\b[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/svg>/g, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();

/** Problems with the <img> tags in one page. */
function imageProblems(html) {
  const problems = [];
  for (const [tag] of markupOf(html).matchAll(/<img\b[^>]*>/gi)) {
    const alt = attrOf(tag, "alt");
    const decorative =
      attrOf(tag, "aria-hidden") === "true" ||
      /^(presentation|none)$/.test(attrOf(tag, "role") ?? "");
    const short = tag.slice(0, 90);
    if (alt === undefined) problems.push(`no alt: ${short}`);
    else if (decorative && alt !== "")
      problems.push(`decorative image with alt text: ${short}`);
    else if (!decorative && !decodeEntities(alt).trim())
      problems.push(`content image with empty alt: ${short}`);
    else if (!decorative && /\.(png|jpe?g|webp|avif|gif|svg)\b/i.test(alt))
      problems.push(`alt is a file name: ${short}`);
  }
  return problems;
}

test("the image check rejects a missing or empty alt on a content image", () => {
  assert.equal(imageProblems('<img src="/a.png">').length, 1);
  assert.equal(imageProblems('<img src="/a.png" alt="">').length, 1);
  assert.equal(imageProblems('<img src="/a.png" alt="  ">').length, 1);
  assert.equal(imageProblems('<img src="/a.png" alt="a.png">').length, 1);
  assert.equal(
    imageProblems('<img src="/a.png" alt="x" aria-hidden="true">').length,
    1,
  );
  assert.deepEqual(imageProblems('<img src="/a.png" alt="A chart">'), []);
  assert.deepEqual(
    imageProblems('<img src="/a.png" alt="" role="presentation">'),
    [],
  );
});

test("every page declares English and a zoomable viewport", () => {
  const problems = [];
  for (const page of htmlFiles()) {
    const html = readPage(page);
    if (!/<html\b[^>]*\slang="en"/.test(html)) problems.push(`${page}: lang`);
    const viewport = html.match(/<meta name="viewport" content="([^"]*)"/)?.[1];
    if (!viewport || !/width=device-width/.test(viewport))
      problems.push(`${page}: viewport ${viewport}`);
    else if (
      /user-scalable\s*=\s*(no|0)/i.test(viewport) ||
      Number(viewport.match(/maximum-scale\s*=\s*([\d.]+)/)?.[1] ?? 5) < 2
    )
      problems.push(`${page}: viewport blocks zoom: ${viewport}`);
  }
  assert.deepEqual(problems, []);
});

test("every page has exactly one h1, and it is the first heading", () => {
  const problems = [];
  for (const page of htmlFiles()) {
    const html = markupOf(readPage(page));
    const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => m[1]);
    const h1s = levels.filter((l) => l === "1").length;
    if (h1s !== 1) problems.push(`${page}: ${h1s} h1`);
    else if (levels[0] !== "1")
      problems.push(`${page}: first heading h${levels[0]}`);
    const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "";
    if (h1s === 1 && !textOf(h1)) problems.push(`${page}: empty h1`);
  }
  assert.deepEqual(problems, []);
});

test("every page has one main, banner and contentinfo, and a skip link to main", () => {
  const problems = [];
  for (const page of htmlFiles()) {
    const html = markupOf(readPage(page));
    const body = html.slice(html.indexOf("<body"));
    if ((body.match(/<main\b/g) ?? []).length !== 1)
      problems.push(`${page}: main count`);
    if (!/<main\b[^>]*\sid="main"/.test(body))
      problems.push(`${page}: main id`);
    // The page header and footer are direct children of <body>, so they are
    // the banner and contentinfo landmarks; a <footer> inside <main> is not.
    const outside = body.replace(/<main\b[\s\S]*<\/main>/, "");
    if ((outside.match(/<header\b/g) ?? []).length !== 1)
      problems.push(`${page}: banner count`);
    if ((outside.match(/<footer\b/g) ?? []).length !== 1)
      problems.push(`${page}: contentinfo count`);
    const firstLink = body.match(/<a\b[^>]*>/)?.[0] ?? "";
    if (attrOf(firstLink, "href") !== "#main")
      problems.push(`${page}: first link is not the skip link`);
    for (const [nav] of body.matchAll(/<nav\b[^>]*>/g))
      if (!attrOf(nav, "aria-label")?.trim())
        problems.push(`${page}: unlabelled nav`);
  }
  assert.deepEqual(problems, []);
});

test("every content image has a non-empty text alternative", () => {
  const problems = [];
  let images = 0;
  for (const page of htmlFiles()) {
    const html = readPage(page);
    images += (markupOf(html).match(/<img\b/gi) ?? []).length;
    for (const problem of imageProblems(html))
      problems.push(`${page}: ${problem}`);
  }
  assert.ok(images > 0, "no images found in the build");
  assert.deepEqual(problems, []);
});

test("every inline svg is hidden from assistive technology or named", () => {
  const problems = [];
  for (const page of htmlFiles()) {
    for (const [tag] of markupOf(readPage(page)).matchAll(/<svg\b[^>]*>/g)) {
      const hidden = attrOf(tag, "aria-hidden") === "true";
      const named =
        attrOf(tag, "role") === "img" &&
        Boolean(
          attrOf(tag, "aria-label")?.trim() || attrOf(tag, "aria-labelledby"),
        );
      if (!hidden && !named) problems.push(`${page}: ${tag.slice(0, 80)}`);
    }
  }
  assert.deepEqual(problems, []);
});

test("every link and button has an accessible name", () => {
  const problems = [];
  for (const page of htmlFiles()) {
    const html = markupOf(readPage(page));
    for (const [whole, , open, inner] of html.matchAll(
      /<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/g,
    )) {
      const label = attrOf(` ${open}`, "aria-label")?.trim();
      const labelledby = attrOf(` ${open}`, "aria-labelledby");
      if (!label && !labelledby && !textOf(inner))
        problems.push(`${page}: ${whole.slice(0, 90)}`);
    }
  }
  assert.deepEqual(problems, []);
});

test("every visible form field has a label", () => {
  const problems = [];
  for (const page of htmlFiles()) {
    const html = markupOf(readPage(page));
    const labelled = new Set(
      [...html.matchAll(/<label\b[^>]*\sfor="([^"]+)"/g)].map((m) => m[1]),
    );
    for (const [tag] of html.matchAll(/<(input|select|textarea)\b[^>]*>/g)) {
      if (/\stype="(hidden|submit|button)"/.test(tag)) continue;
      const id = attrOf(tag, "id");
      const named =
        (id && labelled.has(id)) ||
        attrOf(tag, "aria-label")?.trim() ||
        attrOf(tag, "aria-labelledby");
      if (!named) problems.push(`${page}: ${tag.slice(0, 90)}`);
    }
  }
  assert.deepEqual(problems, []);
});

test("the emitted stylesheet draws a visible focus ring", () => {
  const astro = join(dist, "_astro");
  const css = readdirSync(astro)
    .filter((f) => f.endsWith(".css"))
    .map((f) => readFileSync(join(astro, f), "utf8"))
    .join("\n");
  const rule = css.match(/(?:^|[},])\s*:focus-visible\s*\{([^}]*)\}/)?.[1];
  assert.ok(rule, "no :focus-visible rule in the emitted CSS");
  const width = Number(rule.match(/outline:\s*([\d.]+)px\s+solid/)?.[1] ?? 0);
  assert.ok(width >= 2, `focus outline is ${width}px; expected at least 2px`);
});
