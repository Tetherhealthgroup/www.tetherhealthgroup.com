// Functional — the beta waitlist with Supabase as the source of truth (P-116)
// and the CSV file as the fallback, under a real PHP interpreter over HTTP.
//
// A small in-process stub stands in for Supabase's RPC endpoint and implements
// the four functions' contract (secret check, signup, token status, confirm,
// cleanup) on an in-memory list, or misbehaves on demand (forbidden, 500,
// timeout, bad JSON, redirect). sendmail is a capture script. All data is
// synthetic. Skipped, with the reason, when no PHP interpreter is found.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import http from "node:http";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
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
  : "no PHP interpreter (set PHP_BIN or put php on PATH)";

const PORT = 4337;
const STUB_PORT = 4338;
const BASE = `http://127.0.0.1:${PORT}`;
const SIGNUP = `${BASE}/api/beta-signup.php`;
const CONFIRM = `${BASE}/api/beta-confirm.php`;
const SECRET = "a1".repeat(32); // synthetic 64-hex server secret
// Synthetic, assembled so no file holds a string shaped like a real key.
const KEY =
  ["sb", "publishable", "synthetic", "test", "key"].join("_") + "_0123456789";

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

// --- Stub Supabase -----------------------------------------------------------

const stub = {
  mode: "normal", // normal | forbidden | 500 | timeout | badjson | redirect
  calls: [],
  rows: new Map(), // email -> { status, tokenHash, expires, lastSent, ... }
};

function rpc(fn, args) {
  if (args.p_server_secret !== SECRET) return { status: "forbidden" };
  const now = Date.now();
  if (fn === "beta_waitlist_signup") {
    const email = String(args.p_email ?? "")
      .trim()
      .toLowerCase();
    if (
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ||
      args.p_age_confirmed !== true ||
      args.p_consent !== true
    )
      return { status: "invalid" };
    const row = stub.rows.get(email);
    if (row?.status === "confirmed") return { status: "already" };
    if (row && row.lastSent > now - 86400000) return { status: "throttled" };
    const token = createHash("sha256")
      .update(String(Math.random()) + now)
      .digest("hex");
    stub.rows.set(email, {
      status: "pending",
      email,
      first_name: args.p_first_name,
      phone: args.p_phone,
      heard_from: args.p_heard_from,
      tokenHash: sha256(token),
      expires: now + 7 * 86400000,
      lastSent: now,
      created_at: new Date(now).toISOString(),
    });
    return { status: "sent", token };
  }
  const find = () =>
    [...stub.rows.values()].find(
      (r) =>
        r.status === "pending" &&
        r.tokenHash === sha256(String(args.p_token ?? "")) &&
        r.expires > now,
    );
  if (fn === "beta_waitlist_token_status")
    return { status: find() ? "valid" : "invalid" };
  if (fn === "beta_waitlist_confirm") {
    const row = find();
    if (!row) return { status: "invalid" };
    Object.assign(row, {
      status: "confirmed",
      tokenHash: null,
      expires: null,
      confirmed_at: new Date(now).toISOString(),
    });
    return {
      status: "confirmed",
      first_name: row.first_name,
      email: row.email,
      phone: row.phone,
      heard_from: row.heard_from,
      created_at: row.created_at,
      confirmed_at: row.confirmed_at,
    };
  }
  if (fn === "beta_waitlist_cleanup") {
    for (const [email, r] of stub.rows)
      if (r.status === "pending" && r.expires <= now) stub.rows.delete(email);
    return { status: "ok" };
  }
  return null;
}

const stubServer = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const fn = req.url.replace(/^\/rest\/v1\/rpc\//, "");
    let args = {};
    try {
      args = JSON.parse(body);
    } catch {}
    stub.calls.push({ fn, args, headers: req.headers });
    const send = (code, text) => {
      res.writeHead(code, { "content-type": "application/json" });
      res.end(text);
    };
    if (stub.mode === "timeout")
      return setTimeout(() => send(200, '{"status":"ok"}'), 2500);
    if (stub.mode === "500") return send(500, '{"message":"boom"}');
    if (stub.mode === "badjson") return send(200, "<html>not json</html>");
    if (stub.mode === "redirect") {
      res.writeHead(302, { location: "http://127.0.0.1:1/elsewhere" });
      return res.end();
    }
    if (stub.mode === "forbidden") return send(200, '{"status":"forbidden"}');
    const answer = rpc(fn, args);
    if (!answer) return send(404, '{"message":"no such function"}');
    send(200, JSON.stringify(answer));
  });
});

// --- PHP server --------------------------------------------------------------

let tmp, docroot, privateDir, configPath, csvPath, mailLog, errorLog, server;

function writeConfig(extra = {}) {
  const q = (v) =>
    typeof v === "number"
      ? String(v)
      : `'${String(v).replace(/['\\]/g, "\\$&")}'`;
  const config = {
    storage_path: csvPath,
    rate_limit_dir: join(privateDir, "rate"),
    from: "support@tetherhealthgroup.com",
    rate_limit_max: 1000,
    supabase_url: `http://127.0.0.1:${STUB_PORT}`,
    supabase_publishable_key: KEY,
    supabase_waitlist_secret: SECRET,
    supabase_timeout: 1,
    ...extra,
  };
  const lines = Object.entries(config)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `  '${k}' => ${q(v)},`);
  lines.push(`  'notify' => ['support@tetherhealthgroup.com'],`);
  writeFileSync(configPath, `<?php\nreturn [\n${lines.join("\n")}\n];\n`);
}

function mails() {
  if (!existsSync(mailLog)) return [];
  return readFileSync(mailLog, "utf8")
    .split("--END--\n")
    .filter((c) => c.trim())
    .map((chunk) => chunk.split("\n").slice(1).join("\n"));
}
const csvRows = () =>
  existsSync(csvPath)
    ? readFileSync(csvPath, "utf8").split("\n").filter(Boolean).slice(1)
    : [];
const errors = () =>
  existsSync(errorLog) ? readFileSync(errorLog, "utf8") : "";
const tokenIn = (mail) =>
  mail.match(/beta-confirm\.php\?t=([0-9a-f]{64})/)?.[1];

function reset(extra) {
  for (const p of [csvPath, mailLog, errorLog])
    if (existsSync(p)) unlinkSync(p);
  rmSync(join(privateDir, "rate"), { recursive: true, force: true });
  stub.mode = "normal";
  stub.calls = [];
  stub.rows.clear();
  writeConfig(extra);
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

async function post(url, fields) {
  const res = await fetch(url, {
    method: "POST",
    body: new URLSearchParams(fields),
    redirect: "manual",
  });
  return {
    status: res.status,
    location: res.headers.get("location"),
    text: await res.text(),
  };
}
const responses = [];
async function tracked(p) {
  const r = await p;
  responses.push(r.text ?? "");
  return r;
}

before(async () => {
  if (!phpAvailable) return;
  await new Promise((r) => stubServer.listen(STUB_PORT, "127.0.0.1", r));
  tmp = mkdtempSync(join(tmpdir(), "beta-supabase-"));
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
  errorLog = join(tmp, "php-error.log");
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
      "opcache.enable=0",
      "-d",
      `sendmail_path=${sendmail}`,
      "-d",
      "display_errors=0",
      "-d",
      "log_errors=1",
      "-d",
      `error_log=${errorLog}`,
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
  throw new Error("PHP server did not answer");
});

after(() => {
  server?.kill();
  stubServer.close();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

test(
  "signup goes to Supabase with the contract's arguments and headers, and the link uses its token",
  { skip },
  async () => {
    reset();
    const res = await tracked(post(SIGNUP, VALID));
    assert.equal(res.location, "/beta/thanks/");
    assert.deepEqual(
      stub.calls.map((c) => c.fn),
      ["beta_waitlist_signup", "beta_waitlist_cleanup"],
    );
    const [call] = stub.calls;
    assert.equal(call.headers.apikey, KEY);
    assert.equal(call.headers.authorization, `Bearer ${KEY}`);
    assert.match(call.headers["content-type"], /^application\/json/);
    assert.deepEqual(call.args, {
      p_server_secret: SECRET,
      p_first_name: "Synthetic",
      p_email: "synthetic-user-01@example.test",
      p_phone: "iphone",
      p_heard_from: "friend",
      p_age_confirmed: true,
      p_consent: true,
    });
    const sent = mails();
    assert.equal(sent.length, 1);
    const token = tokenIn(sent[0]);
    assert.ok(token, "no link in the confirmation email");
    assert.equal(
      stub.rows.get("synthetic-user-01@example.test").tokenHash,
      sha256(token),
    );
    assert.deepEqual(
      csvRows(),
      [],
      "the file is not written when Supabase answers",
    );
    assert.doesNotMatch(
      sent[0],
      /Synthetic/,
      "the email echoes the first name",
    );
  },
);

test("an empty source is sent as null", { skip }, async () => {
  reset();
  await post(SIGNUP, { ...VALID, source: "" });
  assert.equal(stub.calls[0].args.p_heard_from, null);
});

test(
  "already and throttled show the same page and send nothing",
  { skip },
  async () => {
    reset();
    await post(SIGNUP, VALID);
    const again = await post(SIGNUP, VALID); // throttled: a token was issued today
    assert.equal(again.location, "/beta/thanks/");
    stub.rows.get("synthetic-user-01@example.test").status = "confirmed";
    const confirmed = await post(SIGNUP, VALID); // already
    assert.equal(confirmed.location, "/beta/thanks/");
    assert.equal(mails().length, 1, "only the first sign-up sent an email");
    assert.deepEqual(csvRows(), []);
  },
);

test(
  "invalid from Supabase returns the form with an error and stores nothing",
  { skip },
  async () => {
    reset();
    const res = await post(SIGNUP, { ...VALID, email: "someone@intranet" });
    assert.equal(res.location, "/beta/#error-fields");
    assert.deepEqual(mails(), []);
    assert.deepEqual(csvRows(), []);
  },
);

for (const [mode, reason] of [
  ["forbidden", "forbidden"],
  ["500", "http"],
  ["timeout", "transport"],
  ["badjson", "response"],
  ["redirect", "http"],
]) {
  test(
    `signup falls back to the file when Supabase is ${mode}, and logs one line`,
    { skip },
    async () => {
      reset();
      stub.mode = mode;
      const res = await tracked(post(SIGNUP, VALID));
      assert.equal(res.location, "/beta/thanks/");
      const rows = csvRows();
      assert.equal(rows.length, 1, "the sign-up was not kept in the file");
      assert.match(rows[0], /,pending,/);
      assert.equal(
        mails().length,
        1,
        "no confirmation email from the fallback",
      );
      const log = errors();
      assert.equal(
        (log.match(/waitlist database unavailable/g) ?? []).length,
        1,
        `expected one log line, got: ${log}`,
      );
      assert.match(
        log,
        new RegExp(
          `beta-signup: waitlist database unavailable \\(${reason}\\); using the file fallback`,
        ),
      );
    },
  );
}

test(
  "the confirm GET asks token_status and does not consume; the POST confirms, notifies and cleans up",
  { skip },
  async () => {
    reset();
    await post(SIGNUP, VALID);
    const token = tokenIn(mails()[0]);
    stub.calls = [];

    const page = await fetch(`${CONFIRM}?t=${token}`);
    assert.equal(page.status, 200);
    responses.push(await page.text());
    assert.deepEqual(
      stub.calls.map((c) => c.fn),
      ["beta_waitlist_token_status"],
    );
    assert.equal(stub.calls[0].args.p_token, token);
    assert.equal(
      stub.rows.get("synthetic-user-01@example.test").status,
      "pending",
    );
    assert.equal(mails().length, 1, "a GET notified someone");

    stub.calls = [];
    const res = await tracked(post(CONFIRM, { t: token }));
    assert.equal(res.location, "/beta/confirmed/");
    assert.deepEqual(
      stub.calls.map((c) => c.fn),
      ["beta_waitlist_confirm", "beta_waitlist_cleanup"],
    );
    assert.equal(
      stub.rows.get("synthetic-user-01@example.test").status,
      "confirmed",
    );
    const notify = mails()[1];
    assert.match(notify, /^To: support@tetherhealthgroup\.com$/m);
    assert.match(
      notify,
      /^Subject: Beta waitlist sign-up confirmed \(iPhone\)$/m,
    );
    assert.doesNotMatch(notify, /^Reply-To:/im);
    assert.match(notify, /Email: synthetic-user-01@example\.test/);
    assert.match(notify, /Heard about us from: Friend or family/);

    const reused = await post(CONFIRM, { t: token });
    assert.equal(reused.location, "/beta/#error-link");
    const reusedGet = await fetch(`${CONFIRM}?t=${token}`, {
      redirect: "manual",
    });
    assert.equal(reusedGet.headers.get("location"), "/beta/#error-link");
  },
);

test(
  "a link from a fallback sign-up still confirms through the file",
  { skip },
  async () => {
    reset();
    stub.mode = "500";
    await post(SIGNUP, VALID);
    const token = tokenIn(mails()[0]);
    stub.mode = "normal";
    const page = await fetch(`${CONFIRM}?t=${token}`);
    assert.equal(
      page.status,
      200,
      "Supabase says invalid, but the file has it",
    );
    const res = await post(CONFIRM, { t: token });
    assert.equal(res.location, "/beta/confirmed/");
    assert.match(csvRows()[0], /,confirmed,/);
    assert.match(mails()[1], /Beta waitlist sign-up confirmed/);
  },
);

test(
  "confirm falls back to the file when Supabase is down",
  { skip },
  async () => {
    reset();
    stub.mode = "forbidden";
    await post(SIGNUP, VALID);
    const token = tokenIn(mails()[0]);
    const res = await post(CONFIRM, { t: token });
    assert.equal(res.location, "/beta/confirmed/");
    assert.match(
      errors(),
      /beta-confirm: waitlist database unavailable \(forbidden\)/,
    );
  },
);

test("an unknown token is refused without detail", { skip }, async () => {
  reset();
  const res = await post(CONFIRM, { t: "0".repeat(64) });
  assert.equal(res.location, "/beta/#error-link");
});

test(
  "a secret key in place of the publishable key is refused: no call, file path, one log line",
  { skip },
  async () => {
    reset({
      supabase_publishable_key: "sb_secret_synthetic_do_not_use_0123456789",
    });
    const res = await post(SIGNUP, VALID);
    assert.equal(res.location, "/beta/thanks/");
    assert.deepEqual(stub.calls, []);
    assert.equal(csvRows().length, 1);
    assert.match(
      errors(),
      /beta-signup: waitlist database unavailable \(config\)/,
    );
  },
);

test(
  "without the Supabase keys the file path runs exactly as before",
  { skip },
  async () => {
    reset({
      supabase_url: undefined,
      supabase_publishable_key: undefined,
      supabase_waitlist_secret: undefined,
      supabase_timeout: undefined,
    });
    await post(SIGNUP, VALID);
    assert.deepEqual(stub.calls, []);
    assert.equal(csvRows().length, 1);
    assert.equal(
      errors(),
      "",
      "nothing is logged when Supabase is simply not configured",
    );
  },
);

test(
  "no secret, key, token or personal data appears in a response or the log",
  { skip },
  async () => {
    // Run the whole flow, fallback included, then read everything it produced.
    reset();
    await post(SIGNUP, VALID);
    const token = tokenIn(mails()[0]);
    const page = await fetch(`${CONFIRM}?t=${token}`);
    const confirmPage = await page.text();
    const confirmed = await post(CONFIRM, { t: token });
    stub.mode = "500";
    const fallback = await post(SIGNUP, {
      ...VALID,
      email: "synthetic-user-02@example.test",
    });
    const fallbackToken = tokenIn(mails().at(-1));
    const log = errors();
    assert.match(
      log,
      /waitlist database unavailable \(http\)/,
      "the fallback was not exercised",
    );
    for (const needle of [
      SECRET,
      KEY,
      token,
      fallbackToken,
      "synthetic-user-0",
      "Synthetic",
    ])
      assert.ok(!log.includes(needle), `the log leaks ${needle.slice(0, 10)}…`);
    for (const text of [confirmed.text, fallback.text, ...responses])
      for (const needle of [SECRET, KEY, token, fallbackToken])
        assert.ok(
          !text.includes(needle),
          `a response leaks ${needle.slice(0, 10)}…`,
        );
    // The confirm page carries only the visitor's own token, in its form.
    assert.ok(confirmPage.includes(`name="t" value="${token}"`));
    assert.ok(!confirmPage.includes(SECRET) && !confirmPage.includes(KEY));
  },
);

// --- One-time import script --------------------------------------------------

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
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

/**
 * Run the import script asynchronously: the stub Supabase lives in this
 * process, so a blocking spawnSync would stop it from answering.
 */
function runImport(...args) {
  return new Promise((resolve) => {
    const child = spawn(
      PHP,
      [
        "-d",
        `sendmail_path=${join(tmp, "sendmail.sh")}`,
        join(projectRoot, "..", "scripts", "import-waitlist-csv.php"),
        `--lib=${join(projectRoot, "public", "api", "beta-lib.inc")}`,
        ...args,
      ],
      {
        env: {
          ...process.env,
          TETHER_BETA_CONFIG: configPath,
          MAIL_LOG: mailLog,
        },
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

function seedCsv() {
  const day = 86400000;
  const now = Date.now();
  const row = (email, status, expires) => {
    const r = {
      submitted_at_utc: iso(now - day),
      first_name: "Synthetic",
      email,
      phone: "Android",
      heard_from: "(not given)",
      confirmed_18_plus: "yes",
      consent_beta_email: "yes",
      status,
      confirmed_at_utc: status === "confirmed" ? iso(now) : "",
      token_hash: status === "pending" ? "b2".repeat(32) : "",
      token_expires_utc: status === "pending" ? iso(expires) : "",
      last_sent_utc: iso(now - day),
    };
    return COLUMNS.map((c) => (/[",]/.test(r[c]) ? `"${r[c]}"` : r[c])).join(
      ",",
    );
  };
  writeFileSync(
    csvPath,
    [
      COLUMNS.join(","),
      row("import-01@example.test", "pending", now + day),
      row("import-02@example.test", "pending", now + 2 * day),
      row("import-03@example.test", "confirmed", 0),
      row("import-04@example.test", "pending", now - day),
    ].join("\n") + "\n",
  );
}

test(
  "the import script's dry run counts rows and sends nothing",
  { skip },
  async () => {
    reset();
    seedCsv();
    const before = readFileSync(csvPath, "utf8");
    const r = await runImport();
    assert.equal(r.status, 0, r.stderr);
    assert.match(
      r.stdout,
      /CSV: 2 pending to import, 1 confirmed \(stay in the CSV\), 1 expired, 0 unreadable\./,
    );
    assert.match(r.stdout, /Dry run: nothing was sent\./);
    assert.deepEqual(stub.calls, []);
    assert.deepEqual(mails(), []);
    assert.equal(readFileSync(csvPath, "utf8"), before, "the CSV was changed");
  },
);

test(
  "the import script with --apply signs up pending rows and emails new links",
  { skip },
  async () => {
    reset();
    seedCsv();
    const before = readFileSync(csvPath, "utf8");
    const r = await runImport("--apply");
    assert.equal(r.status, 0, r.stderr);
    assert.match(
      r.stdout,
      /Imported: 2 sent a new link, 0 already confirmed, 0 throttled, 0 invalid, 0 failed/,
    );
    assert.deepEqual(
      stub.calls.map((c) => c.args.p_email),
      ["import-01@example.test", "import-02@example.test"],
    );
    assert.equal(stub.calls[0].args.p_phone, "android");
    assert.equal(stub.calls[0].args.p_heard_from, null);
    assert.equal(mails().length, 2);
    assert.equal(readFileSync(csvPath, "utf8"), before, "the CSV was changed");
    for (const out of [r.stdout, r.stderr])
      assert.doesNotMatch(
        out,
        /example\.test|Synthetic|[0-9a-f]{64}/,
        "the script printed personal data or a token",
      );
  },
);

test(
  "the import script refuses to run without Supabase configured",
  { skip },
  async () => {
    reset({
      supabase_url: undefined,
      supabase_publishable_key: undefined,
      supabase_waitlist_secret: undefined,
      supabase_timeout: undefined,
    });
    const r = await runImport("--apply");
    assert.equal(r.status, 2);
    assert.match(r.stderr, /Supabase is not configured/);
  },
);
