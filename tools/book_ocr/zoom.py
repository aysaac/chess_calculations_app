"""Zoom into one board at 4x: uv run --with pillow python tools/book_ocr/zoom.py A-3-2-b [out.png]"""
import json, sys
from pathlib import Path
from PIL import Image
OUT = Path(__file__).parent / "out"
pid = sys.argv[1]
p = next(x for x in json.loads((OUT / "problems_analysis.json").read_text()) if x["id"] == pid)
im = Image.open(OUT / p["image"]).convert("RGB")
im = im.resize((im.width * 4, im.height * 4), Image.LANCZOS)
dst = Path(sys.argv[2]) if len(sys.argv) > 2 else OUT / "sheets" / f"zoom_{pid}.png"
im.save(dst); print(dst)
