"""
Builds public/logos/<SYMBOL>.png for every stock token in src/data/stocks.json.

For each ticker several public logo sources are fetched, each candidate is scored on real
content (resolution of the trimmed logo, number of colours, not a placeholder), the best one
is normalised onto a transparent 256x256 canvas with even padding, and src/data/logos.json
records whether the logo needs a light or a dark tile behind it.

    python scripts/pull_logos.py            # all tickers
    python scripts/pull_logos.py NVDA AAPL  # a few
"""
import io
import json
import sys
import time
import urllib.request
from pathlib import Path

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "logos"
OUT.mkdir(parents=True, exist_ok=True)

SOURCES = [
    ("cmc256", "https://companiesmarketcap.com/img/company-logos/256/{s}.webp"),
    ("eodhd", "https://eodhd.com/img/logos/US/{s}.png"),
    ("fmp", "https://financialmodelingprep.com/image-stock/{s}.png"),
    ("parqet", "https://assets.parqet.com/logos/symbol/{s}?format=png&size=256"),
    ("iex", "https://storage.googleapis.com/iex/api/logos/{s}.png"),
]
CANVAS = 256
PAD = 22


def fetch(url: str) -> bytes | None:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            if r.status != 200:
                return None
            data = r.read()
            return data if len(data) > 150 else None
    except Exception:
        return None


def to_rgba(data: bytes) -> Image.Image | None:
    try:
        im = Image.open(io.BytesIO(data))
        im.load()
        return im.convert("RGBA")
    except Exception:
        return None


def knock_out_background(im: Image.Image) -> Image.Image:
    """If the image is opaque, make its corner colour transparent (most sources ship logos on flat white)."""
    alpha = im.getchannel("A")
    lo, hi = alpha.getextrema()
    if lo < 250:
        return im  # already has transparency
    w, h = im.size
    corners = [im.getpixel((0, 0)), im.getpixel((w - 1, 0)), im.getpixel((0, h - 1)), im.getpixel((w - 1, h - 1))]
    bg = corners[0][:3]
    if not all(sum(abs(c[i] - bg[i]) for i in range(3)) < 30 for c in corners):
        return im  # corners disagree: keep as is
    px = im.load()
    tol = 28
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) < tol:
                px[x, y] = (r, g, b, 0)
    return im


def analyse(im: Image.Image):
    """Returns (score, trimmed image, needs_dark_tile) or None when the image has no usable content."""
    im = knock_out_background(im)
    alpha = im.getchannel("A")
    bbox = alpha.point(lambda a: 255 if a > 40 else 0).getbbox()
    if not bbox:
        return None
    cropped = im.crop(bbox)
    cw, ch = cropped.size
    if cw * ch < 0.03 * im.size[0] * im.size[1]:
        return None
    small = cropped.resize((32, 32))
    opaque = [p for p in small.getdata() if p[3] > 40]
    if len(opaque) < 20:
        return None
    colours = {(p[0] // 24, p[1] // 24, p[2] // 24) for p in opaque}
    if len(colours) < 2 and len(opaque) < 200:
        return None
    lum = sum(0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2] for p in opaque) / len(opaque) / 255
    whitish = sum(1 for p in opaque if p[0] > 225 and p[1] > 225 and p[2] > 225) / len(opaque)
    needs_dark = lum > 0.8 or whitish > 0.6
    score = min(cw, ch) + 4 * len(colours)
    return score, cropped, needs_dark


def normalise(cropped: Image.Image) -> Image.Image:
    cw, ch = cropped.size
    inner = CANVAS - 2 * PAD
    scale = min(inner / cw, inner / ch)
    nw, nh = max(1, round(cw * scale)), max(1, round(ch * scale))
    resized = cropped.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.paste(resized, ((CANVAS - nw) // 2, (CANVAS - nh) // 2), resized)
    return canvas


def main():
    stocks = json.loads((ROOT / "src" / "data" / "stocks.json").read_text(encoding="utf-8"))
    wanted = set(sys.argv[1:])
    existing = {}
    p = ROOT / "src" / "data" / "logos.json"
    if p.exists():
        existing = json.loads(p.read_text(encoding="utf-8"))
    result = dict(existing)
    picked = {}
    for i, s in enumerate(stocks, 1):
        sym = s["symbol"]
        if wanted and sym not in wanted:
            continue
        best = None
        for name, tpl in SOURCES:
            data = fetch(tpl.format(s=sym))
            if not data:
                continue
            im = to_rgba(data)
            if im is None:
                continue
            a = analyse(im)
            if a is None:
                continue
            score, cropped, dark = a
            if best is None or score > best[0]:
                best = (score, cropped, dark, name)
        if best is None:
            result.pop(sym, None)
            print(f"{sym:8s} no usable logo")
        else:
            normalise(best[1]).save(OUT / f"{sym}.png", optimize=True)
            result[sym] = "dark" if best[2] else "light"
            picked[sym] = best[3]
        if i % 20 == 0:
            print(f"{i}/{len(stocks)} ...")
        time.sleep(0.15)
    p.write_text(json.dumps(dict(sorted(result.items())), indent=1), encoding="utf-8")
    from collections import Counter
    print("sources used:", Counter(picked.values()))
    print("logos:", len(result), "dark tiles:", sum(1 for v in result.values() if v == "dark"))


if __name__ == "__main__":
    main()
