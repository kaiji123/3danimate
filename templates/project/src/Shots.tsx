// Hard cuts inside a scene. Each shot runs from its `from` to the next shot's
// `from`; key every `from` to a narration word (2–4 frames early).
import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { sceneById } from "./lib/timing";
import { CutGlitch, useVhs } from "./Vhs";

export type Shot = { from: number; C: React.FC };

// Heavy VHS filter for the first frames of every shot (the cut glitch).
const ShotBody: React.FC<{ C: React.FC }> = ({ C }) => {
  const vhs = useVhs();
  const f = useCurrentFrame();
  const heavy = vhs && f < 4;
  return (
    <AbsoluteFill style={heavy ? { filter: "url(#vhs-heavy)" } : undefined}>
      <C />
      {vhs && <CutGlitch />}
    </AbsoluteFill>
  );
};

/**
 * Shot components (`C`) MUST be defined at module level. A component defined
 * inside another component is a new type every render, so the 3D canvas
 * re-mounts every frame.
 */
export const Shots: React.FC<{ scene: string; shots: Shot[]; total?: number }> = ({
  scene,
  shots,
  total,
}) => {
  const end = total ?? sceneById(scene).frames;
  const sorted = [...shots].sort((a, b) => a.from - b.from);
  return (
    <>
      {sorted.map((s, i) => {
        const from = Math.max(0, s.from);
        const to = i + 1 < sorted.length ? sorted[i + 1].from : end;
        if (to <= from) return null;
        return (
          <Sequence key={i} from={from} durationInFrames={to - from} layout="absolute-fill">
            <ShotBody C={s.C} />
          </Sequence>
        );
      })}
    </>
  );
};
