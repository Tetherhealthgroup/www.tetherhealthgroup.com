// Functional — the beta waitlist page (P-108), read from the build.
//
// The form must submit with JavaScript off: a real POST to the PHP handler,
// browser-enforced required fields, and error messages the handler's
// redirects can reveal without a script. It asks for the minimum: no health
// condition and no program. The handler's allowlists and the form's options
// are compared here so the two cannot drift apart.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { dist, projectRoot, readPage } from "../helpers/dist.js";

const page = () => readPage("beta/index.html");
/** The PHP handlers and their shared code, as one text. */
const handlerSource = () =>
  ["beta-lib.inc", "beta-signup.php", "beta-confirm.php"]
    .map((name) =>
      readFileSync(join(projectRoot, "public", "api", name), "utf8"),
    )
    .join("\n");

const formTag = () => page().match(/<form\b[^>]*id="beta-form"[^>]*>/)?.[0];
const formBody = () =>
  page().match(/<form\b[^>]*id="beta-form"[^>]*>([\s\S]*?)<\/form>/)?.[1] ?? "";

/** Every control in the form as { tag, html, name }. */
function controls() {
  return [...formBody().matchAll(/<(input|select|textarea)\b[^>]*>/g)].map(
    ([html, tag]) => ({ tag, html, name: html.match(/\sname="([^"]*)"/)?.[1] }),
  );
}
const control = (name) => controls().find((c) => c.name === name);

/** Option values of one select. */
function optionsOf(name) {
  const select = formBody().match(
    new RegExp(`<select\\b[^>]*name="${name}"[^>]*>([\\s\\S]*?)</select>`),
  );
  assert.ok(select, `no <select name="${name}">`);
  return [...select[1].matchAll(/<option\b[^>]*value="([^"]*)"/g)].map(
    (m) => m[1],
  );
}

/** Keys of a PHP const array such as BETA_PHONES. */
function phpKeys(constName) {
  const block = handlerSource().match(
    new RegExp(`const ${constName} = \\[([\\s\\S]*?)\\];`),
  );
  assert.ok(block, `${constName} not found in the handler`);
  return [...block[1].matchAll(/'([^']*)'\s*=>/g)].map((m) => m[1]);
}

test("the form POSTs to the PHP handler, so it works with JavaScript off", () => {
  const tag = formTag();
  assert.ok(tag, "beta/index.html has no beta form");
  assert.match(tag, /\smethod="post"/);
  assert.match(tag, /\saction="\/api\/beta-signup\.php"/);
  assert.doesNotMatch(tag, /novalidate/, "the browser must enforce required");
  assert.ok(
    existsSync(join(dist, "api", "beta-signup.php")),
    "the handler is not in the build",
  );
  assert.ok(
    readFileSync(join(dist, "api", "beta-signup.php")).equals(
      readFileSync(join(projectRoot, "public", "api", "beta-signup.php")),
    ),
    "the built handler differs from public/api/beta-signup.php",
  );
});

test("the form asks for exactly the agreed fields and nothing about health", () => {
  const names = controls()
    .map((c) => c.name)
    .sort();
  assert.deepEqual(names, [
    "adult",
    "consent",
    "contact_ref",
    "email",
    "fill_ms",
    "first_name",
    "phone",
    "source",
  ]);
  const text = formBody().replace(/<[^>]+>/g, " ");
  assert.doesNotMatch(
    text,
    /\b(condition|diagnos\w*|symptom\w*|medication|program|health area)\b/i,
    "the beta form must not ask about health or programs",
  );
});

test("required fields are required in the markup", () => {
  assert.match(control("first_name").html, /\srequired/);
  assert.match(control("first_name").html, /type="text"/);
  assert.match(control("email").html, /\srequired/);
  assert.match(control("email").html, /type="email"/);
  assert.match(control("phone").html, /\srequired/);
  assert.doesNotMatch(
    control("source").html,
    /\srequired/,
    "source is optional",
  );
  for (const name of ["adult", "consent"]) {
    assert.match(control(name).html, /type="checkbox"/, name);
    assert.match(control(name).html, /value="yes"/, name);
    assert.match(control(name).html, /\srequired/, name);
  }
  const body = formBody();
  assert.match(body, />I am 18 or over\.<\/label>/);
  assert.match(body, />Email me about the beta\.<\/label>/);
});

test("the phone and source options are exactly the handler's allowlists", () => {
  const phones = optionsOf("phone");
  assert.equal(phones[0], "", "phone starts with an empty placeholder");
  assert.deepEqual(phones.slice(1), phpKeys("BETA_PHONES"));
  assert.deepEqual(phones.slice(1), ["iphone", "android"]);
  assert.deepEqual(optionsOf("source"), phpKeys("BETA_SOURCES"));
});

test("the honeypot is hidden from people and the timing field is hidden", () => {
  const trap = formBody().match(
    /<div class="hidden" aria-hidden="true">[\s\S]*?<\/div>/,
  )?.[0];
  assert.ok(trap, "no hidden honeypot wrapper");
  assert.match(trap, /name="contact_ref"/);
  assert.match(trap, /tabindex="-1"/);
  assert.match(control("fill_ms").html, /type="hidden"/);
});

test("every error the handler redirects to has a message shown by :target", () => {
  const codes = [...handlerSource().matchAll(/beta_fail\('([a-z]+)'\)/g)].map(
    (m) => m[1],
  );
  assert.ok(codes.length >= 4, "the handler names fewer errors than expected");
  const html = page();
  for (const code of new Set(codes)) {
    const el = html.match(new RegExp(`<p\\b[^>]*id="error-${code}"[^>]*>`));
    assert.ok(el, `no #error-${code} message on /beta/`);
    assert.match(
      el[0],
      /\bhidden\b/,
      `#error-${code} is not hidden by default`,
    );
    assert.match(
      el[0],
      /target:flex/,
      `#error-${code} is not revealed by :target`,
    );
  }
  assert.match(handlerSource(), /beta_redirect\('\/beta\/thanks\/'\)/);
});

test("the thank-you page asks the visitor to confirm by email", () => {
  const html = readPage("beta/thanks/index.html");
  assert.match(html, /<meta name="robots" content="[^"]*noindex/);
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  assert.match(text, /Check your email\./);
  assert.match(text, /You are not on the list until you confirm\./);
  assert.match(text, /expires in 7 days/);
  assert.match(html, /mailto:privacy@tetherhealthgroup\.com/);
});

test("the confirmed page exists, is not indexed, and promises no date", () => {
  const html = readPage("beta/confirmed/index.html");
  assert.match(html, /<meta name="robots" content="[^"]*noindex/);
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  assert.match(text, /You're on the list\./);
  assert.match(text, /We'll email you an invite when there's a spot\./);
  assert.match(text, /We cannot promise a date\./);
  assert.match(html, /mailto:privacy@tetherhealthgroup\.com/);
  assert.match(handlerSource(), /beta_redirect\('\/beta\/confirmed\/'\)/);
});

test("home and programs carry a clear call to action into /beta/", () => {
  for (const rel of ["index.html", "programs/index.html"]) {
    assert.match(
      readPage(rel),
      /<a\b[^>]*href="\/beta\/"[^>]*>[\s\S]{0,400}?Get early access/,
      `${rel} has no "Get early access" link to /beta/`,
    );
  }
});

test('every "Get early access" call to action links to /beta/', async () => {
  const { htmlFiles } = await import("../helpers/dist.js");
  const offenders = [];
  let seen = 0;
  for (const rel of htmlFiles()) {
    for (const [a, href] of readPage(rel).matchAll(
      /<a\b[^>]*href="([^"]*)"[^>]*>(?:(?!<\/a>)[\s\S])*?Get early access(?:(?!<\/a>)[\s\S])*?<\/a>/g,
    )) {
      seen += 1;
      if (href !== "/beta/") offenders.push(`${rel}: ${href}`);
    }
  }
  assert.ok(seen > 0, "no Get early access link found");
  assert.deepEqual(offenders, []);
});
