---
name: 3d-animate
description: Animate rigged humanoid characters in 3D and render them to video with Remotion + three.js/react-three-fiber. Plays, blends and chains CC0 mocap clips (ActionForge/Quaternius library: walks, runs, combat, dance, sitting, gestures, interactions) on a skinned humanoid rig (a plain mannequin by default), deterministically frame by frame, with root motion, props attached to bones, camera moves, and a stills-based visual QA loop. Use when the user wants to animate a 3D humanoid/character/mannequin, apply or preview mocap clips on a rig, chain or cross-fade animations, render a character animation to MP4/GIF, or extend a project built this way. Optional extras (only when asked): narrated story shorts, photo-mosaic faces, captions, VHS look.
---

# 3D Animate: rigged humanoids + mocap clips

Drive a skinned humanoid rig with mocap clips and render the result with
Remotion. The default character is the bare Quaternius mannequin (a neutral grey
rig, no face or clothes). The clip library is CC0. Every frame is computed
from the frame number, so renders are reproducible and can be scrubbed.

## Toolchain

Node 18+ and Python 3.10+ (standard library only for the clip fetcher). Remotion
downloads its own headless Chrome on the first render. `ffmpeg` is optional
(GIFs, contact sheets of finished videos). Blender is optional (retargeting
other rigs or captured motion).

## Skill contents

- `scripts/scaffold.py <dir>`: new project from `templates/project/`, plus the Python helpers
- `scripts/fetch_actionforge.py list|get`: browse and download CC0 clips and the rig
- `scripts/contact_sheet.py`: tile stills, or sample a finished video every N s
- `templates/project/`: the Remotion project:
  - `src/three/Mannequin.tsx`: the bare rig driven by clip `layers` (default character)
  - `src/three/Actor.tsx`: the same rig plus clothes, a face and props on bones (optional)
  - `src/three/assets.ts`: the asset gate (every GLB and image preloads here)
  - `src/three/Stage.tsx`: `Stage`, `Cam`, `Spot`, `KeyFill`
  - `src/three/kit.tsx`: `Floor`, `Block`, `Chair`, `Desk`, `Label3D`
  - `src/demo/ClipDemos.tsx`: `ClipGrid` (nine clips on one rig) and `ClipChain` (cross-faded chain)
  - `scripts/stills.mjs`: renders chosen frames and tiles a contact sheet

| Reference | Read when |
| --- | --- |
| [references/characters.md](references/characters.md) | choosing and driving clips, root motion, props on bones, `Actor` looks |
| [references/custom-capture.md](references/custom-capture.md) | no library clip fits: video → pose → retarget → cleanup |
| [references/qa.md](references/qa.md) | every stills pass and the final render (symptom → fix table) |
| [references/look-and-sound.md](references/look-and-sound.md) | 3D/lighting rules (first section); the rest only for story shorts |
| [references/props.md](references/props.md) | an object that recurs across shots and needs one canonical model |

## Workflow

Run the commands from the project root.

1. **Scaffold**: `python <skill>/scripts/scaffold.py <dir>`, then `cd <dir> && npm install`.
2. **Pick clips**: `python scripts/fetch_actionforge.py list` (or `--filter walk`).
   The columns are name, duration, loop, root-motion metres and licence. Check
   that every clip you use is CC0.
3. **Download**: `python scripts/fetch_actionforge.py get public/anims <clip> ...`
   (this always fetches `rig-human.glb` too). Add every clip name to `CLIP_NAMES`
   in `src/three/assets.ts`. The template already lists the ten clips its demos use.
   Fetch those as well, or trim the list and the demos.
4. **Check the rig**: `COMP=ClipGrid node scripts/stills.mjs out/check 0 30 60`,
   then open `out/check/sheet.png`. Each tile should show a different pose,
   not a rest/T-pose, with feet on the floor and the character facing the camera.
5. **Build the animation**: a composition in `src/<name>/` (use `ClipDemos.tsx`
   as the model), registered in `src/Root.tsx`:
   ```tsx
   const s = useCurrentFrame() / 30;                       // or useSecs() inside a Sequence
   <Mannequin layers={[{ clip: "walk_loop", t: s }]} />
   // chain / blend: cross-fade weights over ~8–10 frames
   <Mannequin layers={[{ clip: "walk_loop", t: s, weight: 1 - w }, { clip: "punch_cross", t: s, weight: w }]} />
   ```
   - `layers`: `{clip, t, weight?, loop?}`. Freeze `t` to hold a pose; offset
     `t` to desync two characters on the same clip.
   - `Mannequin` plays clips in place. For travel with planted feet, or for clothes,
     faces or props in hands, use `Actor` (`travel`, `rightHand`, `leftHand`,
     `chest`; see references/characters.md).
   - Facing is +z. `rotationY={Math.PI}` turns the character away from a camera at +z.
6. **QA**: render stills at the key frames (clip boundaries, mid cross-fade, the
   extremes of the camera move) with `COMP=<Comp> node scripts/stills.mjs out/qa f1 f2 ...`,
   look at them, fix, and repeat (references/qa.md).
7. **Render**: `npx remotion render src/index.ts <Comp> out/<name>.mp4`.
   For a GIF:
   `ffmpeg -i out/x.mp4 -vf "fps=15,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" out/x.gif`.

Always open the stills yourself before declaring something done.

## Other humanoid rigs

All clips target the Quaternius rig (71 bones, UE-style names such as `pelvis`,
`spine_01..03`, `Head`, `hand_r`; Z-up with a rotated `root`; metres, ~1.8 m).
- **Same bone names** (Quaternius/UE-style skeleton): drop the GLB into
  `public/anims/`, load it in place of `rig-human` in `Mannequin`/`Actor`, and
  check it with `ClipGrid`.
- **Different skeleton** (Mixamo, VRM, custom): retarget the clips onto it.
  Map the bone names and correct the rest pose (T-pose vs. A-pose), using
  headless Blender (references/custom-capture.md, Step 3) or three.js
  `SkeletonUtils.retargetClip`. Export one animation per GLB on the target
  rig's bone names. Retargeting is not scripted in this skill yet: verify the
  result in `ClipGrid` before building anything on it.

## Hard rules (each one cost a debugging session)

- **Determinism**: animate only from `useCurrentFrame()`/`useSecs()`. No `useFrame`,
  no clocks, no `Math.random()` (use Remotion's `random(seed)`).
- **Asset gate**: every GLB and image goes through `src/three/assets.ts`. An asset
  that arrives after the canvas has rendered never reaches the frame. A missing
  file fails the whole render, so keep `CLIP_NAMES` equal to what is in `public/anims/`.
- **Components at module level**: a component defined inside another component
  re-mounts the 3D canvas every frame.
- **Lights**: use `<Spot position target>`, never `<spotLight target-position>`
  (that one aims at the origin). Interior walls and ceilings use `shadow={false}`.
- **Skinned meshes**: `frustumCulled = false` (their bounds don't follow the
  animation). Fully metallic materials render black without an environment map.
- **Narrow frames**: a 40° vertical FOV on 9:16 is only ~24° wide. Stack
  subjects in depth, or frame 1:1 / 16:9 for side-by-side action.
- **Licences**: ActionForge clips are CC0 (check the `list` output). Captured
  motion must come from your own footage or CC0/CC-BY footage.

## Optional: narrated story shorts

The template still contains a full pipeline for vertical narrated "true story"
shorts. Use it only when the user asks for one: `ShortVideo`, word-timed cuts
(`Shots`, `wordFrame`), captions, pop-ups, photo-mosaic faces from AI portraits,
synthesized music/SFX and a VHS look. Its pieces:
- `scripts/generate_audio.py` (edge-tts>=7.3), `scripts/generate_sfx.py`,
  `scripts/process_faces.py`, `scripts/commons_refs.py`
  (`pip install "edge-tts>=7.3" numpy scipy pillow`)
- `src/example/scenes.tsx`, `src/ShortVideo.tsx`, `src/qa/ActorTest.tsx`
- To enable it: register the timeline in `src/timelines.ts`, add the face names
  to `FACE_NAMES` and the example's clips to `CLIP_NAMES`, and uncomment the
  `Example` composition in `src/Root.tsx`. Details are in
  [references/story-and-timing.md](references/story-and-timing.md) and the
  later sections of references/look-and-sound.md.
