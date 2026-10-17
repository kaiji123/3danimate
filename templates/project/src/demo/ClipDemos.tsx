// Mannequin demos: the default compositions of a new project.
//   ClipGrid:  one rig, nine clips in a 3x3 grid (also a quick rig/clip check)
//   ClipChain: one rig cross-fading through a chain of clips
// Every clip used here must be in CLIP_NAMES (src/three/assets.ts) and in public/anims/.
import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { useAssetsReady } from "../three/assets";
import type { Layer } from "../three/Actor";
import { Floor } from "../three/kit";
import { Mannequin } from "../three/Mannequin";
import { Cam, KeyFill, Stage } from "../three/Stage";

export const GRID_CLIPS = [
  "walk_loop", "jog_fwd_loop", "dance_loop",
  "punch_cross", "sword_attack", "pistol_shoot",
  "crouch_fwd_loop", "idle_talking_loop", "zombie_walk_fwd_loop",
];
export const CHAIN = ["idle_loop", "walk_loop", "jog_fwd_loop", "dance_loop", "punch_cross", "sword_attack", "idle_loop"];
const SEG = 60; // frames per clip in the chain
const XF = 10; // cross-fade frames
export const CHAIN_FRAMES = SEG * CHAIN.length;

const Studio: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Stage bg="#2b2e36" fog={false} ambient={1.1}>
    <KeyFill />
    <Floor color="#3a3e48" />
    {children}
  </Stage>
);

const Label: React.FC<{ text: string; size: number }> = ({ text, size }) => (
  <div style={{ position: "absolute", left: 12, bottom: 8, color: "#e8eaee", font: `bold ${size}px monospace` }}>{text}</div>
);

const Tile: React.FC<{ clip: string }> = ({ clip }) => {
  const s = useCurrentFrame() / 30;
  const a = 0.6 + s * 0.35; // slow orbit
  return (
    <Studio>
      <Mannequin layers={[{ clip, t: s }]} />
      <Cam pos={[Math.sin(a) * 3.6, 1.6, Math.cos(a) * 3.6]} look={[0, 0.95, 0]} fov={32} />
    </Studio>
  );
};

export const ClipGrid: React.FC = () => {
  const ready = useAssetsReady();
  return (
    <AbsoluteFill style={{ background: "#111", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "repeat(3, 1fr)" }}>
      {ready &&
        GRID_CLIPS.map((c) => (
          <div key={c} style={{ position: "relative", overflow: "hidden", border: "2px solid #111" }}>
            {/* ThreeCanvas sizes itself from useVideoConfig(): give each tile its own size */}
            <Sequence width={360} height={360} layout="none">
              <Tile clip={c} />
            </Sequence>
            <Label text={c} size={22} />
          </div>
        ))}
    </AbsoluteFill>
  );
};

const Chain: React.FC = () => {
  const f = useCurrentFrame();
  const i = Math.min(Math.floor(f / SEG), CHAIN.length - 1);
  const local = f - i * SEG;
  const layers: Layer[] = [{ clip: CHAIN[i], t: local / 30, weight: 1 }];
  if (i > 0 && local < XF) {
    const w = local / XF;
    layers[0].weight = w;
    layers.push({ clip: CHAIN[i - 1], t: (local + SEG) / 30, weight: 1 - w });
  }
  const a = -0.8 + (1.6 * f) / CHAIN_FRAMES; // swing across the front
  return (
    <>
      <Studio>
        <Mannequin layers={layers} />
        <Cam pos={[Math.sin(a) * 3.4, 1.5, Math.cos(a) * 3.4]} look={[0, 0.95, 0]} fov={34} />
      </Studio>
      <Label text={CHAIN[i]} size={30} />
    </>
  );
};

export const ClipChain: React.FC = () => {
  const ready = useAssetsReady();
  return <AbsoluteFill style={{ background: "#111" }}>{ready && <Chain />}</AbsoluteFill>;
};
