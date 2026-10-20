// Integration — the build output and the edge configuration that ships
// with it, checked against each other. A CSP hash is exact, so a script
// edited without updating the policy is a silently broken page.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  dist,
  inlineScriptHashes,
  htaccess as readHtaccess,
  cspLine as readCspLine,
} from "../helpers/dist.js";

const htaccess = readHtaccess();
const cspLine = readCspLine();

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
     document root at all. Comment lines are stripped first, so a comment
     that merely mentions a flag cannot satisfy these checks. */
  const commands = readFileSync(join(dist, ".cpanel.yml"), "utf8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");
  if (!/--delete/.test(commands)) return; // nothing is removed; nothing to protect

  for (const path of [".git", ".cpanel.yml"]) {
    assert.match(
      commands,
      new RegExp(`--exclude=\\.?/?${path.replace(/[.]/g, "\\.")}`),
      `${path} is not excluded from a --delete copy into the document root`,
    );
  }
  assert.match(
    commands,
    /--filter='P \/\.well-known\/\*\*'/,
    "everything under /.well-known/ must be protected from --delete " +
      "(--filter='P /.well-known/**')",
  );
});

test("the deploy does not exclude .well-known wholesale, or security.txt never ships", () => {
  /* rsync --exclude also stops the TRANSFER, not just the deletion. Excluding
     all of .well-known/ protected AutoSSL's tokens but meant
     /.well-known/security.txt could never reach the document root. Everything
     under it is protected from deletion instead (see the test above). */
  const yml = readFileSync(join(dist, ".cpanel.yml"), "utf8");
  const commands = yml
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");
  assert.doesNotMatch(
    commands,
    /--exclude=\.?\/?\/?\.well-known\/?(\s|$)/,
    "the deploy excludes the whole .well-known directory",
  );
  assert.doesNotMatch(
    commands,
    /tar[^|]*--exclude=\.\/\.well-known(\s|$)/,
    "the tar fallback excludes the whole .well-known directory",
  );
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
