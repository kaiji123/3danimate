// The asset gate. A texture or model that arrives after a ThreeCanvas has
// rendered never makes it into the captured frame (swapping it in by `key`
// doesn't fix that). So every image and GLB is preloaded under ONE delayRender,
// and ShortVideo only mounts scenes once useAssetsReady() is true.
// Any new image/model asset must be added here.
import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

/** Every clip in public/anims/ that a scene uses (library clips + custom `cap_` clips). */
export const CLIP_NAMES = [
  "idle_loop",
  "idle_talking_loop",
  "walk_formal_loop",
  "sitting_idle_loop",
  "yes",
  "interact",
] as const;
export type ClipName = (typeof CLIP_NAMES)[number];

/** Every face texture in public/faces/ (from scripts/process_faces.py). */
export const FACE_NAMES = ["clerk"] as const;
export type FaceName = (typeof FACE_NAMES)[number];

/** Other images (reference photos for the model sheet, signs, ...). */
export const IMAGE_FILES: string[] = [];

const gltfs = new Map<string, GLTF>();
const images = new Map<string, HTMLImageElement>();
let loading: Promise<void> | null = null;
let loaded = false;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image ${src}`));
    img.src = src;
  });
}

function loadAll(): Promise<void> {
  if (loading) return loading;
  const loader = new GLTFLoader();
  const glb = (name: string) =>
    loader.loadAsync(staticFile(`anims/${name}.glb`)).then((g) => void gltfs.set(name, g));
  loading = Promise.all([
    glb("rig-human"),
    ...CLIP_NAMES.map(glb),
    ...FACE_NAMES.map((f) => loadImage(staticFile(`faces/${f}.png`)).then((i) => void images.set(f, i))),
    ...IMAGE_FILES.map((p) => loadImage(staticFile(p)).then((i) => void images.set(p, i))),
  ]).then(() => {
    loaded = true;
  });
  return loading;
}

export function useAssetsReady(): boolean {
  const [ready, setReady] = useState(loaded);
  const [handle] = useState(() =>
    loaded ? null : delayRender("Loading 3D assets", { timeoutInMilliseconds: 120_000 }),
  );
  useEffect(() => {
    if (handle === null) return;
    loadAll()
      .then(() => {
        setReady(true);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [handle]);
  return ready;
}

export function getGltf(name: string): GLTF {
  const g = gltfs.get(name);
  if (!g) throw new Error(`GLB "${name}" was not preloaded. Add it to CLIP_NAMES in src/three/assets.ts`);
  return g;
}

export function getImage(name: string): HTMLImageElement {
  const i = images.get(name);
  if (!i) throw new Error(`Image "${name}" was not preloaded. Add it to FACE_NAMES / IMAGE_FILES`);
  return i;
}
