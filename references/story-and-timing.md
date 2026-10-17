# Story and timing

## Picking the story
- One true, surprising story with a satisfying twist: someone who beat a
  casino, lottery, exam, bank or market with an insight; a heist; a con.
- **Start from the clip catalog, not the script** when characters carry the
  story (`python scripts/fetch_actionforge.py list`). A story whose beats map
  almost one-to-one onto available clips is much cheaper to make well. Example
  mapping from a heist short:

| Story beat | Clip(s) |
| --- | --- |
| arrives, walks to the vault | `walk_formal_loop` |
| runs a fake business / talks to clients | `sitting_talking_loop`, `idle_talking_loop`, client nods `yes` |
| sprays a sensor, tapes over a sensor | `interact` (played once, held at 0.9 s) |
| crew sneaks in | `crouch_fwd_loop` |
| works on a mechanism on the floor | `fixing_kneeling` |
| opens boxes | `chest_open` (two actors, offset 0.6 s) |
| carries loot, dumps trash | `walk_carry_loop`, then `pickup_table` |
| getaway car | `driving_loop` (actor scaled 0.95, seated in a car) |
| witness calls the police | `idle_talkingphone_loop` |
| eats (the evidence) | `consume` |
| prison | `sitting_idle_loop` |

- If a beat has no clip: show the object rather than the person (sensor
  close-up, a counter, the loot pile, a DNA helix), or capture a custom clip
  (custom-capture.md) when the person *is* the beat.

## Fact-check
- Use 2–3 sources, with Wikipedia as the baseline. Write down dates, counts and amounts.
- If sources disagree, use the conservative figure or phrase it vaguely ("he was
  right", not "19 of 20"; "over $100M").
- Keep the hedges the sources use: "he **allegedly** sprayed hairspray".
- Never put a real photo of a real person on a character. Use AI faces and a name tag (`Tag`).

## Script (`data/<video>/script.json`)
- 150–170 words gives ~60 s at edge-tts `+12%`.
- Shape: **question hook → who/where/when → the insight → the method (with a
  number) → the temptation → the twist → the one-line ending.**
- Short sentences. Every sentence should suggest a picture: each becomes 1–2 shots.
- 7–10 scenes, ids unique across ALL videos, prefixed per video.

```json
{
  "voice": "en-US-AndrewNeural",
  "rate": "+12%",
  "fps": 30,
  "scenes": [
    { "id": "h-hook", "text": "Can you rob the most secure vault on Earth, and get caught by a sandwich?" },
    { "id": "h-tenant", "text": "In 2000, a man rented an office in Antwerp's Diamond Centre..." }
  ]
}
```

Run `python scripts/generate_audio.py <video>` (add `--only <scene-id>` to redo
one scene). It prints the total length: aim for 50–65 s. The endpoint
sometimes returns 403; the script retries with backoff, and a persistent 403
means edge-tts needs upgrading. Then register the timeline in `src/timelines.ts`:

```ts
import heist from "../data/heist/timeline.json";
export const TIMELINES: Timeline[] = [example as Timeline, heist as Timeline];
```

Timeline facts: each scene lasts its audio plus a 250 ms tail; the last scene
gets an extra 1 s hold. Words carry `w` (bare, for lookups) and `text` (with
punctuation restored, so captions break at sentence ends).

## Cutting on words (`src/lib/timing.ts`)
Scenes never hard-code seconds. They ask where a word starts:

```tsx
const F = W("h-vault");                         // scene-relative frames
<Shots scene="h-vault" shots={[
  { from: 0, C: Corridor },
  { from: F("sensor") - 3, C: SensorClose },    // picture leads the voice by 2–4 frames
  { from: F("hairspray") - 3, C: Spray },
]} />
<PopText text="189 BOXES" at={F("boxes")} until={F("boxes") + 45} />
<Sfx name="whoosh" at={F("vault") - 6} />
```

- `wordFrame`/`W` match by **word prefix** after stripping punctuation. If a word
  repeats in a scene, pass an occurrence index (`F("he", 1)`) or key on a
  unique neighbour. A missing word throws an error that lists the scene's words.
- Re-recording the narration re-times every cut automatically.
- `useSecs(offset)` = seconds since the shot started (drive clips with it);
  `useShotProgress()` = 0→1 across the shot (drive camera moves with it, eased
  by `ease`). Inside a `Sequence`, `useVideoConfig().durationInFrames` is the shot length.
- Pacing check: if a shot runs longer than ~3 s, split it on another word.
