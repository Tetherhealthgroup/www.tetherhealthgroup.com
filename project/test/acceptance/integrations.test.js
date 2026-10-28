// Acceptance — health-record import is described as it is (P-110).
//
// Providers return to the API, not to this website, and the app holds no
// PKCE verifier, so the site has no OAuth callback pages and makes no claim
// about where the token exchange happens. Import is coming in the app: opt-in,
// reviewed before anything is added, from Epic, Medicare Blue Button, Apple
// Health and Health Connect, and not available today.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { dist, htmlFiles, readPage } from "../helpers/dist.js";

const text = (rel) =>
  readPage(rel)
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

test("the integrations page says import is coming in the app and not live", () => {
  const page = text("integrations/index.html");
  assert.match(page, /Importing them is coming in the Tether Health app/);
  assert.match(page, /It is not available today\./);
  assert.match(page, /Import is off until you choose a source/);
  assert.match(page, /Review before adding/);
  assert.match(page, /Nothing is added to your programs until you say so\./);
  for (const source of [
    "Epic",
    "Blue Button",
    "Medicare",
    "Apple Health",
    "Health Connect",
  ])
    assert.ok(
      page.includes(source),
      `integrations page does not name ${source}`,
    );
  assert.doesNotMatch(
    page,
    /\b(?:connect|import) (?:now|today)\b|\bnow live\b|\bavailable now\b/i,
  );
});

test("there are no FHIR callback pages and no claim about the token exchange", () => {
  assert.equal(existsSync(join(dist, "fhir")), false, "dist/fhir/ exists");
  for (const rel of htmlFiles()) {
    const html = readPage(rel);
    assert.doesNotMatch(
      html,
      /\/fhir\/callback/,
      `${rel} links a callback page`,
    );
    assert.doesNotMatch(
      html,
      /intent:\/\//,
      `${rel} carries an intent:// link`,
    );
    assert.doesNotMatch(
      text(rel),
      /token exchange happens in the app/i,
      `${rel} repeats the wrong exchange model`,
    );
  }
});
