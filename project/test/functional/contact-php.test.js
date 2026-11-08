// Functional — the contact handler, public/api/contact.php, under a real PHP
// interpreter over HTTP (PHP's built-in server; sendmail is a capture script,
// so nothing leaves the machine). Every address is synthetic or a role
// mailbox. Skipped, with the reason, when no PHP interpreter is found.

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
  : "no PHP interpreter (set PHP_BIN or put php on PATH)";

const PORT = 4335; // e2e 4331, beta 4332, Apache 4333-4334
const ENDPOINT = `http://127.0.0.1:${PORT}/api/contact.php`;
const ROUTES = {
  support: "support@tetherhealthgroup.com",
  sales_partnerships: "partnerships@tetherhealthgroup.com",
  careers: "careers@tetherhealthgroup.com",
  privacy: "privacy@tetherhealthgroup.com",
  finance: "finance@tetherhealthgroup.com",
};
const LABELS = {
  support: "Support",
  app_feedback: "App feedback",
  sales_partnerships: "Sales & partnerships",
  careers: "Careers",
  privacy: "Privacy",
  finance: "Finance",
};

let tmp, docroot, privateDir, configPath, mailLog, server;

function writeConfig({ routes = ROUTES, max = 1000, omitRoutes = false } = {}) {
  const q = (v) => `'${String(v).replace(/['\\]/g, "\\$&")}'`;
  const lines = [
    `  'storage_path' => ${q(join(privateDir, "beta-waitlist.csv"))},`,
    `  'rate_limit_dir' => ${q(join(privateDir, "rate"))},`,
    `  'notify' => ['support@tetherhealthgroup.com'],`,
    `  'from' => 'support@tetherhealthgroup.com',`,
    `  'rate_limit_max' => ${max},`,
    `  'rate_limit_window' => 3600,`,
  ];
  if (!omitRoutes)
    lines.push(
      `  'contact_routes' => [${Object.entries(routes)
        .map(([k, v]) => `${q(k)} => ${q(v)}`)
        .join(", ")}],`,
    );
  writeFileSync(configPath, `<?php\nreturn [\n${lines.join("\n")}\n];\n`);
}

function mails() {
  if (!existsSync(mailLog)) return [];
  return readFileSync(mailLog, "utf8")
    .split("--END--\n")
    .filter((c) => c.trim())
    .map((chunk) => {
      const [first, ...rest] = chunk.split("\n");
      const raw = rest.join("\n");
      const split = raw.search(/\r?\n\r?\n/);
      return {
        args: first.replace(/^ARGS: /, ""),
        headers: raw.slice(0, split),
        body: raw.slice(split).trim(),
      };
    });
}

/** Decode an RFC 2047 base64 word, or return the text as is. */
const decodeHeader = (v) =>
  v.replace(/=\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=/g, (_, b) =>
    Buffer.from(b, "base64").toString("utf8"),
  );

function reset(options) {
  if (existsSync(mailLog)) unlinkSync(mailLog);
  rmSync(join(privateDir, "rate"), { recursive: true, force: true });
  writeConfig(options);
}

const VALID = {
  topic: "support",
  first_name: "Synthetic",
  email: "synthetic-user-01@example.test",
  organisation: "Example Clinic",
  message: "Hello from a synthetic test.\nSecond line.",
  contact_ref: "",
  fill_ms: "5000",
};

async function post(fields) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields))
    for (const x of [].concat(v)) body.append(k, x);
  const res = await fetch(ENDPOINT, {
    method: "POST",
    body,
    redirect: "manual",
  });
  return { status: res.status, location: res.headers.get("location") };
}

before(async () => {
  if (!phpAvailable) return;
  tmp = mkdtempSync(join(tmpdir(), "contact-php-"));
  docroot = join(tmp, "site");
  privateDir = join(tmp, "private");
  mkdirSync(join(docroot, "api"), { recursive: true });
  mkdirSync(privateDir);
  for (const name of ["contact.php", "beta-lib.inc"])
    copyFileSync(
      join(projectRoot, "public", "api", name),
      join(docroot, "api", name),
    );
  configPath = join(privateDir, "beta-config.php");
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
      "opcache.enable=0",
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
  throw new Error("PHP server did not answer");
});

after(() => {
  server?.kill();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

test("a GET is refused with 405 and Allow: POST", { skip }, async () => {
  reset();
  const res = await fetch(ENDPOINT);
  assert.equal(res.status, 405);
  assert.equal(res.headers.get("allow"), "POST");
  assert.deepEqual(mails(), []);
});

test(
  "each topic reaches its configured mailbox, one email, no copy to the visitor",
  { skip },
  async () => {
    for (const [topic, address] of Object.entries(ROUTES)) {
      reset();
      const res = await post({ ...VALID, topic });
      assert.equal(res.status, 303, topic);
      assert.equal(res.location, "/contact/thanks/", topic);
      const sent = mails();
      assert.equal(sent.length, 1, `${topic}: exactly one email`);
      assert.match(
        sent[0].headers,
        new RegExp(`^To: ${address.replace(".", "\\.")}$`, "m"),
        topic,
      );
      assert.doesNotMatch(
        sent[0].headers,
        /synthetic-user-01@example\.test/,
        `${topic}: visitor address in a header`,
      );
      const subject = decodeHeader(
        sent[0].headers.match(/^Subject: (.*)$/m)[1],
      );
      assert.equal(subject, `[Contact · ${LABELS[topic]}]`);
    }
  },
);

test(
  "headers are fixed: From the config, no Reply-To, no visitor text",
  { skip },
  async () => {
    reset();
    await post(VALID);
    const [mail] = mails();
    assert.match(
      mail.headers,
      /^From: Tether Health <support@tetherhealthgroup\.com>$/m,
    );
    assert.doesNotMatch(mail.headers, /^Reply-To:/im);
    for (const text of [
      "Synthetic",
      "Example Clinic",
      "Hello from",
      "synthetic-user-01",
    ])
      assert.ok(
        !decodeHeader(mail.headers).includes(text),
        `header carries "${text}"`,
      );
    assert.match(mail.body, /First name: Synthetic/);
    assert.match(mail.body, /Email: synthetic-user-01@example\.test/);
    assert.match(mail.body, /Organisation: Example Clinic/);
    assert.match(mail.body, /Hello from a synthetic test\.\r?\nSecond line\./);
    assert.match(mail.args, /-fsupport@tetherhealthgroup\.com/);
  },
);

test("nothing is stored", { skip }, async () => {
  reset();
  await post(VALID);
  const files = readdirSync(privateDir).filter(
    (f) => f !== "beta-config.php" && f !== "rate",
  );
  assert.deepEqual(files, []);
});

const INVALID = [
  ["no topic", { topic: "" }],
  ["the retired admin topic", { topic: "admin" }],
  ["an unknown topic", { topic: "press" }],
  ["no first name", { first_name: "" }],
  ["a first name with CR/LF", { first_name: "Syn\r\nBcc: b@example.test" }],
  ["an over-long first name", { first_name: "x".repeat(81) }],
  ["no email", { email: "" }],
  ["an invalid email", { email: "not-an-address" }],
  [
    "an email with a header injected",
    { email: "a@example.test\r\nBcc: b@example.test" },
  ],
  ["an organisation with LF", { organisation: "Org\nBcc: b@example.test" }],
  ["an over-long organisation", { organisation: "x".repeat(121) }],
  ["no message", { message: "  " }],
  ["a message over 2,000 characters", { message: "é".repeat(2001) }],
  ["a message with a control character", { message: "Hello\u0007" }],
  [
    "a field sent as an array",
    { "topic[]": ["support", "finance"], topic: undefined },
  ],
];

for (const [name, change] of INVALID) {
  test(
    `${name} is returned with an error and sends nothing`,
    { skip },
    async () => {
      reset();
      const fields = { ...VALID, ...change };
      for (const k of Object.keys(fields))
        if (fields[k] === undefined) delete fields[k];
      const res = await post(fields);
      assert.equal(res.location, "/contact/#error-fields");
      assert.deepEqual(mails(), []);
    },
  );
}

test(
  "a message of exactly 2,000 characters is accepted",
  { skip },
  async () => {
    reset();
    assert.equal(
      (await post({ ...VALID, message: "é".repeat(2000) })).location,
      "/contact/thanks/",
    );
  },
);

test(
  "a filled honeypot looks like success and sends nothing",
  { skip },
  async () => {
    reset();
    assert.equal(
      (await post({ ...VALID, contact_ref: "spam" })).location,
      "/contact/thanks/",
    );
    assert.deepEqual(mails(), []);
  },
);

test("a form filled too fast is asked to retry", { skip }, async () => {
  reset();
  assert.equal(
    (await post({ ...VALID, fill_ms: "200" })).location,
    "/contact/#error-retry",
  );
  assert.deepEqual(mails(), []);
});

test(
  "the per-IP rate limit has its own counter and refuses over the maximum",
  { skip },
  async () => {
    reset({ max: 2 });
    assert.equal((await post(VALID)).location, "/contact/thanks/");
    assert.equal((await post(VALID)).location, "/contact/thanks/");
    assert.equal((await post(VALID)).location, "/contact/#error-rate");
    assert.equal(mails().length, 2);
    const files = readdirSync(join(privateDir, "rate"));
    assert.equal(files.length, 1);
    assert.match(files[0], /^[0-9a-f]{64}\.rate$/);
  },
);

test(
  "a topic with no route fails closed and sends nothing",
  { skip },
  async () => {
    const { finance, ...withoutFinance } = ROUTES;
    reset({ routes: withoutFinance });
    assert.equal(
      (await post({ ...VALID, topic: "finance" })).location,
      "/contact/#error-unavailable",
    );
    assert.equal(
      (await post({ ...VALID, topic: "support" })).location,
      "/contact/thanks/",
    );
    assert.equal(mails().length, 1);
  },
);

test("an invalid route address fails closed", { skip }, async () => {
  reset({
    routes: {
      ...ROUTES,
      careers: "careers@tetherhealthgroup.com\r\nBcc: b@example.test",
    },
  });
  assert.equal(
    (await post({ ...VALID, topic: "careers" })).location,
    "/contact/#error-unavailable",
  );
  assert.deepEqual(mails(), []);
});

test(
  "no contact_routes, or no config at all, fails closed",
  { skip },
  async () => {
    reset({ omitRoutes: true });
    assert.equal((await post(VALID)).location, "/contact/#error-unavailable");
    unlinkSync(configPath);
    try {
      assert.equal((await post(VALID)).location, "/contact/#error-unavailable");
    } finally {
      writeConfig();
    }
    assert.deepEqual(mails(), []);
  },
);

test(
  "App feedback with no route of its own reaches the support mailbox",
  { skip },
  async () => {
    reset(); // ROUTES has no app_feedback entry
    const res = await post({ ...VALID, topic: "app_feedback" });
    assert.equal(res.location, "/contact/thanks/");
    const sent = mails();
    assert.equal(sent.length, 1);
    assert.match(sent[0].headers, /^To: support@tetherhealthgroup\.com$/m);
    assert.equal(
      decodeHeader(sent[0].headers.match(/^Subject: (.*)$/m)[1]),
      "[Contact · App feedback]",
    );
  },
);

test(
  "an App feedback route in the config wins over the fallback",
  { skip },
  async () => {
    reset({
      routes: { ...ROUTES, app_feedback: "feedback-team@example.test" },
    });
    assert.equal(
      (await post({ ...VALID, topic: "app_feedback" })).location,
      "/contact/thanks/",
    );
    const sent = mails();
    assert.equal(sent.length, 1);
    assert.match(sent[0].headers, /^To: feedback-team@example\.test$/m);
  },
);

test(
  "an invalid App feedback route fails closed instead of falling back, back on /feedback/",
  { skip },
  async () => {
    reset({ routes: { ...ROUTES, app_feedback: "not-an-address" } });
    assert.equal(
      (await post({ ...VALID, topic: "app_feedback" })).location,
      "/feedback/#error-unavailable",
    );
    assert.deepEqual(mails(), []);
  },
);

test(
  "App feedback fails closed when there is no support route either",
  { skip },
  async () => {
    const { support, ...withoutSupport } = ROUTES;
    reset({ routes: withoutSupport });
    assert.equal(
      (await post({ ...VALID, topic: "app_feedback" })).location,
      "/feedback/#error-unavailable",
    );
    assert.deepEqual(mails(), []);
  },
);

test(
  "App feedback errors return to /feedback/, every other topic to /contact/",
  { skip },
  async () => {
    reset();
    const feedback = { ...VALID, topic: "app_feedback" };
    assert.equal(
      (await post({ ...feedback, email: "not-an-address" })).location,
      "/feedback/#error-fields",
    );
    assert.equal(
      (await post({ ...feedback, fill_ms: "200" })).location,
      "/feedback/#error-retry",
    );
    assert.equal(
      (await post({ ...VALID, email: "not-an-address" })).location,
      "/contact/#error-fields",
    );
    assert.equal(
      (await post({ ...VALID, topic: "/feedback/" })).location,
      "/contact/#error-fields",
    );
    assert.deepEqual(mails(), []);
  },
);
