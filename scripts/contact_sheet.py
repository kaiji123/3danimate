#!/usr/bin/env python3
"""Tile images into one labelled contact sheet for visual QA.

  python contact_sheet.py OUT.png img1.png img2.png ...  [--cols 6] [--width 270]
  python contact_sheet.py OUT.png --video out/video.mp4 --every 2.5 [--cols 6]

The --video form grabs a frame every N seconds with ffmpeg (whole-video check
after the final render). Labels show the file name or the timestamp.
"""
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw


def opt(args, name, default):
    return type(default)(args[args.index(name) + 1]) if name in args else default


def frames_from_video(video: str, every: float, tmp: Path) -> list[tuple[Path, str]]:
    subprocess.run(["ffmpeg", "-v", "error", "-i", video, "-vf", f"fps=1/{every}",
                    str(tmp / "f_%04d.png")], check=True)
    files = sorted(tmp.glob("f_*.png"))
    return [(f, f"{i * every:.1f}s") for i, f in enumerate(files)]


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    out = Path(args[0])
    cols, width = opt(args, "--cols", 6), opt(args, "--width", 270)
    with tempfile.TemporaryDirectory() as td:
        if "--video" in args:
            items = frames_from_video(args[args.index("--video") + 1], opt(args, "--every", 2.5), Path(td))
        else:
            skip = {"--cols", "--width"}
            paths, i = [], 1
            while i < len(args):
                if args[i] in skip:
                    i += 2
                    continue
                paths.append(Path(args[i]))
                i += 1
            items = [(p, p.stem) for p in paths]
        if not items:
            sys.exit("no images")
        thumbs = []
        for p, label in items:
            im = Image.open(p).convert("RGB")
            h = round(im.height * width / im.width)
            im = im.resize((width, h), Image.LANCZOS)
            d = ImageDraw.Draw(im)
            d.rectangle([0, 0, 8 + 7 * len(label), 18], fill=(0, 0, 0))
            d.text((4, 3), label, fill=(255, 255, 0))
            thumbs.append(im)
        th = max(t.height for t in thumbs)
        rows = -(-len(thumbs) // cols)
        sheet = Image.new("RGB", (cols * width + (cols - 1) * 4, rows * th + (rows - 1) * 4), (40, 40, 40))
        for i, t in enumerate(thumbs):
            sheet.paste(t, ((i % cols) * (width + 4), (i // cols) * (th + 4)))
        out.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(out)
        print(f"wrote {out} ({len(thumbs)} tiles)")


if __name__ == "__main__":
    main()
