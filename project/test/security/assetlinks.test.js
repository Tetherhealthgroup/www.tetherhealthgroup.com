// Security — Android App Links statement at /.well-known/assetlinks.json.
//
// This file tells Android which app may open links on this domain. A wrong
// package or fingerprint hands that trust to the wrong app, or to none, so
// every field is pinned exactly. The fingerprint is the SHA-256 of the Play
// app-signing certificate; it is public by design.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { dist, projectRoot, htaccess } from "../helpers/dist.js";

const PACKAGE = "com.TetherHealthLLC.tetherhealth";
const RELATION = "delegate_permission/common.handle_all_urls";
const FINGERPRINT =
  "97:CC:2D:32:B8:21:11:DD:0C:BA:13:A2:50:D5:AE:47:F4:F0:EB:83:33:8F:79:21:6D:7F:F5:53:8B:2D:1D:EB";

const sourcePath = join(
  projectRoot,
  "public",
  ".well-known",
  "assetlinks.json",
);
const builtPath = join(dist, ".well-known", "assetlinks.json");

const parse = () => JSON.parse(readFileSync(sourcePath, "utf8"));

test("assetlinks.json is valid JSON holding exactly one statement", () => {
  const statements = parse();
  assert.ok(Array.isArray(statements), "the top level must be an array");
  assert.equal(statements.length, 1, "exactly one statement is published");
});

test("the statement grants exactly handle_all_urls to the Android app", () => {
  const [statement] = parse();
  assert.deepEqual(Object.keys(statement).sort(), ["relation", "target"]);
  assert.deepEqual(statement.relation, [RELATION]);
  assert.deepEqual(Object.keys(statement.target).sort(), [
    "namespace",
    "package_name",
    "sha256_cert_fingerprints",
  ]);
  assert.equal(statement.target.namespace, "android_app");
  assert.equal(statement.target.package_name, PACKAGE);
});

test("the fingerprint is 32 colon-separated uppercase hex bytes and is the app-signing key", () => {
  const prints = parse()[0].target.sha256_cert_fingerprints;
  assert.ok(Array.isArray(prints), "sha256_cert_fingerprints must be an array");
  assert.equal(prints.length, 1, "exactly one fingerprint is published");
  assert.match(prints[0], /^[0-9A-F]{2}(?::[0-9A-F]{2}){31}$/);
  assert.equal(prints[0], FINGERPRINT);
});

test("assetlinks.json is emitted in the build, byte for byte", () => {
  assert.ok(
    existsSync(builtPath),
    "dist/.well-known/assetlinks.json is missing",
  );
  assert.ok(
    readFileSync(builtPath).equals(readFileSync(sourcePath)),
    "the built assetlinks.json differs from public/.well-known/assetlinks.json",
  );
});

test("assetlinks.json is served as application/json and not blocked by .htaccess", () => {
  const conf = htaccess();

  // The content-type rule sits inside the mod_mime block, like security.txt.
  const mime = conf.match(/<IfModule mod_mime\.c>([\s\S]*?)<\/IfModule>/)?.[1];
  assert.ok(mime, "mod_mime block not found; re-check this test");
  assert.match(
    mime,
    /<Files "assetlinks\.json">\s*ForceType application\/json\s*<\/Files>/,
    "assetlinks.json is not forced to application/json",
  );

  // The filename deny-list and the .git rule must not catch it.
  const deny = conf.match(/<FilesMatch "([^"]*\^\\\.[^"]*)">/)?.[1];
  assert.ok(deny, "dotfile deny-list not found; re-check this test");
  assert.equal(new RegExp(deny).test("assetlinks.json"), false);
  // Nor the directory name: when .well-known/ is missing from the document
  // root, Apache matches <FilesMatch> against ".well-known" itself, and a
  // match there answered 403 for /.well-known/assetlinks.json.
  assert.equal(new RegExp(deny).test(".well-known"), false);
  assert.equal(
    new RegExp("(^|/)\\.git(/|$)").test(".well-known/assetlinks.json"),
    false,
  );
});

test("the dotfile deny-list still refuses every other dot-name", () => {
  const deny = htaccess().match(/<FilesMatch "([^"]*\^\\\.[^"]*)">/)?.[1];
  assert.ok(deny, "dotfile deny-list not found; re-check this test");
  const re = new RegExp(deny);
  for (const name of [
    ".htaccess",
    ".env",
    ".git",
    ".cpanel.yml",
    ".well-known-x",
    ".well-knownx",
    ".hidden",
  ])
    assert.equal(re.test(name), true, `${name} is no longer refused`);
});

test("the published statement is the exact agreed JSON", () => {
  assert.deepEqual(parse(), [
    {
      relation: [RELATION],
      target: {
        namespace: "android_app",
        package_name: PACKAGE,
        sha256_cert_fingerprints: [FINGERPRINT],
      },
    },
  ]);
});
