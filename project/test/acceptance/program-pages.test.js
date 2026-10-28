// Acceptance — the richer program pages (WEB-915, owner decision P-113).
//
// Each of the 11 program pages carries three screens from the app design with
// alt text, an intro video that never autoplays and has a captions track, the
// sections "What it is", "What the app helps with" and "If you go off plan:
// the recovery plan", the medical boundary, 911 and 988, and early access at
// /beta/. The media files are checked for size, length and captions, and the
// caption tracks are checked against the narration in program-pages.ts, so a
// copy change without a video rebuild fails here.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  dist,
  projectRoot,
  htmlFiles,
  readPage,
  cspLine,
  decodeEntities,
  OUTBOUND_LINK_HOSTS,
} from "../helpers/dist.js";

const { programs } = await import("../../src/data/programs.ts");
const { programPages, programDisclaimer, clinicalReviewMarker, videoEndCard } =
  await import("../../src/data/program-pages.ts");

const MB = 1024 * 1024;
const pageOf = (id) => programPages.find((p) => p.id === id);
const html = (id) => readPage(`programs/${id}/index.html`);
const attr = (tag, name) =>
  tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? null;
const hasAttr = (tag, name) => new RegExp(`\\s${name}(?:=|\\s|>|/)`).test(tag);
const text = (fragment) =>
  decodeEntities(fragment.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");

/** Duration in seconds from an MP4's mvhd box. */
function mp4Seconds(file) {
  const buf = readFileSync(file);
  const i = buf.indexOf("mvhd");
  assert.ok(i > 0, `${file} has no mvhd box`);
  if (buf[i + 4] === 1) {
    const scale = buf.readUInt32BE(i + 24);
    return Number(buf.readBigUInt64BE(i + 28)) / scale;
  }
  return buf.readUInt32BE(i + 20) / buf.readUInt32BE(i + 16);
}

/** WebVTT cues as { start, end, text }. */
function cues(vtt) {
  const toSec = (t) => {
    const [h, m, s] = t.split(":");
    return Number(h) * 3600 + Number(m) * 60 + Number(s);
  };
  return [
    ...vtt.matchAll(
      /(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})\n([^\n]+(?:\n[^\n]+)*)/g,
    ),
  ].map((m) => ({ start: toSec(m[1]), end: toSec(m[2]), text: m[3] }));
}

test("there is one program page entry per program, in step with programs.ts", () => {
  assert.deepEqual(
    programPages.map((p) => p.id).sort(),
    programs.map((p) => p.id).sort(),
  );
  assert.equal(programPages.length, 11);
});

test("each program has three screen renders, home, action and recovery, on disk", () => {
  for (const page of programPages) {
    assert.deepEqual(
      page.screens.map((s) => s.role),
      ["home", "action", "recovery"],
      page.id,
    );
    for (const screen of page.screens) {
      const png = join(
        projectRoot,
        "src/assets/programs",
        page.id,
        `${screen.role}.png`,
      );
      assert.ok(existsSync(png), `missing ${png}`);
      assert.ok(screen.alt.length >= 80, `${screen.specId}: alt is too short`);
    }
  }
});

test("the screens and their alt text use synthetic content only", () => {
  // The design kit's examples name a person, a clinic and an EHR vendor; the
  // website renders replace them (see program-pages.ts). Alt text must not
  // reintroduce them, nor the kit's "Example" tag.
  for (const page of programPages)
    for (const screen of page.screens)
      assert.doesNotMatch(
        screen.alt,
        /\b(?:Patel|Rosa|Sam|Epic|Example)\b/,
        `${page.id}/${screen.specId}`,
      );
});

test("each program page shows its three screens, optimised, with alt text", () => {
  for (const program of programs) {
    const page = pageOf(program.id);
    const doc = html(program.id);
    const list = doc.match(
      new RegExp(`<ul[^>]*aria-label="${program.name} screens"[\\s\\S]*?</ul>`),
    )?.[0];
    assert.ok(list, `${program.id}: no screens list`);
    const imgs = list.match(/<img\b[^>]*>/g) ?? [];
    assert.equal(imgs.length, 3, `${program.id}: ${imgs.length} screens`);
    imgs.forEach((img, i) => {
      assert.equal(
        decodeEntities(attr(img, "alt") ?? ""),
        page.screens[i].alt,
        `${program.id} image ${i + 1} alt`,
      );
      assert.match(attr(img, "src") ?? "", /^\/_astro\/.+\.webp$/);
      assert.equal(attr(img, "loading"), "lazy");
      assert.ok(attr(img, "width") && attr(img, "height"));
    });
  }
});

test("each program page has an intro video that waits to be played, with captions", () => {
  for (const program of programs) {
    const doc = html(program.id);
    const videos = doc.match(/<video\b[^>]*>[\s\S]*?<\/video>/g) ?? [];
    assert.equal(videos.length, 1, `${program.id}: ${videos.length} videos`);
    const video = videos[0];
    const open = video.match(/<video\b[^>]*>/)[0];
    const base = `/media/programs/${program.id}`;
    assert.ok(hasAttr(open, "controls"), `${program.id}: no controls`);
    assert.equal(attr(open, "preload"), "none", `${program.id}: preload`);
    assert.ok(hasAttr(open, "playsinline"), `${program.id}: playsinline`);
    assert.ok(hasAttr(open, "muted"), `${program.id}: not muted`);
    assert.ok(!hasAttr(open, "autoplay"), `${program.id}: autoplay`);
    assert.ok(!hasAttr(open, "loop"), `${program.id}: loop`);
    assert.equal(attr(open, "poster"), `${base}/intro-poster.webp`);

    const sources = video.match(/<source\b[^>]*>/g) ?? [];
    assert.equal(sources.length, 2, `${program.id}: sources`);
    assert.equal(attr(sources[0], "src"), `${base}/intro-still.mp4`);
    assert.equal(
      attr(sources[0], "media"),
      "(prefers-reduced-motion: reduce)",
      `${program.id}: the reduced-motion version must come first`,
    );
    assert.equal(attr(sources[1], "src"), `${base}/intro.mp4`);
    for (const source of sources)
      assert.equal(attr(source, "type"), "video/mp4");

    const track = video.match(/<track\b[^>]*>/)?.[0];
    assert.ok(track, `${program.id}: no track`);
    assert.equal(attr(track, "kind"), "captions");
    assert.equal(attr(track, "src"), `${base}/intro.vtt`);
    assert.equal(attr(track, "srclang"), "en");
  }
});

test("no page loads a video before it is played", () => {
  // The home page and every program page: no autoplay, and preload="none" on
  // every <video>, so only the poster is fetched until the visitor presses play.
  for (const page of htmlFiles()) {
    for (const open of readPage(page).match(/<video\b[^>]*>/g) ?? []) {
      assert.equal(attr(open, "preload"), "none", `${page}: preload`);
      assert.ok(!hasAttr(open, "autoplay"), `${page}: autoplay`);
    }
  }
});

test("each program page has the three content sections, from its data", () => {
  for (const program of programs) {
    const page = pageOf(program.id);
    const doc = html(program.id);
    const headings = [...doc.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map(
      (m) => text(m[1]).trim(),
    );
    for (const heading of [
      "What it is",
      "What the app helps with",
      "If you go off plan: the recovery plan",
    ])
      assert.ok(headings.includes(heading), `${program.id} lacks "${heading}"`);

    const body = text(doc);
    for (const paragraph of page.area)
      assert.ok(body.includes(paragraph), `${program.id}: area text missing`);
    assert.ok(page.helpsWith.length >= 4, `${program.id}: helpsWith`);
    for (const feature of page.helpsWith)
      assert.ok(body.includes(feature.name), `${program.id}: ${feature.name}`);
    assert.ok(page.recovery.steps.length >= 3, `${program.id}: steps`);
    for (const step of page.recovery.steps)
      assert.ok(body.includes(step.name), `${program.id}: ${step.name}`);
    assert.ok(body.includes(page.recovery.heading), `${program.id}: heading`);
  }
});

test("the health-area block is marked for clinical review and links only to public-health sources", () => {
  for (const program of programs) {
    const page = pageOf(program.id);
    const doc = html(program.id);
    const start = doc.indexOf(`data-review="${clinicalReviewMarker}"`);
    assert.notEqual(start, -1, `${program.id}: no review marker`);
    const block = doc.slice(start, doc.indexOf("</section>", start));
    assert.match(text(block), /What it is/, `${program.id}: marker misplaced`);
    const links = block.match(/<a\b[^>]*>/g) ?? [];
    assert.equal(links.length, page.learnMore.length, `${program.id}: links`);
    assert.ok(links.length >= 1, `${program.id}: no Learn more link`);
    for (const tag of links) {
      const href = attr(tag, "href");
      assert.ok(
        OUTBOUND_LINK_HOSTS.includes(new URL(href).host),
        `${program.id}: ${href} is not a listed public-health host`,
      );
      assert.equal(new URL(href).protocol, "https:");
      assert.equal(attr(tag, "rel"), "noopener noreferrer");
    }
  }
});

test("each program page keeps the medical boundary, 911, 988 and early access at /beta/", () => {
  for (const program of programs) {
    const doc = html(program.id);
    assert.ok(text(doc).includes(programDisclaimer), `${program.id}: boundary`);
    assert.match(doc, /href="tel:911"/, `${program.id}: 911`);
    assert.match(doc, /href="tel:988"/, `${program.id}: 988`);
    const cta = doc.match(/id="waitlist"[\s\S]*?<\/section>/)?.[0] ?? "";
    assert.match(
      cta,
      /<a[^>]*href="\/beta\/"[^>]*>\s*Get early access/,
      `${program.id}: no Get early access link to /beta/`,
    );
  }
});

test("every program video is H.264 MP4, 20-35 seconds and at most 3 MB", () => {
  for (const program of programs) {
    for (const name of ["intro.mp4", "intro-still.mp4"]) {
      const file = join(dist, "media/programs", program.id, name);
      assert.ok(existsSync(file), `missing ${file}`);
      const bytes = statSync(file).size;
      assert.ok(
        bytes <= 3 * MB,
        `${program.id}/${name} is ${(bytes / MB).toFixed(2)} MB`,
      );
      const buf = readFileSync(file);
      assert.equal(buf.subarray(4, 8).toString(), "ftyp", `${name}: not MP4`);
      assert.ok(buf.includes("avc1"), `${program.id}/${name}: not H.264`);
      const seconds = mp4Seconds(file);
      assert.ok(
        seconds >= 20 && seconds <= 35,
        `${program.id}/${name} is ${seconds.toFixed(1)} s`,
      );
    }
    const poster = readFileSync(
      join(dist, "media/programs", program.id, "intro-poster.webp"),
    );
    assert.equal(poster.subarray(8, 12).toString(), "WEBP", "poster format");
  }
});

test("each caption track matches the narration and ends with the end card", () => {
  for (const program of programs) {
    const page = pageOf(program.id);
    const vtt = readFileSync(
      join(dist, "media/programs", program.id, "intro.vtt"),
      "utf8",
    );
    assert.match(vtt, /^WEBVTT\n/);
    const list = cues(vtt);
    const expected = [
      ...page.video.scenes.flat(),
      `${videoEndCard.title} · ${videoEndCard.cta}`,
    ];
    assert.deepEqual(
      list.map((c) => c.text),
      expected,
      `${program.id}: captions differ from program-pages.ts; rebuild the videos`,
    );
    for (let i = 0; i < list.length; i += 1) {
      assert.ok(list[i].end > list[i].start, `${program.id} cue ${i + 1}`);
      if (i > 0)
        assert.ok(list[i].start >= list[i - 1].end, `${program.id} overlap`);
    }
    const seconds = mp4Seconds(
      join(dist, "media/programs", program.id, "intro.mp4"),
    );
    assert.ok(list.at(-1).end <= seconds, `${program.id}: cue past the end`);
  }
});

test("the caption tracks name a platform only in the P-113 end card", () => {
  // The site-wide overclaim filters forbid naming the iPhone outside /beta/
  // in page text. The video end card the owner decision specifies is the one
  // place a caption may; every other caption is held to those filters' words.
  const banned =
    /coming soon|download|launch|\binstall\b|available (?:now|today)|app store|google play|testflight|\bbeta\b|\b(?:iphone|ios|android)\b/i;
  for (const program of programs) {
    const vtt = readFileSync(
      join(dist, "media/programs", program.id, "intro.vtt"),
      "utf8",
    );
    for (const cue of cues(vtt)) {
      if (cue.text === `${videoEndCard.title} · ${videoEndCard.cta}`) continue;
      assert.doesNotMatch(cue.text, banned, `${program.id}: ${cue.text}`);
    }
  }
});

test("the content security policy allows same-origin media and nothing wider", () => {
  assert.match(cspLine(), /(?:^|; )media-src 'self';/);
});

test("no built file name or page names an app screen id", () => {
  // The renders are stored as home/action/recovery.png so the app's internal
  // screen ids (for example be_diary) never reach a public URL or page.
  const ids = programPages.flatMap((p) => p.screens.map((s) => s.specId));
  const idPattern = new RegExp(
    `(?:^|[^a-z])(?:${ids.join("|")}|(?:bf|sf|ca|hw|st|re|nu|sd|ea|ck|be|rescue)_[a-z]+)(?:[^a-z]|$)`,
  );
  const walk = (dir, prefix = "") =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? walk(join(dir, e.name), `${prefix}${e.name}/`)
        : [`${prefix}${e.name}`],
    );
  const files = walk(dist);
  assert.ok(files.length > 0);
  assert.deepEqual(
    files.filter((f) => idPattern.test(f)),
    [],
    "built files named after app screen ids",
  );
  for (const rel of htmlFiles())
    for (const id of ids)
      assert.ok(!readPage(rel).includes(id), `${rel} contains ${id}`);
});
