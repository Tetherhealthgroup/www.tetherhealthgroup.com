// Security — static checks on the contact handler, public/api/message.php.
// Runs without PHP; the behaviour is exercised over HTTP in
// test/functional/contact-php.test.js when an interpreter exists.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { projectRoot } from "../helpers/dist.js";

const read = (name) =>
  readFileSync(join(projectRoot, "public", "api", name), "utf8")
    .replace(/^\s*\/\*[\s\S]*?\*\//gm, "")
    .replace(/^\s*\/\/.*$/gm, "");
const handler = read("message.php");
const lib = read("beta-lib.inc");

test("POST only, through the shared guards", () => {
  assert.match(handler, /require __DIR__ \. '\/beta-lib\.inc';/);
  assert.match(handler, /\$_SERVER\['REQUEST_METHOD'\][^;]*!== 'POST'/);
  assert.match(handler, /header\('Allow: POST'\)/);
  assert.match(handler, /beta_rate_limit\(\$config, 'tether-contact'\)/);
  assert.match(handler, /\$_POST\['contact_ref'\]/);
  assert.match(handler, /\(int\) \$fill < BETA_MIN_FILL_MS/);
  for (const name of [
    "topic",
    "first_name",
    "email",
    "organisation",
    "fill_ms",
  ])
    assert.match(
      handler,
      new RegExp(`beta_field\\(\\$_POST, '${name}'\\)`),
      name,
    );
  assert.match(handler, /array_key_exists\(\$topic, BETA_CONTACT_TOPICS\)/);
  assert.match(handler, /beta_is_email\(\$email\)/);
  assert.match(handler, /<= BETA_MAX_MESSAGE_CHARS/);
  assert.match(
    handler,
    /\[\\x00-\\x09\\x0B-\\x1F\\x7F\]/,
    "message control characters",
  );
});

test("the topic allowlist is the six agreed topics, with no admin", () => {
  const block =
    lib.match(/const BETA_CONTACT_TOPICS = \[([\s\S]*?)\];/)?.[1] ?? "";
  const keys = [...block.matchAll(/'([a-z_]+)' =>/g)].map((m) => m[1]);
  assert.deepEqual(keys, [
    "support",
    "app_feedback",
    "sales_partnerships",
    "careers",
    "privacy",
    "finance",
  ]);
  assert.doesNotMatch(lib + handler, /admin/i);
});

test("the mailbox comes only from the private config, and fails closed", () => {
  assert.match(
    handler,
    /\$to = \$config\['contact_routes'\]\[\$topic\] \?\? null;/,
  );
  assert.match(
    handler,
    /if \(\$to === null\) \{[\s\S]*?contact_fail\('unavailable'\);/,
  );
  assert.doesNotMatch(
    handler,
    /@tetherhealthgroup\.com/,
    "no address in the handler",
  );
});

test("one email to the team: fixed headers, no Reply-To, nothing to the visitor, no direct storage", () => {
  const sends = [...handler.matchAll(/\bbeta_mail\(([^,]+),/g)].map((m) =>
    m[1].trim(),
  );
  assert.deepEqual(
    sends,
    ["$to"],
    "the handler must send exactly one email, to the route",
  );
  assert.doesNotMatch(handler, /\bmail\(/);
  assert.doesNotMatch(handler + lib, /Reply-To/i);
  assert.match(
    handler,
    /beta_header_text\('\[Contact · ' \. \$label \. '\]'\)/,
  );
  assert.doesNotMatch(
    handler,
    /fopen|file_put_contents|fputcsv|beta_with_rows|beta_store/,
  );
});

test("only the topic and message are queued, after the email, for App feedback and Support", () => {
  const calls = [...handler.matchAll(/beta_feedback_queue\(([^)]*)\)/g)].map(
    (m) => m[1],
  );
  assert.deepEqual(calls, ["$topic, $message"]);
  const failBranch =
    handler.match(/if \(!beta_mail\([\s\S]*?\n\}\n/)?.[0] ?? "";
  assert.ok(failBranch, "the mail failure branch exists");
  assert.ok(
    handler.indexOf("beta_feedback_queue(") >
      handler.indexOf(failBranch) + failBranch.length,
    "the queue is written only after the email is sent, outside its failure branch",
  );
  assert.match(
    lib,
    /const BETA_FEEDBACK_TOPICS = \['app_feedback', 'support'\];/,
  );
  const fn = lib.match(/function beta_feedback_queue\([\s\S]*?\n\}/)?.[0] ?? "";
  assert.ok(fn, "beta_feedback_queue exists");
  const pathFn =
    lib.match(/function beta_feedback_path\([\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(pathFn, /beta_outside_web_root\(\$path\)/);
  assert.doesNotMatch(
    fn,
    /email|first_?name|organisation|REMOTE_ADDR|\$_POST|\$_SERVER/i,
  );
  assert.deepEqual(
    [...fn.matchAll(/'([a-z]+)' =>/g)].map((m) => m[1]),
    ["id", "topic", "sent", "message"],
  );
});

test("only App feedback falls back, to the support route, and only when it has no entry of its own", () => {
  const block =
    lib.match(/const BETA_CONTACT_ROUTE_FALLBACKS = \[([\s\S]*?)\];/)?.[1] ??
    "";
  assert.deepEqual(
    [...block.matchAll(/'([a-z_]+)' => '([a-z_]+)'/g)].map((m) => [m[1], m[2]]),
    [["app_feedback", "support"]],
  );
  assert.match(
    lib,
    /!array_key_exists\(\$topic, \$rawRoutes\) && isset\(\$routes\[\$fallback\]\)/,
    "a present-but-invalid route must not fall back",
  );
});

test("errors return to a page from a fixed map, never a URL from the request", () => {
  const block =
    handler.match(/const CONTACT_ERROR_PAGES = \[([\s\S]*?)\];/)?.[1] ?? "";
  assert.deepEqual(
    [...block.matchAll(/'([a-z_]+)' => '([^']+)'/g)].map((m) => [m[1], m[2]]),
    [["app_feedback", "/feedback/"]],
  );
  const fail = handler.match(/function contact_fail\([\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(fail, /CONTACT_ERROR_PAGES\[\$topic\]/);
  assert.match(fail, /: '\/contact\/';/);
  assert.doesNotMatch(fail, /\$_(?:GET|SERVER|REQUEST)|HTTP_REFERER/);
});

test("no handler is named contact*: the host answers those with a 409 bot challenge the CSP blocks", async () => {
  const { readdirSync } = await import("node:fs");
  const names = readdirSync(join(projectRoot, "public", "api"));
  assert.deepEqual(
    names.filter((n) => /^contact/i.test(n)),
    [],
  );
  const form = readFileSync(
    join(projectRoot, "src", "components", "ContactForm.astro"),
    "utf8",
  );
  assert.match(form, /action="\/api\/message\.php"/);
});
