#!/usr/bin/env python3
"""Create a new low-poly short project from the skill's template.

  python <skill>/scripts/scaffold.py <target-dir>

Copies templates/project/ (Remotion + react-three-fiber kit, example video,
QA compositions) and the Python helpers into <target-dir>/scripts/. Refuses
to overwrite existing files.
"""
import shutil
import sys
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    dst = Path(sys.argv[1]).resolve()
    src = SKILL / "templates" / "project"
    clashes = [p.relative_to(src) for p in src.rglob("*") if p.is_file() and (dst / p.relative_to(src)).exists()]
    if clashes:
        sys.exit(f"refusing to overwrite: {', '.join(map(str, clashes[:5]))}")
    shutil.copytree(src, dst, dirs_exist_ok=True)
    for py in (SKILL / "scripts").glob("*.py"):
        if py.name != "scaffold.py":
            shutil.copy2(py, dst / "scripts" / py.name)
    for d in ("public/anims", "public/faces", "public/sfx", "public/audio", "assets/capture-src", "out"):
        (dst / d).mkdir(parents=True, exist_ok=True)
    print(f"scaffolded {dst}\nnext: cd there, npm install, then follow the SKILL.md workflow")


if __name__ == "__main__":
    main()
