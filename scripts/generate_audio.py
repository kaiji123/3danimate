#!/usr/bin/env python3
"""Narration + word timings with edge-tts.

Reads   data/<video>/script.json
Writes  public/audio/<video>/<scene-id>.mp3
        data/<video>/timeline.json

script.json:
  {
    "voice": "en-US-AndrewNeural",      # optional
    "rate": "+12%",                     # optional
    "fps": 30,                          # optional
    "scenes": [ {"id": "x-hook", "text": "Can you tell ..."}, ... ]
  }

timeline.json (consumed by the timing helpers in templates/src/lib/timing.ts):
  {
    "video": "<video>", "fps": 30,
    "scenes": [
      { "id": "x-hook", "audio": "audio/<video>/x-hook.mp3",
        "audioMs": 3120, "frames": 101,            # audio + 250 ms tail (+1 s on the last scene)
        "words": [ {"w": "Can", "text": "Can", "startMs": 50, "endMs": 210}, ... ] }
    ]
  }
`w` is the bare word (punctuation stripped) used for lookups; `text` keeps the
punctuation restored from the script, so captions can break at sentence ends.

Run from the project root:  python scripts/generate_audio.py <video> [--only scene-id]
Re-run after any script change: every cut keyed to a word re-times itself.
"""
import asyncio
import json
import math
import re
import shutil
import subprocess
import sys
from pathlib import Path

import edge_tts

TAIL_MS = 250
LAST_HOLD_MS = 1000


async def synth(text: str, voice: str, rate: str, out: Path) -> list[dict]:
    """Synthesize one scene; return raw word boundaries. Retries on 403 etc."""
    for attempt in range(6):
        try:
            comm = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
            words, audio = [], bytearray()
            async for chunk in comm.stream():
                if chunk["type"] == "audio":
                    audio.extend(chunk["data"])
                elif chunk["type"] == "WordBoundary":
                    start = chunk["offset"] / 10_000  # 100 ns ticks -> ms
                    words.append({"raw": chunk["text"], "startMs": round(start),
                                  "endMs": round(start + chunk["duration"] / 10_000)})
            if not audio:
                raise RuntimeError("no audio returned")
            out.write_bytes(bytes(audio))
            return words
        except Exception as e:
            if attempt == 5:
                raise
            wait = 2 ** attempt
            print(f"  edge-tts failed ({e}); retry in {wait}s", file=sys.stderr)
            await asyncio.sleep(wait)
    raise RuntimeError("unreachable")


def restore_punctuation(text: str, words: list[dict]) -> None:
    """Align boundary words to the script letter by letter, then widen each match
    over the punctuation touching it, so `text` reads "winner," / "it?"."""
    stream, where = [], []  # alphanumeric chars of the script + their indexes
    for i, ch in enumerate(text):
        if ch.isalnum():
            stream.append(ch.lower())
            where.append(i)
    stream = "".join(stream)
    cursor = 0
    for wd in words:
        wd["w"] = re.sub(r"^[^\w$%]+|[^\w$%]+$", "", wd["raw"]) or wd["raw"]
        wd["text"] = wd["raw"]
        key = "".join(c.lower() for c in wd["raw"] if c.isalnum())
        pos = stream.find(key, cursor) if key else -1
        if pos < 0 or pos - cursor > 40:  # TTS expanded/changed the word: keep raw
            continue
        a, b = where[pos], where[pos + len(key) - 1] + 1
        while a > 0 and not text[a - 1].isspace():
            a -= 1
        while b < len(text) and not text[b].isspace():
            b += 1
        wd["text"] = text[a:b]
        cursor = pos + len(key)
    for wd in words:
        del wd["raw"]


def audio_ms(path: Path, words: list[dict]) -> int:
    if shutil.which("ffprobe"):
        r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                            "-of", "csv=p=0", str(path)], capture_output=True, text=True)
        try:
            return round(float(r.stdout.strip()) * 1000)
        except ValueError:
            pass
    # edge-tts default output is 48 kbit/s mono mp3
    est = path.stat().st_size * 8 / 48
    return round(max(est, words[-1]["endMs"] + 100 if words else 0))


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    video = args[0]
    only = args[args.index("--only") + 1] if "--only" in args else None
    src = Path("data") / video / "script.json"
    cfg = json.loads(src.read_text(encoding="utf-8"))
    voice = cfg.get("voice", "en-US-AndrewNeural")
    rate = cfg.get("rate", "+12%")
    fps = cfg.get("fps", 30)
    out_dir = Path("public") / "audio" / video
    out_dir.mkdir(parents=True, exist_ok=True)
    tl_path = Path("data") / video / "timeline.json"
    old = {}
    if only and tl_path.exists():
        old = {s["id"]: s for s in json.loads(tl_path.read_text(encoding="utf-8"))["scenes"]}

    ids = [s["id"] for s in cfg["scenes"]]
    if len(ids) != len(set(ids)):
        sys.exit("scene ids must be unique")

    scenes = []
    for i, sc in enumerate(cfg["scenes"]):
        last = i == len(cfg["scenes"]) - 1
        mp3 = out_dir / f"{sc['id']}.mp3"
        if only and sc["id"] != only and sc["id"] in old:
            entry = old[sc["id"]]
        else:
            print(f"[{sc['id']}] {sc['text'][:60]}...")
            words = asyncio.run(synth(sc["text"], voice, rate, mp3))
            restore_punctuation(sc["text"], words)
            ms = audio_ms(mp3, words)
            entry = {"id": sc["id"], "audio": f"audio/{video}/{sc['id']}.mp3", "audioMs": ms,
                     "words": words}
        total = entry["audioMs"] + TAIL_MS + (LAST_HOLD_MS if last else 0)
        entry["frames"] = math.ceil(total / 1000 * fps)
        scenes.append(entry)

    tl = {"video": video, "fps": fps, "scenes": scenes}
    tl_path.write_text(json.dumps(tl, indent=1), encoding="utf-8")
    secs = sum(s["frames"] for s in scenes) / fps
    words = sum(len(s["words"]) for s in scenes)
    print(f"wrote {tl_path}: {len(scenes)} scenes, {words} words, {secs:.1f} s")
    if not 45 <= secs <= 70:
        print(f"  note: {secs:.0f} s is outside the 50-65 s target; adjust the script length")


if __name__ == "__main__":
    main()
