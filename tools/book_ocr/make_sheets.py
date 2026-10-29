"""Build 2x2 contact sheets of the analysis boards (upscaled, labelled) for reading FENs by eye.

Usage: uv run --with pillow python tools/book_ocr/make_sheets.py
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).parent / "out"
SCALE = 2
PER_SHEET = 4

problems = json.loads((OUT / "problems_analysis.json").read_text())
for s in range(0, len(problems), PER_SHEET):
    chunk = problems[s:s + PER_SHEET]
    tiles = []
    for p in chunk:
        im = Image.open(OUT / p["image"]).convert("RGB")
        im = im.resize((im.width * SCALE, im.height * SCALE), Image.LANCZOS)
        tile = Image.new("RGB", (im.width + 20, im.height + 40), "white")
        ImageDraw.Draw(tile).text((10, 8), f"{p['id']}  ({p['side']} to move)", fill="red")
        tile.paste(im, (10, 30))
        tiles.append(tile)
    w = max(t.width for t in tiles)
    h = max(t.height for t in tiles)
    sheet = Image.new("RGB", (w * 2, h * 2), "white")
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % 2) * w, (i // 2) * h))
    sheet.save(OUT / "sheets" / f"sheet_{s // PER_SHEET + 1:02d}.png")
print("sheets:", len(list((OUT / "sheets").glob("*.png"))))
