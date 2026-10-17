# Look and sound

## 3D rules (Remotion + react-three-fiber)
- Everything animates from `useCurrentFrame()` (`useSecs`, `useShotProgress`).
  **No `useFrame`**, no self-running animations, no `Math.random()`.
- `<Cam pos look fov roll>` mutates the default camera during render, so every
  frame is fully determined by its props. Keep the camera always slightly moving:
  `lerp3(a, b, ease(useShotProgress()))`, or `pos[2] - s * 0.1`.
- **Vertical frame = narrow horizontal FOV.** 40° vertical on 9:16 is about 24° wide.
  Stack subjects in depth rather than side by side, keep labels within ±0.6 m
  at 4–5 m, and check the framing in stills.
- Street shots: two rows of buildings facing each other along z, with the camera
  looking down the street. A row running across the street sits in front of the camera as a wall.
- Physically based lights: spot/point lights need large intensities (60–180);
  directional lights work at ~1–2.5. `KeyFill` = warm key + cool fill.
- `<Spot position target>` (Stage.tsx), never `<spotLight target-position>`,
  which silently aims at the origin because its target isn't in the scene.
- Interior shells (walls, ceiling) must not cast shadows (`shadow={false}`),
  or a high key light leaves the whole room black.
- Dark "night" scenes need more fill (`ambient`) than looks right in isolation,
  because the VHS grade crushes the blacks further.
- `torusGeometry` already lies in the XY plane, so a ring facing the camera needs no rotation.
- Canvas-drawn textures (signs, tickets, screens, faces) give dynamic 2D
  detail in 3D. Redraw per frame only for hero objects; crowds share one static texture.
- Layered canvas trick (scratch-off, reveal): draw the coating on its own
  canvas, erase it with `globalCompositeOperation = "destination-out"`, then
  composite it over the content. Erasing on the main canvas punches through to black.

## VHS treatment (`src/Vhs.tsx`; `vhs={false}` on ShortVideo turns it off)
```
<VhsPicture>   SVG filter + CSS grade + jitter over all scenes
<VhsOverlay/>  grain, scanlines, tracking band, head-switch noise, vignette
<VhsOsd/>      "PLAY ►", "SP", running timecode, date stamp
<Captions/>    unfiltered, always readable
```
- SVG filter `#vhs`: y-only `feTurbulence` → `feDisplacementMap` on x (per-line
  wobble); R and B split with `feColorMatrix` + `feOffset` (±3 px) and recombined
  with `screen`; an anisotropic blur (1.6 px horizontal, 0.4 px vertical) imitates VHS's low horizontal resolution.
- CSS grade `saturate(.78) contrast(1.12) brightness(1.04) sepia(.18)` + sub-pixel jitter.
- Every shot cut gets ~4 frames of the heavy filter + tearing lines (`Shots` does
  this). Rare random hiccups happen in between. A tracking band rolls down every 4 s.
- Tuning lives in `VHS` (`split`, `wobble`, `scanlineAlpha`). Set `osdDate` to the story's date.

## Captions and pop-ups
- `Captions` are automatic from the timeline: bites of 1–3 words, breaking at
  punctuation or pauses, at `top: 1340px`, white with a heavy black outline.
- `PopText` for numbers and key words (`+$3`, `72`, `9 / 10`, `$600 / DAY`) on the word they're spoken.
- `Stamp` for the ending (`DISCONTINUED`, `10 YEARS`), with a thud SFX. Give it `until` if anything follows.
- `Tag` for names and places (lower-third, above the captions).
- Keep everything above ~70 % of the frame height so it never collides with captions.

## Audio
- **Voice**: edge-tts `en-US-AndrewNeural` at `+12%` (set in script.json).
  Other good narrators: `en-US-GuyNeural`, `en-GB-RyanNeural`. List them with `edge-tts --list-voices`.
- **Music**: `python scripts/generate_sfx.py [--seconds 75 --bpm 96]` builds a
  minor-key bed (Am–F–C–E): detuned-saw pad, soft kick on every beat, off-beat
  ticking hats, Karplus-Strong pizzicato arpeggio. `ShortVideo` plays it at 0.16 with fades.
- **SFX** go on story beats, not on every cut: `scratch` for scratching, `coin` for a
  win/reveal, `cash` for money, `whoosh` for a big transition, `thud` for a
  stamp, `click` for a camera/lock, `riser` before the twist.
  `<Sfx name="coin" at={F("won")} />`.
- Target: final max volume ≈ -2 dB (check with `volumedetect`, see qa.md).
