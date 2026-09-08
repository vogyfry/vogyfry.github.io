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
  | `app` — consumer app | teal `#00D4AA` | TradeSocial · BoatNavi · Waypoint · Mavee · Pravida |
  | `tool` — developer tool | cyan `#00B8FF` | Toolport · SwiftMind |
  | `enterprise` — enterprise platform | blue `#3A92FF` | EAG · Prava Loom |

  A reader can tell what a product *is* before reading its name. Products are told
  apart by their glyph, which is the part actually drawn for them. Violet is
  unassigned and held for a fourth kind. The studio mark is the exception: it carries
  the full spectrum gradient, and no kind.
- **Icon rules:** deep-navy squircle, white line-work on a shared 256 grid
  (stroke ≈ 17–20, round caps), one core dot per glyph. **Every product shares the same
  navy tile** — a product that paints its own background stops reading as one of the
  family, which is why Loom's violet tile was removed.

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
| `icon-light.svg` | navy ink on light tile — light backgrounds |
| `icon-tint.svg` | product-hue tinted tile (iOS 18 tinted mode reference) |
| `glyph.svg` / `glyph-dark.svg` | bare glyph, no tile — lockups, headers |
| `icon-macos.svg` / `macos-{16…1024}.png` | Mac apps — the tile inset on Apple's 824-in-1024 grid, since macOS applies no mask of its own. Opt in with `"macos": true` |

## Adding a new product

1. Add an entry to `tokens.json` — `name`, `glyph`, and its `kind`
   (`app` / `tool` / `enterprise`), which is where every colour comes from. Naming a
   `core` on the product itself overrides the kind, so do it only with a reason.
2. Draw `glyphs/<id>.svg`: a 256-viewBox fragment, stroke `__INK__` at weight
   17–20 with round caps, plus **exactly one** `<circle r="17" fill="__CORE__">` —
   the core dot is the family signature, placed where the product's meaning lives.
3. `node brand/generate.mjs <id>`.

Design intent per existing glyph: TradeSocial — rising line, core at the pivot ·
Toolport — hub routing to servers, core at the junction · EAG — gateway chevrons,
core at the gate · Pravida — shield, core protected inside · Waypoint — the destination
pin, core at the point you actually reach · BoatNavi — the vessel underway over water,
core at the boat · SwiftMind — the chip, core inside it, because the model never leaves
your silicon · Mavee — the day as one loop, core on what matters. · Loom — warp and weft, core where the threads cross, because the connection is woven, watched, and mended there.
