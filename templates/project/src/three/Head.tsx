// Faceted low-poly head with a photo-mosaic face. No modelled hair (3D hair
// caps looked like a helmet): front/side triangles get a planar projection of
// the whole-head photo, so the real hairline wraps over the temples; back
// triangles sample the flat hair corner, the nape samples skin.
import React, { useMemo } from "react";
import * as THREE from "three";
import { EYE_L, FACE_H, faceTexture, MOUTH, UV_HAIR, UV_NAPE, type FaceExpr } from "./faces";

const R = 0.5; // unit head, scaled by `size`
const Y_SCALE = 1.15;
// Where the eye line and mouth land on the head (in units of R, 0 = equator).
// Features low on a sphere curve away from the camera and look squashed, so
// the eyes sit just above the equator.
const EYE_Y = 0.05;
const MOUTH_Y = -0.55;
const FACE_SPREAD_X = 1; // >1 spreads the photo wider (more hair over the temples)
const V_EYE = 1 - EYE_L[1] / FACE_H;
const V_PER_R = (MOUTH[1] - EYE_L[1]) / FACE_H / (EYE_Y - MOUTH_Y);

function buildHead(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(R, 11, 9).toNonIndexed();
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i) * Y_SCALE, z = pos.getZ(i);
    if (y < 0) {
      const k = 1 - 0.35 * (-y / (R * Y_SCALE)); // taper the jaw
      x *= k;
      z *= 0.85 + 0.15 * k;
    }
    pos.setXYZ(i, x, y, z);
  }
  const uv = new Float32Array(pos.count * 2);
  for (let t = 0; t < pos.count; t += 3) {
    const cy = (pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2)) / 3;
    const cz = (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3;
    for (let k = 0; k < 3; k++) {
      const i = t + k;
      let u: number, v: number;
      if (cz > -0.18 * R) {
        u = 0.5 + pos.getX(i) / (2 * R * FACE_SPREAD_X);
        v = V_EYE + V_PER_R * (pos.getY(i) / R - EYE_Y);
      } else if (cy > -0.35 * R) {
        [u, v] = UV_HAIR;
      } else {
        [u, v] = UV_NAPE;
      }
      uv[i * 2] = THREE.MathUtils.clamp(u, 0.001, 0.999);
      uv[i * 2 + 1] = THREE.MathUtils.clamp(v, 0.001, 0.999);
    }
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

const HEAD_GEO = buildHead();
const EAR_GEO = new THREE.IcosahedronGeometry(0.075, 0);
const RIM_GEO = new THREE.TorusGeometry(0.075, 0.012, 4, 8);
const BAR_GEO = new THREE.BoxGeometry(0.07, 0.014, 0.014);
const GLASSES_MAT = new THREE.MeshStandardMaterial({ color: "#151515", roughness: 0.4 });
const mats = new Map<string, THREE.MeshStandardMaterial>();

function headMaterial(face: string, expr: FaceExpr): THREE.MeshStandardMaterial {
  const key = `${face}|${JSON.stringify(expr)}`;
  let m = mats.get(key);
  if (!m) {
    const tex = faceTexture(face, expr);
    m = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex, // keeps faces readable in dark scenes
      emissive: new THREE.Color("white"),
      emissiveIntensity: 0.22,
      flatShading: true,
      roughness: 0.85,
    });
    mats.set(key, m);
  }
  return m;
}

export type HeadProps = {
  face: string;
  skin: string;
  expr?: FaceExpr;
  glasses?: boolean;
  /** Head height in metres. Slightly oversized reads as a stylised game character. */
  size?: number;
};

/** Faces +z. Origin at the head centre. */
export const Head: React.FC<HeadProps> = ({ face, skin, expr = {}, glasses, size = 0.27 }) => {
  const mat = headMaterial(face, expr);
  const earMat = useMemo(() => new THREE.MeshStandardMaterial({ color: skin, flatShading: true }), [skin]);
  const s = size / (2 * R * Y_SCALE);
  const eyeY = EYE_Y * R;
  return (
    <group scale={s}>
      <mesh geometry={HEAD_GEO} material={mat} castShadow />
      {[-1, 1].map((side) => (
        <mesh key={side} geometry={EAR_GEO} material={earMat} position={[side * 0.47, -0.06, -0.02]} scale={[0.45, 1, 0.75]} />
      ))}
      {glasses && (
        <group position={[0, eyeY, 0.47]}>
          {[-1, 1].map((side) => (
            <mesh key={side} geometry={RIM_GEO} material={GLASSES_MAT} position={[side * 0.158, 0, 0]} />
          ))}
          <mesh geometry={BAR_GEO} material={GLASSES_MAT} />
        </group>
      )}
    </group>
  );
};
