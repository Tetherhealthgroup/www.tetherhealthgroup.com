// Deploy script (WEB-910): scripts/deploy.sh must work under macOS's bash 3.2
// when the new commit has no parent, and must build on origin/deploy when the
// clone has no local `deploy` branch, so the push is a fast-forward. Every
// repository here lives in a temp dir; nothing touches the real remote.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { projectRoot } from "../helpers/dist.js";

const deployScript = join(projectRoot, "..", "scripts", "deploy.sh");
// /bin/bash is 3.2 on macOS, which is where the script broke; elsewhere use PATH.
const bash = existsSync("/bin/bash") ? "/bin/bash" : "bash";
const identity = {
  GIT_AUTHOR_NAME: "Deploy Test",
  GIT_AUTHOR_EMAIL: "deploy-test@example.invalid",
  GIT_COMMITTER_NAME: "Deploy Test",
  GIT_COMMITTER_EMAIL: "deploy-test@example.invalid",
};

let tmp;
before(() => {
  tmp = mkdtempSync(join(tmpdir(), "web910-deploy-"));
});
after(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function git(cwd, ...args) {
  const r = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...identity },
  });
  assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

function tryGit(cwd, ...args) {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}

/** A source repo whose project/dist holds a build; `marker` varies its tree. */
function makeSite(name, marker) {
  const dir = join(tmp, name);
  mkdirSync(join(dir, "scripts"), { recursive: true });
  git(dir, "init", "-q", "-b", "master");
  copyFileSync(deployScript, join(dir, "scripts", "deploy.sh"));
  writeFileSync(join(dir, ".gitignore"), "project/dist/\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "source");
  writeBuild(dir, marker);
  return dir;
}

function writeBuild(dir, marker) {
  const dist = join(dir, "project", "dist");
  mkdirSync(dist, { recursive: true });
  writeFileSync(join(dist, "index.html"), `<p>${marker}</p>\n`);
  writeFileSync(join(dist, ".htaccess"), "RewriteEngine On\n");
  writeFileSync(join(dist, ".cpanel.yml"), "---\ndeployment:\n");
}

function deploy(dir, ...args) {
  return spawnSync(bash, ["scripts/deploy.sh", ...args], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, ...identity },
  });
}

test("the first deploy, with no parent anywhere, makes a root commit", () => {
  const site = makeSite("first", "v1");
  const r = deploy(site, "--local");
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stderr, /unbound variable/);
  assert.equal(
    git(site, "rev-list", "--parents", "-n1", "deploy").split(" ").length,
    1,
  );
  assert.equal(git(site, "show", "deploy:index.html"), "<p>v1</p>");
});

test("with only origin/deploy, the new commit builds on it and the push fast-forwards", () => {
  // Publish a first build to a bare origin, then clone it: the clone has
  // origin/deploy and no local deploy branch, like a fresh checkout.
  const origin = join(tmp, "origin.git");
  git(tmp, "init", "-q", "--bare", "-b", "master", origin);
  const seed = makeSite("seed", "v1");
  git(seed, "remote", "add", "origin", origin);
  git(seed, "push", "-q", "origin", "master");
  assert.equal(deploy(seed).status, 0);
  const live = git(origin, "rev-parse", "deploy");

  const clone = join(tmp, "clone");
  git(tmp, "clone", "-q", origin, clone);
  assert.equal(
    tryGit(clone, "rev-parse", "--verify", "-q", "refs/heads/deploy").status,
    1,
  );
  writeBuild(clone, "v2");

  const local = deploy(clone, "--local");
  assert.equal(local.status, 0, local.stderr);
  assert.doesNotMatch(local.stderr, /unbound variable/);
  assert.equal(git(clone, "rev-parse", "deploy^"), live);
  assert.equal(
    git(origin, "rev-parse", "deploy"),
    live,
    "--local must not push",
  );

  const pushed = deploy(clone);
  assert.equal(pushed.status, 0, pushed.stderr);
  const tip = git(clone, "rev-parse", "deploy");
  assert.equal(git(origin, "rev-parse", "deploy"), tip);
  assert.equal(
    tryGit(origin, "merge-base", "--is-ancestor", live, tip).status,
    0,
  );
  assert.match(
    pushed.stderr,
    new RegExp(`${live.slice(0, 7)}\\.\\.${tip.slice(0, 7)}`),
  );
});

test("a build identical to origin/deploy with no local branch commits and pushes nothing", () => {
  const origin = join(tmp, "origin-same.git");
  git(tmp, "init", "-q", "--bare", "-b", "master", origin);
  const seed = makeSite("seed-same", "v1");
  git(seed, "remote", "add", "origin", origin);
  git(seed, "push", "-q", "origin", "master");
  assert.equal(deploy(seed).status, 0);
  const live = git(origin, "rev-parse", "deploy");

  const clone = join(tmp, "clone-same");
  git(tmp, "clone", "-q", origin, clone);
  writeBuild(clone, "v1");
  const r = deploy(clone);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Nothing to commit/);
  assert.equal(git(origin, "rev-parse", "deploy"), live);
  assert.equal(
    tryGit(clone, "rev-parse", "--verify", "-q", "refs/heads/deploy").status,
    1,
  );
});

test("the deploy branch built from the real dist keeps dotfiles and the beta handler", () => {
  // The deploy commits whatever is in dist/, dot-directories included: the
  // build's .well-known/ must reach the branch, or the live site keeps
  // answering /.well-known/ from a document root that does not have it.
  const builtDist = join(projectRoot, "dist");
  assert.ok(
    existsSync(join(builtDist, "index.html")),
    "run npm run build first",
  );
  const site = makeSite("real-dist", "unused");
  const target = join(site, "project", "dist");
  rmSync(target, { recursive: true, force: true });
  cpSync(builtDist, target, { recursive: true });

  const r = deploy(site, "--local");
  assert.equal(r.status, 0, r.stderr);
  const tree = git(site, "ls-tree", "-r", "--name-only", "deploy").split("\n");
  for (const path of [
    ".htaccess",
    ".cpanel.yml",
    ".well-known/assetlinks.json",
    ".well-known/security.txt",
    "app-ads.txt",
    "api/beta-signup.php",
    "api/beta-confirm.php",
    "api/beta-lib.inc",
    "beta/index.html",
    "beta/thanks/index.html",
    "beta/confirmed/index.html",
  ])
    assert.ok(tree.includes(path), `the deploy branch lacks ${path}`);
  assert.equal(
    git(site, "show", "deploy:.well-known/assetlinks.json"),
    readFileSync(
      join(builtDist, ".well-known", "assetlinks.json"),
      "utf8",
    ).trim(),
  );
});
