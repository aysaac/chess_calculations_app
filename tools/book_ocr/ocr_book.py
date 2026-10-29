"""Step 1: run the whole book PDF through Mistral OCR and cache the result.

Usage:
    uv run --with mistralai python tools/book_ocr/ocr_book.py [path/to/book.pdf]

Reads MISTRAL_API_KEY from the environment or the repo's .env file.
Writes to tools/book_ocr/out/:
    ocr_raw.json      full OCR response (markdown + image metadata per page)
    pages/NNN.md      markdown per PDF page (1-based)
    images/NNN_*.jpg  every figure Mistral detected, named by PDF page
"""
import base64
import json
import os
import sys
import time
from pathlib import Path

from mistralai.client import Mistral
from mistralai.client.errors import SDKError

HERE = Path(__file__).parent
OUT = HERE / "out"
DEFAULT_PDF = Path.home() / "Downloads" / "423257233-El-programa-de-fuerza-en-ajedrez-Nigel-Davies-2002-pdf.pdf"


def load_key() -> str:
    key = os.environ.get("MISTRAL_API_KEY")
    if key:
        return key
    env = HERE.parent.parent / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("MISTRAL_API_KEY="):
                return line.split("=", 1)[1].strip().strip("'\"")
    sys.exit("MISTRAL_API_KEY not found in environment or .env")


CHUNK = 20
TOTAL_PAGES = 258


def ocr_chunk(client: Mistral, url: str, pages: list[int]) -> dict:
    """OCR a set of 0-based pages, retrying on rate limits."""
    delay = 15
    for attempt in range(8):
        try:
            resp = client.ocr.process(
                model="mistral-ocr-latest",
                document={"type": "document_url", "document_url": url},
                pages=pages,
                include_image_base64=True,
            )
            return json.loads(resp.model_dump_json())
        except SDKError as e:
            if e.status_code != 429 or attempt == 7:
                raise
            print(f"  rate limited, waiting {delay}s ...")
            time.sleep(delay)
            delay = min(delay * 2, 120)


def main() -> None:
    pdf = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PDF
    OUT.mkdir(exist_ok=True)
    chunks_dir = OUT / "chunks"
    chunks_dir.mkdir(exist_ok=True)

    todo = [
        list(range(i, min(i + CHUNK, TOTAL_PAGES)))
        for i in range(0, TOTAL_PAGES, CHUNK)
    ]
    todo = [c for c in todo if not (chunks_dir / f"{c[0]:03d}.json").exists()]

    if todo:
        client = Mistral(api_key=load_key())
        print(f"Uploading {pdf.name} ...")
        uploaded = client.files.upload(
            file={"file_name": pdf.name, "content": pdf.read_bytes()},
            purpose="ocr",
        )
        try:
            url = client.files.get_signed_url(file_id=uploaded.id).url
            for pages in todo:
                print(f"OCR pages {pages[0] + 1}-{pages[-1] + 1} ...")
                data = ocr_chunk(client, url, pages)
                (chunks_dir / f"{pages[0]:03d}.json").write_text(json.dumps(data))
        finally:
            client.files.delete(file_id=uploaded.id)
    else:
        print("All chunks cached (delete out/chunks to re-run OCR)")

    all_pages = []
    for f in sorted(chunks_dir.glob("*.json")):
        all_pages.extend(json.loads(f.read_text())["pages"])
    all_pages.sort(key=lambda p: p["index"])
    (OUT / "ocr_raw.json").write_text(json.dumps({"pages": all_pages}))

    (OUT / "pages").mkdir(exist_ok=True)
    (OUT / "images").mkdir(exist_ok=True)
    n_images = 0
    for page in all_pages:
        num = page["index"] + 1  # PDF page, 1-based
        (OUT / "pages" / f"{num:03d}.md").write_text(page["markdown"])
        for img in page.get("images", []):
            b64 = img.get("image_base64")
            if not b64:
                continue
            if "," in b64:
                b64 = b64.split(",", 1)[1]
            (OUT / "images" / f"{num:03d}_{img['id']}").write_bytes(base64.b64decode(b64))
            n_images += 1
    print(f"Saved {len(all_pages)} pages and {n_images} images to {OUT}")


if __name__ == "__main__":
    main()
