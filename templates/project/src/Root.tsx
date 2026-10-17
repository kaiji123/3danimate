import React from "react";
import { Composition } from "remotion";
import { videoFrames } from "./lib/timing";
import { ShortVideo } from "./ShortVideo";
import { EXAMPLE_SCENES } from "./example/scenes";
import { ActorTest } from "./qa/ActorTest";
import { ModelSheet } from "./qa/ModelSheet";

const Example: React.FC = () => <ShortVideo video="example" scenes={EXAMPLE_SCENES} osdDate="MAR 04 1994" />;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Example" component={Example} durationInFrames={videoFrames("example")} fps={30} width={1080} height={1920} />
    <Composition id="ActorTest" component={ActorTest} durationInFrames={90} fps={30} width={1080} height={1920} />
    <Composition id="ModelSheet" component={ModelSheet} durationInFrames={120} fps={30} width={1080} height={1920} />
  </>
);
