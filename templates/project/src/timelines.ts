// Every video's timeline.json is registered here, so wordFrame/sceneById can
// look across all of them. Regenerate with: python scripts/generate_audio.py <video>
import type { Timeline } from "./lib/timing";
import example from "../data/example/timeline.json";

export const TIMELINES: Timeline[] = [example as Timeline];
