// Functional — the beta waitlist handler, public/api/beta-signup.php, run by a
// real PHP interpreter over HTTP.
//
// Each case POSTs the way the no-JavaScript form does and asserts the whole
// outcome: the redirect, the CSV row (or its absence) and the mail that was
// (or was not) handed to sendmail. PHP's built-in server stands in for Apache;
// sendmail is a capture script, so no mail leaves the machine. Every address is
// synthetic.
//
// PHP is not part of this repository's toolchain. When no interpreter is found
// (PHP_BIN, else `php` on PATH) these cases are reported as skipped, with the
// reason; the static guard checks in test/security/beta-signup.test.js still
// run.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { projectRoot } from "../helpers/dist.js";

const PHP = process.env.PHP_BIN || "php";
const phpAvailable = spawnSync(PHP, ["-v"], { encoding: "utf8" }).status === 0;
const skip = phpAvailable
  ? false
  : `no PHP interpreter (set PHP_BIN or put php on PATH)`;

const PORT = 4332; // e2e uses 4331
const BASE = `http://127.0.0.1:${PORT}`;
const ENDPOINT = `${BASE}/api/beta-signup.php`;
const NOTIFY = "support@tetherhealthgroup.com";

let tmp, docroot, privateDir, configPath, csvPath, mailLog, server;

function writeConfig(overrides = {}) {
  const config = {
    storage_path: csvPath,
    rate_limit_dir: join(privateDir, "rate"),
    notify: [NOTIFY],
    from: NOTIFY,
    rate_limit_max: 1000,
    rate_limit_window: 3600,
    ...overrides,
  };
  const php = (value) =>
    Array.isArray(value)
      ? `[${value.map(php).join(", ")}]`
      : typeof value === "number"
        ? String(value)
        : `'${String(value).replace(/['\\]/g, "\\$&")}'`;
  const body = Object.entries(config)
    .map(([key, value]) => `  '${key}' => ${php(value)},`)
    .join("\n");
  writeFileSync(configPath, `<?php\nreturn [\n${body}\n];\n`);
}

/** Messages handed to sendmail so far: { args, raw }. */
function mails() {
  if (!existsSync(mailLog)) return [];
  return readFileSync(mailLog, "utf8")
    .split("--END--\n")
    .filter((chunk) => chunk.trim())
    .map((chunk) => {
      const [first, ...rest] = chunk.split("\n");
      return { args: first.replace(/^ARGS: /, ""), raw: rest.join("\n") };
    });
}

const csvLines = () =>
  existsSync(csvPath)
    ? readFileSync(csvPath, "utf8").split("\n").filter(Boolean)
    : [];

function reset() {
  for (const path of [csvPath, mailLog]) if (existsSync(path)) unlinkSync(path);
  rmSync(join(privateDir, "rate"), { recursive: true, force: true });
  writeConfig();
}

const VALID = {
  first_name: "Synthetic",
  email: "synthetic-user-01@example.test",
  phone: "iphone",
  source: "friend",
  adult: "yes",
  consent: "yes",
  contact_ref: "",
  fill_ms: "5000",
};

/** POST form fields; `fields` may hold arrays for repeated keys. */
async function post(fields) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields))
    for (const v of [].concat(value)) body.append(key, v);
  const res = await fetch(ENDPOINT, {
    method: "POST",
    body,
    redirect: "manual",
  });
  return { status: res.status, location: res.headers.get("location") };
}

before(async () => {
  if (!phpAvailable) return;
  tmp = mkdtempSync(join(tmpdir(), "beta-signup-"));
  docroot = join(tmp, "site");
  privateDir = join(tmp, "private");
  mkdirSync(join(docroot, "api"), { recursive: true });
  mkdirSync(privateDir);
  copyFileSync(
    join(projectRoot, "public", "api", "beta-signup.php"),
    join(docroot, "api", "beta-signup.php"),
  );
  configPath = join(privateDir, "beta-config.php");
  csvPath = join(privateDir, "beta-waitlist.csv");
  mailLog = join(tmp, "mail.log");
  const sendmail = join(tmp, "sendmail.sh");
  writeFileSync(
    sendmail,
    '#!/bin/sh\n{ echo "ARGS: $*"; cat; echo "--END--"; } >> "$MAIL_LOG"\n',
  );
  chmodSync(sendmail, 0o755);
  writeConfig();

  server = spawn(
    PHP,
    [
      "-d",
      `sendmail_path=${sendmail}`,
      "-d",
      "display_errors=0",
      "-d",
      "log_errors=1",
      "-d",
      `error_log=${join(tmp, "php-error.log")}`,
      "-S",
      `127.0.0.1:${PORT}`,
      "-t",
      docroot,
    ],
    {
      env: {
        ...process.env,
        TETHER_BETA_CONFIG: configPath,
        MAIL_LOG: mailLog,
      },
      stdio: "ignore",
    },
  );
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      await fetch(ENDPOINT, { redirect: "manual" });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error(`PHP server did not answer on ${BASE}`);
});

after(() => {
  server?.kill();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

test(
  "a GET is refused with 405 and Allow: POST, and stores nothing",
  { skip },
  async () => {
    reset();
    const res = await fetch(`${ENDPOINT}?first_name=<b>x</b>`);
    assert.equal(res.status, 405);
    assert.equal(res.headers.get("allow"), "POST");
    const html = await res.text();
    assert.doesNotMatch(html, /<b>x<\/b>/, "query input must never be echoed");
    assert.deepEqual(csvLines(), []);
    assert.deepEqual(mails(), []);
  },
);

test(
  "a valid sign-up is stored, the team is notified, the member is confirmed",
  { skip },
  async () => {
    reset();
    const res = await post(VALID);
    assert.equal(res.status, 303);
    assert.equal(res.location, "/beta/thanks/");

    const rows = csvLines();
    assert.equal(rows.length, 2, "header plus one row");
    assert.equal(
      rows[0],
      "submitted_at_utc,first_name,email,phone,heard_from,confirmed_18_plus,consent_beta_email",
    );
    assert.match(
      rows[1],
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z,Synthetic,synthetic-user-01@example\.test,iPhone,"Friend or family",yes,yes$/,
    );

    const sent = mails();
    assert.equal(sent.length, 2, "one notification and one confirmation");
    const [notify, confirm] = sent;

    assert.match(notify.raw, new RegExp(`^To: ${NOTIFY}$`, "m"));
    assert.match(
      notify.raw,
      /^Subject: New beta waitlist sign-up \(iPhone\)$/m,
    );
    assert.match(notify.raw, /^Reply-To: synthetic-user-01@example\.test$/m);
    assert.match(
      notify.raw,
      /^From: Tether Health <support@tetherhealthgroup\.com>$/m,
    );
    assert.match(notify.raw, /Email: synthetic-user-01@example\.test/);
    assert.match(notify.raw, /Heard about us from: Friend or family/);
    assert.match(notify.args, /-fsupport@tetherhealthgroup\.com/);

    assert.match(confirm.raw, /^To: synthetic-user-01@example\.test$/m);
    assert.match(confirm.raw, /^Content-Type: text\/plain; charset=UTF-8$/m);
    assert.match(confirm.raw, /^Reply-To: support@tetherhealthgroup\.com$/m);
    assert.match(
      confirm.raw,
      /You're on the list; we'll email you an invite when there's a spot\./,
    );
    assert.match(confirm.raw, /TestFlight/);
    assert.match(confirm.raw, /We cannot promise a date\./);
    assert.match(confirm.raw, /reply to this message with "unsubscribe"/);
    assert.match(confirm.raw, /privacy@tetherhealthgroup\.com/);
    assert.doesNotMatch(
      confirm.raw,
      /\b20\d\d\b|\bweeks?\b|\bdays?\b|\bsoon\b/i,
    );
  },
);

test(
  "the Android choice is stored and confirmed as Android",
  { skip },
  async () => {
    reset();
    const res = await post({ ...VALID, phone: "android", source: "" });
    assert.equal(res.location, "/beta/thanks/");
    assert.match(csvLines()[1], /,Android,"\(not given\)",yes,yes$/);
    const confirm = mails()[1];
    assert.match(confirm.raw, /invite to test on Android\./);
    assert.doesNotMatch(confirm.raw, /TestFlight/);
  },
);

test(
  "a submission without the timing field (JavaScript off) is accepted",
  { skip },
  async () => {
    reset();
    const { fill_ms, ...noScript } = VALID;
    const res = await post(noScript);
    assert.equal(res.location, "/beta/thanks/");
    assert.equal(csvLines().length, 2);
  },
);

const INVALID = [
  ["no first name", { first_name: "" }],
  ["whitespace-only first name", { first_name: "   " }],
  ["an over-long first name", { first_name: "x".repeat(81) }],
  ["no email", { email: "" }],
  ["an invalid email", { email: "not-an-address" }],
  [
    "an email with a header injected",
    { email: "a@example.test\r\nBcc: b@example.test" },
  ],
  ["an email with a bare LF", { email: "a@example.test\nBcc: b@example.test" }],
  ["a first name with CR/LF", { first_name: "Syn\r\nBcc: b@example.test" }],
  ["a source with CR/LF", { source: "friend\r\n" }],
  ["a phone outside the list", { phone: "blackberry" }],
  ["no phone", { phone: "" }],
  ["a source outside the list", { source: "billboard" }],
  ["no 18+ confirmation", { adult: "" }],
  ["no consent", { consent: "" }],
  ["a field sent as an array", { first_name: ["a", "b"] }],
  ["a control character", { first_name: "Syn\u0000thetic" }],
];

for (const [name, change] of INVALID) {
  test(
    `${name} is returned to the form with an error, nothing stored or sent`,
    { skip },
    async () => {
      reset();
      const fields = { ...VALID, ...change };
      if (Array.isArray(change.first_name)) {
        delete fields.first_name;
        fields["first_name[]"] = change.first_name;
      }
      const res = await post(fields);
      assert.equal(res.status, 303);
      assert.equal(res.location, "/beta/#error-fields");
      assert.deepEqual(csvLines(), []);
      assert.deepEqual(mails(), []);
    },
  );
}

test(
  "a filled honeypot looks like success but stores and sends nothing",
  { skip },
  async () => {
    reset();
    const res = await post({
      ...VALID,
      contact_ref: "https://spam.example.test",
    });
    assert.equal(res.location, "/beta/thanks/");
    assert.deepEqual(csvLines(), []);
    assert.deepEqual(mails(), []);
  },
);

test(
  "a form filled faster than the minimum time is asked to retry",
  { skip },
  async () => {
    reset();
    for (const fill of ["500", "abc", "-1"]) {
      const res = await post({ ...VALID, fill_ms: fill });
      assert.equal(res.location, "/beta/#error-retry", `fill_ms=${fill}`);
    }
    assert.deepEqual(csvLines(), []);
    assert.deepEqual(mails(), []);
  },
);

test(
  "the per-IP rate limit refuses attempts over the configured maximum",
  { skip },
  async () => {
    reset();
    writeConfig({ rate_limit_max: 2 });
    assert.equal((await post(VALID)).location, "/beta/thanks/");
    assert.equal(
      (await post({ ...VALID, email: "" })).location,
      "/beta/#error-fields",
    );
    const third = await post(VALID);
    assert.equal(third.location, "/beta/#error-rate");
    assert.equal(csvLines().length, 2, "only the first attempt was stored");
    assert.equal(mails().length, 2);
    // The counter lives in the configured private folder, named by a hash.
    const rateDir = join(privateDir, "rate");
    const files = readdirSync(rateDir);
    assert.equal(files.length, 1);
    assert.match(
      files[0],
      /^[0-9a-f]{64}\.rate$/,
      "named by hash, not by address",
    );
    const stamps = readFileSync(join(rateDir, files[0]), "utf8").split("\n");
    assert.equal(stamps.length, 2, "two allowed attempts recorded");
  },
);

test(
  "with no config file the form says unavailable and sends nothing",
  { skip },
  async () => {
    reset();
    unlinkSync(configPath);
    try {
      const res = await post(VALID);
      assert.equal(res.location, "/beta/#error-unavailable");
      assert.deepEqual(csvLines(), []);
      assert.deepEqual(mails(), []);
    } finally {
      writeConfig();
    }
  },
);

test(
  "a config that points storage inside the web root is refused",
  { skip },
  async () => {
    reset();
    const inside = join(docroot, "waitlist.csv");
    writeConfig({ storage_path: inside });
    const res = await post(VALID);
    assert.equal(res.location, "/beta/#error-unavailable");
    assert.equal(existsSync(inside), false);
    assert.deepEqual(mails(), []);
    writeConfig({ storage_path: "/home/someone/public_html/list.csv" });
    assert.equal((await post(VALID)).location, "/beta/#error-unavailable");
  },
);

test(
  "a config with a non-email notify entry is refused",
  { skip },
  async () => {
    reset();
    writeConfig({
      notify: ["support@tetherhealthgroup.com\r\nBcc: b@example.test"],
    });
    assert.equal((await post(VALID)).location, "/beta/#error-unavailable");
    assert.deepEqual(mails(), []);
  },
);

test(
  "a value that would run as a spreadsheet formula is stored inert",
  { skip },
  async () => {
    reset();
    await post({ ...VALID, first_name: "=HYPERLINK(1)" });
    assert.match(csvLines()[1], /,'=HYPERLINK\(1\),/);
  },
);
