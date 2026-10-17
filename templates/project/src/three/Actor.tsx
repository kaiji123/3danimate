// Skinned, mocap-animated characters from the ActionForge library (CC0,
// Quaternius mannequin, 71 bones, UE-style names) turned into low-poly people:
//  - clothes by bone weight (flat-shaded vertex colours per body region)
//  - the mannequin head is collapsed and our photo-mosaic <Head> rides the Head bone
//  - clips are evaluated deterministically: set every action's time/weight, mixer.update(0)
//  - root motion is stripped; `travel` moves the actor by the clip's average velocity
import React, { useMemo } from "react";
import * as THREE from "three";
import { createPortal } from "@react-three/fiber";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { getGltf } from "./assets";
import { Head } from "./Head";
import type { FaceExpr } from "./faces";

export type Look = {
  face: string;
  skin: string;
  jacket: string;
  trousers: string;
  shoes?: string;
  shirt?: string;
  tie?: string;
  glasses?: boolean;
};

export type Layer = {
  clip: string;
  /** seconds into the clip (usually useSecs() + offset) */
  t: number;
  weight?: number;
  /** default: true when the clip name ends in "_loop" */
  loop?: boolean;
};

type V3 = [number, number, number];

// Placement of our Head relative to the mannequin's Head bone, in rest-pose
// model coordinates (metres). Tune with the ActorTest composition.
const HEAD_OFFSET: V3 = [0, 0.11, 0.025];
const HEAD_SIZE = 0.29;
// Hands: props are placed relative to the hand bone (bone-local axes).
// Chest: rest-pose model coordinates relative to spine_03.

// ---------------------------------------------------------------- clip prep
type Prepped = { clip: THREE.AnimationClip; vel: THREE.Vector3; duration: number };
const prepped = new Map<string, Prepped>();

/** Strip horizontal root motion (root + pelvis tracks) and measure its velocity. */
function prepClip(name: string): Prepped {
  const hit = prepped.get(name);
  if (hit) return hit;
  const rig = getGltf("rig-human").scene;
  rig.updateMatrixWorld(true);
  const src = getGltf(name).animations[0];
  if (!src) throw new Error(`${name}.glb has no animation`);
  const clip = src.clone();
  const duration = clip.duration;
  const vel = new THREE.Vector3();
  for (const bone of ["root", "pelvis"]) {
    const track = clip.tracks.find((t) => t.name === `${bone}.position`);
    const node = rig.getObjectByName(bone);
    if (!track || !node || !node.parent) continue;
    const v = track.values;
    const n = track.times.length;
    if (n < 2) continue;
    const toModel = new THREE.Matrix3().setFromMatrix4(node.parent.matrixWorld);
    const toLocal = toModel.clone().invert();
    const dLocal = new THREE.Vector3(v[(n - 1) * 3] - v[0], v[(n - 1) * 3 + 1] - v[1], v[(n - 1) * 3 + 2] - v[2]);
    const dModel = dLocal.clone().applyMatrix3(toModel);
    dModel.y = 0; // keep vertical bob / crouch height
    if (dModel.length() < 0.05) continue; // in-place clip: leave its sway alone
    const hLocal = dModel.clone().applyMatrix3(toLocal);
    const t0 = track.times[0];
    const span = track.times[n - 1] - t0 || 1;
    for (let i = 0; i < n; i++) {
      const k = (track.times[i] - t0) / span;
      v[i * 3] -= hLocal.x * k;
      v[i * 3 + 1] -= hLocal.y * k;
      v[i * 3 + 2] -= hLocal.z * k;
    }
    vel.add(dModel.divideScalar(span));
  }
  const p = { clip, vel, duration };
  prepped.set(name, p);
  return p;
}

/** Average travel speed of a clip in m/s (walk loops ≈ 1 m/s, ~1.3 m per loop). */
export const clipSpeed = (name: string) => prepClip(name).vel.length();
export const clipDuration = (name: string) => prepClip(name).duration;

// ---------------------------------------------------------- body colouring
type Region = "skin" | "jacket" | "trousers" | "shoes" | "head";
function regionOf(bone: string): Region {
  if (bone === "Head") return "head";
  if (/^(neck|hand|index|middle|pinky|ring|thumb)/.test(bone)) return "skin";
  if (/^(foot|ball)/.test(bone)) return "shoes";
  if (/^(pelvis|thigh|calf)/.test(bone)) return "trousers";
  return "jacket"; // spine, clavicle, arms, root
}

function dressMesh(mesh: THREE.SkinnedMesh, look: Look) {
  const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const si = geo.getAttribute("skinIndex") as THREE.BufferAttribute;
  const sw = geo.getAttribute("skinWeight") as THREE.BufferAttribute;
  const bones = mesh.skeleton.bones;
  const headIdx = bones.findIndex((b) => b.name === "Head");
  const skull = new THREE.Vector3();
  if (headIdx >= 0) {
    // Head bone position in bind space: collapse mannequin head vertices onto it
    skull.setFromMatrixPosition(mesh.skeleton.boneInverses[headIdx].clone().invert());
    skull.applyMatrix4(mesh.bindMatrixInverse);
  }
  const palette: Record<Region, THREE.Color> = {
    skin: new THREE.Color(look.skin),
    jacket: new THREE.Color(look.jacket),
    trousers: new THREE.Color(look.trousers),
    shoes: new THREE.Color(look.shoes ?? "#1b1b1b"),
    head: new THREE.Color(look.skin),
  };
  const dominant = (i: number) => {
    let best = 0;
    for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, best)) best = k;
    return si.getComponent(i, best);
  };
  const colors = new Float32Array(pos.count * 3);
  for (let t = 0; t < pos.count; t += 3) {
    const regs = [0, 1, 2].map((k) => regionOf(bones[dominant(t + k)].name));
    const reg = regs[1] === regs[2] ? regs[1] : regs[0]; // majority of the face
    const c = palette[reg];
    for (let k = 0; k < 3; k++) {
      colors.set([c.r, c.g, c.b], (t + k) * 3);
      if (regs[k] === "head") pos.setXYZ(t + k, skull.x, skull.y, skull.z);
    }
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  mesh.geometry = geo;
  mesh.material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false; // skinned bounds don't follow the animation
}

/** Group that cancels a bone's rest rotation/scale, so children use model axes. */
function restFrame(bone: THREE.Object3D) {
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  bone.matrixWorld.decompose(new THREE.Vector3(), q, s);
  return { quaternion: q.invert(), scale: new THREE.Vector3(1 / s.x, 1 / s.y, 1 / s.z) };
}

// ------------------------------------------------------------------- Actor
export const Actor: React.FC<{
  look: Look;
  layers: Layer[];
  position?: V3;
  /** Facing is +z. Math.PI walks away from a camera at +z. */
  rotationY?: number;
  /** move along the clip's root motion; true = use the first layer's t, or pass seconds */
  travel?: boolean | number;
  scale?: number;
  expr?: FaceExpr;
  rightHand?: React.ReactNode;
  leftHand?: React.ReactNode;
  chest?: React.ReactNode;
}> = ({ look, layers, position = [0, 0, 0], rotationY = 0, travel, scale = 1, expr, rightHand, leftHand, chest }) => {
  const built = useMemo(() => {
    const scene = SkeletonUtils.clone(getGltf("rig-human").scene);
    scene.updateMatrixWorld(true);
    const meshes: THREE.SkinnedMesh[] = [];
    scene.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(o as THREE.SkinnedMesh);
    });
    meshes.forEach((m) => dressMesh(m, look));
    const bone = (n: string) => {
      const b = scene.getObjectByName(n);
      if (!b) throw new Error(`rig has no bone ${n}`);
      return b;
    };
    const head = bone("Head"), handR = bone("hand_r"), handL = bone("hand_l"), chestB = bone("spine_03");
    return {
      scene,
      mixer: new THREE.AnimationMixer(scene),
      actions: new Map<string, THREE.AnimationAction>(),
      head, handR, handL, chestB,
      headRest: restFrame(head),
      chestRest: restFrame(chestB),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [look.face, look.skin, look.jacket, look.trousers, look.shoes]);

  // Evaluate the pose for this frame (no clock: fully deterministic).
  const { mixer, actions } = built;
  const used = new Set<string>();
  for (const l of layers) {
    const p = prepClip(l.clip);
    let a = actions.get(l.clip);
    if (!a) {
      a = mixer.clipAction(p.clip);
      actions.set(l.clip, a);
    }
    const loop = l.loop ?? l.clip.endsWith("_loop");
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    a.clampWhenFinished = true;
    a.enabled = true;
    a.paused = false;
    a.play();
    a.setEffectiveWeight(l.weight ?? 1);
    a.time = loop ? ((l.t % p.duration) + p.duration) % p.duration : THREE.MathUtils.clamp(l.t, 0, p.duration - 1e-4);
    used.add(l.clip);
  }
  actions.forEach((a, name) => {
    if (!used.has(name)) a.setEffectiveWeight(0);
  });
  mixer.update(0);

  let offset: V3 = [0, 0, 0];
  if (travel !== undefined && travel !== false && layers[0]) {
    const p = prepClip(layers[0].clip);
    const t = typeof travel === "number" ? travel : layers[0].t;
    offset = [p.vel.x * t, 0, p.vel.z * t];
  }

  return (
    <group position={position} rotation-y={rotationY} scale={scale}>
      <group position={offset}>
        <primitive object={built.scene} />
        {createPortal(
          <group quaternion={built.headRest.quaternion} scale={built.headRest.scale}>
            <group position={HEAD_OFFSET}>
              <Head face={look.face} skin={look.skin} expr={expr} glasses={look.glasses} size={HEAD_SIZE} />
            </group>
          </group>,
          built.head,
        )}
        {createPortal(
          <group quaternion={built.chestRest.quaternion} scale={built.chestRest.scale}>
            <ShirtFront look={look} />
            {chest}
          </group>,
          built.chestB,
        )}
        {rightHand && createPortal(<>{rightHand}</>, built.handR)}
        {leftHand && createPortal(<>{leftHand}</>, built.handL)}
      </group>
    </group>
  );
};

// Shirt V, lapels and tie, attached to spine_03 (rest-pose model coordinates).
const V_GEO = new THREE.CircleGeometry(0.075, 3);
const TIE_GEO = new THREE.BoxGeometry(0.035, 0.2, 0.01);
const ShirtFront: React.FC<{ look: Look }> = ({ look }) => {
  if (!look.shirt && !look.tie) return null;
  return (
    <group position={[0, 0.1, 0.125]} rotation-x={-0.12}>
      {look.shirt && (
        <mesh geometry={V_GEO} rotation-z={-Math.PI / 2}>
          <meshStandardMaterial color={look.shirt} flatShading />
        </mesh>
      )}
      {look.tie && (
        <mesh geometry={TIE_GEO} position={[0, -0.06, 0.008]}>
          <meshStandardMaterial color={look.tie} flatShading />
        </mesh>
      )}
    </group>
  );
};
