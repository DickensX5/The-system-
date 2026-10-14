#!/usr/bin/env python3
"""
THE SYSTEM - brand asset generator.

One geometry definition draws BOTH the SVG artwork and the Pillow PNG icons,
so the logo, app icons, favicon and splash mark always match.

Run from the project root:   python3 tools/make_icons.py
Requires: Pillow (pip install pillow)
"""
import math
import os
from PIL import Image, ImageDraw, ImageFilter, ImageChops

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRAND = os.path.join(ROOT, "assets", "branding")
FAV = os.path.join(ROOT, "assets", "favicon")
os.makedirs(BRAND, exist_ok=True)
os.makedirs(FAV, exist_ok=True)

S = 1024                      # master canvas
CX = CY = 512
BG = (5, 6, 10)               # near-black foundation

# ------------------------------------------------------------------ geometry
def chevron(ay, w, h, t, cx=CX):
    """Upward chevron polygon (apex at ay)."""
    return [(cx, ay), (cx + w, ay + h), (cx + w, ay + h + t),
            (cx, ay + t), (cx - w, ay + h + t), (cx - w, ay + h)]

# bottom -> top : widest to narrowest (ascending power)
CHEVRONS = [
    dict(poly=chevron(560, 240, 150, 62), top=(150, 140, 255), bot=(92, 80, 255)),
    dict(poly=chevron(450, 180, 115, 52), top=(205, 210, 255), bot=(130, 125, 255)),
    dict(poly=chevron(350, 118, 80, 42), top=(248, 249, 255), bot=(190, 205, 255)),
]
DIAMOND = [(512, 220), (562, 270), (512, 320), (462, 270)]
RING_R = 372
RING_W = 16
ARC_SPAN = 66
# quest arcs: centre angle (deg, clockwise from +x, y-down), colour
ARCS = [
    (225, (25, 195, 125)),   # Financial  - emerald
    (315, (255, 106, 43)),   # Physique   - ember orange
    (135, (61, 123, 255)),   # Intelligence - electric blue
    (45,  (224, 33, 74)),    # Romance    - crimson
]
CARDINALS = [270, 0, 90, 180]  # gap centres, small silver diamonds sit here
GLOW = (118, 92, 255)


def polar(r, deg):
    a = math.radians(deg)
    return (CX + r * math.cos(a), CY + r * math.sin(a))


def hex_(c):
    return "#%02x%02x%02x" % c


# ------------------------------------------------------------------ SVG
def emblem_svg_body(uid="s"):
    """Returns (defs, body) strings for the emblem, no background."""
    defs = []
    body = []
    for i, c in enumerate(CHEVRONS):
        ys = [p[1] for p in c["poly"]]
        defs.append(
            f'<linearGradient id="{uid}c{i}" gradientUnits="userSpaceOnUse" x1="0" y1="{min(ys)}" x2="0" y2="{max(ys)}">'
            f'<stop offset="0" stop-color="{hex_(c["top"])}"/><stop offset="1" stop-color="{hex_(c["bot"])}"/></linearGradient>')
    defs.append(
        f'<linearGradient id="{uid}d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/>'
        f'<stop offset="1" stop-color="#bfe0ff"/></linearGradient>')
    defs.append(f'<filter id="{uid}g" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="26"/></filter>')
    defs.append(f'<radialGradient id="{uid}v" cx="50%" cy="50%" r="55%"><stop offset="0" stop-color="{hex_(GLOW)}" stop-opacity=".22"/>'
                f'<stop offset="1" stop-color="{hex_(GLOW)}" stop-opacity="0"/></radialGradient>')
    body.append(f'<circle cx="{CX}" cy="{CY}" r="430" fill="url(#{uid}v)"/>')
    # inner hairline ring
    body.append(f'<circle cx="{CX}" cy="{CY}" r="338" fill="none" stroke="#c9cdf5" stroke-opacity=".28" stroke-width="3"/>')
    # quest arcs
    for ang, col in ARCS:
        a0, a1 = ang - ARC_SPAN / 2, ang + ARC_SPAN / 2
        x0, y0 = polar(RING_R, a0)
        x1, y1 = polar(RING_R, a1)
        body.append(f'<path d="M{x0:.1f} {y0:.1f} A{RING_R} {RING_R} 0 0 1 {x1:.1f} {y1:.1f}" fill="none" '
                    f'stroke="{hex_(col)}" stroke-width="{RING_W}" stroke-linecap="round"/>')
    # cardinal studs
    for ang in CARDINALS:
        x, y = polar(RING_R, ang)
        body.append(f'<path d="M{x:.1f} {y-16:.1f} L{x+12:.1f} {y:.1f} L{x:.1f} {y+16:.1f} L{x-12:.1f} {y:.1f}Z" fill="#dfe3ff"/>')
    # glow layer
    glow_shapes = "".join(
        f'<polygon points="{" ".join(f"{x},{y}" for x, y in c["poly"])}"/>' for c in CHEVRONS)
    glow_shapes += f'<polygon points="{" ".join(f"{x},{y}" for x, y in DIAMOND)}"/>'
    body.append(f'<g fill="{hex_(GLOW)}" opacity=".85" filter="url(#{uid}g)">{glow_shapes}</g>')
    for i, c in enumerate(CHEVRONS):
        body.append(f'<polygon points="{" ".join(f"{x},{y}" for x, y in c["poly"])}" fill="url(#{uid}c{i})"/>')
    body.append(f'<polygon points="{" ".join(f"{x},{y}" for x, y in DIAMOND)}" fill="url(#{uid}d)"/>')
    return "".join(defs), "".join(body)


def write_svg(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def svg_logo():
    defs, body = emblem_svg_body("L")
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}" role="img" aria-label="THE SYSTEM logo">'
            f'<title>THE SYSTEM</title><defs>{defs}</defs>'
            f'<rect width="{S}" height="{S}" fill="{hex_(BG)}"/>{body}</svg>')


def svg_app_icon(maskable=False):
    defs, body = emblem_svg_body("A")
    scale = 0.84 if maskable else 0.94
    tx = CX * (1 - scale)
    ty = CY * (1 - scale) - 6
    r = 0 if maskable else 232
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}" role="img" aria-label="THE SYSTEM app icon">'
            f'<defs>{defs}</defs><rect width="{S}" height="{S}" rx="{r}" fill="{hex_(BG)}"/>'
            f'<rect x="6" y="6" width="{S-12}" height="{S-12}" rx="{max(r-6,0)}" fill="none" stroke="#6f66ff" stroke-opacity=".35" stroke-width="6"/>'
            f'<g transform="translate({tx:.1f} {ty:.1f}) scale({scale})">{body}</g></svg>')


def svg_favicon():
    """Simplified mark for tiny sizes: thick chevrons + diamond on dark tile."""
    chev = ""
    polys = [chevron(560, 250, 160, 110), chevron(400, 170, 110, 96)]
    cols = ["#7d70ff", "#e6e9ff"]
    for p, c in zip(polys, cols):
        chev += f'<polygon points="{" ".join(f"{x},{y}" for x, y in p)}" fill="{c}"/>'
    dia = [(512, 170), (590, 248), (512, 326), (434, 248)]
    chev += f'<polygon points="{" ".join(f"{x},{y}" for x, y in dia)}" fill="#ffffff"/>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}"><title>THE SYSTEM</title>'
            f'<rect width="{S}" height="{S}" rx="200" fill="{hex_(BG)}"/>'
            f'<circle cx="512" cy="512" r="400" fill="none" stroke="#6f66ff" stroke-width="40" stroke-opacity=".8"/>'
            f'{chev}</svg>')


def svg_splash():
    """Animated emblem for the launch screen (CSS animation inside the SVG, reduced-motion aware)."""
    defs, body = emblem_svg_body("P")
    css = ("<style>"
           ".rise{opacity:0;transform:translateY(40px);animation:rise .8s cubic-bezier(.2,.8,.2,1) forwards}"
           ".r1{animation-delay:.05s}.r2{animation-delay:.25s}.r3{animation-delay:.45s}"
           ".ring{opacity:0;animation:fade .9s .1s ease-out forwards}"
           ".core{transform-origin:512px 270px;animation:pulse 2.2s 1s ease-in-out infinite}"
           "@keyframes rise{to{opacity:1;transform:none}}@keyframes fade{to{opacity:1}}"
           "@keyframes pulse{0%,100%{opacity:1}50%{opacity:.55}}"
           "@media (prefers-reduced-motion:reduce){.rise,.ring{animation:none;opacity:1;transform:none}.core{animation:none}}"
           "</style>")
    d2, _ = emblem_svg_body("P")
    parts = []
    # ring group
    parts.append(f'<g class="ring"><circle cx="{CX}" cy="{CY}" r="430" fill="url(#Pv)"/>'
                 f'<circle cx="{CX}" cy="{CY}" r="338" fill="none" stroke="#c9cdf5" stroke-opacity=".28" stroke-width="3"/>')
    for ang, col in ARCS:
        a0, a1 = ang - ARC_SPAN / 2, ang + ARC_SPAN / 2
        x0, y0 = polar(RING_R, a0)
        x1, y1 = polar(RING_R, a1)
        parts.append(f'<path d="M{x0:.1f} {y0:.1f} A{RING_R} {RING_R} 0 0 1 {x1:.1f} {y1:.1f}" fill="none" stroke="{hex_(col)}" stroke-width="{RING_W}" stroke-linecap="round"/>')
    for ang in CARDINALS:
        x, y = polar(RING_R, ang)
        parts.append(f'<path d="M{x:.1f} {y-16:.1f} L{x+12:.1f} {y:.1f} L{x:.1f} {y+16:.1f} L{x-12:.1f} {y:.1f}Z" fill="#dfe3ff"/>')
    parts.append("</g>")
    for i, c in enumerate(CHEVRONS):
        pts = " ".join(f"{x},{y}" for x, y in c["poly"])
        parts.append(f'<g class="rise r{i+1}"><polygon points="{pts}" fill="{hex_(GLOW)}" opacity=".7" filter="url(#Pg)"/>'
                     f'<polygon points="{pts}" fill="url(#Pc{i})"/></g>')
    dp = " ".join(f"{x},{y}" for x, y in DIAMOND)
    parts.append(f'<g class="core"><polygon points="{dp}" fill="{hex_(GLOW)}" filter="url(#Pg)"/><polygon points="{dp}" fill="url(#Pd)"/></g>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}" role="img" aria-label="THE SYSTEM">{css}'
            f'<defs>{d2}</defs>{"".join(parts)}</svg>')


# ------------------------------------------------------------------ Pillow
def vgrad(w, h, top, bot):
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        col = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3))
        for x in range(w):
            px[x, y] = col
    return img


def draw_emblem(size_mult=3):
    """Draw emblem on transparent RGBA canvas (S*size_mult) then downscale for antialiasing."""
    N = S * size_mult
    k = size_mult
    base = Image.new("RGBA", (N, N), (0, 0, 0, 0))

    # soft violet vignette
    vig = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    vd = ImageDraw.Draw(vig)
    for r in range(430 * k, 0, -8 * k):
        a = int(56 * (1 - r / (430 * k)) ** 1.6)
        vd.ellipse([CX * k - r, CY * k - r, CX * k + r, CY * k + r], fill=GLOW + (a,))
    base = Image.alpha_composite(base, vig)

    d = ImageDraw.Draw(base)
    # hairline inner ring
    r = 338 * k
    d.ellipse([CX * k - r, CY * k - r, CX * k + r, CY * k + r], outline=(201, 205, 245, 72), width=3 * k)
    # quest arcs
    r = RING_R * k
    for ang, col in ARCS:
        d.arc([CX * k - r, CY * k - r, CX * k + r, CY * k + r], ang - ARC_SPAN / 2, ang + ARC_SPAN / 2,
              fill=col + (255,), width=RING_W * k)
        for a in (ang - ARC_SPAN / 2, ang + ARC_SPAN / 2):   # round caps
            x, y = polar(RING_R, a)
            rr = RING_W * k / 2
            d.ellipse([x * k - rr, y * k - rr, x * k + rr, y * k + rr], fill=col + (255,))
    for ang in CARDINALS:
        x, y = polar(RING_R, ang)
        d.polygon([(x * k, (y - 16) * k), ((x + 12) * k, y * k), (x * k, (y + 16) * k), ((x - 12) * k, y * k)],
                  fill=(223, 227, 255, 255))

    # glow
    glow = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for c in CHEVRONS:
        gd.polygon([(x * k, y * k) for x, y in c["poly"]], fill=GLOW + (230,))
    gd.polygon([(x * k, y * k) for x, y in DIAMOND], fill=GLOW + (255,))
    glow = glow.filter(ImageFilter.GaussianBlur(26 * k))
    base = Image.alpha_composite(base, glow)

    # gradient chevrons
    for c in CHEVRONS:
        ys = [p[1] for p in c["poly"]]
        y0, y1 = int(min(ys) * k), int(max(ys) * k)
        grad = vgrad(N, y1 - y0 + 1, c["top"], c["bot"]).convert("RGBA")
        full = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        full.paste(grad, (0, y0))
        mask = Image.new("L", (N, N), 0)
        ImageDraw.Draw(mask).polygon([(x * k, y * k) for x, y in c["poly"]], fill=255)
        full.putalpha(ImageChops.multiply(full.getchannel("A"), mask))
        base = Image.alpha_composite(base, full)
    # diamond
    ys = [p[1] for p in DIAMOND]
    y0, y1 = int(min(ys) * k), int(max(ys) * k)
    grad = vgrad(N, y1 - y0 + 1, (255, 255, 255), (191, 224, 255)).convert("RGBA")
    full = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    full.paste(grad, (0, y0))
    mask = Image.new("L", (N, N), 0)
    ImageDraw.Draw(mask).polygon([(x * k, y * k) for x, y in DIAMOND], fill=255)
    full.putalpha(ImageChops.multiply(full.getchannel("A"), mask))
    base = Image.alpha_composite(base, full)

    return base.resize((S, S), Image.LANCZOS)


def tile(emblem, scale, rounded, size=S):
    """Dark tile with the emblem scaled and centred."""
    canvas = Image.new("RGBA", (S, S), BG + (255,))
    em = emblem.resize((int(S * scale), int(S * scale)), Image.LANCZOS)
    off = (S - em.width) // 2
    canvas.alpha_composite(em, (off, off - 6))
    # thin violet rim
    d = ImageDraw.Draw(canvas)
    rad = 232 if rounded else 0
    if rounded:
        d.rounded_rectangle([6, 6, S - 7, S - 7], radius=rad - 6, outline=(111, 102, 255, 90), width=6)
        mask = Image.new("L", (S, S), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=rad, fill=255)
        canvas.putalpha(mask)
    return canvas.resize((size, size), Image.LANCZOS)


def favicon_png(size):
    k = 4
    N = S * k
    img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, N - 1, N - 1], radius=200 * k, fill=BG + (255,))
    r = 400 * k
    d.ellipse([CX * k - r, CY * k - r, CX * k + r, CY * k + r], outline=(111, 102, 255, 205), width=40 * k)
    for p, c in zip([chevron(560, 250, 160, 110), chevron(400, 170, 110, 96)], [(125, 112, 255), (230, 233, 255)]):
        d.polygon([(x * k, y * k) for x, y in p], fill=c + (255,))
    d.polygon([(x * k, y * k) for x, y in [(512, 170), (590, 248), (512, 326), (434, 248)]], fill=(255, 255, 255, 255))
    return img.resize((size, size), Image.LANCZOS)


def main():
    write_svg(os.path.join(BRAND, "system-logo.svg"), svg_logo())
    write_svg(os.path.join(BRAND, "app-icon.svg"), svg_app_icon(False))
    write_svg(os.path.join(BRAND, "app-icon-maskable.svg"), svg_app_icon(True))
    write_svg(os.path.join(BRAND, "splash-mark.svg"), svg_splash())
    write_svg(os.path.join(FAV, "favicon.svg"), svg_favicon())

    emblem = draw_emblem()
    # high-resolution master logo
    master = Image.new("RGBA", (S, S), BG + (255,))
    master.alpha_composite(emblem)
    master.convert("RGB").save(os.path.join(BRAND, "system-logo-1024.png"), optimize=True)

    any_icon = tile(emblem, 0.94, True)
    for sz in (192, 512):
        any_icon.resize((sz, sz), Image.LANCZOS).save(os.path.join(BRAND, f"app-icon-{sz}.png"), optimize=True)
    tile(emblem, 0.84, False, 512).save(os.path.join(BRAND, "app-icon-maskable-512.png"), optimize=True)
    tile(emblem, 0.84, False, 192).save(os.path.join(BRAND, "app-icon-maskable-192.png"), optimize=True)
    # iOS home screen (no transparency allowed -> square, opaque)
    tile(emblem, 0.90, False, 180).convert("RGB").save(os.path.join(BRAND, "apple-touch-icon-180.png"), optimize=True)

    for sz in (16, 32, 48):
        favicon_png(sz).save(os.path.join(FAV, f"favicon-{sz}.png"), optimize=True)
    favicon_png(256).save(os.path.join(FAV, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
    print("brand assets written")


if __name__ == "__main__":
    main()
