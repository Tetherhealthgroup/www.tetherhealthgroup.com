#!/usr/bin/env node
// Program intro videos (WEB-915, owner decision P-113).
//
// Builds, for each of the 11 program pages, a short intro video from three
// screens of the app design, and writes into
// project/public/media/programs/<id>/:
//
//   intro.mp4          H.264 1280x720, gentle pan/zoom, captions burned in,
//                      narration track (macOS `say -v Samantha`)
//   intro-still.mp4    the same video with no pan/zoom, for
//                      prefers-reduced-motion
//   intro.vtt          WebVTT captions, the same text as the burned-in ones
//   intro-poster.webp  poster frame (the title card)
//
// Sources: the narration and captions are `video.scenes` in
// project/src/data/program-pages.ts, the screens are
// project/src/assets/programs/<id>/<role>.png, and the program name, area,
// tagline and colour come from project/src/data/programs.ts. Change those, then
// rerun this script, and commit the new media.
//
// Requirements (macOS): Node >= 22.18 (imports the .ts data files directly),
// ffmpeg with libx264 and AAC, ImageMagick 7 (`magick`), `say` with the
// Samantha voice, and the Arial and Georgia fonts in
// /System/Library/Fonts/Supplemental. ffmpeg needs no drawtext or libass:
// every caption is drawn by ImageMagick and overlaid.
//
// Usage, from the repository root:
//   node scripts/build-program-videos.mjs                # all programs
//   node scripts/build-program-videos.mjs --only tobacco # one program
//   node scripts/build-program-videos.mjs --no-voice     # silent track
//
// Each finished intro.mp4 and intro-still.mp4 must be 20-35 s long and at most
// 3 MB; the script raises the x264 CRF until it fits and fails otherwise.

import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  rmSync,
  statSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const project = join(repoRoot, "project");

const { programPages, videoEndCard } = await import(
  join(project, "src/data/program-pages.ts")
);
const { programs } = await import(join(project, "src/data/programs.ts"));

// --- Options -----------------------------------------------------------------

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const voice = !args.includes("--no-voice");
if (only && !programPages.some((p) => p.id === only)) {
  console.error(`--only: no program page "${only}"`);
  process.exit(2);
}

// --- Look and timing ---------------------------------------------------------

const W = 1280;
const H = 720;
const FPS = 30;
const MAX_BYTES = 3 * 1024 * 1024;
const MIN_SECONDS = 20;
const MAX_SECONDS = 35;

const FONT_DIR = "/System/Library/Fonts/Supplemental";
const FONT = join(FONT_DIR, "Arial.ttf");
const FONT_BOLD = join(FONT_DIR, "Arial Bold.ttf");
const FONT_SERIF_ITALIC = join(FONT_DIR, "Georgia Italic.ttf");

// Site palette (project/src/styles/global.css).
const C = {
  cream: "#f8f5ec",
  paper: "#fffdf7",
  tealDeep: "#123c37",
  tealMid: "#536f69",
  tealMuted: "#718a84",
  mintStrong: "#bfe1d2",
  lime: "#d5ef75",
};

const SCREEN_PX_H = 500; // phone screen height in the frame
const BEZEL = 9;
const LEAD_IN = 0.5; // seconds before the first sentence of a scene
const GAP = 0.35; // seconds between sentences
const TAIL = 0.7; // seconds after the last sentence of a scene
const MIN_SCENE = 4.0;
const FADE = 0.4;
const ZOOM = 0.045; // total zoom over one scene in the motion version
const ROLE_EYEBROW = {
  home: "Home",
  action: "The main action",
  recovery: "If you go off plan",
};
const END_NARRATION = "Coming to iPhone and Android. Get early access.";

// --- Helpers -----------------------------------------------------------------

function run(cmd, cmdArgs, { capture = false } = {}) {
  const res = spawnSync(cmd, cmdArgs, {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : ["ignore", "ignore", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.error) throw new Error(`${cmd}: ${res.error.message}`);
  if (res.status !== 0)
    throw new Error(
      `${cmd} exited ${res.status}\n${(res.stderr ?? "").slice(-2000)}`,
    );
  return res.stdout ?? "";
}

function duration(file) {
  const out = run(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=nw=1:nk=1",
      file,
    ],
    { capture: true },
  );
  const seconds = Number(out.trim());
  if (!Number.isFinite(seconds)) throw new Error(`no duration for ${file}`);
  return seconds;
}

/** ImageMagick text: no leading @ (file read) and literal percent signs. */
function im(text) {
  if (text.startsWith("@")) throw new Error(`text may not start with @`);
  return text.replace(/%/g, "%%").replace(/\\/g, "\\\\");
}

function vttTime(t) {
  const ms = Math.round(t * 1000);
  const h = String(Math.floor(ms / 3600000)).padStart(2, "0");
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, "0");
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
  return `${h}:${m}:${s}.${String(ms % 1000).padStart(3, "0")}`;
}

function checkTools() {
  for (const [cmd, probe] of [
    ["ffmpeg", ["-hide_banner", "-encoders"]],
    ["ffprobe", ["-version"]],
    ["magick", ["-version"]],
  ]) {
    const out = run(cmd, probe, { capture: true });
    if (cmd === "ffmpeg" && !/libx264/.test(out))
      throw new Error("ffmpeg lacks libx264");
  }
  if (voice) {
    const voices = run("say", ["-v", "?"], { capture: true });
    if (!/^Samantha\s/m.test(voices))
      throw new Error("the Samantha voice is not installed");
  }
  for (const font of [FONT, FONT_BOLD, FONT_SERIF_ITALIC])
    if (!existsSync(font)) throw new Error(`missing font ${font}`);
}

// --- Frames ------------------------------------------------------------------

/** The screen in a rounded device frame with a soft shadow. */
function phone(screenPng, out) {
  const sw = Math.round((SCREEN_PX_H * 585) / 1266);
  const r = 34;
  const pw = sw + 2 * BEZEL;
  const ph = SCREEN_PX_H + 2 * BEZEL;
  run("magick", [
    screenPng,
    "-resize",
    `${sw}x${SCREEN_PX_H}!`,
    "(",
    "-size",
    `${sw}x${SCREEN_PX_H}`,
    "xc:black",
    "-fill",
    "white",
    "-draw",
    `roundrectangle 0,0,${sw - 1},${SCREEN_PX_H - 1},${r - BEZEL},${r - BEZEL}`,
    ")",
    "-alpha",
    "off",
    "-compose",
    "CopyOpacity",
    "-composite",
    "(",
    "-size",
    `${pw}x${ph}`,
    "xc:none",
    "-fill",
    C.tealDeep,
    "-draw",
    `roundrectangle 0,0,${pw - 1},${ph - 1},${r},${r}`,
    ")",
    "+swap",
    "-geometry",
    `+${BEZEL}+${BEZEL}`,
    "-compose",
    "Over",
    "-composite",
    "(",
    "+clone",
    "-background",
    "#123c37",
    "-shadow",
    "28x14+0+10",
    ")",
    "+swap",
    "-background",
    "none",
    "-layers",
    "merge",
    "+repage",
    out,
  ]);
  return { w: pw, h: ph };
}

/** Letter badge in the program colour. */
function badgeArgs(program, x, y, size) {
  return [
    "-fill",
    program.color,
    "-draw",
    `roundrectangle ${x},${y},${x + size},${y + size},${size * 0.28},${size * 0.28}`,
    "-font",
    FONT_BOLD,
    "-pointsize",
    String(Math.round(size * 0.55)),
    "-fill",
    C.paper,
    "-gravity",
    "NorthWest",
    "-annotate",
    `+${x + Math.round(size * 0.3)}+${y + Math.round(size * 0.17)}`,
    im(program.letter),
  ];
}

function textBlock(text, font, size, color, width) {
  return [
    "(",
    "-size",
    `${width}x`,
    "-background",
    "none",
    "-fill",
    color,
    "-font",
    font,
    "-pointsize",
    String(size),
    "-interline-spacing",
    "4",
    `caption:${im(text)}`,
    ")",
  ];
}

/** A scene still: cream canvas, text on the left, the phone on the right. */
function sceneStill({
  program,
  phonePng,
  phoneSize,
  eyebrow,
  title,
  sub,
  out,
}) {
  const px = W - 110 - phoneSize.w;
  const py = 34;
  const left = 96;
  const textW = px - left - 60;
  run("magick", [
    "-size",
    `${W}x${H}`,
    `gradient:${C.cream}-#f1ede0`,
    phonePng,
    "-geometry",
    `+${px - 14}+${py}`,
    "-composite",
    ...badgeArgs(program, left, 150, 44),
    "-font",
    FONT_BOLD,
    "-pointsize",
    "24",
    "-fill",
    C.tealDeep,
    "-annotate",
    `+${left + 60}+158`,
    im(program.name),
    "-font",
    FONT_BOLD,
    "-pointsize",
    "19",
    "-fill",
    C.tealMuted,
    "-kerning",
    "2",
    "-annotate",
    `+${left}+228`,
    im(eyebrow.toUpperCase()),
    "-kerning",
    "0",
    ...textBlock(title, FONT_BOLD, 54, C.tealDeep, textW),
    "-geometry",
    `+${left}+262`,
    "-composite",
    ...(sub
      ? [
          ...textBlock(sub, FONT_SERIF_ITALIC, 30, C.tealMid, textW),
          "-geometry",
          `+${left}+420`,
          "-composite",
        ]
      : []),
    out,
  ]);
}

function endCardStill(out) {
  run("magick", [
    "-size",
    `${W}x${H}`,
    `xc:${C.tealDeep}`,
    "-gravity",
    "North",
    "-font",
    FONT_BOLD,
    "-pointsize",
    "58",
    "-fill",
    C.paper,
    "-annotate",
    "+0+215",
    im(videoEndCard.title),
    "-fill",
    C.lime,
    "-draw",
    `roundrectangle ${W / 2 - 200},330,${W / 2 + 200},410,40,40`,
    "-font",
    FONT_BOLD,
    "-pointsize",
    "34",
    "-fill",
    C.tealDeep,
    "-annotate",
    "+0+349",
    im(videoEndCard.cta),
    "-font",
    FONT,
    "-pointsize",
    "28",
    "-fill",
    C.mintStrong,
    "-annotate",
    "+0+455",
    im(videoEndCard.url),
    "-gravity",
    "NorthWest",
    out,
  ]);
}

/** A burned-in caption: white text on a dark rounded panel, bottom centre. */
function captionPng(text, out) {
  const tmpText = `${out}.text.png`;
  run("magick", [
    "-size",
    "1040x",
    "-background",
    "none",
    "-fill",
    "white",
    "-font",
    FONT_BOLD,
    "-pointsize",
    "31",
    "-gravity",
    "Center",
    "-interline-spacing",
    "6",
    `caption:${im(text)}`,
    "-trim",
    "+repage",
    tmpText,
  ]);
  const dims = run("magick", ["identify", "-format", "%w %h", tmpText], {
    capture: true,
  })
    .trim()
    .split(" ")
    .map(Number);
  const bw = dims[0] + 48;
  const bh = dims[1] + 28;
  run("magick", [
    "-size",
    `${bw}x${bh}`,
    "xc:none",
    "-fill",
    "rgba(18,60,55,0.88)",
    "-draw",
    `roundrectangle 0,0,${bw - 1},${bh - 1},18,18`,
    tmpText,
    "-gravity",
    "Center",
    "-compose",
    "Over",
    "-composite",
    out,
  ]);
  rmSync(tmpText);
  return { w: bw, h: bh };
}

// --- Narration ---------------------------------------------------------------

function narrate(text, out) {
  if (voice) {
    run("say", [
      "-v",
      "Samantha",
      "-r",
      "172",
      "-o",
      out,
      "--data-format=LEI16@44100",
      text,
    ]);
  } else {
    // A silent clip with roughly the time the sentence takes to read.
    const seconds = Math.max(1.5, text.split(/\s+/).length / 2.6);
    run("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "anullsrc=r=44100:cl=mono",
      "-t",
      seconds.toFixed(2),
      out,
    ]);
  }
  return duration(out);
}

// --- Segments ----------------------------------------------------------------

/**
 * Renders one scene as an intermediate file: the still (zoomed or not), its
 * captions at their cue times, fades, and the narration placed at the same
 * times.
 */
function segment({ still, cues, clips, length, motion, out }) {
  const inputs = [
    "-loop",
    "1",
    "-framerate",
    String(FPS),
    "-t",
    length.toFixed(3),
    "-i",
    still,
  ];
  for (const cue of cues)
    inputs.push("-loop", "1", "-t", length.toFixed(3), "-i", cue.png);
  for (const clip of clips) inputs.push("-i", clip.file);
  inputs.push(
    "-f",
    "lavfi",
    "-t",
    length.toFixed(3),
    "-i",
    "anullsrc=r=44100:cl=mono",
  );

  const frames = Math.round(length * FPS);
  let graph = motion
    ? `[0:v]scale=${W * 2}:${H * 2},zoompan=z='1+${ZOOM}*on/${frames}':` +
      `x='(iw-iw/zoom)*(0.5+0.5*on/${frames})':y='(ih-ih/zoom)*0.5':` +
      `d=1:s=${W}x${H}:fps=${FPS},setsar=1[v0]`
    : `[0:v]scale=${W}:${H},setsar=1,fps=${FPS}[v0]`;
  cues.forEach((cue, i) => {
    const x = Math.round((W - cue.w) / 2);
    const y = H - 24 - cue.h;
    graph +=
      `;[v${i}][${i + 1}:v]overlay=${x}:${y}:` +
      `enable='between(t,${cue.start.toFixed(3)},${cue.end.toFixed(3)})'[v${i + 1}]`;
  });
  const last = `v${cues.length}`;
  graph +=
    `;[${last}]fade=t=in:st=0:d=${FADE},` +
    `fade=t=out:st=${(length - FADE).toFixed(3)}:d=${FADE},format=yuv420p[vout]`;

  const audioBase = 1 + cues.length;
  const silence = audioBase + clips.length;
  const delayed = clips.map((clip, i) => {
    const ms = Math.round(clip.start * 1000);
    graph += `;[${audioBase + i}:a]aresample=44100,adelay=${ms}:all=1[a${i}]`;
    return `[a${i}]`;
  });
  graph +=
    `;[${silence}:a]${delayed.join("")}amix=inputs=${clips.length + 1}:` +
    `normalize=0:duration=first[aout]`;

  run("ffmpeg", [
    "-y",
    ...inputs,
    "-filter_complex",
    graph,
    "-map",
    "[vout]",
    "-map",
    "[aout]",
    "-t",
    length.toFixed(3),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "12",
    "-c:a",
    "pcm_s16le",
    out,
  ]);
}

function encodeFinal(segments, out) {
  const inputs = segments.flatMap((s) => ["-i", s]);
  const concat =
    segments.map((_, i) => `[${i}:v][${i}:a]`).join("") +
    `concat=n=${segments.length}:v=1:a=1[v][a]`;
  for (let crf = 25; crf <= 36; crf += 1) {
    run("ffmpeg", [
      "-y",
      ...inputs,
      "-filter_complex",
      concat,
      "-map",
      "[v]",
      "-map",
      "[a]",
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-tune",
      "stillimage",
      "-profile:v",
      "high",
      "-crf",
      String(crf),
      "-pix_fmt",
      "yuv420p",
      "-g",
      String(FPS * 4),
      "-c:a",
      "aac",
      "-b:a",
      "64k",
      "-ac",
      "1",
      "-movflags",
      "+faststart",
      "-metadata",
      "title=Tether Health program introduction",
      out,
    ]);
    const bytes = statSync(out).size;
    if (bytes <= MAX_BYTES) return { crf, bytes };
  }
  throw new Error(`${out} is still over 3 MB at CRF 36`);
}

// --- One program -------------------------------------------------------------

function build(page) {
  const program = programs.find((p) => p.id === page.id);
  if (!program) throw new Error(`no program for page ${page.id}`);
  const work = join(tmpdir(), "thg-program-videos", page.id);
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  const outDir = join(project, "public/media/programs", page.id);
  mkdirSync(outDir, { recursive: true });

  // Stills.
  const stills = [];
  const phones = page.screens.map((screen, i) => {
    const png = join(
      project,
      "src/assets/programs",
      page.id,
      `${screen.role}.png`,
    );
    if (!existsSync(png)) throw new Error(`missing ${png}`);
    const out = join(work, `phone${i}.png`);
    return { png: out, size: phone(png, out) };
  });
  const titleStill = join(work, "scene0.png");
  sceneStill({
    program,
    phonePng: phones[0].png,
    phoneSize: phones[0].size,
    eyebrow: `${program.area} · ${program.archetype}`,
    title: program.name,
    sub: program.tagline,
    out: titleStill,
  });
  stills.push(titleStill);
  page.screens.forEach((screen, i) => {
    const out = join(work, `scene${i + 1}.png`);
    sceneStill({
      program,
      phonePng: phones[i].png,
      phoneSize: phones[i].size,
      eyebrow: ROLE_EYEBROW[screen.role],
      title: screen.title,
      sub: null,
      out,
    });
    stills.push(out);
  });
  const endStill = join(work, "scene4.png");
  endCardStill(endStill);
  stills.push(endStill);

  // Timeline: narration decides each scene's length.
  const sceneTexts = [...page.video.scenes, [END_NARRATION]];
  const vtt = ["WEBVTT", ""];
  const plan = [];
  let clock = 0;
  sceneTexts.forEach((sentences, k) => {
    let t = LEAD_IN;
    const cues = [];
    const clips = [];
    sentences.forEach((sentence, j) => {
      const file = join(work, `n${k}_${j}.wav`);
      const len = narrate(sentence, file);
      const isEnd = k === sceneTexts.length - 1;
      // The end card's own text is the caption; its narration is spoken only.
      const caption = isEnd
        ? `${videoEndCard.title} · ${videoEndCard.cta}`
        : sentence;
      clips.push({ file, start: t });
      cues.push({ text: caption, start: t, end: t + len + 0.25, burn: !isEnd });
      t += len + GAP;
    });
    const length = Math.max(MIN_SCENE, t - GAP + TAIL);
    cues.forEach((cue, j) => {
      vtt.push(
        `${k + 1}.${j + 1}`,
        `${vttTime(clock + cue.start)} --> ${vttTime(clock + Math.min(cue.end, length - 0.1))}`,
        cue.text,
        "",
      );
    });
    plan.push({ still: stills[k], cues, clips, length });
    clock += length;
  });
  if (clock < MIN_SECONDS || clock > MAX_SECONDS)
    throw new Error(
      `${page.id}: ${clock.toFixed(1)} s is outside ${MIN_SECONDS}-${MAX_SECONDS} s`,
    );

  // Caption images.
  plan.forEach((scene, k) => {
    scene.burned = scene.cues
      .filter((cue) => cue.burn)
      .map((cue, j) => {
        const png = join(work, `cap${k}_${j}.png`);
        const size = captionPng(cue.text, png);
        return { ...cue, png, ...size };
      });
  });

  const results = {};
  for (const [name, motion] of [
    ["intro.mp4", true],
    ["intro-still.mp4", false],
  ]) {
    const segs = plan.map((scene, k) => {
      const out = join(work, `${motion ? "m" : "s"}${k}.mkv`);
      segment({
        still: scene.still,
        cues: scene.burned,
        clips: scene.clips,
        length: scene.length,
        motion: motion && k < plan.length - 1,
        out,
      });
      return out;
    });
    results[name] = encodeFinal(segs, join(outDir, name));
    results[name].seconds = duration(join(outDir, name));
  }

  writeFileSync(join(outDir, "intro.vtt"), vtt.join("\n"));
  run("magick", [
    titleStill,
    "-quality",
    "78",
    join(outDir, "intro-poster.webp"),
  ]);
  rmSync(work, { recursive: true, force: true });
  return results;
}

// --- Main --------------------------------------------------------------------

checkTools();
let total = 0;
for (const page of programPages) {
  if (only && page.id !== only) continue;
  const results = build(page);
  for (const [name, r] of Object.entries(results)) {
    total += r.bytes;
    console.log(
      `${page.id}/${name}: ${r.seconds.toFixed(1)} s, ${(r.bytes / 1024 / 1024).toFixed(2)} MB, CRF ${r.crf}`,
    );
  }
}
console.log(`video total: ${(total / 1024 / 1024).toFixed(2)} MB`);
