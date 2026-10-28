// Functional — the beta waitlist handlers, public/api/beta-signup.php and
// beta-confirm.php, run by a real PHP interpreter over HTTP.
//
// Each case POSTs the way the no-JavaScript form does and asserts the whole
// outcome: the redirect, the CSV rows (or their absence) and the mail that was
// (or was not) handed to sendmail. Sign-up is double opt-in: a pending row
// and a confirmation link to the member; the team hears only after the link
// is used. PHP's built-in server stands in for Apache; sendmail is a capture
// script, so no mail leaves the machine. Every address is synthetic.
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
  utimesSync,
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
const SIGNUP = `${BASE}/api/beta-signup.php`;
const CONFIRM = `${BASE}/api/beta-confirm.php`;
const NOTIFY = "support@tetherhealthgroup.com";
const COLUMNS = [
  "submitted_at_utc",
  "first_name",
  "email",
  "phone",
  "heard_from",
  "confirmed_18_plus",
  "consent_beta_email",
  "status",
  "confirmed_at_utc",
  "token_hash",
  "token_expires_utc",
  "last_sent_utc",
];

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

/** One CSV line into cells (RFC 4180 quoting, no escape character). */
function cells(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') ((cur += '"'), i++);
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") (out.push(cur), (cur = ""));
    else cur += c;
  }
  out.push(cur);
  return out;
}

const csvLines = () =>
  existsSync(csvPath)
    ? readFileSync(csvPath, "utf8").split("\n").filter(Boolean)
    : [];

/** Data rows as objects keyed by column. */
const rows = () =>
  csvLines()
    .slice(1)
    .map((line) =>
      Object.fromEntries(cells(line).map((v, i) => [COLUMNS[i], v])),
    );

/** Rewrite the CSV from row objects (for setting up expired or old rows). */
function writeRows(list) {
  const quote = (v) => (/[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  writeFileSync(
    csvPath,
    [COLUMNS, ...list.map((r) => COLUMNS.map((c) => r[c] ?? ""))]
      .map((line) => line.map(quote).join(","))
      .join("\n") + "\n",
  );
}

const utc = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

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
async function post(fields, url = SIGNUP) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields))
    for (const v of [].concat(value)) body.append(key, v);
  const res = await fetch(url, { method: "POST", body, redirect: "manual" });
  return { status: res.status, location: res.headers.get("location") };
}

/** The token in the most recent confirmation email. */
function lastToken() {
  const sent = mails();
  const match = sent.at(-1)?.raw.match(/beta-confirm\.php\?t=([0-9a-f]{64})/);
  assert.ok(match, "no confirmation link in the last email");
  return match[1];
}

before(async () => {
  if (!phpAvailable) return;
  tmp = mkdtempSync(join(tmpdir(), "beta-signup-"));
  docroot = join(tmp, "site");
  privateDir = join(tmp, "private");
  mkdirSync(join(docroot, "api"), { recursive: true });
  mkdirSync(privateDir);
  for (const name of ["beta-signup.php", "beta-confirm.php", "beta-lib.inc"])
    copyFileSync(
      join(projectRoot, "public", "api", name),
      join(docroot, "api", name),
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
      await fetch(SIGNUP, { redirect: "manual" });
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
  "a GET to the sign-up is refused with 405 and Allow: POST, and stores nothing",
  { skip },
  async () => {
    reset();
    const res = await fetch(`${SIGNUP}?first_name=<b>x</b>`);
    assert.equal(res.status, 405);
    assert.equal(res.headers.get("allow"), "POST");
    assert.doesNotMatch(await res.text(), /<b>x<\/b>/);
    assert.deepEqual(csvLines(), []);
    assert.deepEqual(mails(), []);
  },
);

test(
  "a valid sign-up is stored pending and sent only a confirmation link",
  { skip },
  async () => {
    reset();
    const res = await post(VALID);
    assert.equal(res.status, 303);
    assert.equal(res.location, "/beta/thanks/");

    assert.equal(csvLines()[0], COLUMNS.join(","));
    const [row] = rows();
    assert.equal(rows().length, 1);
    assert.equal(row.first_name, "Synthetic");
    assert.equal(row.email, "synthetic-user-01@example.test");
    assert.equal(row.phone, "iPhone");
    assert.equal(row.heard_from, "Friend or family");
    assert.equal(row.status, "pending");
    assert.equal(row.confirmed_at_utc, "");
    assert.match(row.token_hash, /^[0-9a-f]{64}$/);
    const expires = Date.parse(row.token_expires_utc);
    const sevenDays = 7 * 86400 * 1000;
    assert.ok(Math.abs(expires - Date.now() - sevenDays) < 60000, "not 7 days");

    const sent = mails();
    assert.equal(
      sent.length,
      1,
      "only the member is emailed before confirming",
    );
    const [mail] = sent;
    assert.match(mail.raw, /^To: synthetic-user-01@example\.test$/m);
    assert.match(
      mail.raw,
      /^Subject: Confirm your spot on the Tether Health beta waitlist$/m,
    );
    assert.match(
      mail.raw,
      /^From: Tether Health <support@tetherhealthgroup\.com>$/m,
    );
    assert.doesNotMatch(mail.raw, /^Reply-To:/im);
    assert.match(mail.args, /-fsupport@tetherhealthgroup\.com/);
    const token = lastToken();
    assert.match(
      mail.raw,
      new RegExp(
        `https://www\\.tetherhealthgroup\\.com/api/beta-confirm\\.php\\?t=${token}`,
      ),
    );
    // The token is stored only as its hash.
    assert.equal(
      row.token_hash,
      (await import("node:crypto"))
        .createHash("sha256")
        .update(token)
        .digest("hex"),
    );
    assert.doesNotMatch(readFileSync(csvPath, "utf8"), new RegExp(token));
  },
);

test(
  "the confirmation email echoes none of the submitted text",
  { skip },
  async () => {
    reset();
    await post({
      ...VALID,
      first_name: "Zqxname <b>",
      phone: "android",
      source: "clinician",
    });
    const body = mails()[0]
      .raw.split(/\r?\n\r?\n/)
      .slice(1)
      .join("\n\n");
    for (const echoed of [
      "Zqxname",
      "<b>",
      "Android",
      "Clinician",
      "synthetic-user-01",
    ])
      assert.ok(!body.includes(echoed), `the email body echoes ${echoed}`);
  },
);

test(
  "confirming marks the row confirmed and only then notifies the team",
  { skip },
  async () => {
    reset();
    await post(VALID);
    const token = lastToken();

    const page = await fetch(`${CONFIRM}?t=${token}`);
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(
      html,
      /<form method="post" action="\/api\/beta-confirm\.php">/,
    );
    assert.match(html, new RegExp(`name="t" value="${token}"`));
    assert.equal(rows()[0].status, "pending", "a GET must not confirm");
    assert.equal(mails().length, 1);

    const res = await post({ t: token }, CONFIRM);
    assert.equal(res.status, 303);
    assert.equal(res.location, "/beta/confirmed/");
    const [row] = rows();
    assert.equal(row.status, "confirmed");
    assert.match(
      row.confirmed_at_utc,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/,
    );
    assert.equal(row.token_hash, "");
    assert.equal(row.token_expires_utc, "");

    const sent = mails();
    assert.equal(sent.length, 2);
    const notify = sent[1];
    assert.match(notify.raw, new RegExp(`^To: ${NOTIFY}$`, "m"));
    assert.match(
      notify.raw,
      /^Subject: Beta waitlist sign-up confirmed \(iPhone\)$/m,
    );
    assert.doesNotMatch(
      notify.raw,
      /^Reply-To:/im,
      "no Reply-To on the notification",
    );
    assert.match(notify.raw, /Email: synthetic-user-01@example\.test/);
    assert.match(notify.raw, /Heard about us from: Friend or family/);
  },
);

test("a used confirmation link does not work again", { skip }, async () => {
  reset();
  await post(VALID);
  const token = lastToken();
  assert.equal(
    (await post({ t: token }, CONFIRM)).location,
    "/beta/confirmed/",
  );
  assert.equal(
    (await post({ t: token }, CONFIRM)).location,
    "/beta/#error-link",
  );
  const get = await fetch(`${CONFIRM}?t=${token}`, { redirect: "manual" });
  assert.equal(get.headers.get("location"), "/beta/#error-link");
  assert.equal(mails().length, 2, "the team is notified once");
});

test(
  "an expired link fails and its pending row is deleted by the cleanup",
  { skip },
  async () => {
    reset();
    await post(VALID);
    const token = lastToken();
    const [row] = rows();
    writeRows([{ ...row, token_expires_utc: utc(Date.now() - 1000) }]);
    assert.equal(
      (await post({ t: token }, CONFIRM)).location,
      "/beta/#error-link",
    );
    assert.deepEqual(rows(), [], "the expired pending row is gone");
    assert.equal(mails().length, 1, "nobody is notified");
  },
);

test(
  "an unconfirmed row is deleted after 7 days by any request",
  { skip },
  async () => {
    reset();
    await post(VALID);
    await post({ ...VALID, email: "synthetic-user-02@example.test" });
    const [old, fresh] = rows();
    writeRows([{ ...old, token_expires_utc: utc(Date.now() - 1000) }, fresh]);
    await fetch(SIGNUP); // a 405, but the cleanup still runs
    assert.deepEqual(
      rows().map((r) => r.email),
      ["synthetic-user-02@example.test"],
    );
  },
);

test("unknown or malformed tokens fail without detail", { skip }, async () => {
  reset();
  await post(VALID);
  for (const t of ["0".repeat(64), "abc", "<script>", ""]) {
    const res = await post({ t }, CONFIRM);
    assert.equal(res.location, "/beta/#error-link", `t=${t}`);
  }
  assert.equal(rows()[0].status, "pending");
});

test(
  "signing up again sends at most one confirmation a day",
  { skip },
  async () => {
    reset();
    await post(VALID);
    const first = lastToken();
    const again = await post({
      ...VALID,
      email: "SYNTHETIC-USER-01@example.test",
    });
    assert.equal(again.location, "/beta/thanks/", "the page reveals nothing");
    assert.equal(mails().length, 1, "no second email within a day");
    assert.equal(rows().length, 1, "no duplicate row");

    const [row] = rows();
    writeRows([{ ...row, last_sent_utc: utc(Date.now() - 25 * 3600 * 1000) }]);
    await post(VALID);
    assert.equal(mails().length, 2, "a new link after a day");
    const second = lastToken();
    assert.notEqual(second, first);
    assert.equal(
      (await post({ t: first }, CONFIRM)).location,
      "/beta/#error-link",
    );
    assert.equal(
      (await post({ t: second }, CONFIRM)).location,
      "/beta/confirmed/",
    );
  },
);

test(
  "an address that has confirmed is not emailed again",
  { skip },
  async () => {
    reset();
    await post(VALID);
    await post({ t: lastToken() }, CONFIRM);
    const before = mails().length;
    const [row] = rows();
    writeRows([{ ...row, last_sent_utc: utc(Date.now() - 30 * 86400 * 1000) }]);
    assert.equal((await post(VALID)).location, "/beta/thanks/");
    assert.equal(mails().length, before);
    assert.equal(rows()[0].status, "confirmed");
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
    assert.equal(rows().length, 1);
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
    assert.equal((await post(VALID)).location, "/beta/#error-rate");
    assert.equal(rows().length, 1, "only the first attempt was stored");
    assert.equal(mails().length, 1);
    const rateDir = join(privateDir, "rate");
    const files = readdirSync(rateDir);
    assert.equal(files.length, 1);
    assert.match(
      files[0],
      /^[0-9a-f]{64}\.rate$/,
      "named by hash, not by address",
    );
  },
);

test(
  "rate-limit files older than a day are removed on every request",
  { skip },
  async () => {
    reset();
    const rateDir = join(privateDir, "rate");
    mkdirSync(rateDir, { recursive: true });
    const stale = join(rateDir, `${"a".repeat(64)}.rate`);
    const recent = join(rateDir, `${"b".repeat(64)}.rate`);
    writeFileSync(stale, "1");
    writeFileSync(recent, "1");
    const twoDaysAgo = (Date.now() - 2 * 86400 * 1000) / 1000;
    utimesSync(stale, twoDaysAgo, twoDaysAgo);
    await fetch(SIGNUP); // GET: refused, but the cleanup runs first
    assert.equal(existsSync(stale), false, "the day-old file survived");
    assert.equal(existsSync(recent), true, "a recent file was removed");
    utimesSync(recent, twoDaysAgo, twoDaysAgo);
    await fetch(`${CONFIRM}?t=bad`, { redirect: "manual" });
    assert.equal(
      existsSync(recent),
      false,
      "the confirm handler skipped cleanup",
    );
  },
);

test(
  "with no config file the form says unavailable and sends nothing",
  { skip },
  async () => {
    reset();
    unlinkSync(configPath);
    try {
      assert.equal((await post(VALID)).location, "/beta/#error-unavailable");
      assert.equal(
        (await post({ t: "0".repeat(64) }, CONFIRM)).location,
        "/beta/#error-unavailable",
      );
      assert.deepEqual(csvLines(), []);
      assert.deepEqual(mails(), []);
    } finally {
      writeConfig();
    }
  },
);

test(
  "a waitlist file with an unexpected header is left alone",
  { skip },
  async () => {
    reset();
    writeFileSync(csvPath, "some,other,columns\n1,2,3\n");
    assert.equal((await post(VALID)).location, "/beta/#error-unavailable");
    assert.equal(readFileSync(csvPath, "utf8"), "some,other,columns\n1,2,3\n");
    assert.deepEqual(mails(), []);
  },
);

test(
  "a config that points storage inside the web root is refused",
  { skip },
  async () => {
    reset();
    const inside = join(docroot, "waitlist.csv");
    writeConfig({ storage_path: inside });
    assert.equal((await post(VALID)).location, "/beta/#error-unavailable");
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
    // Read back and rewritten (by a later request), it is not prefixed twice.
    await post({ ...VALID, email: "synthetic-user-02@example.test" });
    assert.match(csvLines()[1], /,'=HYPERLINK\(1\),/);
    assert.equal(rows()[0].first_name, "'=HYPERLINK(1)");
  },
);
