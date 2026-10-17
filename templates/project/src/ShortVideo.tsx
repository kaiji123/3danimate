// Shared shell: scenes in series with their narration, the music bed, the VHS
// treatment and the captions on top. Scenes mount only after the asset gate.
import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, Series, staticFile, useVideoConfig } from "remotion";
import { Captions } from "./Captions";
import { timelineOf, videoFrames } from "./lib/timing";
import { useAssetsReady } from "./three/assets";
import { VhsContext, VhsDefs, VhsOsd, VhsOverlay, VhsPicture } from "./Vhs";

export type SceneMap = Record<string, React.FC>;

export const ShortVideo: React.FC<{
  video: string;
  scenes: SceneMap;
  /** music bed file in public/, e.g. "sfx/music.wav" */
  music?: string;
  musicVolume?: number;
  vhs?: boolean;
  /** camcorder date stamp, set to the story's date, e.g. "FEB 15 2003" */
  osdDate?: string;
}> = ({ video, scenes, music = "sfx/music.wav", musicVolume = 0.16, vhs = true, osdDate = "" }) => {
  const ready = useAssetsReady();
  const { fps } = useVideoConfig();
  const tl = timelineOf(video);
  const total = videoFrames(video);
  const missing = tl.scenes.filter((s) => !scenes[s.id]).map((s) => s.id);
  if (missing.length) throw new Error(`No component for scene(s): ${missing.join(", ")}`);

  const body = (
    <Series>
      {tl.scenes.map((s) => {
        const C = scenes[s.id];
        return (
          <Series.Sequence key={s.id} durationInFrames={s.frames} name={s.id}>
            <C />
            <Audio src={staticFile(s.audio)} />
          </Series.Sequence>
        );
      })}
    </Series>
  );

  return (
    <VhsContext.Provider value={vhs}>
      <AbsoluteFill style={{ background: "#000" }}>
        {vhs && <VhsDefs />}
        {ready && (vhs ? <VhsPicture>{body}</VhsPicture> : body)}
        {music && (
          <Audio
            src={staticFile(music)}
            loop
            volume={(f) =>
              musicVolume *
              interpolate(f, [0, fps, total - 2 * fps, total], [0, 1, 1, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })
            }
          />
        )}
        {vhs && <VhsOverlay />}
        {vhs && <VhsOsd date={osdDate} />}
        <Series>
          {tl.scenes.map((s) => (
            <Series.Sequence key={s.id} durationInFrames={s.frames} name={`captions ${s.id}`}>
              <Captions words={s.words} />
            </Series.Sequence>
          ))}
        </Series>
      </AbsoluteFill>
    </VhsContext.Provider>
  );
};

/** Sound effect on a story beat (not on every cut): <Sfx name="coin" at={F("won")} /> */
export const Sfx: React.FC<{ name: string; at: number; volume?: number }> = ({ name, at, volume = 0.7 }) => (
  <Sequence from={at} durationInFrames={90} layout="none">
    <Audio src={staticFile(`sfx/${name}.wav`)} volume={volume} />
  </Sequence>
);
