// Functional — the contact and careers pages, and how visitors reach them.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { htmlFiles, projectRoot, readPage } from "../helpers/dist.js";

const { primaryNav, footerNav } = await import("../../src/data/site.ts");

const contactHtml = () => readPage("contact/index.html");
const mainOf = (html) => html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? "";
const lib = readFileSync(
  join(projectRoot, "public", "api", "beta-lib.inc"),
  "utf8",
);

test("the contact page is one form that POSTs to the handler, with no mailbox list", () => {
  const main = mainOf(contactHtml());
  assert.ok(main, "contact page has no <main>");
  const form = main.match(/<form\b[^>]*id="contact-form"[^>]*>/)?.[0];
  assert.ok(form, "no contact form");
  assert.match(form, /method="post"/);
  assert.match(form, /action="\/api\/contact\.php"/);
  assert.doesNotMatch(form, /novalidate/);
  assert.doesNotMatch(
    main,
    /mailto:/,
    "the contact page still lists mailboxes",
  );
  assert.equal(
    (contactHtml().match(/<form\b/g) ?? []).length,
    1,
    "exactly one form",
  );
});

test("the topic dropdown offers exactly the handler's five topics, with no admin", () => {
  const select = contactHtml().match(
    /<select\b[^>]*name="topic"[^>]*>([\s\S]*?)<\/select>/,
  );
  assert.ok(select, "no topic select");
  assert.match(select[0], /\srequired/);
  const options = [
    ...select[1].matchAll(/<option\b[^>]*value="([^"]*)"[^>]*>([^<]*)</g),
  ];
  assert.equal(options[0][1], "", "a placeholder comes first");
  assert.deepEqual(
    options.slice(1).map((o) => [o[1], o[2].replace("&amp;", "&")]),
    [
      ["support", "Support"],
      ["sales_partnerships", "Sales & partnerships"],
      ["careers", "Careers"],
      ["privacy", "Privacy"],
      ["finance", "Finance"],
    ],
  );
  const block =
    lib.match(/const BETA_CONTACT_TOPICS = \[([\s\S]*?)\];/)?.[1] ?? "";
  assert.deepEqual(
    [...block.matchAll(/'([a-z_]+)' =>/g)].map((m) => m[1]),
    options.slice(1).map((o) => o[1]),
    "the form and the handler allowlist differ",
  );
  assert.doesNotMatch(contactHtml(), /admin/i);
});

test("required fields, caps, consent line, honeypot and fill time are in the markup", () => {
  const html = contactHtml();
  const tag = (name) =>
    html.match(
      new RegExp(`<(?:input|textarea)\\b[^>]*name="${name}"[^>]*>`),
    )?.[0] ?? "";
  for (const name of ["first_name", "email", "message"])
    assert.match(tag(name), /\srequired/, `${name} is not required`);
  assert.doesNotMatch(
    tag("organisation"),
    /\srequired/,
    "organisation is optional",
  );
  assert.match(tag("email"), /type="email"/);
  assert.match(tag("message"), /maxlength="2000"/);
  assert.match(html, /We'll use this only to reply\./);
  assert.match(
    html,
    /<div class="hidden" aria-hidden="true">[\s\S]*?name="contact_ref"/,
  );
  assert.match(tag("fill_ms"), /type="hidden"/);
});

test("every error the handler redirects to has a message shown by :target", () => {
  const handler = readFileSync(
    join(projectRoot, "public", "api", "contact.php"),
    "utf8",
  );
  const codes = new Set(
    [...handler.matchAll(/contact_fail\('([a-z]+)'\)/g)].map((m) => m[1]),
  );
  assert.ok(codes.size >= 4);
  for (const code of codes) {
    const el = contactHtml().match(
      new RegExp(`<p\\b[^>]*id="error-${code}"[^>]*>`),
    );
    assert.ok(el, `no #error-${code} on /contact/`);
    assert.match(el[0], /target:flex/);
  }
  assert.match(
    contactHtml(),
    /Sorry, the form is unavailable\. Please email support@tetherhealthgroup\.com\./,
  );
});

test("the thank-you page exists, is not indexed, and sends no copy", () => {
  const html = readPage("contact/thanks/index.html");
  assert.match(html, /<meta name="robots" content="[^"]*noindex/);
  assert.match(html, /We do not send an automatic copy of your message\./);
});

test("no placeholder telephone number or postal address is published", () => {
  // The owner is supplying both; until then neither appears anywhere.
  for (const page of ["contact/index.html", "careers/index.html"]) {
    const html = readPage(page);
    const phones = (html.match(/href="tel:[^"]*"/g) ?? []).filter(
      (h) => !/tel:(911|\+18007848669|\+18553353569)"/.test(h),
    );
    assert.deepEqual(
      phones,
      [],
      `${page} publishes an unexpected phone number`,
    );
    assert.doesNotMatch(html, /\b(?:555-\d{4}|123 Main|Suite\s+\d+|XXX)/i);
  }
});

test("the careers page sends applications to the careers mailbox", () => {
  assert.ok(
    readPage("careers/index.html").includes(
      'href="mailto:careers@tetherhealthgroup.com',
    ),
  );
});

test("contact and integrations are in the primary navigation; all three are in the footer", () => {
  // Careers is footer-only: a seventh header link overflows the desktop bar
  // between 1024px and 1280px.
  const footerLinks = footerNav.flatMap((group) => group.links);
  for (const href of ["/contact/", "/integrations/"])
    assert.ok(
      primaryNav.some((l) => l.href === href),
      `nav lacks ${href}`,
    );
  assert.ok(primaryNav.length <= 6, "the header holds at most six links");
  for (const href of ["/contact/", "/careers/", "/integrations/"]) {
    assert.ok(
      footerLinks.some((l) => l.href === href),
      `footer lacks ${href}`,
    );
  }
  for (const page of htmlFiles()) {
    const header = readPage(page).match(/<header[\s\S]*?<\/header>/)?.[0];
    if (header)
      assert.ok(
        header.includes('href="/contact/"'),
        `${page} header lacks Contact`,
      );
  }
});
