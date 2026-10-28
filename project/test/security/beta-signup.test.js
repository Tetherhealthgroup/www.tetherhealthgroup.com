// Security — static checks on the beta waitlist handlers in public/api/:
// beta-signup.php, beta-confirm.php and their shared beta-lib.inc.
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

/** Source with comments removed, so a guard named only in a comment fails. */
const stripped = (name) =>
  readFileSync(join(projectRoot, "public", "api", name), "utf8")
    .replace(/^\s*\/\*[\s\S]*?\*\//gm, "")
    .replace(/^\s*\/\/.*$/gm, "");
const signup = stripped("beta-signup.php");
const confirm = stripped("beta-confirm.php");
const lib = stripped("beta-lib.inc");
const code = [lib, signup, confirm].join("\n");

test("sign-up accepts only POST; confirm only GET (a page) and POST", () => {
  assert.match(signup, /\$_SERVER\['REQUEST_METHOD'\][^;]*!== 'POST'/);
  assert.match(signup, /header\('Allow: POST'\)/);
  assert.match(signup, /beta_page\(405,/);
  assert.match(confirm, /header\('Allow: GET, POST'\)/);
  // Only the POST branch changes a row to confirmed.
  const getBranch = confirm.match(
    /if \(\$method === 'GET'\) \{[\s\S]*?\n}/,
  )?.[0];
  assert.ok(getBranch, "no GET branch found; re-check this test");
  assert.doesNotMatch(getBranch, /'confirmed'/, "a GET confirms");
});

test("both handlers load the shared code and run the cleanup on every request", () => {
  for (const [name, src] of [
    ["beta-signup.php", signup],
    ["beta-confirm.php", confirm],
  ]) {
    assert.match(src, /require __DIR__ \. '\/beta-lib\.inc';/, name);
    const cleanup = src.indexOf("beta_cleanup($config)");
    const method = src.indexOf("REQUEST_METHOD");
    assert.ok(
      cleanup > -1 && cleanup < method,
      `${name}: cleanup is not before the method check`,
    );
  }
  assert.match(lib, /\$mtime < \$now - BETA_RATE_FILE_TTL/);
  assert.match(
    lib,
    /\$row\['status'\] === 'pending' && \$row\['token_expires_utc'\] <= \$now/,
  );
});

test("tokens are random, single-use, stored as a hash and expire in 7 days", () => {
  assert.match(lib, /bin2hex\(random_bytes\(32\)\)/);
  assert.match(lib, /hash\('sha256', \$token\)/);
  assert.match(lib, /const BETA_TOKEN_TTL = 7 \* 86400;/);
  assert.match(lib, /const BETA_RESEND_AFTER = 86400;/);
  assert.match(confirm, /hash_equals\(\$row\['token_hash'\], \$hash\)/);
  assert.match(
    confirm,
    /\$row\['token_hash'\] = '';/,
    "the token is not cleared",
  );
  assert.match(confirm, /preg_match\('\/\^\[0-9a-f\]\{64\}\$\/', \$token\)/);
});

test("every field is rejected if it carries CR or LF (header injection)", () => {
  assert.match(code, /preg_match\('\/\[\\r\\n\]\/', \$value\) === 1/);
  // The check is in the one function every field passes through.
  const field = code.match(/function beta_field\([\s\S]*?\n}/)?.[0] ?? "";
  assert.match(field, /\[\\r\\n\]/, "beta_field does not reject CR/LF");
  assert.match(field, /is_string\(\$value\)/, "beta_field accepts arrays");
  assert.match(field, /trim\(\$value\)/, "beta_field does not trim");
  for (const name of [
    "t",
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
      new RegExp(`beta_field\\([^,]+, '${name}'\\)`),
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
    /\$_(?:REQUEST|COOKIE|FILES)\b/,
    /\binclude\s+\$_|\brequire\s+\$_/,
  ])
    assert.doesNotMatch(code, banned, `banned construct: ${banned}`);
  // $_GET is read in one place: the confirm token, through beta_field.
  assert.equal(code.match(/\$_GET\b/g)?.length, 1);
  assert.match(
    confirm,
    /beta_field\(\$method === 'POST' \? \$_POST : \$_GET, 't'\)/,
  );
});

test("mail uses fixed headers; only validated addresses reach a header", () => {
  const mail = code.match(/function beta_mail\([\s\S]*?\n}/)?.[0] ?? "";
  assert.match(mail, /'Content-Type' => 'text\/plain; charset=UTF-8'/);
  assert.match(mail, /mail\(\$to, \$subject,/);
  assert.doesNotMatch(mail, /\$_POST/);
  assert.doesNotMatch(code, /Reply-To/i, "no email carries a Reply-To");
  // The member's address is the only input used in a header (To), and it
  // has passed beta_is_email by then.
  assert.match(code, /beta_is_email\(\$email\)/);
});

test("the confirmation email body carries the link and no submitted text", () => {
  const fn =
    lib.match(/function beta_send_confirmation\([\s\S]*?\n}/)?.[0] ?? "";
  assert.ok(fn, "beta_send_confirmation not found");
  const vars = [...fn.matchAll(/\$\w+/g)].map((m) => m[0]);
  assert.deepEqual(
    [...new Set(vars)].sort(),
    ["$body", "$from", "$to", "$token"].sort(),
  );
  assert.match(fn, /'Confirm your spot on the Tether Health beta waitlist/);
  assert.match(
    fn,
    /BETA_SITE_URL \. '\/api\/beta-confirm\.php\?t=' \. \$token/,
  );
  assert.match(
    lib,
    /const BETA_SITE_URL = 'https:\/\/www\.tetherhealthgroup\.com';/,
  );
  assert.doesNotMatch(
    code,
    /HTTP_HOST|SERVER_NAME/,
    "the link must not come from the request",
  );
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
