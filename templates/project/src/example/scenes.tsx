// Example video: one exported component per narration scene, each a <Shots>
// list whose cuts are keyed to words. Shot components live at module level.
import React from "react";
import { PopText, Stamp, Tag } from "../Overlays";
import { Sfx } from "../ShortVideo";
import { Shots } from "../Shots";
import { ease, lerp3, useSecs, useShotProgress, W } from "../lib/timing";
import { Actor, type Look } from "../three/Actor";
import { Chair, Desk, Floor, Block, Label3D } from "../three/kit";
import { Cam, KeyFill, Spot, Stage } from "../three/Stage";

export const CLERK: Look = {
  face: "clerk",
  skin: "#d9a88c",
  jacket: "#2e3b55",
  trousers: "#23262e",
  shoes: "#151515",
  shirt: "#e8e4da",
  tie: "#8a1f2b",
};

// ------------------------------------------------------------ shared sets
const Bank: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <>
    <KeyFill />
    <Spot position={[0, 5, 2]} target={[0, 0, -2]} intensity={140} />
    <Floor color="#3a3328" />
    <Block size={[12, 6, 0.3]} position={[0, 3, -6]} color="#5a4a3a" shadow={false} />
    {[-3, 0, 3].map((x) => (
      <Block key={x} size={[0.5, 6, 0.5]} position={[x, 3, -5.5]} color="#c8b89a" />
    ))}
    <Label3D text="BANK" position={[0, 4.2, -5.8]} width={2.4} color="#e8d9a8" bg="#2a2018" />
    {children}
  </>
);

// --------------------------------------------------------------- ex-hook
const HookWalk: React.FC = () => {
  const s = useSecs();
  const p = ease(useShotProgress());
  return (
    <Stage>
      <Bank />
      {/* walks away from the camera along z: stays inside the narrow vertical frame */}
      <Actor look={CLERK} position={[0, 0, 3]} rotationY={Math.PI} layers={[{ clip: "walk_formal_loop", t: s }]} travel />
      <Cam pos={lerp3([0.3, 1.5, 6.5], [0.1, 1.7, 5.6], p)} look={[0, 1.2, 0]} />
    </Stage>
  );
};

const HookFace: React.FC = () => {
  const s = useSecs();
  return (
    <Stage>
      <Bank />
      <Actor look={CLERK} layers={[{ clip: "idle_loop", t: s }]} expr={{ mouth: "open" }} />
      <Cam pos={[0, 1.62, 2.2 - s * 0.08]} look={[0, 1.55, 0]} fov={30} />
    </Stage>
  );
};

export const ExHook: React.FC = () => {
  const F = W("ex-hook");
  return (
    <>
      <Shots scene="ex-hook" shots={[{ from: 0, C: HookWalk }, { from: F("question") - 3, C: HookFace }]} />
      <PopText text="$$$?" at={F("fortune")} />
      <Sfx name="whoosh" at={F("fortune") - 6} />
    </>
  );
};

// --------------------------------------------------------------- ex-desk
const DeskWide: React.FC = () => {
  const s = useSecs();
  const p = useShotProgress();
  return (
    <Stage>
      <Bank>
        <Desk position={[0, 0, 0.55]} />
        <Chair position={[0, 0, 0]} />
      </Bank>
      <Actor look={CLERK} layers={[{ clip: "sitting_idle_loop", t: s }]} />
      <Cam pos={lerp3([1.2, 1.9, 4], [0.6, 1.7, 3.3], p)} look={[0, 1, 0.3]} />
    </Stage>
  );
};

const DeskNod: React.FC = () => {
  const s = useSecs();
  return (
    <Stage>
      <Bank />
      <Actor look={CLERK} layers={[{ clip: "yes", t: s }]} expr={{ brows: -1 }} />
      <Cam pos={[0.4, 1.55, 2.4 - s * 0.1]} look={[0, 1.35, 0]} fov={34} />
    </Stage>
  );
};

export const ExDesk: React.FC = () => {
  const F = W("ex-desk");
  return (
    <>
      <Shots scene="ex-desk" shots={[{ from: 0, C: DeskWide }, { from: F("machine") - 3, C: DeskNod }]} />
      <Tag title="PAUL" sub="bank clerk, 1994" at={F("clerk")} until={F("noticed") + 30} />
      <PopText text="x2" at={F("twice")} size={260} />
      <Sfx name="cash" at={F("twice")} />
    </>
  );
};

// ---------------------------------------------------------------- ex-end
const EndShot: React.FC = () => {
  const s = useSecs();
  return (
    <Stage bg="#0b0c10" ambient={0.8}>
      <Bank />
      <Actor look={CLERK} layers={[{ clip: "idle_talking_loop", t: s + 0.4 }]} expr={{ eyesClosed: s > 1.5 }} />
      <Cam pos={[0, 1.5, 3.2 - s * 0.15]} look={[0, 1.3, 0]} />
    </Stage>
  );
};

export const ExEnd: React.FC = () => {
  const F = W("ex-end");
  return (
    <>
      <Shots scene="ex-end" shots={[{ from: 0, C: EndShot }]} />
      <Stamp text="CLASSIFIED" at={F("now")} />
      <Sfx name="thud" at={F("now")} />
    </>
  );
};

export const EXAMPLE_SCENES = { "ex-hook": ExHook, "ex-desk": ExDesk, "ex-end": ExEnd };
