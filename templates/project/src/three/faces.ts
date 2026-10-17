// Face textures + runtime expressions painted onto a copy of the texture.
// Landmark positions MUST match scripts/process_faces.py (crop 500x700).
import * as THREE from "three";
import { getImage } from "./assets";

export const FACE_W = 500;
export const FACE_H = 700;
export const EYE_L = [171, 375] as const;
export const EYE_R = [329, 375] as const;
export const MOUTH = [250, 565] as const;
/** Flat regions painted by process_faces.py: back of head samples hair, nape samples skin. */
export const UV_HAIR = [0.05, 1 - 0.04] as const; // three.js uv (v up)
export const UV_NAPE = [0.05, 1 - 0.97] as const;

export type FaceExpr = {
  mouth?: "open" | "frown";
  eyesClosed?: boolean;
  brows?: -1 | 0; // -1 = angry slanted brows
};

const cache = new Map<string, THREE.Texture>();

function sample(ctx: CanvasRenderingContext2D, x: number, y: number): string {
  const d = ctx.getImageData(x - 3, y - 3, 6, 6).data;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) {
    r += d[i];
    g += d[i + 1];
    b += d[i + 2];
  }
  const n = d.length / 4;
  return `rgb(${(r / n) | 0},${(g / n) | 0},${(b / n) | 0})`;
}

export function faceTexture(face: string, expr: FaceExpr = {}): THREE.Texture {
  const key = `${face}|${expr.mouth ?? ""}|${expr.eyesClosed ? 1 : 0}|${expr.brows ?? 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = FACE_W;
  canvas.height = FACE_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(getImage(face), 0, 0, FACE_W, FACE_H);
  const [mx, my] = MOUTH;

  if (expr.mouth === "frown") {
    ctx.fillStyle = sample(ctx, mx, my - 45); // upper-lip skin covers the smile
    ctx.beginPath();
    ctx.ellipse(mx, my, 56, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#5a2626";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(mx, my + 30, 38, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }
  if (expr.mouth === "open") {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(mx, my + 4, 40, 22, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#2a0d0d";
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = "#f1ece2"; // a row of teeth
    ctx.fillRect(mx - 40, my - 20, 80, 13);
    ctx.restore();
  }
  if (expr.eyesClosed) {
    for (const [ex, ey] of [EYE_L, EYE_R]) {
      ctx.fillStyle = sample(ctx, ex, ey + 48); // cheek skin (above the eye is brow)
      ctx.beginPath();
      ctx.ellipse(ex, ey, 34, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#3a2420";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(ex, ey - 8, 26, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
    }
  }
  if (expr.brows === -1) {
    ctx.strokeStyle = "#2a1a14";
    ctx.lineWidth = 11;
    ctx.lineCap = "round";
    for (const [[x0, y0], [x1, y1]] of [
      [[EYE_L[0] - 38, EYE_L[1] - 62], [EYE_L[0] + 30, EYE_L[1] - 36]],
      [[EYE_R[0] + 38, EYE_R[1] - 62], [EYE_R[0] - 30, EYE_R[1] - 36]],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}
