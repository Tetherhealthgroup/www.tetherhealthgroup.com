// Security — public-repository hygiene (WEB-901).
//
// This repository and the site it builds are public. Two things must never
// reach either:
//
//  1. Internal process vocabulary in any tracked text file: team role
//     handles, paths into private workspaces, private branch names, register
//     or review identifiers, and review-iteration wording. Say what is needed
//     ("needs counsel", "needs a security review"), not who does it or where
//     the notes live.
//  2. HTML comments in the built pages that cite sources (section:line or
//     file:line references, commit hashes, evidence labels, needs-owner /
//     needs-counsel markers). Those belong in expression comments
//     ({/* ... */}), which the build drops.
//
// This file is scanned too, so every pattern and sample below is assembled
// from fragments and none of the forbidden strings appears in it literally.
// Keep it that way when editing.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dist, htmlFiles } from "../helpers/dist.js";
import { repoFiles, repoTextOf as textOf } from "../helpers/repo.js";

const ROLE_PREFIX = "t" + "h";
const ROLE_SUFFIXES = [
  "qa",
  "security",
  "reviewer",
  "architect",
  "release",
  "lead",
  "app-engineer",
  "backend-engineer",
  "web-engineer",
  "chronic-engineer",
];
const WORKSPACE_DIR = "office" + "-worktrees";
const WORKSPACE_TOOLS = "office" + "-tools";
const WORKSPACE_REPO = "Tether-Health-AI" + "-Office";
const BRANCH_ROOT = "off" + "ice/";
const DEPTS = ["TH", "BE", "WEB", "OPS", "DES", "QA", "CC"];
const NOTE_FILES = ["LED" + "GER", "DECI" + "SIONS"];
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** [pattern, reason] pairs for tracked text. */
const FORBIDDEN_IN_TREE = [
  [
    new RegExp(
      `(?<![A-Za-z0-9])${ROLE_PREFIX}-(?:${ROLE_SUFFIXES.join("|")})\\b`,
      "i",
    ),
    "team role handle",
  ],
  [new RegExp(escape(WORKSPACE_DIR), "i"), "private workspace path"],
  [new RegExp(escape(WORKSPACE_TOOLS), "i"), "private workspace path"],
  [new RegExp(escape(WORKSPACE_REPO), "i"), "private workspace repository"],
  [
    new RegExp(`\\b${escape(BRANCH_ROOT)}(?:${DEPTS.join("|")})-\\d+`),
    "private branch name",
  ],
  [new RegExp("\\bru" + "ns/\\d{4}-\\d{2}-\\d{2}-"), "private notes path"],
  [new RegExp(`\\b(?:${NOTE_FILES.join("|")})\\.md\\b`), "private notes file"],
  [new RegExp("\\bAR" + "CH-\\d+"), "private decision identifier"],
  [new RegExp("\\bR" + "-\\d{3}[a-z]?\\b"), "register identifier"],
  [
    new RegExp(
      "\\b(?:finding|findings|nit|nits|review|reviewer)\\s+[A-Z]{1,2}\\d+\\b",
    ),
    "review finding identifier",
  ],
  [
    new RegExp("\\bsend" + "-back\\b|\\bsen" + "t back\\b", "i"),
    "review wording",
  ],
  [new RegExp("\\bro" + "und \\d+\\b", "i"), "review-iteration wording"],
];

/** Patterns that mark an HTML comment as a source citation. */
const CITATION_IN_COMMENT = [
  [/\b[A-Z](?:\.\d+)?:\d+(?:-\d+)?\b/, "section:line reference"],
  [
    /[\w./-]+\.(?:md|dart|ts|js|mjs|astro|json|ya?ml|sql|py):\d+/,
    "file:line reference",
  ],
  [/\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}\b/, "commit hash"],
  [new RegExp("needs" + "-(?:owner|counsel)"), "draft-status marker"],
  [/\b(?:Observed|Verified|Inferred|Assumed|NOT RUN)\b/, "evidence label"],
];

/**
 * Legitimate occurrences in tracked text: { path, lineContains, why }.
 * Empty today. Every entry is stale-checked below.
 */
const ALLOWLIST = [];

const allowed = (path, line) =>
  ALLOWLIST.some(
    (a) =>
      a.path === path &&
      (a.lineContains ? line.includes(a.lineContains) : true),
  );

/** Every forbidden-term hit in one text, as "path:line: reason". */
function treeHits(path, text) {
  const hits = [];
  text.split("\n").forEach((line, i) => {
    for (const [pattern, why] of FORBIDDEN_IN_TREE)
      if (pattern.test(line) && !allowed(path, line))
        hits.push(`${path}:${i + 1}: ${why}`);
  });
  return hits;
}

/** Every citing HTML comment in one page, as "page: reason: comment". */
function commentHits(page, html) {
  const hits = [];
  for (const [, body] of html.matchAll(/<!--([\s\S]*?)-->/g))
    for (const [pattern, why] of CITATION_IN_COMMENT)
      if (pattern.test(body))
        hits.push(`${page}: ${why}: <!--${body.slice(0, 80)}-->`);
  return hits;
}

test("the hygiene patterns catch every sample they exist to catch", () => {
  const tree = [
    `see ${ROLE_PREFIX}-reviewer`,
    `${ROLE_PREFIX.toUpperCase()}-Security signed off`,
    `../.${WORKSPACE_DIR}/WEB-1`,
    `~/x/.${WORKSPACE_TOOLS}/harness`,
    `${WORKSPACE_REPO.toLowerCase()}/notes`,
    `branch ${BRANCH_ROOT}WEB-123-some-slug`,
    "ru" + "ns/2026-01-01-WEB-1-x.md",
    `${NOTE_FILES[0]}.md`,
    "AR" + "CH-12",
    "(R" + "-054)",
    "review" + " M1 fixed",
    "rework after a send" + "-back",
    "ro" + "und 2 fixes",
  ];
  for (const sample of tree)
    assert.ok(
      treeHits("sample", sample).length > 0,
      `no tree pattern catches: ${sample}`,
    );

  const comments = [
    "<!-- F:449-454 -->",
    "<!-- A.6:311-312 -->",
    "<!-- lib/auth/gate.dart:131 -->",
    "<!-- at 44c5510 -->",
    "<!-- needs" + "-owner: timeline -->",
    "<!-- Observed in app code -->",
  ];
  for (const sample of comments)
    assert.ok(
      commentHits("sample", sample).length > 0,
      `no comment pattern catches: ${sample}`,
    );
});

test("ordinary words and structural comments are not flagged", () => {
  for (const sample of [
    "the decisions table in TASKS.md",
    "a ruthless edit",
    "health-qa",
    "WEB-013; hardened in WEB-016",
  ])
    assert.deepEqual(treeHits("sample", sample), [], sample);
  for (const sample of [
    "<!-- Navigation -->",
    "<!-- Safety routing, first and unmissable. -->",
    "<!-- Legal -->",
  ])
    assert.deepEqual(commentHits("sample", sample), [], sample);
});

test("no tracked text file carries internal process vocabulary", () => {
  const files = repoFiles();
  assert.ok(files.length > 50, `only ${files.length} files listed`);
  const hits = [];
  for (const path of files) {
    const text = textOf(path);
    if (text !== null) hits.push(...treeHits(path, text));
  }
  assert.deepEqual(hits, []);
});

test("every hygiene allowlist entry still matches something", () => {
  for (const entry of ALLOWLIST) {
    const text = textOf(entry.path) ?? "";
    const lines = text
      .split("\n")
      .filter((l) => !entry.lineContains || l.includes(entry.lineContains));
    assert.ok(
      lines.some((line) =>
        FORBIDDEN_IN_TREE.some(([pattern]) => pattern.test(line)),
      ),
      `stale allowlist entry: ${entry.path}`,
    );
  }
});

test("no built page ships an HTML comment citing a source", () => {
  const pages = htmlFiles();
  assert.ok(pages.length > 0, "no built pages; run npm run build first");
  const hits = [];
  for (const page of pages) {
    const html = readFileSync(join(dist, page), "utf8");
    hits.push(...commentHits(page, html));
    for (const [pattern, why] of FORBIDDEN_IN_TREE)
      if (pattern.test(html)) hits.push(`${page}: ${why}`);
  }
  assert.deepEqual(hits, []);
});
