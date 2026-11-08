// Functional — /feedback/, the page given as the Tether Health app's feedback
// address. It reuses the contact form with the App feedback topic
// preselected, so it must still POST to the handler without JavaScript, show
// every error the handler can send back to it, and be reachable from the
// footer, the support page and the sitemap.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dist, htmlFiles, projectRoot, readPage } from "../helpers/dist.js";

const html = () => readPage("feedback/index.html");
const mainOf = (page) => page.match(/<main[\s\S]*?<\/main>/)?.[0] ?? "";
const text = (fragment) =>
  fragment
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/\s+/g, " ");

test("the feedback page is one form that POSTs to the contact handler", () => {
  const main = mainOf(html());
  const form = main.match(/<form\b[^>]*id="contact-form"[^>]*>/)?.[0];
  assert.ok(form, "no contact form on /feedback/");
  assert.match(form, /method="post"/);
  assert.match(form, /action="\/api\/contact\.php"/);
  assert.doesNotMatch(form, /novalidate/);
  assert.equal((html().match(/<form\b/g) ?? []).length, 1, "exactly one form");
  assert.doesNotMatch(main, /mailto:/, "the feedback page lists a mailbox");
  assert.match(html(), /<title>App feedback — Tether Health Group<\/title>/);
});

test("App feedback is the one preselected topic, and it is on the handler's allowlist", () => {
  const select = html().match(
    /<select\b[^>]*name="topic"[^>]*>([\s\S]*?)<\/select>/,
  );
  assert.ok(select, "no topic select");
  assert.match(select[0], /\srequired/);
  const selected = [...select[1].matchAll(/<option\b([^>]*)>([^<]*)</g)]
    .filter((o) => /\sselected\b/.test(o[1]))
    .map((o) => [o[1].match(/value="([^"]*)"/)[1], o[2].trim()]);
  assert.deepEqual(selected, [["app_feedback", "App feedback"]]);
  const lib = readFileSync(
    join(projectRoot, "public", "api", "beta-lib.inc"),
    "utf8",
  );
  assert.match(lib, /'app_feedback' => 'App feedback',/);
});

test("every error the handler can send back to /feedback/ has a message shown by :target", () => {
  const handler = readFileSync(
    join(projectRoot, "public", "api", "contact.php"),
    "utf8",
  );
  const codes = new Set(
    [...handler.matchAll(/contact_fail\('([a-z]+)'\)/g)].map((m) => m[1]),
  );
  assert.ok(codes.size >= 4);
  for (const code of codes) {
    const el = html().match(new RegExp(`<p\\b[^>]*id="error-${code}"[^>]*>`));
    assert.ok(el, `no #error-${code} on /feedback/`);
    assert.match(el[0], /target:flex/);
  }
});

test("the page says what feedback is for, keeps the emergency routing and warns about health details", () => {
  const main = text(mainOf(html()));
  for (const phrase of [
    "Tell us what works, what doesn't, and any ideas you have",
    "In an emergency call 911.",
    "Call or text 988.",
    "Email is not monitored around the clock and we cannot give medical advice.",
    "Please do not include health details you would not want to share by email.",
  ])
    assert.ok(main.includes(phrase), `/feedback/ lacks: ${phrase}`);
});

test("the feedback page is linked from every footer, the support page and the sitemap", () => {
  for (const page of htmlFiles()) {
    // The site footer is the page's last <footer>; a card may hold its own.
    const doc = readPage(page);
    const at = doc.lastIndexOf("<footer");
    const footer = at === -1 ? "" : doc.slice(at);
    if (footer)
      assert.ok(
        footer.includes('href="/feedback/"'),
        `${page} footer lacks /feedback/`,
      );
  }
  const support = readPage("support/index.html");
  assert.match(
    support.match(/<div id="feedback">[\s\S]*?<\/div>/)?.[0] ?? "",
    /href="\/feedback\/"/,
    "the support FAQ does not link /feedback/",
  );
  const sitemap = readFileSync(join(dist, "sitemap-0.xml"), "utf8");
  assert.ok(
    sitemap.includes("<loc>https://www.tetherhealthgroup.com/feedback/</loc>"),
    "/feedback/ is not in the sitemap",
  );
});
