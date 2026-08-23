#!/usr/bin/env node
// Prava Labs icon generator.
// Composes brand/glyphs/*.svg with the tile system in tokens.json and emits
// every deliverable into brand/dist/<product>/.
//
// Usage:
//   node brand/generate.mjs            # all products
//   node brand/generate.mjs toolport   # one product
//
// Adding a new product = one tokens.json entry + one glyph file, then rerun.
// PNG rasterization uses rsvg-convert (brew install librsvg); if it's missing,
// SVGs are still written and PNGs are skipped with a warning.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync, execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const T = JSON.parse(readFileSync(join(ROOT, "tokens.json"), "utf8"));
const G = T.grid;
const RX = G * T.cornerRadiusRatio;

const rgba = (s) => {
  const m = s.match(/rgba\((\d+),(\d+),(\d+),([\d.]+)\)/);
  if (!m) return { hex: s, op: 1 };
  const hex = "#" + [m[1], m[2], m[3]].map((n) => (+n).toString(16).padStart(2, "0")).join("");
  return { hex, op: +m[4] };
};

// core may be a flat hex or "gradient:a,b"
function coreDefs(core, id) {
  if (!core?.startsWith("gradient:")) return { fill: core, def: "" };
  const [a, b] = core.slice(9).split(",");
  return {
    fill: `url(#${id})`,
    def: `<linearGradient id="${id}" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`,
  };
}

const darkTileDef = (id, stops) => `<radialGradient id="${id}" cx="0.5" cy="-0.1" r="1.2">
  <stop offset="0" stop-color="${stops[0]}"/><stop offset="0.48" stop-color="${stops[1]}"/>
  <stop offset="1" stop-color="${stops[2]}"/></radialGradient>`;

const washDef = (id, [teal, cyan, , violet]) => `<radialGradient id="${id}" cx="0.5" cy="-0.1" r="1.25">
  <stop offset="0" stop-color="${teal}" stop-opacity="0.32"/>
  <stop offset="0.34" stop-color="${cyan}" stop-opacity="0.20"/>
  <stop offset="0.62" stop-color="${violet}" stop-opacity="0.16"/>
  <stop offset="0.78" stop-color="${violet}" stop-opacity="0"/></radialGradient>`;

function glyphMarkup(file, ink, core, inset) {
  const raw = readFileSync(join(ROOT, "glyphs", file), "utf8")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replaceAll("__INK__", ink)
    .replaceAll("__CORE__", core)
    .trim();
  const off = (G * (1 - inset)) / 2;
  return `<g transform="translate(${off.toFixed(1)} ${off.toFixed(1)}) scale(${inset})">${raw}</g>`;
}

function icon({ p, variant, fullBleed = false, pad = 0 }) {
  const inset = p.glyphInset ?? T.glyphInset;
  const defs = [];
  let bg, stroke, ink, core;

  if (variant === "light") {
    bg = `<rect width="${G}" height="${G}" rx="${fullBleed ? 0 : RX}" fill="${T.tile.light}"/>`;
    stroke = rgba(T.tile.innerStrokeLight);
    ink = T.ink.light;
    const c = coreDefs(p.coreLight ?? p.core, "core");
    defs.push(c.def); core = c.fill;
  } else if (variant === "tint") {
    defs.push(darkTileDef("bg", p.tint));
    bg = `<rect width="${G}" height="${G}" rx="${fullBleed ? 0 : RX}" fill="url(#bg)"/>`;
    stroke = rgba(T.tile.innerStroke);
    ink = p.tintInk;
    core = typeof p.core === "string" && !p.core.startsWith("gradient:") ? p.core : p.tintInk;
  } else {
    defs.push(darkTileDef("bg", T.tile.dark));
    bg = `<rect width="${G}" height="${G}" rx="${fullBleed ? 0 : RX}" fill="url(#bg)"/>`;
    if (p.parent) { defs.push(washDef("wash", T.spectrum)); bg += `<rect width="${G}" height="${G}" rx="${fullBleed ? 0 : RX}" fill="url(#wash)"/>`; }
    stroke = rgba(T.tile.innerStroke);
    ink = T.ink.dark;
    if (variant === "mono") core = T.ink.dark;
    else { const c = coreDefs(p.core, "core"); defs.push(c.def); core = c.fill; }
  }

  const ring = fullBleed ? "" :
    `<rect x="1.5" y="1.5" width="${G - 3}" height="${G - 3}" rx="${RX - 1.5}" fill="none" stroke="${stroke.hex}" stroke-opacity="${stroke.op}" stroke-width="3"/>`;

  const content = `${bg}${ring}\n${glyphMarkup(p.glyph, ink, core, inset)}`;
  // macOS draws no mask of its own: the tile has to arrive already inset inside a
  // transparent canvas, on Apple's 824-in-1024 grid, or the icon sits oversized
  // next to every other app in the Dock.
  const off = ((G * (1 - pad)) / 2).toFixed(1);
  const body = pad ? `<g transform="translate(${off} ${off}) scale(${pad})">${content}</g>` : content;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${G} ${G}">
<defs>${defs.filter(Boolean).join("\n")}</defs>
${body}
</svg>`;
}

function bareGlyph(p, dark) {
  const inset = p.glyphInset ?? T.glyphInset;
  const ink = dark ? T.ink.light : T.ink.dark;
  const c = coreDefs(dark ? (p.coreLight ?? p.core) : p.core, "core");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${G} ${G}">
<defs>${c.def}</defs>
${glyphMarkup(p.glyph, ink, c.fill, inset)}
</svg>`;
}

let RSVG = true;
try { execSync("rsvg-convert --version", { stdio: "ignore" }); }
catch { RSVG = false; console.warn("⚠ rsvg-convert not found — writing SVGs only (brew install librsvg)"); }

const png = (svgPath, outPath, size) =>
  RSVG && execFileSync("rsvg-convert", ["-w", String(size), "-h", String(size), svgPath, "-o", outPath]);

const only = process.argv[2];
const entries = Object.entries(T.products).filter(([id]) => !only || id === only);
if (!entries.length) { console.error(`No product "${only}" in tokens.json`); process.exit(1); }

for (const [id, p] of entries) {
  const dir = join(ROOT, "dist", id);
  mkdirSync(dir, { recursive: true });

  const files = {
    "icon.svg": icon({ p, variant: "full" }),
    "icon-mono.svg": icon({ p, variant: "mono" }),
    "icon-light.svg": icon({ p, variant: "light" }),
    "glyph.svg": bareGlyph(p, false),
    "glyph-dark.svg": bareGlyph(p, true),
    "appstore.svg": icon({ p, variant: "full", fullBleed: true }),
  };
  if (p.tint) files["icon-tint.svg"] = icon({ p, variant: "tint" });
  if (p.macos) files["icon-macos.svg"] = icon({ p, variant: "full", pad: 824 / 1024 });

  for (const [name, svg] of Object.entries(files)) writeFileSync(join(dir, name), svg);

  for (const s of T.sizes) png(join(dir, "icon.svg"), join(dir, `icon-${s}.png`), s);
  png(join(dir, "appstore.svg"), join(dir, "appstore-1024.png"), 1024);
  if (p.macos) for (const s of T.sizes) png(join(dir, "icon-macos.svg"), join(dir, `macos-${s}.png`), s);

  console.log(`✓ ${id} → dist/${id} (${Object.keys(files).length} SVG, ${RSVG ? T.sizes.length + 1 : 0} PNG)`);
}
console.log("done");
