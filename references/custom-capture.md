# Custom clips: video → pose → retarget → cleanup

The library covers common game actions, but story beats are often more
specific (eating a sandwich, spraying an aerosol, peeling tape). Order of preference:
1. A library clip as-is.
2. A library clip tweaked in ActionForge's posing tools (a hand angle, a held pose).
3. A custom clip captured from video (below).
4. Show the object instead of the person.

If a small fix to a library clip gets you 90 % of the way, do that instead.
Tell the user up front that steps 1 and 4 below need their input (filming, a
manual cleanup pass in a browser tool).

## Step 1: footage
- **Best: film it yourself** on a phone. It's free, there's no licence
  question, and you control the framing. Third-party footage is a last resort,
  and only from CC0 / CC-BY sources.
- Filming rules: full body in frame including feet; side-on or three-quarter view
  (depth is the weakest axis); tripod, no pan or zoom; plain background, even light,
  fitted clothes; 30/60 fps, ≥1080p; a still 1 s pose at the start and end; act slightly
  exaggerated; use a real prop (or one of the same size).
- Save to `assets/capture-src/<clip>.mp4` and log the source/licence (or "own
  recording") in `assets/capture-src/SOURCES.txt`.

## Step 2: extract the motion
Monocular pose estimation → a 3D skeleton animation (BVH/FBX per take):
- open-source (preferred, scriptable): WHAM or 4D-Humans for full-body 3D with
  root motion; MediaPipe for a quick check of whether a take is usable.
- browser services (Rokoko Vision, DeepMotion, …) export FBX/BVH with little
  setup. Check their current free-tier limits and export licence terms first.
- This field moves fast: verify which tools are current before setting it up.
- Trim to the action, keeping the still pose at each end.

## Step 3: retarget to the Quaternius rig (headless Blender)
`blender -b -P retarget.py -- <in.bvh> <out.glb>`, with a `bone_map.json`
mapping source bones to the rig's UE names (`pelvis`, `spine_01..03`,
`neck_01`, `Head`, `clavicle_l`, `upperarm_l`, `lowerarm_l`, `hand_l`, `thigh_l`,
`calf_l`, `foot_l`, `ball_l`, and the `_r` side). Unmapped bones (fingers, twist) keep their rest pose.
- Fix the rest pose first (source T-pose vs. the mannequin's A-pose), or every arm is off by the same angle.
- Keep root motion on `pelvis`, so `Actor`'s `travel` works the same as with library clips.
- Export **one animation per GLB** targeting `rig-human.glb`'s bone names. `Actor` needs no changes.

## Step 4: clean up in ActionForge (manual, not optional)
Load the GLB in actionforge.app: lock foot contacts (sliding, floor
penetration), smooth jitter (wrists, neck, head), fix wrist/finger poses for
held props, fix limbs drifting in depth, match the first/last pose for loops, trim dead time.
Export to `public/anims/cap_<name>.glb` (the `cap_` prefix marks custom clips) and add it to `CLIP_NAMES`.

## Step 5: QA
Render the clip on an `Actor` next to frames of the source video (a
ClipSheet-style comp, like `ModelSheet`), plus one still per shot that uses it. Check that:
- the motion reads as the same action
- feet stay planted and nothing passes through the floor
- the held prop meets the hand (and mouth/face)
- the loop has no visible pop
- `travel` follows the facing (+z)

Expect noise: single-camera capture is jittery with weak depth. Fast or
self-occluding motion captures badly, so re-film from another angle rather than fixing it frame by frame.
