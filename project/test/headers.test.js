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
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
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

/* --- The deployment configuration -------------------------------------------
 *
 * dist/.cpanel.yml is what makes cPanel's "Deploy HEAD Commit" copy the
 * checkout into the document root. It exists because the two were not the same
 * directory: the repository was cloned to /home2/safecode/tetherhealthgroup.com
 * (cPanel's default is the HOME directory) while Apache serves this domain from
 * /home2/safecode/public_html/tetherhealthgroup.com. A correct build sat on
 * disk and every request answered 403.
 *
 * These tests guard the two ways that file can be wrong while still looking
 * right: copying without dotfiles, which drops .htaccess and ships the site
 * with no CSP and no redirects; and deleting paths that must survive a deploy.
 */

test("the deployment configuration ships with the site", () => {
  assert.ok(
    existsSync(join(dist, ".cpanel.yml")),
    ".cpanel.yml is missing from dist/. cPanel reads it from the checked-out " +
      "branch, so without it 'Deploy HEAD Commit' cannot copy anything and the " +
      "live site stays on whatever is already in the document root.",
  );
});

test("the deploy copies dotfiles, or it ships a site with no .htaccess", () => {
  /* `cp -R * $DOCROOT` is the idiom in most .cpanel.yml examples and it is
     wrong here: the glob does not match .htaccess, which on this site is the
     canonical-host redirects, the CSP, HSTS and the ACME exemption. The deploy
     reports success and the site loses all of it. */
  const yml = readFileSync(join(dist, ".cpanel.yml"), "utf8");
  const copy = yml
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");

  assert.doesNotMatch(
    copy,
    /cp\s+-[a-zA-Z]*R[a-zA-Z]*\s+\*/,
    "the copy uses a bare '*' glob, which skips .htaccess and every other " +
      "dotfile. Use rsync or tar.",
  );
  assert.match(
    copy,
    /rsync|tar/,
    "no dotfile-safe copy command (rsync or tar) appears in the deploy tasks",
  );
});

test("the deploy does not delete what it must not delete", () => {
  /* --delete keeps the document root equal to the build instead of hoarding
     every fingerprinted asset ever shipped. That is correct, and it is also
     the one thing here that can destroy something: .well-known/ holds AutoSSL's
     HTTP-01 challenge tokens, and a deploy that runs mid-validation would fail
     a certificate renewal it has nothing to do with. .git/ must never reach the
     document root at all. */
  const yml = readFileSync(join(dist, ".cpanel.yml"), "utf8");
  if (!/--delete/.test(yml)) return; // nothing is removed; nothing to protect

  for (const path of [".git", ".well-known", ".cpanel.yml"]) {
    assert.match(
      yml,
      new RegExp(`--exclude=\\.?/?${path.replace(".", "\\.")}`),
      `${path} is not excluded from a --delete copy into the document root`,
    );
  }
});

test("the deploy target is a document root, not the repository checkout", () => {
  /* The whole defect this file fixes was a copy that never left the home
     directory. A DOCROOT pointing back at the checkout would restore it. */
  const yml = readFileSync(join(dist, ".cpanel.yml"), "utf8");
  const docroot = yml.match(/DOCROOT=(\S+)/)?.[1];
  assert.ok(docroot, "no DOCROOT is exported by the deploy tasks");
  assert.match(
    docroot,
    /public_html/,
    `DOCROOT is ${docroot}, which is not under public_html. cPanel's default ` +
      `clone path is the home directory, and copying there changes nothing.`,
  );
});
