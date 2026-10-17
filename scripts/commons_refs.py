#!/usr/bin/env python3
"""Reference photos for props from Wikimedia Commons, with licences logged.

Usage (from the project root):
  python commons_refs.py search "safe deposit boxes" [--limit 15]
  python commons_refs.py get "File:Round Brilliant Cut Diamond.jpg" diamond-brilliant [--dir public/refs]

`get` saves an 800 px thumbnail as <dir>/<name>.<ext> and appends the source
page, author and licence to <dir>/SOURCES.txt. It pauses between requests:
Commons rate-limits (returns non-JSON) after ~4 quick calls.

Get at least one SIDE / PROFILE view per object. The silhouette is what a
low-poly model must get right; a top-down glamour shot hides it.
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://commons.wikimedia.org/w/api.php"
UA = {"User-Agent": "3d-animate-skill-refs/1.0 (reference photos for modelling)"}


def api(**params) -> dict:
    params["format"] = "json"
    url = API + "?" + urllib.parse.urlencode(params)
    for attempt in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                body = r.read()
            time.sleep(2)  # be polite; Commons rate-limits quick bursts
            return json.loads(body)
        except (json.JSONDecodeError, OSError) as e:
            wait = 5 * (attempt + 1)
            print(f"  rate-limited or failed ({e.__class__.__name__}); waiting {wait}s", file=sys.stderr)
            time.sleep(wait)
    sys.exit("Commons API kept failing")


def strip_html(s: str) -> str:
    return re.sub(r"<[^>]+>", "", s or "").strip()


def cmd_search(args):
    q = args[0]
    limit = int(args[args.index("--limit") + 1]) if "--limit" in args else 15
    d = api(action="query", list="search", srnamespace=6, srlimit=limit, srsearch=q)
    for hit in d.get("query", {}).get("search", []):
        print(hit["title"])


def cmd_get(args):
    title, name = args[0], args[1]
    if not title.startswith("File:"):
        title = "File:" + title
    out_dir = Path(args[args.index("--dir") + 1]) if "--dir" in args else Path("public/refs")
    out_dir.mkdir(parents=True, exist_ok=True)
    d = api(action="query", prop="imageinfo", iiprop="url|extmetadata", iiurlwidth=800, titles=title)
    page = next(iter(d["query"]["pages"].values()))
    if "imageinfo" not in page:
        sys.exit(f"not found: {title}")
    info = page["imageinfo"][0]
    meta = info.get("extmetadata", {})
    lic = strip_html(meta.get("LicenseShortName", {}).get("value", "unknown"))
    author = strip_html(meta.get("Artist", {}).get("value", "unknown"))
    url = info.get("thumburl") or info["url"]
    ext = Path(urllib.parse.urlparse(url).path).suffix.lower() or ".jpg"
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        ext = ".png" if ext == ".svg" else ".jpg"
    dest = out_dir / f"{name}{ext}"
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        dest.write_bytes(r.read())
    time.sleep(2)
    line = f"{dest.name}\t{lic}\t{author}\t{info.get('descriptionurl', '')}\n"
    with open(out_dir / "SOURCES.txt", "a", encoding="utf-8") as f:
        f.write(line)
    print(f"saved {dest}  [{lic}] by {author}")
    if not re.search(r"CC0|Public domain|PD|CC BY", lic, re.I):
        print(f"  WARNING: check this licence before using the photo: {lic}", file=sys.stderr)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")  # file titles are often non-ASCII
    if len(sys.argv) < 3 or sys.argv[1] not in ("search", "get"):
        sys.exit(__doc__)
    {"search": cmd_search, "get": cmd_get}[sys.argv[1]](sys.argv[2:])
