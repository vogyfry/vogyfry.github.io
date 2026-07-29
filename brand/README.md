# Prava Labs brand system

The identity is generated, not hand-cut. One glyph drawing + one tokens entry per
product; everything else — tiles, variants, every size — is produced by the generator.

## The system

- **Mark:** the "Core P" — a geometric P holding a solid core dot (your data, inside,
  never leaving). Only the studio mark carries the full spectrum.
- **Palette (the Prava Spectrum):** teal `#00D4AA` → cyan `#00B8FF` → blue `#3A92FF`
  → violet `#7C5CFC`. Each product owns exactly one hue — the colour of its core dot.
- **Icon rules:** deep-navy squircle, white line-work on a shared 256 grid
  (stroke ≈ 17–20, round caps), one core dot per glyph.

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

## Adding a new product

1. Add an entry to `tokens.json` — pick its spectrum hue (`core`), a darker
   `coreLight` for light backgrounds, and `tint`/`tintInk` shades.
2. Draw `glyphs/<id>.svg`: a 256-viewBox fragment, stroke `__INK__` at weight
   17–20 with round caps, plus **exactly one** `<circle r="17" fill="__CORE__">` —
   the core dot is the family signature, placed where the product's meaning lives.
3. `node brand/generate.mjs <id>`.

Design intent per existing glyph: TradeSocial — rising line, core at the pivot ·
Toolport — hub routing to servers, core at the junction · EAG — gateway chevrons,
core at the gate · Pravida — shield, core protected inside · Mavee — the day as one
loop, core on what matters.
