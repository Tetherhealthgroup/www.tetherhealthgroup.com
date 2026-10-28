/**
 * Unit tests for contact-form routing and message composition.
 *
 * As with the early-access form, the browser hands the `mailto:` URL to an
 * external handler and reports nothing back, so which inbox a topic reaches,
 * and what arrives there, are checked here as values.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  contactMailtoUrl,
  contactMessageBody,
  contactRoute,
  contactTopic,
  contactTopics,
  normalizeContactPayload,
} from "../../src/lib/contact.ts";
import { contact } from "../../src/data/site.ts";

test("every topic routes to a role mailbox defined in site data", () => {
  const addresses = new Set(Object.values(contact));
  for (const topic of contactTopics) {
    const { address } = contactRoute(
      normalizeContactPayload({
        email: "synthetic-user-01@example.test",
        topic: topic.value,
      }),
    );
    assert.ok(addresses.has(address), `${topic.value} -> ${address}`);
  }
});

test("topic values are unique", () => {
  const values = contactTopics.map((t) => t.value);
  assert.equal(new Set(values).size, values.length);
});

test("specialist topics reach their specialist inbox", () => {
  const route = (topic) =>
    contactRoute(
      normalizeContactPayload({
        email: "synthetic-user-01@example.test",
        topic,
      }),
    ).address;
  assert.equal(route("partnerships"), contact.partnerships);
  assert.equal(route("careers"), contact.careers);
  assert.equal(route("privacy"), contact.privacy);
  assert.equal(route("security"), contact.security);
  assert.equal(route("general"), contact.support);
});

test("an unknown or missing topic falls back to the default, not to nowhere", () => {
  assert.equal(contactTopic("nonsense").value, contactTopics[0].value);
  assert.equal(normalizeContactPayload({}).topic, contactTopics[0].value);
});

test("free-text fields are trimmed and optional ones say so when blank", () => {
  const payload = normalizeContactPayload({
    email: "  synthetic-user-01@example.test ",
    name: "  ",
    organisation: "",
  });
  assert.equal(payload.email, "synthetic-user-01@example.test");
  const body = contactMessageBody(payload);
  assert.match(body, /^Name: \(not given\)$/m);
  assert.match(body, /^Organisation: \(not given\)$/m);
  assert.match(body, /\(no message\)$/);
  assert.doesNotMatch(body, /undefined/);
});

test("the mailto URL encodes the subject and body so nothing is cut short", () => {
  const payload = normalizeContactPayload({
    email: "synthetic-user-01@example.test",
    topic: "partnerships",
    message: "Tom & Jerry + friends?",
  });
  const url = contactMailtoUrl(payload);
  assert.ok(url.startsWith(`mailto:${contact.partnerships}?`));
  const query = new URLSearchParams(url.slice(url.indexOf("?") + 1));
  assert.equal(query.get("subject"), contactRoute(payload).subject);
  assert.equal(query.get("body"), contactMessageBody(payload));
});
