// Narrated videos only (optional, see references/story-and-timing.md): every
// video's timeline.json is registered here, so wordFrame/sceneById can look
// across all of them. Generate one with: python scripts/generate_audio.py <video>
//   import example from "../data/example/timeline.json";
//   export const TIMELINES: Timeline[] = [example as Timeline];
import type { Timeline } from "./lib/timing";

export const TIMELINES: Timeline[] = [];
