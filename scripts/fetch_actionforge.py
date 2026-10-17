#!/usr/bin/env python3
"""List and download CC0 animation clips from the ActionForge library.

ActionForge (https://actionforge.app) serves its library as static files, so no
UI clicking is needed. The catalog is a JSON manifest; the rig and every clip
are GLBs that target the same 71-bone Quaternius skeleton (UE-style names:
pelvis, spine_01..03, Head, hand_r, ...).

Usage:
  python fetch_actionforge.py list [--filter WORD]       # catalog as a table
  python fetch_actionforge.py get OUT_DIR clip1 clip2 ... # rig + clips -> OUT_DIR
  python fetch_actionforge.py manifest OUT_FILE           # save the raw catalog

`get` always downloads rig-human.glb too. Clip names are the manifest keys
(walk_formal_loop, sitting_idle_loop, interact, ...). Files already in OUT_DIR
are skipped (pass --force to re-download), and requests are spaced out: this
fetches from ActionForge's own hosting, so keep the load on it small.

Credits: animations and rig by Quaternius (https://quaternius.com), CC0;
retargeted and hosted by ActionForge (CGstuff). This project is not affiliated
with either. Only the CC0 assets are fetched; ActionForge's app code is not.
"""
import json
import sys
import time
import urllib.request
from pathlib import Path

BASE = "https://actionforge.app/assets/animation-library"
MANIFEST = f"{BASE}/manifests/library.json"
UA = {"User-Agent": "3d-animate-skill/1.0 (+https://github.com/kaiji123/3danimate)"}
DELAY = 1.0  # seconds between downloads


def fetch(url: str) -> bytes:
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read()
        except Exception as e:  # network hiccup: back off and retry
            if attempt == 3:
                raise
            print(f"  retry {url} ({e})", file=sys.stderr)
            time.sleep(2 * (attempt + 1))
    raise RuntimeError("unreachable")


def manifest() -> dict:
    return json.loads(fetch(MANIFEST))


def rig_file(m: dict) -> str:
    # schemaVersion 2: m["rig"]["file"] or m["rigs"]["human"]["file"]
    if isinstance(m.get("rig"), dict) and m["rig"].get("file"):
        return m["rig"]["file"]
    return m["rigs"]["human"]["file"]


def clips(m: dict) -> dict:
    c = m["clips"]
    if isinstance(c, list):  # older schema: list of {name, file, ...}
        return {x.get("name") or Path(x["file"]).stem: x for x in c}
    return c


def cmd_list(args):
    flt = None
    if "--filter" in args:
        flt = args[args.index("--filter") + 1].lower()
    m = manifest()
    print(f"{'clip':28} {'dur(s)':>6} {'loop':>4} {'root m':>6}  licence  tags")
    for name, c in sorted(clips(m).items()):
        tags = ",".join(c.get("tags") or [])
        if flt and flt not in name.lower() and flt not in tags.lower():
            continue
        if c.get("deprecated") or c.get("rig", "human") != "human":
            continue
        lic = (c.get("source") or {}).get("license") or "?"
        dist = c.get("rootDistance") or 0
        print(f"{name:28} {c.get('duration', 0):6.2f} {'y' if c.get('loops') else 'n':>4} "
              f"{dist:6.2f}  {lic:7}  {tags}")


def save(url_path: str, out: Path, force: bool = False):
    if out.exists() and out.stat().st_size > 0 and not force:
        print(f"  {out}  (cached)")
        return
    data = fetch(f"{BASE}/{url_path}")
    out.write_bytes(data)
    print(f"  {out}  ({len(data) // 1024} KB)")


def cmd_get(args):
    force = "--force" in args
    args = [a for a in args if a != "--force"]
    if len(args) < 1:
        sys.exit("usage: get OUT_DIR clip [clip ...] [--force]")
    out_dir = Path(args[0])
    out_dir.mkdir(parents=True, exist_ok=True)
    m = manifest()
    cat = clips(m)
    rig = out_dir / "rig-human.glb"
    save(rig_file(m), rig, force)
    missing = [n for n in args[1:] if n not in cat]
    if missing:
        sys.exit(f"unknown clip(s): {', '.join(missing)}  (run `list` to see names)")
    for name in args[1:]:
        lic = (cat[name].get("source") or {}).get("license")
        if lic != "CC0":
            print(f"  WARNING {name}: licence is {lic!r}, not CC0", file=sys.stderr)
        out = out_dir / f"{name}.glb"
        cached = out.exists() and not force
        save(cat[name]["file"], out, force)
        if not cached:
            time.sleep(DELAY)


def cmd_manifest(args):
    Path(args[0]).write_text(json.dumps(manifest(), indent=2), encoding="utf-8")
    print(f"saved {args[0]}")


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in ("list", "get", "manifest"):
        sys.exit(__doc__)
    {"list": cmd_list, "get": cmd_get, "manifest": cmd_manifest}[sys.argv[1]](sys.argv[2:])
