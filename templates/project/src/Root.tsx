import React from "react";
import { Composition } from "remotion";
import { CHAIN_FRAMES, ClipChain, ClipGrid } from "./demo/ClipDemos";
import { ModelSheet } from "./qa/ModelSheet";

// Optional narrated story short (needs generate_audio.py, a face, and the
// timeline registered in src/timelines.ts; see references/story-and-timing.md):
//   import { videoFrames } from "./lib/timing";
//   import { ShortVideo } from "./ShortVideo";
//   import { EXAMPLE_SCENES } from "./example/scenes";
//   const Example = () => <ShortVideo video="example" scenes={EXAMPLE_SCENES} osdDate="MAR 04 1994" />;
//   <Composition id="Example" component={Example} durationInFrames={videoFrames("example")} fps={30} width={1080} height={1920} />

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="ClipGrid" component={ClipGrid} durationInFrames={120} fps={30} width={1080} height={1080} />
    <Composition id="ClipChain" component={ClipChain} durationInFrames={CHAIN_FRAMES} fps={30} width={720} height={720} />
    <Composition id="ModelSheet" component={ModelSheet} durationInFrames={120} fps={30} width={1080} height={1920} />
  </>
);
