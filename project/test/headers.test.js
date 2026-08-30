/**
 * Tests for the deployed Apache configuration in dist/.htaccess.
 *
 * The Content-Security-Policy pins a hash per inline script. A hash is exact:
 * change one character of the mobile-menu script or the waitlist form and the
 * browser silently refuses to run it — the menu stops opening, the form starts
 * reloading the page instead of composing an email, and nothing in the build
 * output looks wrong. So the hashes are recomputed here from the build and
 * checked against the policy, in both directions.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(projectRoot, "dist");

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return htmlFiles(full);
    return entry.endsWith(".html") ? [full] : [];
  });
}

/** Every distinct inline <script> body in the build, as a CSP hash source. */
function inlineScriptHashes() {
  const hashes = new Map();
  for (const file of htmlFiles(dist)) {
    const html = readFileSync(file, "utf8");
    for (const match of html.matchAll(
      /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g,
    )) {
      const body = match[1];
      const hash = createHash("sha256").update(body, "utf8").digest("base64");
      if (!hashes.has(hash)) hashes.set(hash, { file, bytes: body.length });
    }
  }
  return hashes;
}

const htaccess = readFileSync(join(dist, ".htaccess"), "utf8");
const cspLine =
  htaccess.match(
    /^\s*Header always set Content-Security-Policy "(.+)"$/m,
  )?.[1] ?? "";

test("the Apache configuration ships with the site", () => {
  assert.ok(
    htaccess.includes("RewriteEngine On"),
    "dist/.htaccess is missing — public/.htaccess is what puts it there",
  );
  assert.ok(cspLine.length > 0, "no Content-Security-Policy header is set");
});

test("every inline script the build emits is allowed by the policy", () => {
  const pinned = new Set(
    [...cspLine.matchAll(/'sha256-([A-Za-z0-9+/=]+)'/g)].map((m) => m[1]),
  );
  const found = inlineScriptHashes();

  for (const [hash, where] of found) {
    assert.ok(
      pinned.has(hash),
      `An inline script in ${where.file.replace(dist, "dist")} (${where.bytes} bytes) ` +
        `hashes to sha256-${hash}, which the CSP does not allow. The browser ` +
        `will refuse to run it. Add the hash to script-src in public/.htaccess.`,
    );
  }
});

test("the policy pins no hash that no longer matches anything", () => {
  const pinned = [...cspLine.matchAll(/'sha256-([A-Za-z0-9+/=]+)'/g)].map(
    (m) => m[1],
  );
  const found = new Set(inlineScriptHashes().keys());

  for (const hash of pinned) {
    assert.ok(
      found.has(hash),
      `The CSP allows sha256-${hash}, but no inline script in the build has ` +
        `that hash. A stale allowance is dead weight in the policy — remove it ` +
        `from public/.htaccess.`,
    );
  }
  assert.equal(pinned.length, found.size);
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

test("HSTS is not lengthened while the certificate is still wrong", () => {
  /* This is a deliberate tripwire, not a preference. The live host answers
     :443 with a *.hostgator.com certificate that does not cover this domain
     (checked 2026-08-30). HSTS makes a certificate error impossible to click
     through, so a long max-age shipped before the certificate is fixed takes
     the site off the air for anyone who visits in between.
     When AutoSSL has issued a real certificate and https://www.tetherhealthgroup.com
     loads clean, raise max-age here and in public/.htaccess together. */
  const hsts = htaccess.match(
    /Header always set Strict-Transport-Security "([^"]+)"/,
  )?.[1];
  assert.ok(hsts, "no Strict-Transport-Security header is set");
  const maxAge = Number(hsts.match(/max-age=(\d+)/)?.[1] ?? 0);
  assert.ok(
    maxAge <= 300,
    `max-age is ${maxAge}. Raise it only once the certificate is valid — and ` +
      `update this test in the same commit, so the reason is recorded.`,
  );
  assert.doesNotMatch(
    hsts,
    /preload/,
    "preload commits the domain to a list that takes months to leave",
  );
});

test("the ACME challenge is not redirected into the broken certificate", () => {
  /* A certificate authority validates the domain over PLAIN HTTP, fetching
     /.well-known/acme-challenge/<token>. The redirect below it sends everything
     to https://www.tetherhealthgroup.com, where the server currently answers
     with a certificate for a different name — so without an exemption the
     validator is sent into the very TLS error it is being run to clear, and
     AutoSSL cannot issue the certificate. Verified against Apache 2.4.66: with
     the exemption removed the token 301s; with it, the token is served 200.

     The exemption must come FIRST. mod_rewrite applies rules in order, and a
     [L] on the redirect above it would end the round before this one is
     reached. */
  const rules = [...htaccess.matchAll(/^\s*RewriteRule\s+(\S+)\s+(\S+)/gm)];
  const acme = rules.findIndex(([, pattern]) => /acme-challenge/.test(pattern));
  assert.notEqual(
    acme,
    -1,
    "no RewriteRule exempts /.well-known/acme-challenge/. AutoSSL's HTTP-01 " +
      "check will be 301'd to a host whose certificate does not cover it.",
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

test("no directive is guarded by a module that does not define it", () => {
  /* The <IfModule> wrappers exist because an unknown directive in .htaccess is
     not a warning — it is a 500 for every page of the site. That protection
     only works when the module named is the one that actually provides the
     directive.

     AddOutputFilterByType is mod_filter's; only the DEFLATE filter it applies
     is mod_deflate's. Guarded on mod_deflate alone, a server with mod_deflate
     and without mod_filter took the whole site down — reproduced on Apache
     2.4.66, which answered "Invalid command 'AddOutputFilterByType'" and 500'd
     every request until mod_filter was loaded. */
  const providedBy = { AddOutputFilterByType: "mod_filter.c" };

  const open = [];
  for (const line of htaccess.split("\n")) {
    const opens = line.match(/^\s*<IfModule\s+!?([\w.]+)\s*>/);
    if (opens) {
      open.push(opens[1]);
      continue;
    }
    if (/^\s*<\/IfModule>/.test(line)) {
      open.pop();
      continue;
    }
    const directive = line.trim().split(/\s+/)[0];
    const required = providedBy[directive];
    if (!required) continue;
    assert.ok(
      open.includes(required),
      `${directive} is provided by ${required}, but here it is guarded only by ` +
        `${open.join(", ") || "nothing"}. On a server without ${required} this ` +
        `is an unknown directive, and an unknown directive in .htaccess is a ` +
        `500 for the entire site.`,
    );
  }
});
