"""Turn every stroked element in a brand glyph into filled outlines with the caps and
joins baked into the geometry, because macOS 26's live icon renderer draws stroked
circles as rounded squares and ignores round caps. Strokes become shapely buffers,
unioned per glyph, emitted as one evenodd path. The core dot is untouched.

Usage: python3 brand/tools/outline.py brand/glyphs/stroked/<id>.svg [...]
Reads the stroked drawing, writes brand/glyphs/<id>.svg; then run generate.mjs.
Needs: pip install shapely svgpathtools"""
import re, sys, math, xml.etree.ElementTree as ET
from svgpathtools import parse_path
from shapely.geometry import LineString, LinearRing, Point, Polygon
from shapely.ops import unary_union
STEP=0.35  # sampling spacing on the 256 grid (≈1.4 px at 1024)
def sample(d):
    path=parse_path(d); pts=[]
    for seg in path:
        n=max(2,int(seg.length()/STEP)+1)
        for i in range(n):
            z=seg.point(i/(n-1)); pts.append((z.real,z.imag))
    closed = d.strip().lower().endswith("z") or (abs(path[0].start-path[-1].end)<1e-6)
    return pts, closed
def rounded_rect(x,y,w,h,rx):
    pts=[]
    corners=[(x+w-rx,y+rx,-90,0),(x+w-rx,y+h-rx,0,90),(x+rx,y+h-rx,90,180),(x+rx,y+rx,180,270)]
    for cx,cy,a0,a1 in corners:
        for k in range(0,25):
            a=math.radians(a0+(a1-a0)*k/24); pts.append((cx+rx*math.cos(a),cy+rx*math.sin(a)))
    return pts
def geom_for(el, inh):
    tag=el.tag.split('}')[-1]
    a={**inh, **el.attrib}
    if a.get("stroke")!="__INK__": return None
    w=float(a.get("stroke-width","1")); cap=a.get("stroke-linecap","butt"); join=a.get("stroke-linejoin","miter")
    cs={"round":"round","butt":"flat","square":"square"}[cap]; js={"round":"round","miter":"mitre","bevel":"bevel"}[join]
    if tag=="path":
        pts,closed=sample(a["d"])
        base=LinearRing(pts) if closed and len(pts)>3 else LineString(pts)
        return base.buffer(w/2, cap_style=cs, join_style="round" if closed else js, quad_segs=32)
    if tag=="rect":
        pts=rounded_rect(float(a["x"]),float(a["y"]),float(a["width"]),float(a["height"]),float(a.get("rx",0)))
        return LinearRing(pts).buffer(w/2, join_style="round", quad_segs=32)
    if tag=="circle":
        return Point(float(a["cx"]),float(a["cy"])).buffer(float(a["r"]),quad_segs=64).exterior.buffer(w/2, join_style="round", quad_segs=32)
    if tag=="line":
        return LineString([(float(a["x1"]),float(a["y1"])),(float(a["x2"]),float(a["y2"]))]).buffer(w/2, cap_style=cs, join_style=js, quad_segs=32)
    return None
def walk(el, inh, out):
    tag=el.tag.split('}')[-1]
    inh2={**inh, **{k:v for k,v in el.attrib.items() if k in ("stroke","stroke-width","stroke-linecap","stroke-linejoin","fill")}}
    g=geom_for(el, inh)
    if g is not None: out.append(g)
    for c in el: walk(c, inh2, out)
def ring_d(coords):
    return "M"+" L".join(f"{x:.2f} {y:.2f}" for x,y in coords[:-1])+" Z"
def poly_d(p):
    return ring_d(list(p.exterior.coords))+"".join(" "+ring_d(list(i.coords)) for i in p.interiors)
def convert(path):
    src=open(path).read()
    comment=re.search(r"<!--.*?-->",src,re.S); comment=comment.group(0) if comment else ""
    body=src.replace(comment,"",1).strip()
    root=ET.fromstring("<svg xmlns='http://www.w3.org/2000/svg'>"+body+"</svg>")
    geoms=[]; walk(root,{},geoms)
    union=unary_union(geoms).simplify(0.04)
    polys=[union] if union.geom_type=="Polygon" else list(union.geoms)
    d=" ".join(poly_d(p) for p in polys)
    ink=f'<path fill="__INK__" fill-rule="evenodd" d="{d}"/>'
    core=re.search(r'<circle[^>]*fill="__CORE__"[^>]*/>',body).group(0)
    m=re.match(r'(<g transform="[^"]*" data-centre="1">)',body)
    wrap_open=m.group(1) if m else '<g data-centre="1">'
    note="<!-- Filled outlines only (no strokes): macOS 26's live icon renderer draws stroked circles as rounded squares and ignores round caps, so every stroke is baked into its outline geometry (brand/tools/outline.py). The stroked drawing lives in glyphs/stroked/; edit it there, then `python3 brand/tools/outline.py brand/glyphs/stroked/<id>.svg` writes this file. -->"
    new=f"{comment}\n{note}\n{wrap_open}\n  {ink}\n  {core}\n</g>\n"
    out=path.replace("/stroked/","/") if "/stroked/" in path else path
    open(out,"w").write(new)
    return out, len(geoms), len(polys), len(d)
for f in sys.argv[1:]:
    print(f, convert(f))
