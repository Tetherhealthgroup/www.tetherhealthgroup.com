// Integration — the built .htaccess under a real Apache, for /.well-known/.
//
// The live site answered 403 for every /.well-known/ path, including
// assetlinks.json. Reproduced here: with no .well-known/ directory in the
// document root, Apache resolves the request to the missing segment
// ".well-known", the dotfile deny-list matched it, and the answer was 403.
// The deny-list now exempts that name. This file serves dist/ twice, with and
// without the directory, and checks what each path answers.
//
// Apache is not part of this repository's toolchain. When no httpd is found
// (APACHE_HTTPD, else /usr/sbin/httpd, with modules in APACHE_MODULES, else
// /usr/libexec/apache2) the cases are reported as skipped, with the reason.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dist } from "../helpers/dist.js";

const HTTPD = process.env.APACHE_HTTPD || "/usr/sbin/httpd";
const MODULES = process.env.APACHE_MODULES || "/usr/libexec/apache2";
const MIME_TYPES = ["/private/etc/apache2/mime.types", "/etc/mime.types"].find(
  existsSync,
);
const NEEDED = [
  "mpm_prefork",
  "authz_core",
  "mime",
  "headers",
  "rewrite",
  "dir",
  "unixd",
  "log_config",
];
const available =
  existsSync(HTTPD) &&
  Boolean(MIME_TYPES) &&
  NEEDED.every((m) => existsSync(join(MODULES, `mod_${m}.so`)));
const skip = available
  ? false
  : "no Apache httpd with the needed modules (set APACHE_HTTPD and APACHE_MODULES)";

let tmp;
const servers = [];

/** Start httpd on `port` serving `root`; returns a stop function. */
function serve(port, root) {
  const conf = join(tmp, `httpd-${port}.conf`);
  writeFileSync(
    conf,
    [
      `ServerRoot "${tmp}"`,
      `Listen 127.0.0.1:${port}`,
      ...NEEDED.map(
        (m) => `LoadModule ${m}_module ${join(MODULES, `mod_${m}.so`)}`,
      ),
      "ServerName www.tetherhealthgroup.com",
      `PidFile "${join(tmp, `httpd-${port}.pid`)}"`,
      `ErrorLog "${join(tmp, `error-${port}.log`)}"`,
      `TypesConfig ${MIME_TYPES}`,
      `DocumentRoot "${root}"`,
      `<Directory "${root}">`,
      "  AllowOverride All",
      "  Require all granted",
      "</Directory>",
      "",
    ].join("\n"),
  );
  const start = spawnSync(HTTPD, ["-f", conf, "-k", "start"], {
    encoding: "utf8",
  });
  assert.equal(start.status, 0, `httpd failed to start: ${start.stderr}`);
  const stop = () => spawnSync(HTTPD, ["-f", conf, "-k", "stop"]);
  servers.push(stop);
  return stop;
}

/**
 * Status and content type of one path, as the canonical https host. node:http
 * rather than fetch, because fetch does not let a caller set Host.
 */
function request(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      {
        host: "127.0.0.1",
        port,
        path,
        headers: {
          Host: "www.tetherhealthgroup.com",
          "X-Forwarded-Proto": "https",
        },
      },
      (res) => {
        res.resume();
        resolve({ status: res.statusCode, type: res.headers["content-type"] });
      },
    );
    req.on("error", reject);
  });
}

async function get(port, path) {
  for (let i = 0; i < 50; i++) {
    try {
      return await request(port, path);
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error(`no answer from 127.0.0.1:${port}`);
}

const WITH = 4333;
const WITHOUT = 4334;

before(() => {
  if (!available) return;
  tmp = mkdtempSync(join(tmpdir(), "apache-well-known-"));
  mkdirSync(join(tmp, "logs"));
  const full = join(tmp, "full");
  const bare = join(tmp, "bare");
  cpSync(dist, full, { recursive: true });
  cpSync(dist, bare, { recursive: true });
  rmSync(join(bare, ".well-known"), { recursive: true, force: true });
  serve(WITH, full);
  serve(WITHOUT, bare);
});

after(() => {
  for (const stop of servers) stop();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

test(
  "assetlinks.json is served 200 as application/json",
  { skip },
  async () => {
    const res = await get(WITH, "/.well-known/assetlinks.json");
    assert.equal(res.status, 200);
    assert.match(res.type, /^application\/json/);
  },
);

test("security.txt is served 200 as text/plain", { skip }, async () => {
  const sec = await get(WITH, "/.well-known/security.txt");
  assert.equal(sec.status, 200);
  assert.match(sec.type, /^text\/plain/);
});

test(
  "a missing /.well-known/ path is a 404, not the 403 the live site gave",
  { skip },
  async () => {
    for (const path of [
      "/.well-known/assetlinks.json",
      "/.well-known/security.txt",
      "/.well-known/anything",
    ])
      assert.equal((await get(WITHOUT, path)).status, 404, path);
    assert.equal((await get(WITH, "/.well-known/anything")).status, 404);
  },
);

test(
  "dotfiles are still refused, inside and outside .well-known",
  { skip },
  async () => {
    for (const port of [WITH, WITHOUT])
      for (const path of [
        "/.htaccess",
        "/.cpanel.yml",
        "/.env",
        "/.git/config",
      ])
        assert.equal((await get(port, path)).status, 403, `${port} ${path}`);
    // A dot-file inside an existing .well-known/ is refused by its own name.
    assert.equal((await get(WITH, "/.well-known/.hidden")).status, 403);
  },
);
