// Functional — the contact and careers pages, and how visitors reach them.

import { test } from "node:test";
import assert from "node:assert/strict";
import { htmlFiles, readPage } from "../helpers/dist.js";

const { contact, mailboxDirectory, primaryNav, footerNav } =
  await import("../../src/data/site.ts");
const { contactTopics } = await import("../../src/lib/contact.ts");

test("the contact page lists every role mailbox, each as a mailto link", () => {
  const html = readPage("contact/index.html");
  assert.deepEqual(
    mailboxDirectory.map((m) => m.mailbox).sort(),
    Object.keys(contact).sort(),
    "the mailbox directory and the contact addresses list different mailboxes",
  );
  for (const address of Object.values(contact))
    assert.ok(
      html.includes(`href="mailto:${address}`),
      `contact lacks ${address}`,
    );
});

test("the contact form offers every topic and asks for no health information", () => {
  const html = readPage("contact/index.html");
  assert.ok(html.includes('id="contact-form"'), "no contact form");
  for (const topic of contactTopics)
    assert.ok(
      html.includes(`value="${topic.value}"`),
      `no ${topic.value} option`,
    );
  assert.ok(html.includes("Please do not include medical details."));
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
    readPage("careers/index.html").includes(`href="mailto:${contact.careers}`),
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
