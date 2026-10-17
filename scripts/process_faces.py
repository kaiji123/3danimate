#!/usr/bin/env python3
"""AI portraits -> low-poly photo-mosaic face textures for the 3D heads.

Source portraits: https://thispersondoesnotexist.com/random-person.jpeg?r=N
(the bare URL returns an HTML page). They are FFHQ-aligned 1024x1024 images of
nobody, so one fixed crop works for all of them and they are safe to cast as
real people.

Run from the project root:  python scripts/process_faces.py [name ...]
Reads   assets/faces-src/<name>.jpg  and  assets/faces-src/faces.json
Writes  public/faces/<name>.png (500x700)  and  public/faces/faces.json

assets/faces-src/faces.json (hair colour is picked by hand; skin is sampled):
  { "geologist": {"hair": "#3b2a20"},
    "clerk":     {"hair": "#c9a46a", "skin": "#e0b49a"} }

Pipeline: crop whole head (hair included) -> repaint border-connected backdrop
with hair/skin colour -> Delaunay mosaic (jittered grid + edge points + extra
points at eyes/mouth) -> flat fill per triangle -> noise + posterize -> flat
hair colour outside the head oval above the jaw, skin below. The flat corners
are what the back of the 3D head and the nape sample (UV_HAIR / UV_NAPE).
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
from scipy.spatial import Delaunay

CROP = (212, 40, 812, 880)  # FFHQ-aligned 1024 px -> whole head with hair
W, H = 500, 700
EYE_L, EYE_R, MOUTH = (171, 375), (329, 375), (250, 565)
FACE_C, FACE_R = (250, 430), (165, 245)     # inner face (never treated as backdrop)
HEAD_C, HEAD_R = (250, 360), (248, 352)     # whole-head oval incl. hair
JAW_Y = 615                                  # below this, outside the oval is skin
UV_HAIR = (0.05, 0.04)                       # texture uv (u right, v down) sampled by back of head
UV_NAPE = (0.05, 0.97)                       # sampled by the nape
rng = np.random.default_rng(3)


def hex2rgb(h: str) -> np.ndarray:
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float64)


def ellipse_mask(c, r) -> np.ndarray:
    yy, xx = np.mgrid[0:H, 0:W]
    return ((xx - c[0]) / r[0]) ** 2 + ((yy - c[1]) / r[1]) ** 2 <= 1


def remove_backdrop(img: np.ndarray, hair: np.ndarray, skin: np.ndarray) -> np.ndarray:
    """Repaint backdrop pixels that are close to the corner colour, outside the
    inner face AND connected to the image border. The border test keeps bright
    cheeks/highlights that happen to match the backdrop from turning into blotches."""
    corners = np.concatenate([img[:24, :24].reshape(-1, 3), img[:24, -24:].reshape(-1, 3)])
    bg = np.median(corners, axis=0)
    dist = np.linalg.norm(img - bg, axis=2)
    gray = img.mean(axis=2)
    edge = np.hypot(ndimage.sobel(gray, 0), ndimage.sobel(gray, 1))
    # close to the backdrop colour, not on a strong edge (the head outline stops the flood)
    cand = (dist < 30) & (ndimage.maximum_filter(edge, 5) < 120) & ~ellipse_mask(FACE_C, FACE_R)
    lab, _ = ndimage.label(cand)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    mask = np.isin(lab, list(border))
    mask = ndimage.binary_dilation(mask, iterations=2) & ~ellipse_mask(FACE_C, FACE_R)
    out = img.copy()
    yy = np.mgrid[0:H, 0:W][0]
    out[mask & (yy < JAW_Y)] = hair
    out[mask & (yy >= JAW_Y)] = skin
    return out


def mosaic(img: np.ndarray) -> np.ndarray:
    pts = []
    step = 26
    for y in range(0, H + step, step):  # jittered grid
        for x in range(0, W + step, step):
            j = rng.uniform(-step * 0.35, step * 0.35, 2)
            pts.append((np.clip(x + j[0], 0, W - 1), np.clip(y + j[1], 0, H - 1)))
    for x in np.linspace(0, W - 1, 12):  # exact border so triangles cover the canvas
        pts += [(x, 0), (x, H - 1)]
    for y in np.linspace(0, H - 1, 16):
        pts += [(0, y), (W - 1, y)]
    gray = np.asarray(Image.fromarray(img.astype(np.uint8)).convert("L").filter(ImageFilter.GaussianBlur(1.5)),
                      dtype=np.float64)
    mag = np.hypot(ndimage.sobel(gray, 0), ndimage.sobel(gray, 1))
    p = (mag / mag.sum()).ravel()
    for idx in rng.choice(len(p), 700, p=p):  # edge-strength samples
        pts.append((idx % W, idx // W))
    for (cx, cy), rx, ry, n in [(EYE_L, 30, 16, 14), (EYE_R, 30, 16, 14), (MOUTH, 44, 22, 18)]:
        for k in range(n):  # rings around eyes and mouth keep features readable
            a = 2 * np.pi * k / n
            for s in (0.55, 1.0):
                pts.append((cx + rx * s * np.cos(a), cy + ry * s * np.sin(a)))
    pts = np.array(pts)
    tri = Delaunay(pts)
    # rasterize triangle ids, then fill each with its mean colour
    ids = Image.new("I", (W, H), -1)
    d = ImageDraw.Draw(ids)
    for i, s in enumerate(tri.simplices):
        d.polygon([tuple(pts[k]) for k in s], fill=i)
    ids = np.asarray(ids, dtype=np.int64)
    valid = ids >= 0
    n = len(tri.simplices)
    flat = ids[valid]
    out = img.copy()
    for c in range(3):
        sums = np.bincount(flat, weights=img[..., c][valid], minlength=n)
        cnt = np.maximum(np.bincount(flat, minlength=n), 1)
        out[..., c][valid] = (sums / cnt)[flat]
    return out


def grain(img: np.ndarray) -> np.ndarray:
    img = img + rng.normal(0, 5, img.shape)
    q = 12  # posterize to ~21 levels per channel
    return np.clip(np.round(img / q) * q, 0, 255)


def process(name: str, cfg: dict, src_dir: Path, out_dir: Path):
    im = Image.open(src_dir / f"{name}.jpg").convert("RGB")
    if im.size != (1024, 1024):
        im = im.resize((1024, 1024), Image.LANCZOS)
    img = np.asarray(im.crop(CROP).resize((W, H), Image.LANCZOS), dtype=np.float64)
    cheeks = np.concatenate([img[455:485, 185:215].reshape(-1, 3), img[455:485, 285:315].reshape(-1, 3)])
    skin = hex2rgb(cfg["skin"]) if cfg.get("skin") else np.median(cheeks, axis=0)
    hair = hex2rgb(cfg["hair"]) if cfg.get("hair") else np.median(img[60:90, 220:280].reshape(-1, 3), axis=0)
    img = remove_backdrop(img, hair, skin)
    img = mosaic(img)
    img = grain(img)
    yy = np.mgrid[0:H, 0:W][0]
    outside = ~ellipse_mask(HEAD_C, HEAD_R)
    img[outside & (yy < JAW_Y)] = hair
    img[outside & (yy >= JAW_Y)] = skin
    Image.fromarray(img.astype(np.uint8)).save(out_dir / f"{name}.png")
    print(f"  {out_dir / name}.png  hair={hair.astype(int).tolist()} skin={skin.astype(int).tolist()}")


def main():
    src_dir, out_dir = Path("assets/faces-src"), Path("public/faces")
    out_dir.mkdir(parents=True, exist_ok=True)
    cfg_path = src_dir / "faces.json"
    cfg = json.loads(cfg_path.read_text(encoding="utf-8")) if cfg_path.exists() else {}
    names = sys.argv[1:] or sorted({p.stem for p in src_dir.glob("*.jpg")})
    if not names:
        sys.exit("no portraits in assets/faces-src/*.jpg")
    for n in names:
        if n not in cfg:
            print(f"  note: {n} has no entry in faces.json; hair colour is auto-sampled")
        process(n, cfg.get(n, {}), src_dir, out_dir)
    meta = {"size": [W, H], "eyeL": EYE_L, "eyeR": EYE_R, "mouth": MOUTH,
            "uvHair": UV_HAIR, "uvNape": UV_NAPE,
            "faces": sorted(p.stem for p in out_dir.glob("*.png"))}
    (out_dir / "faces.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
