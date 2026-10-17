# Characters: mocap bodies, photo-mosaic faces

## Faces (`scripts/process_faces.py`)
1. **Source**: front-facing, head-and-shoulders portraits **you have the rights
   to use**: a photo of someone who has consented, or an AI-generated face from a
   generator whose terms allow your use (check them; commercial use is often
   restricted). Never use a real person's photo without consent, and never put a
   real, identifiable person's face on a character they aren't. Save them as
   `assets/faces-src/<role>.jpg`, 1024×1024 with the face centred and the eyes
   about 40 % down (FFHQ-style alignment, which the fixed crop below assumes).
   Record where each one came from in `assets/faces-src/SOURCES.txt`.
2. **Hair colour by hand** in `assets/faces-src/faces.json`
   (`{"dealer": {"hair": "#3b2a20"}}`). Auto-sampling is a fallback and often
   picks skin or backdrop. `skin` is sampled from the cheeks unless you set it.
3. Run `python scripts/process_faces.py [names]` and look at the PNGs. What it does:
   - fixed FFHQ crop of the whole head with hair, `(212,40,812,880)` → 500×700;
     eyes at ~(171,375)/(329,375), mouth at ~(250,565). These are duplicated in
     `src/three/faces.ts` for the expression overlays, so keep them in sync.
   - backdrop removal: pixels close to the corner colour, outside the inner face,
     not on a strong edge, **and connected to the border** are repainted with
     hair colour (skin below the jaw). The border test stops bright cheeks becoming blotches.
   - Delaunay mosaic: jittered grid + edge-weighted points + rings around eyes
     and mouth. Each triangle gets its mean colour, then noise + posterize.
   - outside the head oval: flat hair colour above the jaw, skin below. The
     back of the 3D head samples these corners.
4. Add the name to `FACE_NAMES` in `src/three/assets.ts`.

If a face comes out with backdrop blotches, set `hair`/`skin` explicitly or
pick another portrait. Bald heads on beige backdrops are the hardest case.

## Head (`src/three/Head.tsx`)
- Faceted sphere (11×9, flat shading), jaw tapered, slightly oversized (0.29 m).
- **No modelled hair** (3D hair caps look like a helmet). Front/side triangles
  get a planar projection of the whole-head photo, so the real hairline wraps
  over the temples. Back triangles sample the flat hair corner and the nape samples skin.
- The eye line sits just above the sphere's equator (`EYE_Y`, `MOUTH_Y`).
  Features placed low on a sphere curve away and look squashed.
- `emissiveMap = face` at 0.22 keeps faces readable in dark scenes.
- Expressions (`expr` prop), painted on a cached copy of the texture:
  `{ mouth: "open" | "frown", eyesClosed: true, brows: -1 }`.

## Bodies: `Actor` (`src/three/Actor.tsx`)
Library: [ActionForge](https://actionforge.app). It's CC0 (the Quaternius
Universal Animation Library plus a rigged mannequin), so it's free for
commercial use with no attribution. The mannequin has 71 bones with UE names
(`pelvis`, `spine_01..03`, `neck_01`, `Head`, `hand_r`, …), is Z-up with a
rotated `root`, and is in metres, about 1.8 m tall. Every clip GLB targets the same bones.

```bash
python scripts/fetch_actionforge.py list --filter sit     # name, duration, loop, root-motion metres, licence
python scripts/fetch_actionforge.py get public/anims walk_formal_loop sitting_idle_loop
```
Then add each name to `CLIP_NAMES`. Useful clips for story shorts:
`walk_formal_loop`, `walk_carry_loop`, `walk_loop`, `jog_fwd_loop`, `sprint_loop`,
`crouch_fwd_loop`, `crouch_idle_loop`, `idle_loop`, `idle_foldarms_loop`,
`idle_talking_loop`, `idle_talkingphone_loop`, `sitting_enter`, `sitting_idle_loop`,
`sitting_talking_loop`, `sitting_exit`, `yes`, `idle_no_loop`, `interact`,
`pickup_table`, `chest_open`, `fixing_kneeling`, `consume`, `driving_loop`,
`push_loop`, `climbup_1m`, `hit_chest`, `death01`, `farm_watering`, `treechopping_loop`.

The clips and rig are by Quaternius (CC0), retargeted and hosted by ActionForge.
`fetch_actionforge.py` downloads only those CC0 files, skips files you already
have, and spaces out its requests. Don't bulk-mirror the library or hammer the
host; fetch the clips a project actually uses. This project is not affiliated
with ActionForge or Quaternius.

### How it becomes a person
- **Clothes by bone weight**: each triangle is coloured by the body region of its
  dominant bone (hands/neck → skin, spine/arms → jacket, pelvis/legs →
  trousers, feet → shoes), flat shaded. A shirt V and tie attach to `spine_03`.
- **Head**: mannequin `Head` vertices collapse to the bone; our `<Head>` is
  portaled onto the `Head` bone inside a wrapper that undoes the bone's rest
  rotation/scale, so offsets are in rest-pose model coordinates (`HEAD_OFFSET`).
- `Look` = face + colours:
  ```ts
  const DEALER: Look = { face: "dealer", skin: "#d9a88c", jacket: "#2e3b55",
    trousers: "#23262e", shoes: "#151515", shirt: "#e8e4da", tie: "#8a1f2b", glasses: true };
  ```
  Keep a project's looks in `src/<video>/kit.tsx`.

### Driving clips deterministically
```tsx
const s = useSecs();
<Actor look={DEALER} position={[0, 0, 0.5]} rotationY={Math.PI}
       layers={[{ clip: "walk_formal_loop", t: s }]} travel />
```
- `layers`: `{clip, t, weight?, loop?}`. Each frame every action's time and
  weight are set and `mixer.update(0)` evaluates the pose: no clock, so renders are deterministic.
  `loop` defaults to true for names ending in `_loop`. Non-loop clips clamp at the end.
- Hold a pose: freeze `t` (`t: Math.min(s, 0.9)` holds `interact` at 0.9 s).
- Desync two actors on one clip: `t: s + 0.6`.
- Chain clips (walk → sit): two layers, cross-fade `weight` over ~8 frames.
- **Root motion** is stripped from every clip; `travel` moves the actor by the
  clip's average velocity × t (feet don't slide). Walk loops move ~1.3 m per
  loop along the actor's facing (+z). `clipSpeed(name)` gives m/s.
- Facing is +z. `rotationY={Math.PI}` walks away from a camera at +z: the
  easiest way to keep a walker inside the narrow vertical frame.
- Sitting clips put the pelvis at chair height: put a `<Chair>` at the actor's position.
- Driving: scale the actor ~0.95 and seat them in the car model.

### Props in hands
`rightHand` / `leftHand` portal children into `hand_r` / `hand_l` (bone-local
axes); `chest` uses rest-pose model axes at `spine_03`. Each held prop needs a
quick tuning still. Fiddly cases (food at the mouth, a phone at the ear) are
the usual reason to capture a custom clip.

### Known limits
- The mannequin is muscular, so characters read broad-shouldered. Scaling
  `spine_03`/`clavicle_*` down helps.
- No IK: hands won't meet props exactly unless the clip was made for it.
