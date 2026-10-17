---
name: 3d-animate
description: Make fully generated low-poly 3D animated story videos (vertical 1080x1920 shorts, ~60 s) with Remotion + three.js/react-three-fiber. Covers narration with word-timed hard cuts (edge-tts), mocap-animated low-poly characters (CC0 ActionForge/Quaternius clips) with photo-mosaic faces from AI portraits, canonical props modelled from reference photos, captions, pop-ups, synthesized music/SFX, an optional VHS tape look, and a stills-based visual QA loop. Use when the user wants to create, animate or render a 3D animated short, explainer or story video, a low-poly/animated "true story" video, animate characters in 3D with mocap clips, or extend a project built this way.
---

# 3D Animate: low-poly story shorts

Everything is generated: 3D scenes, voice, music and effects. No stock footage,
so nothing to license or censor. The result is a vertical short in which a
narrated story plays over a flat-shaded low-poly 3D world, with hard cuts that
land on the narration's words.

## The format (defaults; follow the user's brief where it differs)

| Element | Spec |
| --- | --- |
| Canvas | 1080×1920, 30 fps, 50–65 s |
| Story | One true, surprising story with a twist (e.g. "someone beat the system") |
| Hook | The first line is a **question** the story answers |
| Pacing | A **hard cut every 2–3 s**. Each cut lands on a narration word; the camera is always slowly moving |
| World | Low-poly, flat-shaded 3D. Moody light: warm key, cool fill, spotlights, fog |
| People | Low-poly mocap-animated bodies with **photo-mosaic faces** from AI portraits |
| Captions | 1–3 words at a time, white, heavy black outline, at `top: 1340px` |
| Pop-ups | Big numbers/key words pop in (`+$3`, `9 / 10`); a rubber stamp for the ending |
| Audio | Narration, a quiet tense music bed (~0.16), SFX on key beats only |
| Finish | Optional VHS filter + camcorder OSD; captions stay crisp on top |

## Toolchain

Node 18+, Python 3.10+ with `edge-tts>=7.3` (older versions get HTTP 403 from
the TTS endpoint), `numpy`, `scipy`, `pillow`; `ffmpeg`/`ffprobe` on PATH.
Remotion downloads its own headless Chrome on first render. Optional: Blender
(for custom mocap retargeting only).

```bash
pip install "edge-tts>=7.3" numpy scipy pillow
```

## Skill contents

- `scripts/scaffold.py <dir>`: new project from `templates/project/` (the kit below) plus these helpers
- `scripts/generate_audio.py <video>`: narration mp3s + `timeline.json` with word timings
- `scripts/generate_sfx.py`: synthesized music bed + SFX (scratch, coin, cash, whoosh, thud, click, riser)
- `scripts/process_faces.py`: AI portraits → low-poly mosaic face textures
- `scripts/fetch_actionforge.py list|get`: browse/download CC0 mocap clips and the rig
- `scripts/commons_refs.py search|get`: Wikimedia Commons reference photos with licences logged
- `scripts/contact_sheet.py`: tile stills, or sample a finished video every N s
- `templates/project/`: Remotion project. `ShortVideo` shell, `Shots`, `Captions`, `Overlays`, `Vhs`, `three/` (`Stage`, `Cam`, `Spot`, `Actor`, `Head`, faces, asset gate, kit), an example video, `ActorTest` + `ModelSheet` QA comps, `scripts/stills.mjs`

Read these references when you reach the step that needs them:

| File | When |
| --- | --- |
| [references/story-and-timing.md](references/story-and-timing.md) | writing the script, keying cuts to words |
| [references/characters.md](references/characters.md) | casting faces, choosing/driving clips, attaching props to hands |
| [references/props.md](references/props.md) | any object that appears in more than one shot |
| [references/look-and-sound.md](references/look-and-sound.md) | 3D rules, lighting, VHS tuning, captions/pop-ups, audio |
| [references/qa.md](references/qa.md) | every stills pass and the final render (symptom → fix table) |
| [references/custom-capture.md](references/custom-capture.md) | a beat with no usable library clip |

## Workflow

Run commands from the project root. Use a short unique prefix per video
(`h-` for heist) on every scene id: ids must be unique across all videos.

1. **Scaffold** (new project only): `python <skill>/scripts/scaffold.py <dir>`, then `npm install`.
   An existing project: reuse its kit and add `src/<video>/`.
2. **Inventory clips, then choose/shape the story.** `python scripts/fetch_actionforge.py list`.
   The library is mostly game actions (walks, sneaking, sitting, talking,
   phone, interacting, chest opening, eating, driving, combat). Map each story
   beat to a clip. Beats with no clip: show the object instead of the person,
   or capture a custom clip (references/custom-capture.md).
3. **Fact-check, then write `data/<video>/script.json`**: 150–170 words,
   7–10 scenes, shape *question hook → who/where/when → insight → method (with
   a number) → temptation → twist → one-line ending*. Keep the sources'
   hedges ("allegedly"). Details: references/story-and-timing.md.
4. **Voice**: `python scripts/generate_audio.py <video>`, register the timeline
   in `src/timelines.ts`. Re-run after every script change: cuts re-time themselves.
5. **Cast faces**: download AI portraits (never a real person's photo) to
   `assets/faces-src/<role>.jpg`, set hair colours in `assets/faces-src/faces.json`,
   run `python scripts/process_faces.py`, add names to `FACE_NAMES` and a `Look` per character.
6. **Clips**: `python scripts/fetch_actionforge.py get public/anims <clip> ...`, then add
   every name to `CLIP_NAMES` in `src/three/assets.ts` (the asset gate).
7. **Prove the pipeline** before any scene: point `ActorTest` at your looks/clips,
   `COMP=ActorTest node scripts/stills.mjs out/actor-test 0 30 60`. Check that the clips play,
   heads sit on necks facing forward, the clothes land right, and `travel` follows the facing.
8. **Props**: list every object that appears in more than one shot, then collect
   references, write a `SPEC`, build each one once in `src/<video>/models.tsx`,
   and verify it in `ModelSheet` (references/props.md).
9. **Sets + scenes**: set pieces in `src/<video>/kit.tsx` (boxes, cylinders and
   icosahedrons, flat shaded); one component per narration scene in `src/<video>/scenes.tsx`,
   each a `<Shots>` list of 2–5 shots with every cut keyed to a word, plus 1 pop-up and
   1 SFX per key beat. Model it on `src/example/scenes.tsx`.
10. **Register**: map scene ids → components, wrap them in `<ShortVideo video=… scenes=… osdDate=…>`, and add
    a `<Composition>` in `src/Root.tsx` with `durationInFrames={videoFrames("<video>")}`.
11. **QA loop**: `python scripts/generate_sfx.py` (once), then render stills, 1–2 per shot:
    `COMP=<Comp> node scripts/stills.mjs out/qa <scene-id> <scene-id>+40 …`. Look at
    `out/qa/sheet.png`, fix, re-render those frames. Repeat per scene group (references/qa.md).
12. **Render**: `npx remotion render src/index.ts <Comp> out/<video>.mp4`, then
    run the final checks (duration, loudness, a contact sheet every 2.5 s).

Always look at the stills yourself (open the PNGs) before declaring a scene
done. The first contact sheet is usually mostly black or empty. That is
normal, and the QA table maps each symptom to its fix.

## Hard rules (each one cost a debugging session)

- **Determinism**: animate only from `useCurrentFrame()`/`useSecs()`. No `useFrame`,
  no clocks, no `Math.random()` (use Remotion's `random(seed)`).
- **Asset gate**: every image/GLB goes through `src/three/assets.ts`. A texture that
  arrives after the canvas renders never reaches the frame.
- **Shot components at module level**: a component defined inside another
  component re-mounts the 3D canvas every frame.
- **Vertical frame = narrow FOV**: 40° vertical is only about 24° wide. Stack subjects in
  depth, keep them within ±0.6 m of the look-at line, and put the camera behind a walker on the
  walking axis (`rotationY={Math.PI}` walks away from a camera at +z).
- **Use `<Spot target>`**, never `<spotLight target-position>` (that one aims at the origin).
  Interior walls and ceilings use `shadow={false}`.
- **Cut 2–4 frames before the word**; get QA frame numbers from the current
  `timeline.json` (or `scene-id+n` specs), never from an old render.
- **No stand-ins in scenes**: a recurring prop gets one canonical model at one fixed story scale.
- **Pop-ups above ~70 %** of the frame (captions sit at 1340 px). Give `Stamp`/`PopText` an `until` when anything follows.
- **Licences**: ActionForge clips are CC0; check that `list` shows CC0. Reference photos are logged in
  `public/refs/SOURCES.txt`. Custom-capture footage is your own or CC0/CC-BY.
