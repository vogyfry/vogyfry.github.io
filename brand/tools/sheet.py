"""The whole family on one page: brand/sheet.html, built from tokens.json and dist/.

    python3 brand/tools/sheet.py                  # writes brand/sheet.html
    python3 brand/tools/sheet.py --fragment OUT   # body-only page, for publishing as an Artifact

Run it after `node brand/generate.mjs`; every icon, colour and number comes from the
generated set, so the sheet cannot drift from what the apps ship. Adding a product
means adding it to INTENT and ORDER below (the assert fails until you do).
"""
import base64
import html
import json
import sys
from pathlib import Path

BRAND = Path(__file__).resolve().parents[1]
FRAGMENT = "--fragment" in sys.argv
OUT = Path(sys.argv[sys.argv.index("--fragment") + 1]) if FRAGMENT else BRAND / "sheet.html"
T = json.loads((BRAND / "tokens.json").read_text())

INTENT = {
    "prava": "The Core P: a geometric P holding a solid core dot. Your data, inside, never leaving. The only mark that carries the full spectrum.",
    "tradesocial": "A rising line, core at the pivot.",
    "boatnavi": "The vessel underway over water, core at the boat.",
    "waypoint": "The destination pin, core at the point you actually reach.",
    "mavee": "The day as one loop, core on what matters.",
    "pravida": "A shield, core protected inside.",
    "timekeeper": "The clock at ten past ten, its hands a check mark, core at the pivot.",
    "echobridge": "Two speech bubbles in conversation, core inside the reply that reaches you.",
    "toolport": "A hub routing to servers, core at the junction.",
    "swiftmind": "The chip, core inside it, because the model never leaves your silicon.",
}
ORDER = {"app": ["tradesocial", "boatnavi", "waypoint", "pravida", "mavee", "timekeeper", "echobridge"],
         "tool": ["toolport", "swiftmind"]}
assert set(ORDER["app"] + ORDER["tool"] + ["prava"]) == set(T["products"]), "tokens.json has products the sheet doesn't list"


def uri(pid, name="icon.svg"):
    return "data:image/svg+xml;base64," + base64.b64encode((BRAND / "dist" / pid / name).read_bytes()).decode()


def img(pid, name="icon.svg", cls="", alt=""):
    return f'<img class="{cls}" src="{uri(pid, name)}" alt="{html.escape(alt)}">'


def card(pid):
    p = T["products"][pid]
    return f"""
      <article class="card">
        {img(pid, cls="tile", alt=p["name"] + " icon")}
        <div class="card-text">
          <h3>{html.escape(p["name"])}</h3>
          <p>{html.escape(INTENT[pid])}</p>
          <p class="spec"><span>{pid}</span><span>inset {p.get("glyphInset", T["glyphInset"])}</span>{"<span>Mac</span>" if p.get("macos") else ""}{"<span>Menu bar</span>" if p.get("menubar") else ""}</p>
        </div>
      </article>"""


def kind_section(kid, heading, blurb):
    k = T["kinds"][kid]
    stops = ", ".join(k["tile"])
    cards = "".join(card(pid) for pid in ORDER[kid])
    return f"""
  <section class="kind" aria-labelledby="k-{kid}">
    <header class="kind-head">
      <div class="kind-title">
        <span class="dot" style="background:{k['core']}"></span>
        <h2 id="k-{kid}">{heading}</h2>
        <span class="count">{len(ORDER[kid])}</span>
      </div>
      <p>{blurb}</p>
      <p class="kind-swatches"><span class="chip"><i style="background:{k['core']}"></i>Core {k['core'].upper()}</span><span class="chip"><i style="background:linear-gradient(180deg,{stops})"></i>Tile {' → '.join(s.upper() for s in k['tile'])}</span></p>
    </header>
    <div class="grid">{cards}
    </div>
  </section>"""


all_ids = ["prava"] + ORDER["app"] + ORDER["tool"]
dock = "".join(f'<figure>{img(pid, alt=T["products"][pid]["name"])}<figcaption>{html.escape(T["products"][pid]["name"].replace("Prava ", "") if pid != "prava" else "Prava")}</figcaption></figure>' for pid in all_ids)
spectrum = T["spectrum"]
spectrum_stops = "".join(f'<li><span style="background:{c}"></span><code>{c.upper()}</code></li>' for c in spectrum)

VARIANTS = [
    ("icon.svg", "App icon", "Every mode. The tile belongs to the kind."),
    ("icon-light.svg", "Light tile", "For placing the icon on a light page."),
    ("icon-mono.svg", "Mono", "White core, for one-colour contexts."),
    ("icon-tint.svg", "Tinted", "iOS tinted-mode reference."),
    ("glyph-on-dark.svg", "Glyph on dark", "Bare glyph, white ink."),
    ("glyph-on-light.svg", "Glyph on light", "Bare glyph, navy ink."),
]
variants = "".join(
    f'<figure class="variant {"on-light" if "light" in f else ""}">{img("echobridge", f, alt=label)}<figcaption><strong>{label}</strong><span>{note}</span></figcaption></figure>'
    for f, label, note in VARIANTS
)

page = f"""<title>Prava Labs Brand Sheet</title>
<meta name="robots" content="noindex">
<meta name="description" content="Every Prava Labs app icon, the kinds that colour them, the palette and the icon rules.">
<style>
/* Layout: one column of sections on the brand's black ground; product cards in a wrapping grid, grouped by kind. */
:root {{
  --ground: #000;
  --surface: #0d1116;
  --line: rgba(140, 190, 255, 0.12);
  --text: #f5f5f7;
  --muted: #8b93a0;
  --teal: #00d4aa;
  --cyan: #00b8ff;
  --dock: #3a3a3a;
  --display: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif;
  --body: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
  --mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
  color-scheme: dark;
}}
@media (prefers-color-scheme: light) {{
  :root:not([data-theme="dark"]) {{ --ground: #f2f6fd; --surface: #ffffff; --line: rgba(10, 30, 70, 0.10); --text: #0d2149; --muted: #55607a; --dock: #d9dee8; color-scheme: light; }}
}}
:root[data-theme="light"] {{ --ground: #f2f6fd; --surface: #ffffff; --line: rgba(10, 30, 70, 0.10); --text: #0d2149; --muted: #55607a; --dock: #d9dee8; color-scheme: light; }}

* {{ box-sizing: border-box; }}
body {{ background: var(--ground); color: var(--text); font-family: var(--body); font-size: 15px; line-height: 1.55; -webkit-font-smoothing: antialiased; }}
.wrap {{ max-width: 1180px; margin: 0 auto; padding-inline: clamp(16px, 4vw, 40px); padding-block: 48px 80px; display: grid; gap: 72px; }}
h1, h2, h3 {{ font-family: var(--display); margin: 0; text-wrap: balance; letter-spacing: -0.02em; }}
p {{ margin: 0; }}
code, .spec, .count, .eyebrow {{ font-family: var(--mono); }}
.eyebrow {{ font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); }}

/* Masthead */
.mast {{ display: grid; grid-template-columns: auto 1fr; gap: 28px; align-items: center; }}
.mast img {{ width: 112px; height: 112px; }}
.mast h1 {{ font-size: clamp(2rem, 5vw, 3.1rem); font-weight: 700; line-height: 1.05; }}
.mast .lede {{ color: var(--muted); max-width: 62ch; margin-top: 12px; font-size: 1.02rem; }}
.mast .stats {{ display: flex; flex-wrap: wrap; gap: 8px 22px; margin-top: 16px; font-family: var(--mono); font-size: 12px; color: var(--muted); }}
.mast .stats b {{ color: var(--text); font-weight: 600; }}
@media (max-width: 560px) {{ .mast {{ grid-template-columns: 1fr; }} .mast img {{ width: 84px; height: 84px; }} }}

/* Dock strip */
.dock {{ background: var(--dock); border-radius: 22px; padding: 18px 20px 12px; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 14px; }}
.dock figure {{ margin: 0; display: grid; justify-items: center; gap: 6px; width: 64px; }}
.dock img {{ width: 44px; height: 44px; }}
.dock figcaption {{ font-size: 10.5px; color: var(--muted); text-align: center; line-height: 1.2; }}
.section-head {{ display: grid; gap: 6px; margin-bottom: 20px; }}
.section-head h2 {{ font-size: 1.5rem; }}
.section-head p:not(.eyebrow) {{ color: var(--muted); max-width: 66ch; }}

/* Kind sections */
.kind {{ display: grid; gap: 22px; }}
.kind-head {{ display: grid; gap: 8px; border-top: 1px solid var(--line); padding-top: 22px; }}
.kind-title {{ display: flex; align-items: center; gap: 12px; }}
.kind-title h2 {{ font-size: 1.5rem; }}
.dot {{ width: 14px; height: 14px; border-radius: 50%; flex: none; }}
.count {{ font-size: 12px; color: var(--muted); border: 1px solid var(--line); border-radius: 999px; padding: 1px 9px; }}
.kind-head > p {{ color: var(--muted); max-width: 66ch; }}
.kind-swatches {{ display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }}
.chip {{ display: inline-flex; align-items: center; gap: 8px; font-family: var(--mono); font-size: 11.5px; color: var(--text); background: var(--surface); border: 1px solid var(--line); border-radius: 999px; padding: 5px 12px 5px 6px; }}
.chip i {{ width: 18px; height: 18px; border-radius: 50%; display: block; }}
.grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr)); gap: 14px; }}
.card {{ display: grid; grid-template-columns: 96px 1fr; gap: 18px; align-items: start; background: var(--surface); border: 1px solid var(--line); border-radius: 20px; padding: 18px; }}
.card .tile {{ width: 96px; height: 96px; }}
.card-text {{ display: grid; gap: 6px; min-width: 0; }}
.card h3 {{ font-size: 1.12rem; font-weight: 650; }}
.card p {{ color: var(--muted); font-size: 0.92rem; }}
.spec {{ display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }}
.spec span {{ font-size: 10.5px; color: var(--muted); border: 1px solid var(--line); border-radius: 6px; padding: 1px 7px; }}

/* Palette */
.spectrum-bar {{ height: 64px; border-radius: 16px; background: linear-gradient(90deg, {", ".join(spectrum)}); }}
.spectrum-stops {{ list-style: none; padding: 0; margin: 12px 0 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }}
.spectrum-stops li {{ display: flex; align-items: center; gap: 8px; font-size: 12px; min-width: 0; }}
.spectrum-stops span {{ width: 14px; height: 14px; border-radius: 50%; flex: none; }}
.spectrum-stops code {{ color: var(--muted); overflow-wrap: anywhere; }}
.ground-pair {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 12px; margin-top: 20px; }}
.ground {{ border-radius: 16px; padding: 16px 18px; border: 1px solid var(--line); display: flex; align-items: center; gap: 14px; }}
.ground img {{ width: 52px; height: 52px; }}
.ground div {{ display: grid; gap: 2px; font-size: 13px; }}
.ground code {{ font-size: 11.5px; opacity: 0.75; }}

/* Rules */
.rules {{ display: grid; grid-template-columns: minmax(0, 340px) 1fr; gap: 36px; align-items: center; }}
.anatomy {{ position: relative; width: 100%; max-width: 340px; aspect-ratio: 1; }}
.anatomy img, .anatomy svg {{ position: absolute; inset: 0; width: 100%; height: 100%; }}
.anatomy svg text {{ font-family: var(--mono); font-size: 34px; fill: #ffd166; }}
.measures {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr)); gap: 10px; }}
.measure {{ background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 14px 16px; display: grid; gap: 2px; }}
.measure b {{ font-family: var(--display); font-size: 1.7rem; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }}
.measure span {{ font-size: 12.5px; color: var(--muted); }}
.rule-notes {{ display: grid; gap: 10px; margin-top: 18px; color: var(--muted); max-width: 64ch; }}
.rule-notes strong {{ color: var(--text); font-weight: 600; }}
@media (max-width: 760px) {{ .rules {{ grid-template-columns: 1fr; }} }}

/* Variants */
.variants {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 160px), 1fr)); gap: 12px; }}
.variant {{ margin: 0; background: #000; border: 1px solid var(--line); border-radius: 18px; padding: 18px 14px 14px; display: grid; justify-items: center; gap: 12px; }}
.variant.on-light {{ background: #f2f6fd; }}
.variant img {{ width: 88px; height: 88px; }}
.variant figcaption {{ display: grid; gap: 2px; text-align: center; font-size: 12px; }}
.variant figcaption strong {{ color: #f5f5f7; font-weight: 600; }}
.variant figcaption span {{ color: #8b93a0; }}
.variant.on-light figcaption strong {{ color: #0d2149; }}
.variant.on-light figcaption span {{ color: #55607a; }}

footer {{ border-top: 1px solid var(--line); padding-top: 20px; color: var(--muted); font-size: 12.5px; display: flex; flex-wrap: wrap; gap: 6px 18px; }}
footer code {{ font-size: 12px; }}
</style>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap">

<main class="wrap">
  <header class="mast">
    {img("prava", alt="Prava Labs mark")}
    <div>
      <p class="eyebrow">Prava Labs · Brand System</p>
      <h1>One glyph per product. Everything else is generated.</h1>
      <p class="lede">{html.escape(INTENT["prava"])} Each product adds one line drawing and one tokens entry; tiles, sizes and variants come from the generator.</p>
      <p class="stats"><span><b>{len(ORDER["app"]) + len(ORDER["tool"])}</b> products</span><span><b>2</b> kinds in use</span><span><b>{T["grid"]}</b> px grid</span><span><b>{int(T["cornerRadiusRatio"] * 100)}%</b> corner radius</span></p>
    </div>
  </header>

  <section aria-labelledby="dock-h">
    <div class="section-head">
      <p class="eyebrow">At Dock size</p>
      <h2 id="dock-h">The whole family at 44 px</h2>
      <p>The size people actually see. Every glyph is held to the same fill, line and dot, so no icon looks heavier than its neighbours.</p>
    </div>
    <div class="dock">{dock}</div>
  </section>

  {kind_section("app", "Consumer Apps", "Phone, tablet, watch and Mac apps for everyday life. A teal core on a teal-leaning navy tile.")}
  {kind_section("tool", "Developer Tools", "Tools for people building with AI agents and models. A cyan core on a cyan navy tile.")}

  <section aria-labelledby="pal-h">
    <div class="section-head">
      <p class="eyebrow">Palette</p>
      <h2 id="pal-h">The Prava Spectrum</h2>
      <p>Teal to violet. Only the studio mark carries the full gradient; each product takes one colour from it through its kind. Blue is held for a future kind.</p>
    </div>
    <div class="spectrum-bar" role="img" aria-label="Spectrum gradient from teal to violet"></div>
    <ul class="spectrum-stops">{spectrum_stops}</ul>
    <div class="ground-pair">
      <div class="ground" style="background:#000;color:#f5f5f7">{img("prava", "glyph-on-dark.svg", alt="")}<div><strong>Ink on dark</strong><code>{T["ink"]["dark"].upper()} on #000000</code></div></div>
      <div class="ground" style="background:{T["tile"]["light"]};color:{T["ink"]["light"]}">{img("prava", "glyph-on-light.svg", alt="")}<div><strong>Ink on light</strong><code>{T["ink"]["light"].upper()} on {T["tile"]["light"].upper()}</code></div></div>
    </div>
  </section>

  <section aria-labelledby="rules-h">
    <div class="section-head">
      <p class="eyebrow">Icon rules</p>
      <h2 id="rules-h">Measured, not eyeballed</h2>
      <p>Every icon is checked on its rendered 1024 px tile against the same four numbers.</p>
    </div>
    <div class="rules">
      <div class="anatomy" role="img" aria-label="EchoBridge icon with its 66 percent ink box marked">
        {img("echobridge", alt="")}
        <svg viewBox="0 0 1024 1024" aria-hidden="true">
          <rect x="174" y="174" width="676" height="676" fill="none" stroke="#ffd166" stroke-width="4" stroke-dasharray="18 12"/>
          <line x1="512" y1="150" x2="512" y2="874" stroke="#ffd166" stroke-width="2" opacity="0.5"/>
          <line x1="150" y1="512" x2="874" y2="512" stroke="#ffd166" stroke-width="2" opacity="0.5"/>
          <text x="186" y="160">66%</text>
        </svg>
      </div>
      <div>
        <div class="measures">
          <div class="measure"><b>66%</b><span>Ink fills the tile (Apple's own: 62–70%)</span></div>
          <div class="measure"><b>68 px</b><span>Line weight at 1024</span></div>
          <div class="measure"><b>60 px</b><span>Core dot radius at 1024</span></div>
          <div class="measure"><b>≤ 2 px</b><span>Ink box off the tile's centre</span></div>
        </div>
        <div class="rule-notes">
          <p><strong>One core dot per glyph,</strong> placed where the product's meaning lives. Its colour names the kind, not the product.</p>
          <p><strong>Glyphs ship as filled outlines.</strong> Drawn with round-capped strokes, then baked to fills, because macOS 26 and iOS 26 draw stroked circles as rounded squares.</p>
          <p><strong>The edge comes from layers.</strong> Apps ship the layered <code>AppIcon.icon</code>; the system adds the glass edge. Tiles are never recoloured to stand out on a Dock.</p>
        </div>
      </div>
    </div>
  </section>

  <section aria-labelledby="var-h">
    <div class="section-head">
      <p class="eyebrow">Variants · shown with EchoBridge</p>
      <h2 id="var-h">Named for the ground they sit on</h2>
      <p>Every product gets the same set from the generator, along with every PNG size from 16 to 1024 px, a full-bleed App Store square, and the layered Icon Composer file.</p>
    </div>
    <div class="variants">{variants}</div>
  </section>

  <footer>
    <span>Source: <code>vogyfry.github.io/brand</code></span>
    <span>Regenerate: <code>node brand/generate.mjs &lt;product&gt;</code></span>
  </footer>
</main>
"""
if not FRAGMENT:
    page = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' + page.replace("\n<main", "\n</head>\n<body>\n<main", 1) + "</body>\n</html>\n"
OUT.write_text(page)
print(OUT, f"{len(page) / 1024:.0f} KB")
