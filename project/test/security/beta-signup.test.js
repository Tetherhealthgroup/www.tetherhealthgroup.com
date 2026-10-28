// Security — static checks on the beta waitlist handler,
// public/api/beta-signup.php.
//
// These run without PHP. They assert that each required guard is present in
// the source, that no input reaches output or a shell, and that the private
// config never ships. The behaviour behind each guard is exercised over HTTP
// in test/functional/beta-signup-php.test.js when a PHP interpreter exists.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { dist, projectRoot } from "../helpers/dist.js";
import { repoFiles } from "../helpers/repo.js";

const source = readFileSync(
  join(projectRoot, "public", "api", "beta-signup.php"),
  "utf8",
);
/** Source with comments removed, so a guard named only in a comment fails. */
const code = source
  .replace(/^\s*\/\*[\s\S]*?\*\//gm, "")
  .replace(/^\s*\/\/.*$/gm, "");

test("only POST is accepted", () => {
  assert.match(code, /\$_SERVER\['REQUEST_METHOD'\][^;]*!== 'POST'/);
  assert.match(code, /header\('Allow: POST'\)/);
  assert.match(code, /beta_page\(405,/);
});

test("every field is rejected if it carries CR or LF (header injection)", () => {
  assert.match(code, /preg_match\('\/\[\\r\\n\]\/', \$value\) === 1/);
  // The check is in the one function every field passes through.
  const field = code.match(/function beta_field\([\s\S]*?\n}/)?.[0] ?? "";
  assert.match(field, /\[\\r\\n\]/, "beta_field does not reject CR/LF");
  assert.match(field, /is_string\(\$value\)/, "beta_field accepts arrays");
  assert.match(field, /trim\(\$value\)/, "beta_field does not trim");
  for (const name of [
    "first_name",
    "email",
    "phone",
    "source",
    "adult",
    "consent",
    "fill_ms",
  ])
    assert.match(
      code,
      new RegExp(`beta_field\\('${name}'\\)`),
      `${name} bypasses beta_field`,
    );
});

test("email is validated with filter_var and capped in length", () => {
  assert.match(code, /filter_var\(\$value, FILTER_VALIDATE_EMAIL\)/);
  assert.match(code, /strlen\(\$value\) <= BETA_MAX_EMAIL/);
  assert.match(code, /strlen\(\$firstName\) <= BETA_MAX_FIRST_NAME/);
});

test("the honeypot, minimum fill time and per-IP rate limit are enforced", () => {
  assert.match(code, /\$_POST\['contact_ref'\]/);
  assert.match(code, /BETA_MIN_FILL_MS = \d{4,}/);
  assert.match(code, /\(int\) \$fill < BETA_MIN_FILL_MS/);
  assert.match(code, /function beta_rate_limit\(/);
  assert.match(code, /\$_SERVER\['REMOTE_ADDR'\]/);
  assert.match(code, /flock\(\$handle, LOCK_EX\)/);
  assert.match(code, /beta_fail\('rate'\)/);
  // The client-supplied forwarding header is never trusted for the limit.
  assert.doesNotMatch(code, /HTTP_X_FORWARDED_FOR|HTTP_CLIENT_IP/);
});

test("storage and counters must be outside the web root", () => {
  assert.match(code, /function beta_outside_web_root\(/);
  assert.match(code, /beta_outside_web_root\(\$storage\)/);
  assert.match(code, /beta_outside_web_root\(\$rateDir\)/);
  assert.match(code, /public_html/);
  assert.match(code, /DOCUMENT_ROOT/);
});

test("output is escaped with htmlspecialchars and never echoes input", () => {
  assert.match(
    code,
    /htmlspecialchars\(\$text, ENT_QUOTES \| ENT_SUBSTITUTE, 'UTF-8'\)/,
  );
  const echoes = [...code.matchAll(/\b(?:echo|print)\b([\s\S]*?);\n/g)];
  assert.ok(echoes.length > 0, "no echo found; re-check this test");
  const piece = String.raw`(?:'[^'\\]*'|beta_html\(\$\w+\))`;
  const onlySafe = new RegExp(`^\\s*${piece}(?:\\s*,\\s*${piece})*\\s*$`);
  for (const [, args] of echoes)
    assert.match(args, onlySafe, `unescaped output in: echo${args}`);
  assert.doesNotMatch(code, /\?>\s*\S/, "no inline HTML templates");
});

test("no shell, eval or unsafe input source is used", () => {
  for (const banned of [
    /\beval\s*\(/,
    /\b(?:shell_exec|exec|system|passthru|popen|proc_open|pcntl_exec)\s*\(/,
    /`/,
    /\bunserialize\s*\(/,
    /\bextract\s*\(/,
    /\$_(?:GET|REQUEST|COOKIE|FILES)\b/,
    /\binclude\s+\$_|\brequire\s+\$_/,
  ])
    assert.doesNotMatch(code, banned, `banned construct: ${banned}`);
});

test("mail uses fixed headers; only validated addresses reach a header", () => {
  const mail = code.match(/function beta_mail\([\s\S]*?\n}/)?.[0] ?? "";
  assert.match(mail, /'Content-Type' => 'text\/plain; charset=UTF-8'/);
  assert.match(mail, /mail\(\$to, \$subject,/);
  assert.doesNotMatch(mail, /\$_POST/);
  // The member's address is the only input used in a header (Reply-To), and
  // it has passed beta_is_email by then.
  assert.match(code, /beta_is_email\(\$email\)/);
});

test("the private config is not in the repository and does not ship", () => {
  const files = repoFiles();
  assert.ok(
    !files.some((f) => /(^|\/)beta-config\.php$/.test(f)),
    "a real beta-config.php is tracked",
  );
  assert.ok(files.includes("docs/beta-config.example.php"));
  assert.ok(
    !files.some(
      (f) => f.startsWith("project/public/") && /beta-config/.test(f),
    ),
    "a beta config file is inside public/",
  );
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(dir, e.name)) : [e.name],
    );
  assert.ok(existsSync(dist), "run npm run build first");
  assert.ok(
    !walk(dist).some((name) => /beta-config|\.csv$|\.rate$/.test(name)),
    "config, waitlist data or counters are in the build",
  );
});

test("the example config shows every key, with role mailboxes only", () => {
  const example = readFileSync(
    join(projectRoot, "..", "docs", "beta-config.example.php"),
    "utf8",
  );
  for (const key of ["storage_path", "rate_limit_dir", "notify", "from"])
    assert.match(example, new RegExp(`'${key}' =>`), `example lacks ${key}`);
  assert.match(example, /'from' => 'support@tetherhealthgroup\.com'/);
  assert.match(example, /'support@tetherhealthgroup\.com',/);
  assert.doesNotMatch(
    example,
    /'(?:storage_path|rate_limit_dir)' => '[^']*public_html/,
    "the example points storage inside public_html",
  );
});
