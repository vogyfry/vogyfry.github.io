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

const readGlyph = (file) => readFileSync(join(ROOT, "glyphs", file), "utf8").replace(/<!--[\s\S]*?-->/g, "").trim();

// Elements that belong to an app state (`data-state="<name>"` in the stroked drawing, kept by
// outline.py): drawn in the icon and in the full menu-bar template, left out of the idle one.
const STATED = /<(?:path|circle|rect|polygon|polyline|line|ellipse)\b[^>]*\sdata-state="[^"]*"[^>]*\/>\s*/gi;

// Bounding box of a glyph's ink on the 256 grid. The outline files hold only absolute M/L
// coordinates plus the core circle, inside the data-centre translate, so no path engine is needed.
function inkBBox(raw) {
  const tr = raw.match(/<g transform="translate\((-?[\d.]+) (-?[\d.]+)\)" data-centre="1">/);
  const [tx, ty] = tr ? [+tr[1], +tr[2]] : [0, 0];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const take = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
  for (const m of raw.matchAll(/\sd="([^"]*)"/g)) {
    const n = m[1].match(/-?[\d.]+/g).map(Number);
    for (let i = 0; i + 1 < n.length; i += 2) take(n[i], n[i + 1]);
  }
  for (const m of raw.matchAll(/<circle\b[^>]*\bcx="([\d.]+)"[^>]*\bcy="([\d.]+)"[^>]*\br="([\d.]+)"/g)) {
    const [cx, cy, r] = [+m[1], +m[2], +m[3]]; take(cx - r, cy - r); take(cx + r, cy + r);
  }
  return { x0: x0 + tx, y0: y0 + ty, x1: x1 + tx, y1: y1 + ty };
}

function glyphMarkupRaw(raw, ink, core, inset, shift = [0, 0]) {
  raw = raw.replaceAll("__INK__", ink).replaceAll("__CORE__", core);
  const off = (G * (1 - inset)) / 2;
  const inner = shift[0] || shift[1] ? `<g transform="translate(${shift[0].toFixed(2)} ${shift[1].toFixed(2)})">${raw}</g>` : raw;
  return `<g transform="translate(${off.toFixed(1)} ${off.toFixed(1)}) scale(${inset})">${inner}</g>`;
}
const glyphMarkup = (file, ink, core, inset) => glyphMarkupRaw(readGlyph(file), ink, core, inset);

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
    // Opt-in per-product tile (tokens "tile": [top, mid, bottom]) for a product
    // whose hue fights the shared navy — a violet core read as "dark blue"
    // on it. Everything else keeps the family tile.
    defs.push(darkTileDef("bg", p.tile ?? T.tile.dark));
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

// Icon Composer layers. Apple's icons are layered: the system draws the glass
// edge, highlights and shadow per layer, so a layered icon reads on any Dock
// where a flat PNG's edge vanishes. Three layers per product, each full-canvas
// on the 256 grid: the tile (opaque, full-bleed), the ink, and the core dot.
function layer({ p, which }) {
  const inset = p.glyphInset ?? T.glyphInset;
  const defs = [];
  let body;
  if (which === "tile") {
    defs.push(darkTileDef("bg", p.tile ?? T.tile.dark));
    body = `<rect width="${G}" height="${G}" fill="url(#bg)"/>`;
    if (p.parent) { defs.push(washDef("wash", T.spectrum)); body += `<rect width="${G}" height="${G}" fill="url(#wash)"/>`; }
  } else {
    const c = coreDefs(p.core, "core"); defs.push(c.def);
    let raw = glyphMarkup(p.glyph, T.ink.dark, c.fill, inset);
    // the dot is the one element filled with the core colour; ink is everything else
    const dot = /<circle[^>]*fill="(?:url\(#core\)|#[0-9a-f]{6})"[^>]*\/>/i;
    body = which === "core" ? raw.replace(/<(?:path|polyline|line|rect|polygon|ellipse)[^>]*\/>|<circle(?![^>]*fill="(?:url\(#core\)|#[0-9a-f]{6})")[^>]*\/>/gi, "")
                            : raw.replace(dot, "");
  }
  // Icon Composer places an SVG at its intrinsic size on the 1024 canvas, so
  // the layer declares 1024 px; the drawing stays on the 256 grid via viewBox.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 ${G} ${G}">
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

for (const [id, entry] of entries) {
  // A product's dot colour is its *kind* — consumer app, developer tool,
  // enterprise platform — not a hue picked per product. Nine one-off hues had
  // drifted into four near-identical violets that told a reader nothing; the
  // kind does. A product may still override any single value by naming it.
  const kind = entry.kind ? T.kinds?.[entry.kind] : null;
  if (entry.kind && !kind) { console.error(`${id}: unknown kind "${entry.kind}"`); process.exit(1); }
  const p = kind ? { ...kind, ...entry } : entry;
  const dir = join(ROOT, "dist", id);
  mkdirSync(dir, { recursive: true });

  const files = {
    "icon.svg": icon({ p, variant: "full" }),
    "icon-mono.svg": icon({ p, variant: "mono" }),
    "icon-light.svg": icon({ p, variant: "light" }),
    // Named for the ground they sit on, not the ink: on-dark is white ink, on-light is navy ink.
    "glyph-on-dark.svg": bareGlyph(p, false),
    "glyph-on-light.svg": bareGlyph(p, true),
    "appstore.svg": icon({ p, variant: "full", fullBleed: true }),
  };
  if (p.tint) files["icon-tint.svg"] = icon({ p, variant: "tint" });
  if (p.macos) files["icon-macos.svg"] = icon({ p, variant: "full", pad: 824 / 1024 });

  for (const [name, svg] of Object.entries(files)) writeFileSync(join(dir, name), svg);

  const ldir = join(dir, "layers");
  mkdirSync(ldir, { recursive: true });
  for (const which of ["tile", "glyph", "core"]) {
    const f = join(ldir, `${which}.svg`);
    writeFileSync(f, layer({ p, which }));
    png(f, join(ldir, `${which}-1024.png`), 1024);
  }

  // Menu bar template for Mac menu-bar apps ("menubar": true): the bare glyph in
  // black on a transparent square, sized so the ink fills the canvas the way an
  // SF Symbol fills its 18 pt box; the app marks it isTemplate and AppKit tints
  // it for light, dark and coloured menu bars. Same mark as the Dock icon, so the
  // two never look like two apps.
  // A Dock glyph's line-work (stroke ≈ 17 on the 256 grid ≈ 1.2 pt at 18 pt) reads thin and
  // small beside the system's menu bar extras (≈ 1.8 pt strokes, ink ≈ 16 pt): the menu bar
  // variant therefore uses the heavier outline `glyphs/<id>.menubar.svg` when it exists
  // (written by `tools/outline.py --stroke-scale <menubarStroke>` from the same stroked
  // drawing — one source, never a second drawing) and a fuller inset (`menubarInset`, > 1
  // enlarges: the Dock glyph keeps air for its tile, the menu bar box has none to spare).
  // The menu bar has no tile, so the template is centred on its ink, not on the glyph's grid:
  // a Dock glyph may sit off the grid centre on purpose (PrintRelay centres its dot on the
  // tile), and that offset must not carry into the 18 pt box. The centre is taken from the
  // *idle* ink — everything without a data-state — so a state's extra ink (PrintRelay's arcs)
  // appears beside a printer that does not move. Products with stated ink get a second
  // template, `menubar-template-idle`, without it; the app swaps the two.
  if (p.menubar) {
    const c = coreDefs("#000000", "core");
    const heavy = p.glyph.replace(/\.svg$/, ".menubar.svg");
    const glyph = existsSync(join(ROOT, "glyphs", heavy)) ? heavy : p.glyph;
    const full = readGlyph(glyph);
    const idle = full.replace(STATED, "");
    const bb = inkBBox(idle);
    const shift = [G / 2 - (bb.x0 + bb.x1) / 2, G / 2 - (bb.y0 + bb.y1) / 2];
    const variants = { "menubar-template": full };
    if (idle !== full) variants["menubar-template-idle"] = idle;
    for (const [name, raw] of Object.entries(variants)) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${G} ${G}">
<defs>${c.def}</defs>
${glyphMarkupRaw(raw, "#000000", c.fill, p.menubarInset ?? 1.0, shift)}
</svg>`;
      const f = join(dir, `${name}.svg`);
      writeFileSync(f, svg);
      for (const s of [18, 36, 54, 128]) png(f, join(dir, `${name}-${s}.png`), s);
    }
  }

  // Icon Composer file. The tile becomes the background fill (a gradient the
  // system lights), the ink and the dot become two glass layers. Xcode renders
  // every platform, appearance and size from this one file, and generates flat
  // PNGs for OS versions before Liquid Glass. Drop dist/<id>/AppIcon.icon into
  // the app target; it replaces the AppIcon asset catalog.
  const srgb = (hex) => "extended-srgb:" + [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(5)).join(",") + ",1.00000";
  const tile = p.tile ?? T.tile.dark;
  const glassGroup = (name) => ({
    name, layers: [{ "image-name": `${name}.svg`, name }],
    shadow: { kind: "neutral", opacity: 0.5 }, translucency: { enabled: true, value: 0.5 },
    specular: true, "blur-material": 0.5, lighting: "individual",
  });
  const iconJson = {
    fill: { "linear-gradient": [srgb(tile[0]), srgb(tile[2])] },
    groups: [glassGroup("core"), glassGroup("glyph")],
    "supported-platforms": { circles: ["watchOS"], squares: "shared" },
  };
  const idir = join(dir, "AppIcon.icon");
  mkdirSync(join(idir, "Assets"), { recursive: true });
  writeFileSync(join(idir, "icon.json"), JSON.stringify(iconJson, null, 2) + "\n");
  for (const which of ["glyph", "core"]) writeFileSync(join(idir, "Assets", `${which}.svg`), layer({ p, which }));

  for (const s of T.sizes) png(join(dir, "icon.svg"), join(dir, `icon-${s}.png`), s);
  png(join(dir, "appstore.svg"), join(dir, "appstore-1024.png"), 1024);
  if (p.macos) for (const s of T.sizes) png(join(dir, "icon-macos.svg"), join(dir, `macos-${s}.png`), s);

  // Classic asset catalog ("appiconset": true) for toolchains before Xcode 26, or wherever an
  // AppIcon.icon can't be used. Every iPhone and iPad slot plus the App Store marketing icon,
  // all rendered from the full-bleed appstore.svg: the system applies the mask, and the files
  // carry no alpha channel (App Store Connect rejects one). Flat, so no glass edge — prefer
  // AppIcon.icon on Xcode 26+; keep one or the other in the target, not both.
  if (p.appiconset && RSVG) {
    const slots = [
      ["iphone", 20, [2, 3]], ["iphone", 29, [2, 3]], ["iphone", 40, [2, 3]], ["iphone", 60, [2, 3]],
      ["ipad", 20, [1, 2]], ["ipad", 29, [1, 2]], ["ipad", 40, [1, 2]], ["ipad", 76, [1, 2]], ["ipad", 83.5, [2]],
      ["ios-marketing", 1024, [1]],
    ];
    const adir = join(dir, "AppIcon.appiconset");
    mkdirSync(adir, { recursive: true });
    const images = [];
    for (const [idiom, pt, scales] of slots) for (const sc of scales) {
      const px = Math.round(pt * sc), filename = `icon-${px}.png`;
      if (!images.some((i) => i.filename === filename)) png(join(dir, "appstore.svg"), join(adir, filename), px);
      images.push({ filename, idiom, scale: `${sc}x`, size: `${pt}x${pt}` });
    }
    writeFileSync(join(adir, "Contents.json"), JSON.stringify({ images, info: { author: "xcode", version: 1 } }, null, 2) + "\n");
  }

  console.log(`✓ ${id} → dist/${id} (${Object.keys(files).length} SVG, ${RSVG ? T.sizes.length + 1 : 0} PNG)`);
}
console.log("done");
