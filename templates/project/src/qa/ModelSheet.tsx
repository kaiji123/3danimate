// Model sheet: each recurring prop on a slow turntable with its reference
// photo inset in the corner. Render after EVERY change to models.tsx, before
// touching scenes:   COMP=ModelSheet node scripts/stills.mjs out/models 0 30
// Tiles are only 540 px wide: at fov 30 the camera needs ~1.3 m for a 0.6 m object.
import React from "react";
import { AbsoluteFill, Img, Sequence, staticFile } from "remotion";
import { useSecs } from "../lib/timing";
import { useAssetsReady } from "../three/assets";
import { Chair, Floor } from "../three/kit";
import { Cam, KeyFill, Stage } from "../three/Stage";

export type SheetItem = {
  name: string;
  C: React.FC;
  /** reference photo in public/, e.g. "refs/diamond-side.jpg" */
  ref?: string;
  /** camera distance in metres */
  dist?: number;
  /** look-at height */
  y?: number;
  /** turntable; use false for walls (spinning shows them edge-on) */
  spin?: boolean;
};

// Replace with the video's canonical models (src/<video>/models.tsx).
export const SHEET_ITEMS: SheetItem[] = [{ name: "Chair", C: () => <Chair />, dist: 2.2, y: 0.45 }];

const Tile: React.FC<{ item: SheetItem }> = ({ item }) => {
  const s = useSecs();
  const a = item.spin === false ? 0.5 : 0.5 + s * 0.6;
  const d = item.dist ?? 1.3;
  const y = item.y ?? 0.3;
  return (
    <Stage bg="#2a2d35" fog={false} ambient={1.1}>
      <KeyFill />
      <Floor color="#3b3f49" />
      <item.C />
      <Cam pos={[Math.sin(a) * d, y + d * 0.35, Math.cos(a) * d]} look={[0, y, 0]} fov={30} />
    </Stage>
  );
};

export const ModelSheet: React.FC = () => {
  const ready = useAssetsReady();
  const items = SHEET_ITEMS.slice(0, 6);
  return (
    <AbsoluteFill style={{ background: "#111", display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "repeat(3, 1fr)" }}>
      {ready &&
        items.map((it) => (
          <div key={it.name} style={{ position: "relative", overflow: "hidden", border: "2px solid #000" }}>
            {/* each tile is its own 540x640 sequence-sized canvas */}
            <AbsoluteFill style={{ width: 540, height: 640 }}>
              <TileFrame item={it} />
            </AbsoluteFill>
            {it.ref && (
              <Img src={staticFile(it.ref)} style={{ position: "absolute", right: 8, top: 8, width: 170, border: "3px solid white" }} />
            )}
            <div style={{ position: "absolute", left: 12, bottom: 8, color: "white", font: "bold 34px Arial" }}>{it.name}</div>
          </div>
        ))}
    </AbsoluteFill>
  );
};

// ThreeCanvas takes its size from useVideoConfig(); give it a tile-sized config via a Sequence.
const TileFrame: React.FC<{ item: SheetItem }> = ({ item }) => (
  <Sequence width={540} height={640} layout="none">
    <Tile item={item} />
  </Sequence>
);
