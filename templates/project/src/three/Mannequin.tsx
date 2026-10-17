// The bare rig-human mannequin: no face, no clothes, one neutral material.
// Same deterministic driving as Actor: every frame sets each action's
// time/weight, then mixer.update(0). Clips play in place (net root drift removed).
//   <Mannequin layers={[{ clip: "walk_loop", t: useSecs() }]} />
import React, { useMemo } from "react";
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { getGltf } from "./assets";
import type { Layer } from "./Actor";

const inPlaceClips = new Map<string, THREE.AnimationClip>();
/** Clip with the net horizontal drift of root/pelvis removed (bob and sway kept). */
function inPlace(name: string): THREE.AnimationClip {
  const hit = inPlaceClips.get(name);
  if (hit) return hit;
  const src = getGltf(name).animations[0];
  if (!src) throw new Error(`${name}.glb has no animation`);
  const clip = src.clone();
  for (const tr of clip.tracks) {
    if (tr.name !== "root.position" && tr.name !== "pelvis.position") continue;
    const v = tr.values;
    const n = tr.times.length;
    if (n < 2) continue;
    const span = tr.times[n - 1] - tr.times[0] || 1;
    for (let axis = 0; axis < 3; axis++) {
      const d = v[(n - 1) * 3 + axis] - v[axis];
      if (Math.abs(d) < 0.05) continue; // in-place on this axis: leave it alone
      for (let i = 0; i < n; i++) v[i * 3 + axis] -= (d * (tr.times[i] - tr.times[0])) / span;
    }
  }
  inPlaceClips.set(name, clip);
  return clip;
}

export const Mannequin: React.FC<{
  layers: Layer[];
  position?: [number, number, number];
  /** Facing is +z. */
  rotationY?: number;
  color?: string;
}> = ({ layers, position = [0, 0, 0], rotationY = 0, color = "#c9ccd2" }) => {
  const built = useMemo(() => {
    const scene = SkeletonUtils.clone(getGltf("rig-human").scene);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 });
    scene.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isSkinnedMesh) return;
      m.material = mat;
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false; // skinned bounds don't follow the animation
    });
    return { scene, mixer: new THREE.AnimationMixer(scene), actions: new Map<string, THREE.AnimationAction>() };
  }, [color]);

  const { mixer, actions } = built;
  const used = new Set<string>();
  for (const l of layers) {
    const clip = inPlace(l.clip);
    let a = actions.get(l.clip);
    if (!a) {
      a = mixer.clipAction(clip);
      actions.set(l.clip, a);
    }
    const loop = l.loop ?? true;
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    a.clampWhenFinished = true;
    a.enabled = true;
    a.play();
    a.setEffectiveWeight(l.weight ?? 1);
    const d = clip.duration;
    a.time = loop ? ((l.t % d) + d) % d : THREE.MathUtils.clamp(l.t, 0, d - 1e-4);
    used.add(l.clip);
  }
  actions.forEach((a, name) => {
    if (!used.has(name)) a.setEffectiveWeight(0);
  });
  mixer.update(0);

  return (
    <group position={position} rotation-y={rotationY}>
      <primitive object={built.scene} />
    </group>
  );
};
