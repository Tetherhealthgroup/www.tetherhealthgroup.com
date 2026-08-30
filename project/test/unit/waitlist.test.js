/**
 * Unit tests for the waitlist message unit.
 *
 * The form itself is driven in a browser; these cover the part a browser
 * cannot report on. Once `window.location.href` is set to a `mailto:` URL the
 * page hands it to an external handler and nothing comes back, so the address
 * and body the company receives are checked here, as values.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isReplyableEmail,
  normalizeWaitlistPayload,
  waitlistMailtoUrl,
  waitlistMessageBody,
} from "../../src/lib/waitlist.ts";

test("an address a reply can reach is accepted", () => {
  for (const address of [
    "a@b.com",
    "first.last+tag@sub.example.co.uk",
    "USER@EXAMPLE.COM",
    "someone@intranet", // the browser's own type=email allows this
    "o'brien@example.com",
    "a@b-c.example",
  ]) {
    assert.equal(
      isReplyableEmail(address),
      true,
      `expected accepted: ${address}`,
    );
  }
});

test("an address no reply can reach is rejected", () => {
  for (const address of [
    "", //           nothing typed
    "   ", //        whitespace only
    "nope", //       no domain part at all
    "a@", //         REGRESSION: this was accepted, and mail went to nobody
    "@b.com", //     no local part
    "a b@c.com", //  space in the local part
    "a@b .com", //   space in the domain
    "a@-b.com", //   domain label starting with a hyphen
    "a@b.", //       trailing dot, no final label
    "a@@b.com",
  ]) {
    assert.equal(
      isReplyableEmail(address),
      false,
      `expected rejected: ${address}`,
    );
  }
});

test("surrounding whitespace does not make an address invalid", () => {
  assert.equal(isReplyableEmail("  a@b.com\n"), true);
  assert.equal(
    normalizeWaitlistPayload({ email: "  a@b.com " }).email,
    "a@b.com",
  );
});

test("the free-text fields are trimmed and the selects pass through", () => {
  assert.deepEqual(
    normalizeWaitlistPayload({
      name: "  Ada  ",
      email: " ada@example.com ",
      role: "Clinician or care-team member",
      interest: "Respiratory health",
      message: "  two words  ",
    }),
    {
      name: "Ada",
      email: "ada@example.com",
      role: "Clinician or care-team member",
      interest: "Respiratory health",
      message: "two words",
    },
  );
});

test("a missing field becomes an empty string, never the text 'undefined'", () => {
  const payload = normalizeWaitlistPayload({ email: "a@b.com" });
  assert.deepEqual(payload, {
    name: "",
    email: "a@b.com",
    role: "",
    interest: "",
    message: "",
  });
  assert.doesNotMatch(waitlistMessageBody(payload), /undefined/);
});

test("the message says which optional fields were left blank", () => {
  const body = waitlistMessageBody(
    normalizeWaitlistPayload({
      email: "a@b.com",
      role: "Researcher or academic",
      interest: "Any / not sure yet",
    }),
  );
  assert.equal(
    body,
    [
      "Name: (not given)",
      "Email: a@b.com",
      "I am: Researcher or academic",
      "Health area of interest: Any / not sure yet",
      "",
      "(no message)",
    ].join("\n"),
  );
});

test("the mailto URL survives characters that would otherwise truncate it", () => {
  const payload = normalizeWaitlistPayload({
    name: "Ada & Grace",
    email: "ada+tag@example.com",
    role: "Something else",
    interest: "Respiratory health",
    message: "One\nTwo & three + four ?five #six",
  });

  const url = waitlistMailtoUrl(
    "support@tetherhealthgroup.com",
    "BreatheFree early access request",
    payload,
  );

  assert.ok(url.startsWith("mailto:support@tetherhealthgroup.com?subject="));

  /* A raw &, + or # in the body would end the query, arrive as a space, or
     start a fragment. Parsing the URL back is what proves they did not. */
  const query = new URLSearchParams(url.slice(url.indexOf("?") + 1));
  assert.equal(query.get("subject"), "BreatheFree early access request");
  assert.equal(query.get("body"), waitlistMessageBody(payload));
  assert.match(query.get("body"), /Two & three \+ four \?five #six/);
  assert.equal(url.includes("\n"), false);
});

test("the address the message is sent to is the one it was given", () => {
  const url = waitlistMailtoUrl(
    "support@tetherhealthgroup.com",
    "s",
    normalizeWaitlistPayload({ email: "a@b.com" }),
  );
  assert.equal(
    url.slice(0, url.indexOf("?")),
    "mailto:support@tetherhealthgroup.com",
  );
});
