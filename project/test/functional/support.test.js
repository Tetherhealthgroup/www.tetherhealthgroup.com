// Functional — the support page as the app's support URL.
//
// The app's Account screen links "Help & legal" to /support/, and the store
// listings need a support URL. The page must name the app, give a contact
// address, answer the basic app questions, and link the app privacy policy
// and the account-deletion page.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readPage } from "../helpers/dist.js";

const html = () => readPage("support/index.html");
const text = () =>
  html()
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");

test("the support page names the Tether Health app and its programs", async () => {
  const { programCount } = await import("../../src/data/programs.ts");
  assert.ok(
    text().includes("Questions about the Tether Health app"),
    "no app section",
  );
  assert.ok(
    text().includes(`Tether Health is one app with ${programCount} programs`),
  );
  assert.match(html(), /<title>Support — Tether Health Group<\/title>/);
});

test("the support page gives the support address as a contact route", () => {
  assert.match(html(), /href="mailto:support@tetherhealthgroup\.com"/);
  assert.ok(html().includes('id="contact"'), "no contact anchor");
});

test("the app FAQ answers the basic questions, once each", () => {
  for (const q of [
    "What is Tether Health?",
    "How do I get help with the app?",
    "I forgot my password.",
    "How do I get a copy of my data?",
    "How do I delete my account and data?",
    "How is my information handled?",
    "Is the app medical advice?",
  ])
    assert.equal(text().split(q).length - 1, 1, `"${q}" must appear once`);
});

test("the support page links the app privacy policy, deletion page and programs", () => {
  for (const href of ["/app-privacy/", "/delete-account/", "/programs/"])
    assert.ok(html().includes(`href="${href}"`), `no link to ${href}`);
});

test("the FAQ uses the app's own labels for deletion and password reset", () => {
  for (const label of [
    '"Your data"',
    '"Delete account and all data"',
    '"Forgot password?"',
    '"Continue with Apple"',
    '"Continue with Google"',
  ])
    assert.ok(text().includes(label), `missing app label ${label}`);
});
