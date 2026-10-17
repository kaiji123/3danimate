// Prove the pipeline before building scenes: 4–5 actors on different clips.
// Render 3 stills and check: clips play (not rest pose), the head sits on the
// neck and faces forward, clothing colours land on the right parts, and
// `travel` moves the walker in its facing direction. Takes 2 minutes and
// isolates rig bugs from scene bugs.
//   COMP=ActorTest node scripts/stills.mjs out/actor-test 0 30 60
import React from "react";
import { AbsoluteFill } from "remotion";
import { useSecs } from "../lib/timing";
import { useAssetsReady } from "../three/assets";
import { Actor, type Look } from "../three/Actor";
import { Chair, Floor } from "../three/kit";
import { Cam, KeyFill, Stage } from "../three/Stage";

const TEST: Look = { face: "clerk", skin: "#d9a88c", jacket: "#2a6f97", trousers: "#3d3d3d", shoes: "#111", shirt: "#eee", tie: "#b22" };

const Scene: React.FC = () => {
  const s = useSecs();
  return (
    <Stage bg="#20242c" fog={false} ambient={1}>
      <KeyFill />
      <Floor color="#4a4f5a" />
      <Actor look={TEST} position={[-0.7, 0, 0]} layers={[{ clip: "idle_loop", t: s }]} />
      <Actor look={TEST} position={[0.7, 0, 0]} layers={[{ clip: "idle_talking_loop", t: s }]} expr={{ mouth: "open" }} />
      <Chair position={[-0.7, 0, -1.6]} />
      <Actor look={TEST} position={[-0.7, 0, -1.6]} layers={[{ clip: "sitting_idle_loop", t: s }]} />
      <Actor look={TEST} position={[0.7, 0, -2.2]} layers={[{ clip: "walk_formal_loop", t: s }]} travel />
      <Cam pos={[0, 2.2, 7.5]} look={[0, 0.8, -1]} fov={36} />
    </Stage>
  );
};

export const ActorTest: React.FC = () => {
  const ready = useAssetsReady();
  return <AbsoluteFill style={{ background: "#000" }}>{ready && <Scene />}</AbsoluteFill>;
};
