/**
 * WCAG 2.x contrast arithmetic against the design tokens the build emits.
 *
 * Tokens are read from the built stylesheet rather than copied here, so a
 * token changed in global.css is the value the assertion sees.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { dist } from "./dist.js";

/** The built stylesheet text (the site ships exactly one). */
export function builtCss() {
  const dir = join(dist, "_astro");
  const sheets = readdirSync(dir).filter((f) => f.endsWith(".css"));
  return sheets.map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
}

/** Map of token name (e.g. "teal-deep") to "#rrggbb", from `--color-*`. */
export function colorTokens(css = builtCss()) {
  const tokens = new Map();
  for (const m of css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{3,6})\b/g)) {
    let hex = m[2].slice(1);
    if (hex.length === 3) hex = [...hex].map((c) => c + c).join("");
    tokens.set(m[1], `#${hex.toLowerCase()}`);
  }
  return tokens;
}

const channels = (hex) =>
  [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));

const luminance = (hex) => {
  const [r, g, b] = channels(hex)
    .map((v) => v / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast ratio between two "#rrggbb" colours. */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Mix `fg` over `bg` at `alpha` (0-1), as the browser composites it. */
export function over(fg, bg, alpha) {
  const f = channels(fg);
  const b = channels(bg);
  const mixed = f.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)));
  return `#${mixed.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
