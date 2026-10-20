// Security — the policy and the promises it enforces. Every check here is
// a negative: what must NOT be reachable, allowed, or loaded.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  dist,
  htmlFiles,
  ALLOWED_ORIGINS,
  htaccess as readHtaccess,
  cspLine as readCspLine,
} from "../helpers/dist.js";

const htaccess = readHtaccess();
const cspLine = readCspLine();

test("no page loads a third-party resource", async () => {
  const offenders = [];

  for (const page of await htmlFiles()) {
    const html = readFileSync(join(dist, page), "utf8");
    for (const url of html.match(/https?:\/\/[a-zA-Z0-9.-]+/g) ?? []) {
      if (!ALLOWED_ORIGINS.some((origin) => url.startsWith(origin))) {
        offenders.push(`${page} -> ${url}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    "the privacy notice promises no third-party requests; these break it",
  );
});

test("the policy forbids the things it exists to forbid", () => {
  /* 'unsafe-inline' in script-src would make every hash above pointless: it
     allows any injected inline script. style-src is a separate directive and
     is allowed to carry it — Astro emits style attributes that cannot be
     hashed, and style injection is not the risk this policy is here for. */
  const scriptSrc = cspLine.match(/script-src ([^;]+)/)?.[1] ?? "";
  assert.doesNotMatch(scriptSrc, /'unsafe-inline'/);
  assert.doesNotMatch(scriptSrc, /'unsafe-eval'/);
  assert.match(cspLine, /default-src 'none'/);
  assert.match(cspLine, /frame-ancestors 'none'/);
  assert.match(cspLine, /base-uri 'none'/);
  assert.match(cspLine, /object-src 'none'/);
});

test("no source outside the site's own origin is allowed", () => {
  /* The site's privacy notice says it loads nothing from anywhere else. A
     policy that permitted a third-party origin would contradict the page that
     promises it. */
  const external = cspLine.match(
    /https?:\/\/(?!www\.tetherhealthgroup\.com)[^\s;']+/g,
  );
  assert.equal(
    external,
    null,
    `the policy allows an external origin: ${external?.join(", ")}`,
  );
});

test("HSTS is a year, with no includeSubDomains and no preload", () => {
  /* This began as a tripwire against lengthening max-age before the site could
     be shown to work. Both conditions it was waiting on have now been measured
     and are recorded in public/.htaccess: the certificate verifies
     ("Verify return code: 0 (ok)"), and all 24 routes serve 200 over HTTPS with
     a clean Chromium render. So the ramp is finished at one year.

     It stays a tripwire, now pointed at what is still unproven. The value is
     pinned exactly, so changing it is a deliberate commit rather than a drift,
     and the two modifiers that can take a host off the air for a full year are
     refused:

       includeSubDomains — the certificate covers mail., webmail. and cpanel.,
       but not one of them has been confirmed to SERVE valid HTTPS. Asserting
       it for a subdomain that then fails removes that subdomain for the whole
       max-age, and webmail is exactly what someone reaches for when the main
       site is broken.

       preload — leaving hstspreload.org takes months and cannot be rushed. */
  const hsts = htaccess.match(
    /Header always set Strict-Transport-Security "([^"]+)"/,
  )?.[1];
  assert.ok(hsts, "no Strict-Transport-Security header is set");

  const maxAge = Number(hsts.match(/max-age=(\d+)/)?.[1] ?? 0);
  assert.equal(
    maxAge,
    31536000,
    `max-age is ${maxAge}, not the pinned 31536000. Change it only ` +
      `deliberately, and update this test in the same commit so the reason is ` +
      `recorded.`,
  );
  assert.doesNotMatch(
    hsts,
    /preload/,
    "preload commits the domain to a list that takes months to leave",
  );
  assert.doesNotMatch(
    hsts,
    /includeSubDomains/i,
    "includeSubDomains would assert HSTS for mail., webmail. and cpanel., " +
      "none of which has been verified to serve valid HTTPS. Verify each " +
      "first — a subdomain that then fails is unreachable for a year.",
  );
});

test("the ACME challenge is not redirected into https://", () => {
  /* A certificate authority validates the domain over PLAIN HTTP, fetching
     /.well-known/acme-challenge/<token>. The redirect below it sends everything
     to https://www.tetherhealthgroup.com, and that is survivable only while the
     certificate there is valid.

     It was not, for the first issuance. It may not be again: AutoSSL renews on
     a cycle, and the renewal that matters most is the one attempted when the
     current certificate has already failed — exactly when redirecting the
     validator into https:// sends it into the error it was run to clear.
     Verified against Apache 2.4.66: with the exemption removed the token 301s;
     with it, the token is served 200.

     The exemption must come FIRST. mod_rewrite applies rules in order, and a
     [L] on the redirect above it would end the round before this one is
     reached. */
  const rules = [...htaccess.matchAll(/^\s*RewriteRule\s+(\S+)\s+(\S+)/gm)];
  const acme = rules.findIndex(([, pattern]) => /acme-challenge/.test(pattern));
  assert.notEqual(
    acme,
    -1,
    "no RewriteRule exempts /.well-known/acme-challenge/. AutoSSL's HTTP-01 " +
      "check will be 301'd into https://, which fails whenever the certificate " +
      "it is being run to renew or replace is not currently valid.",
  );
  assert.equal(
    rules[acme][2],
    "-",
    "the acme-challenge rule must substitute '-' (leave the URL alone), not rewrite it",
  );

  const firstRedirect = rules.findIndex(([, , target]) =>
    target.startsWith("https://"),
  );
  assert.ok(
    firstRedirect === -1 || acme < firstRedirect,
    `the acme-challenge exemption is rule ${acme + 1} but a redirect to ` +
      `${rules[firstRedirect]?.[2]} is rule ${firstRedirect + 1}. mod_rewrite ` +
      `runs rules in order, so the redirect wins and the exemption is dead.`,
  );
});

// --- security.txt (RFC 9116) --------------------------------------------------

const securityTxt = () =>
  readFileSync(join(dist, ".well-known", "security.txt"), "utf8");

const field = (name) =>
  [...securityTxt().matchAll(new RegExp(`^${name}:[ \\t]*(.+)$`, "gm"))].map(
    (m) => m[1].trim(),
  );

test("security.txt carries the required RFC 9116 fields", () => {
  assert.deepEqual(field("Contact"), ["mailto:security@tetherhealthgroup.com"]);
  assert.deepEqual(field("Preferred-Languages"), ["en"]);
  assert.equal(field("Expires").length, 1, "Expires must appear exactly once");
  assert.deepEqual(field("Canonical"), [
    "https://www.tetherhealthgroup.com/.well-known/security.txt",
  ]);
  assert.deepEqual(field("Policy"), [
    "https://www.tetherhealthgroup.com/security/",
  ]);
});

test("security.txt Expires is in the future and no more than a year away", () => {
  const raw = field("Expires")[0];
  assert.match(raw, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
  const expires = new Date(raw);
  const now = new Date();
  const limit = new Date(now);
  limit.setUTCFullYear(limit.getUTCFullYear() + 1);
  const soon = new Date(now);
  soon.setUTCDate(soon.getUTCDate() + 30);
  assert.ok(
    expires > soon,
    `renew security.txt (expires ${raw}, less than 30 days away or past)`,
  );
  assert.ok(expires <= limit, `Expires ${raw} is more than a year away`);
});

test("security.txt is not blocked or rewritten by .htaccess and is served as text/plain", () => {
  // The dotfile deny-list is a <FilesMatch> on FILENAMES. It must not match
  // "security.txt", and the directory ".well-known" is a path segment it
  // cannot match.
  const deny = htaccess.match(/<FilesMatch "([^"]*\^\\\.[^"]*)">/)?.[1];
  assert.ok(deny, "dotfile deny-list not found; re-check this test");
  assert.equal(new RegExp(deny).test("security.txt"), false);

  // No RewriteRule other than the ACME exemption may reference .well-known,
  // and the .git rule must not catch it.
  const rules = htaccess.split("\n").filter((l) => /^\s*RewriteRule\b/.test(l));
  assert.equal(
    new RegExp("(^|/)\\.git(/|$)").test(".well-known/security.txt"),
    false,
  );
  for (const rule of rules) {
    if (/acme-challenge/.test(rule)) continue;
    assert.doesNotMatch(rule, /well-known/, `unexpected rule: ${rule}`);
  }
  assert.match(
    htaccess,
    /<Files "security\.txt">\s*ForceType "text\/plain; charset=utf-8"/,
    "security.txt is not forced to text/plain; charset=utf-8",
  );
});
