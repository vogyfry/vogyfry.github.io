# Prava Labs brand system

The identity is generated, not hand-cut. One glyph drawing + one tokens entry per
product; everything else — tiles, variants, every size — is produced by the generator.

## The system

- **Mark:** the "Core P" — a geometric P holding a solid core dot (your data, inside,
  never leaving). Only the studio mark carries the full spectrum.
- **Palette (the Prava Spectrum):** teal `#00D4AA` → cyan `#00B8FF` → blue `#3A92FF`
  → violet `#7C5CFC`.
- **The dot names the kind, not the product.** Every product declares a `kind` in
  `tokens.json`, and the kind supplies the core dot's colour:

  | Kind | Core | Products |
  |---|---|---|
  | `app` — Consumer App | teal `#00D4AA` | TradeSocial · BoatNavi · Waypoint · Mavee · Pravida |
  | `tool` — Developer Tool | cyan `#00B8FF` | Toolport · SwiftMind |
  | `enterprise` — Enterprise Platform | violet `#A78BFA` | EAG · Prava Loom |

  A reader can tell what a product *is* before reading its name. Products are told
  apart by their glyph, which is the part actually drawn for them. The three hues sit
  29° and 58° apart, so no two kinds read as one colour; blue `#3A92FF` is unassigned
  and held for a fourth kind. Violet was Loom's from the start and the enterprise kind
  inherited it rather than the other way round. The studio mark is the exception: it
  carries the full spectrum gradient, and no kind.
- **Icon rules:** navy squircle, white line-work on a shared 256 grid (stroke ≈ 17–20,
  round caps), one core dot per glyph. **The tile belongs to the kind, not the product** —
  consumer apps sit on a teal-leaning navy, developer tools on a cyan navy, enterprise on
  a violet navy — so tile and dot say the same thing. All three sit at the same brightness
  (luminance ≈ 40–80 on the tile), which is the midpoint between the near-black tile the
  family launched with and the vivid blue of EAG's original mark: bright enough to read
  as a tile on a black page, dark enough that every dot still clears 4:1 on its own tile.
  No product gets its own tile; Loom's violet one was removed for that reason.

## Generate

```bash
node brand/generate.mjs            # everything
node brand/generate.mjs toolport   # one product
```

PNG output needs `rsvg-convert` (`brew install librsvg`); without it you still get SVGs.

Per product, `dist/<id>/` contains:

| File | Use |
|---|---|
| `icon.svg` + `icon-{16…1024}.png` | squircle icon, transparent corners — web, favicons, docs |
| `appstore.svg` / `appstore-1024.png` | full-bleed square, no rounding — App Store Connect (Apple applies the mask) |
| `icon-mono.svg` | white core — one-colour contexts |
| `icon-light.svg` | the **light tile**: navy ink and the darker core on `#f2f6fd`. For placing the icon on a light background — it is not a light-mode app icon; the app icon is `icon.svg` in every mode |
| `icon-tint.svg` | product-hue tinted tile (iOS 18 tinted mode reference) |
| `glyph-on-dark.svg` | bare glyph, no tile, **white ink** — for dark grounds: lockups, headers |
| `glyph-on-light.svg` | bare glyph, no tile, **navy ink** — for light grounds |

Variants are named for the ground they sit on, never for the colour of their ink.
| `icon-macos.svg` / `macos-{16…1024}.png` | Mac apps on macOS 15 and earlier — the tile inset on Apple's 824-in-1024 grid, since old macOS applies no mask of its own. Opt in with `"macos": true`. On macOS 26+ ship `AppIcon.icon` instead |
| `AppIcon.icon/` | **The app icon for iOS, iPadOS, macOS and watchOS 26+.** An Icon Composer file: the tile as the background fill, the ink and the core dot as two glass layers. Xcode renders every platform, size and appearance (default, dark, clear, tinted) from it and generates flat PNGs for older OS versions. Add it to the app target and delete `AppIcon.appiconset`; with xcodegen declare it as `type: file`, `buildPhase: resources`, and exclude it from the folder scan |
| `menubar-template.svg` / `menubar-template-{18,36,54,128}.png` | Mac menu-bar apps — the bare glyph in black on transparent, sized to fill its box like an SF Symbol; the app marks it `isTemplate` and AppKit tints it. Same mark as the Dock icon. Opt in with `"menubar": true` |
| `layers/` | the same three layers as loose SVG + 1024 PNG (`tile`, `glyph`, `core`) for hand assembly in Icon Composer or any other layered format |

## Why layers

Apple's icons are layered. The system draws a live glass edge, highlight and shadow on
each layer, adapted to whatever sits behind the icon, which is why Xcode's tile reads
on a dark Mac Dock and a frosted iPad Dock alike. A flat PNG gets none of that: its edge
is only the tile's own colour, and every flat tile matches some Dock somewhere — the
family navy vanished on the dark Mac Dock, and a lifted tile vanished on the iPad's
(Sep 2026). The HIG's rules follow from this: one design on every platform, no baked
highlights or rims, let the system handle the effects. So the tile colour stays what
the brand says, and the edge comes from `AppIcon.icon`.

## Adding a new product

1. Add an entry to `tokens.json` — `name`, `glyph`, and its `kind`
   (`app` / `tool` / `enterprise`), which is where every colour comes from. Naming a
   `core` on the product itself overrides the kind, so do it only with a reason.
2. Draw `glyphs/stroked/<id>.svg`: a 256-viewBox fragment, white line-work with round caps,
   plus **exactly one** core dot (`fill="__CORE__"`) placed where the product's meaning
   lives. Draw it at whatever size reads well; the next step sizes it.
3. `python3 brand/tools/outline.py brand/glyphs/stroked/<id>.svg` writes `glyphs/<id>.svg`
   with every stroke baked into filled outline geometry (`pip install shapely svgpathtools`
   once). **Never hand-edit `glyphs/<id>.svg`**: macOS 26's live icon renderer draws
   stroked circles as rounded squares and ignores round caps, so the file the generator
   reads must contain fills only. The conversion is checked at 1024 px: every glyph came
   out within 0.2% of its stroked ink. Toolport's outline was drawn by hand and has no
   stroked source.
4. `node brand/generate.mjs <id>`, then **measure, don't eyeball**. Every product is
   held to the same three numbers on the rendered 1024 icon: the glyph's ink fills
   **66%** of the tile (Apple's own glyphs sit at 62–70%), the line is **68 px**, the
   dot is **60 px** radius, and the ink's bounding box is **centred on the tile to
   within 2 px**. Set `glyphInset` for the fill, scale the glyph's stroke widths and
   dot radius to hit the line and dot, and wrap the fragment in
   `<g transform="translate(dx dy)" data-centre="1">` for the centring. Every existing
   glyph carries that translate; it is the record of how far off-centre the hand
   drawing was. SwiftMind sits at 70%: its pins are what the measurement sees, and
   the body they surround is what the eye sees, so it needs the extra to *look* equal.

Design intent per existing glyph: TradeSocial — rising line, core at the pivot ·
Toolport — hub routing to servers, core at the junction · EAG — gateway chevrons,
core at the gate · Pravida — shield, core protected inside · Waypoint — the destination
pin, core at the point you actually reach · BoatNavi — the vessel underway over water,
core at the boat · SwiftMind — the chip, core inside it, because the model never leaves
your silicon · Mavee — the day as one loop, core on what matters. · Loom — warp and weft, core where the threads cross, because the connection is woven, watched, and mended there.
