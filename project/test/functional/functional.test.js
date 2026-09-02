// Functional — each feature through the surface a visitor actually uses.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dist, htmlFiles } from "../helpers/dist.js";

test("the waitlist form points at the support address", () => {
  const html = readFileSync(join(dist, "index.html"), "utf8");
  assert.match(
    html,
    /support@tetherhealthgroup\.com/,
    "the home page must carry the support address the waitlist delivers to",
  );
});

test("the primary navigation renders every declared link on every page", async () => {
  // The header is one component rendered into all 24 pages. If a link is
  // added to site.ts and a page is cached or generated differently, the site
  // gets an inconsistent nav — which reads as a broken page, not a stale one.
  const { primaryNav } = await import("../../src/data/site.ts");

  for (const page of htmlFiles()) {
    const html = readFileSync(join(dist, page), "utf8");
    for (const link of primaryNav) {
      assert.ok(
        html.includes(`href="${link.href}"`),
        `${page} is missing the "${link.label}" nav link (${link.href})`,
      );
    }
  }
});

test("the footer renders every declared group and link on every page", async () => {
  const { footerNav } = await import("../../src/data/site.ts");

  for (const page of htmlFiles()) {
    const html = readFileSync(join(dist, page), "utf8");
    for (const group of footerNav) {
      assert.ok(
        html.includes(group.title),
        `${page} is missing the "${group.title}" footer group`,
      );
      for (const link of group.links) {
        assert.ok(
          html.includes(`href="${link.href}"`),
          `${page} is missing the footer link ${link.href}`,
        );
      }
    }
  }
});

test("the waitlist form declares exactly the fields its composer reads", () => {
  // src/lib/waitlist.ts reads name, email, role, interest and message, plus
  // the company honeypot. A field renamed in the markup and not in the lib
  // silently drops that answer out of the email.
  const html = readFileSync(join(dist, "index.html"), "utf8");
  for (const field of [
    "name",
    "email",
    "role",
    "interest",
    "message",
    "company",
  ]) {
    assert.match(
      html,
      new RegExp(`name="${field}"`),
      `the waitlist form has no "${field}" field`,
    );
  }
  // The email field is the only required one, and must be a real email input
  // so a phone keyboard offers the right keys.
  assert.match(
    html,
    /id="wl-email"[^>]*type="email"|type="email"[^>]*id="wl-email"/,
  );
  assert.match(html, /id="wl-email"[^>]*required|required[^>]*id="wl-email"/);
});

test("every health area page offers a route onward", async () => {
  // A leaf page with no way forward is a dead end. Each area page must link
  // back to the index and to the early-access form.
  const { programs } = await import("../../src/data/programs.ts");

  for (const program of programs) {
    const html = readFileSync(
      join(dist, `programs/${program.id}/index.html`),
      "utf8",
    );
    assert.ok(
      html.includes('href="/programs/"'),
      `programs/${program.id} does not link back to the health-area index`,
    );
    assert.ok(
      html.includes('id="waitlist"') || html.includes('href="/#waitlist"'),
      `programs/${program.id} offers no way to request early access`,
    );
  }
});
