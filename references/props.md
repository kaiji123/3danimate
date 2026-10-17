# Recurring props: reference photos → one canonical model

**The problem**: when each scene improvises its own version of an object, the
same object looks different in every shot. Diamonds ended up as octahedra of
three different sizes that read as confetti. Deposit boxes looked like lockers
up close and a checkerboard from afar. A safe was a bare grey cube. Nothing tied the shots together.

**The rule**: model every recurring object **once**, from real reference
photos, in one file, at one fixed story scale. Every shot uses that model.

## Step 1: collect references (Wikimedia Commons, free licences)
```bash
python scripts/commons_refs.py search "safe deposit boxes"
python scripts/commons_refs.py get "File:Round Brilliant Cut Diamond.jpg" diamond-brilliant
```
`get` saves an 800 px thumbnail to `public/refs/` and logs licence, author
and source page in `public/refs/SOURCES.txt`. It pauses between calls, because
Commons rate-limits after ~4 quick requests. Prefer CC0/PD/CC-BY. These are
modelling references only, never shown in the video except on the QA sheet.

Get at least one **side/profile view** per object: the silhouette is what a
low-poly model has to get right, and a top-down glamour shot hides it. Tile
the references (`python scripts/contact_sheet.py out/refs.png public/refs/*.jpg`),
look at them, and write down what the model must have:

| Object | Must have |
| --- | --- |
| Diamond | flat table, short crown, thin girdle, deep pointed pavilion (not an octahedron) |
| Gold bar | tapered cast block, ~116×52×28 mm for 1 kg |
| Deposit boxes | metal door, number plate, 2 keyholes, hinge, column frame strips, a removable tray |
| Vault door | bolt ring, wheel handle, combination dial |

## Step 2: turn photos into numbers (`SPEC`)
Put every measurement in one `SPEC` object in `src/<video>/models.tsx`, next to
the reference file it came from, so models are measured rather than eyeballed:

```ts
export const SPEC = {
  diamond: { ref: "refs/diamond-side.png", diameter: 0.055, // 1 ct is 6.5 mm: x8 story scale, everywhere
             table: 0.53, crownDeg: 34.5, pavilionDeg: 40.75, segments: 8 },
  goldBar: { ref: "refs/gold-bars.jpg", size: [0.116, 0.028, 0.052], taper: 0.85 },
  depositBox: { ref: "refs/deposit-boxes.jpg", pitch: [0.30, 0.24], cols: 21, rows: 9 },
};
```
- **Story scale is a constant, not a per-shot choice.** Exaggerate tiny
  objects once (in the SPEC). A scene may show more or fewer objects, never a
  resized one. For a closer look, move the camera.
- Low segment counts *are* the facets: a `LatheGeometry` profile with 8 radial
  segments makes a convincing brilliant cut. A tapered bar is a `BoxGeometry` with the top vertices pulled in.

## Step 3: build each object once
- **Shared parts make a family**: one `STEEL` / `BRASS` palette plus shared
  `Dial` / `Wheel` parts for the vault door, safe and boxes, so they look like they come from the same building.
- **Module-level geometry and materials** for anything repeated (a wall of 1,000
  meshes): create `BufferGeometry`/`MeshStandardMaterial` once and pass them as
  `geometry={…} material={…}`. R3F won't dispose them, and sharing them across `Shots` canvases is safe.
- **Scenes contain no stand-ins.** If a scene needs a prop with no model yet,
  add it to `models.tsx` with a SPEC entry and a reference. Never type a `<Box>` into a scene.
- **Props follow the story**: a dealer shows loose stones on an open paper, not
  the loot pile. Opened boxes show their trays pulled out.
- Material tips: fully metallic surfaces render black with no environment map,
  so use metalness ~0.35–0.5 plus a little emissive. Gems need some metalness
  and less emissive, or they turn into flat white discs.

## Step 4: verify on the model sheet
Fill `SHEET_ITEMS` in `src/qa/ModelSheet.tsx` (up to 6 tiles: model on a
turntable + reference inset), add reference images to `IMAGE_FILES` if you
draw them in 3D, and render:
```bash
COMP=ModelSheet node scripts/stills.mjs out/models 0 30
```
Do this after **every** change to `models.tsx`, before touching scenes. Then
render one still from each shot that uses the prop to confirm it reads the
same everywhere. A prop can be in the scene yet hidden behind an actor.

Things the sheet catches:
- tiles framed too tight: a tile is 540 px wide; at fov 30 a 0.6 m object needs ~1.3 m camera distance
- a turntable shows a flat wall edge-on: set `spin: false` for walls
- gems as flat white discs: add metalness and reduce emissive

## Checklist
1. List every object that appears in more than one shot.
2. Collect 2+ references each (one profile view) and log the licences.
3. Write the proportions into `SPEC`, with one story scale per object.
4. Build them in `src/<video>/models.tsx` with shared parts and palette.
5. Check the model sheet against the refs, then one still per shot that uses each prop.
