// E2E — the built site served over real HTTP by a real server.
//
// Every other category reads files off disk. This one starts `astro preview`
// and makes actual requests, so it is the only category that exercises the
// delivery path: directory-style URLs resolving to index.html, the 404
// document being served for an unknown path, and every link on every page
// answering when followed rather than merely existing as a string.
//
// The server is started once for the file and shut down in `after`, so a
// failure cannot leave a port held.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { projectRoot, htmlFiles, routeOf } from "../helpers/dist.js";

const PORT = 4331; // deliberately not 4321, so a dev server can stay running
const BASE = `http://127.0.0.1:${PORT}`;

/**
 * `astro preview` daemonises: it forks a background server and returns
 * immediately, so the spawned process is NOT the server and killing it leaves
 * the port held. The CLI's own `stop` subcommand is the only thing that ends
 * it — an earlier version of this file killed the wrong process and leaked a
 * server between runs.
 */
const previewCli = (...args) =>
  spawnSync("npx", ["astro", "preview", ...args], {
    cwd: projectRoot,
    stdio: "ignore",
  });

const stopPreview = () => previewCli("stop");

/** Resolves once the server answers, or rejects after the timeout. */
async function waitForServer(timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/`, { redirect: "manual" });
      if (res.status > 0) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`preview server did not answer on ${BASE} in ${timeoutMs}ms`);
}

before(async () => {
  // Leave nothing behind from an interrupted earlier run.
  stopPreview();
  previewCli("--port", String(PORT), "--host", "127.0.0.1");
  await waitForServer();
});

after(() => {
  stopPreview();
});

test("every emitted route answers 200 over HTTP", async () => {
  const failures = [];
  for (const page of htmlFiles()) {
    const route = routeOf(page);
    const res = await fetch(BASE + route, { redirect: "manual" });
    // 404.html is the error document; it is served for unknown paths, and
    // requesting it directly is still a 200 from the static server.
    if (res.status !== 200) failures.push(`${route} -> ${res.status}`);
  }
  assert.deepEqual(failures, [], `routes that did not answer 200: ${failures}`);
});

test("a directory-style URL resolves without its index.html", async () => {
  // The whole site links to /about/ rather than /about/index.html. If the
  // server stops resolving that, every internal link breaks at once.
  for (const route of ["/", "/about/", "/programs/tobacco/", "/services/"]) {
    const res = await fetch(BASE + route, { redirect: "manual" });
    assert.equal(res.status, 200, `${route} did not resolve`);
    const html = await res.text();
    assert.match(html, /<html/, `${route} served something that is not HTML`);
  }
});

test("an unknown path does not answer 200", async () => {
  const res = await fetch(`${BASE}/no-such-page-e2e-probe/`, {
    redirect: "manual",
  });
  assert.notEqual(
    res.status,
    200,
    "an unknown path answered 200, so nothing distinguishes a real route",
  );
});

test("every link on every page can actually be followed", async () => {
  // The end-to-end version of the link check: not "does a file exist" but
  // "does the server answer when a visitor clicks it".
  const checked = new Map();
  const broken = [];

  for (const page of htmlFiles()) {
    const route = routeOf(page);
    const res = await fetch(BASE + route, { redirect: "manual" });
    if (res.status !== 200) continue;
    const html = await res.text();

    for (const match of html.matchAll(/<a\b[^>]*\shref="([^"]*)"/g)) {
      let href = match[1].replace(/&amp;/g, "&").trim();
      if (/^(mailto:|tel:|sms:|data:|javascript:)/i.test(href)) continue;
      if (/^https?:\/\//i.test(href)) {
        const url = new URL(href);
        if (url.host !== "www.tetherhealthgroup.com") continue;
        href = url.pathname + url.hash;
      }
      const path = href.split("#")[0];
      if (path === "") continue;
      const target = path.startsWith("/")
        ? path
        : new URL(path, BASE + route).pathname;

      if (!checked.has(target)) {
        const probe = await fetch(BASE + target, { redirect: "manual" });
        checked.set(target, probe.status);
      }
      if (checked.get(target) !== 200) {
        broken.push(`${route} -> ${target} (${checked.get(target)})`);
      }
    }
  }

  assert.ok(checked.size > 0, "no links were checked at all");
  assert.deepEqual(broken, [], `links that did not answer: ${broken}`);
});

test("the waitlist anchor the whole site links to is present when served", async () => {
  // Ten call-to-action buttons across the site point at /#waitlist. If that
  // id ever stops being emitted, every one of them silently lands at the
  // top of the home page instead.
  const html = await (await fetch(`${BASE}/`)).text();
  assert.match(html, /\sid="waitlist"/, "/ has no #waitlist anchor");
});

test("the served HTML declares its character set and viewport", async () => {
  // Served, not built: a server that strips or rewrites <head> would break
  // rendering in a way no file-level assertion can see.
  const html = await (await fetch(`${BASE}/`)).text();
  assert.match(html, /<meta charset="utf-8">/i);
  assert.match(html, /name="viewport"[^>]*width=device-width/i);
});
