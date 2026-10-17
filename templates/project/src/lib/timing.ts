// Cut on the words: scenes never hard-code seconds, they ask where a word starts.
// Timelines come from scripts/generate_audio.py (data/<video>/timeline.json).
import { useCurrentFrame, useVideoConfig } from "remotion";
import { TIMELINES } from "../timelines";

export type Word = { w: string; text: string; startMs: number; endMs: number };
export type SceneTiming = {
  id: string;
  audio: string;
  audioMs: number;
  frames: number;
  words: Word[];
};
export type Timeline = { video: string; fps: number; scenes: SceneTiming[] };

const norm = (s: string) => s.toLowerCase().replace(/[^0-9a-z$%]/g, "");

export function timelineOf(video: string): Timeline {
  const tl = TIMELINES.find((t) => t.video === video);
  if (!tl) throw new Error(`No timeline "${video}". Register it in src/timelines.ts`);
  return tl;
}

/** Scene ids are unique across ALL videos (prefix them per video: "h-", "s-"). */
export function sceneById(id: string): SceneTiming {
  for (const tl of TIMELINES) {
    const s = tl.scenes.find((x) => x.id === id);
    if (s) return s;
  }
  throw new Error(`No scene "${id}" in any timeline. Re-run generate_audio.py?`);
}

export const videoFrames = (video: string) =>
  timelineOf(video).scenes.reduce((n, s) => n + s.frames, 0);

/** Absolute frame where each scene starts, for QA stills. */
export function sceneStarts(video: string): Record<string, number> {
  let f = 0;
  const out: Record<string, number> = {};
  for (const s of timelineOf(video).scenes) {
    out[s.id] = f;
    f += s.frames;
  }
  return out;
}

/**
 * Scene-relative frame where `word` starts. Matches by word PREFIX after
 * stripping punctuation ("scratch" matches "scratched"). If the word repeats,
 * pass `occurrence` (0-based) or key on a unique neighbour instead.
 */
export function wordFrame(sceneId: string, word: string, occurrence = 0, fps = 30): number {
  const s = sceneById(sceneId);
  const key = norm(word);
  const hits = s.words.filter((x) => norm(x.w).startsWith(key));
  const hit = hits[occurrence];
  if (!hit) {
    throw new Error(
      `Word "${word}" (#${occurrence}) not in scene ${sceneId}. Words: ${s.words.map((x) => x.w).join(" ")}`,
    );
  }
  return Math.round((hit.startMs / 1000) * fps);
}

/** `const F = W("h-vault"); F("sprayed") - 3` */
export const W =
  (sceneId: string) =>
  (word: string, occurrence = 0) =>
    wordFrame(sceneId, word, occurrence);

/** Seconds since the current Sequence (shot) started, optionally offset. */
export function useSecs(offset = 0): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps + offset;
}

/** 0 → 1 across the current Sequence (shot): drive slow camera moves with it. */
export function useShotProgress(): number {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return Math.min(1, frame / Math.max(1, durationInFrames - 1));
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerp3 = (
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): [number, number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
/** Smoothstep easing for camera moves that should start/stop softly. */
export const ease = (t: number) => t * t * (3 - 2 * t);
