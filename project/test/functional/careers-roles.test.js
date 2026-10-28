// Functional — the four open roles on /careers/ (WEB-913, owner's list of
// 2026-10-28). Each renders with the owner's description and an apply link to
// the careers mailbox with the role in the subject. Nothing is invented: no
// pay, equity, benefits, location, seniority, start date, team size or
// employment type other than the owner's "part-time" for the clinical advisor.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readPage } from "../helpers/dist.js";

const ROLES = [
  [
    "mobile-engineer",
    "Mobile engineer (Flutter)",
    "iOS and Android app, design system, accessibility.",
  ],
  [
    "backend-engineer",
    "Backend engineer",
    "Node.js/NestJS API, PostgreSQL/Supabase, security and privacy.",
  ],
  [
    "clinical-advisor",
    "Clinical advisor (part-time)",
    "A clinician reviewing safety rules, programme content and sign-offs.",
  ],
  [
    "growth-community",
    "Growth &amp; community",
    "Beta testers, partnerships with clinics and employers, content.",
  ],
];

const html = () => readPage("careers/index.html");
const card = (id) =>
  html().match(
    new RegExp(`<li[^>]*id="${id}"[\\s\\S]*?How to apply[\\s\\S]*?<\\/li>`),
  )?.[0];
const visible = (s) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

test("exactly the four roles render, each with the owner's description", () => {
  const titles = [
    ...html().matchAll(
      /<li[^>]*id="([a-z-]+)"[^>]*>\s*<h3[^>]*>([^<]*)<\/h3>/g,
    ),
  ];
  assert.deepEqual(
    titles.map((m) => m[2]),
    ROLES.map((r) => r[1]),
  );
  for (const [id, , summary] of ROLES) {
    const c = card(id);
    assert.ok(c, `no card for ${id}`);
    assert.ok(c.includes(summary), `${id} lacks its description`);
    const bullets = (c.match(/<ul[\s\S]*?<\/ul>/)?.[0].match(/<li>/g) ?? [])
      .length;
    assert.ok(bullets >= 3 && bullets <= 5, `${id} has ${bullets} bullets`);
  }
});

test("each role's apply link mails careers@ with the role in the subject", () => {
  for (const [id, title] of ROLES) {
    const raw = title.replace("&amp;", "&");
    const href = `mailto:careers@tetherhealthgroup.com?subject=${encodeURIComponent(raw)}`;
    const c = card(id);
    assert.ok(
      c.includes(`href="${href.replace(/&/g, "&amp;")}"`) ||
        c.includes(`href="${href}"`),
      `${id}: apply link is not ${href}`,
    );
    assert.match(
      visible(c),
      /How to apply: email careers@ ?tetherhealthgroup\.com with the role in the subject\./,
    );
  }
});

test("no invented terms: no pay, equity, benefits, location or seniority", () => {
  const text = visible(html());
  assert.doesNotMatch(
    text,
    /\$|salary|equity|compensation|benefits|stock|bonus/i,
  );
  assert.doesNotMatch(
    text,
    /\b(?:remote|on-?site|hybrid|full-?time|contract(?:or)?|senior|junior|lead|staff|principal)\b/i,
  );
  assert.doesNotMatch(
    text,
    /\bstart(?:s|ing)? (?:date|in|on)\b|\bteam of \d+/i,
  );
  assert.equal(
    (text.match(/part-time/gi) ?? []).length,
    1,
    "part-time only for the clinical advisor",
  );
  assert.doesNotMatch(
    html(),
    /"@type":"JobPosting"/,
    "no JobPosting without a location",
  );
});

test("the page no longer says we build with clinicians, and has the EEO line", () => {
  const text = visible(html());
  assert.doesNotMatch(text, /We build with clinicians/);
  assert.match(text, /Tether Health is an equal opportunity employer\./);
  assert.match(html(), /href="\/privacy\/#job-applications"/);
});

test("the privacy notice covers job applications sent to careers@", () => {
  const section = readPage("privacy/index.html").match(
    /<h2 id="job-applications">[\s\S]*?(?=<h2\b)/,
  )?.[0];
  assert.ok(section, "no job-applications section");
  const text = visible(section);
  assert.match(text, /résumé/);
  assert.match(
    text,
    /delete it once the role is filled or closed, or sooner if you ask/,
  );
  assert.match(section, /mailto:privacy@tetherhealthgroup\.com/);
  assert.match(section, /mailto:careers@tetherhealthgroup\.com/);
});
