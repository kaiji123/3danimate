# QA loop

## Stills (during the build)
```bash
COMP=HeistShort node scripts/stills.mjs out/qa h-vault h-vault+40 h-escape+10   # scene-id[+frames]
COMP=HeistShort node scripts/stills.mjs out/qa 0 400 900                       # absolute frames
```
It bundles once, renders PNGs and tiles them into `out/qa/sheet.png`. Scene
specs are resolved from the current `data/*/timeline.json`, so they stay right
after the audio is regenerated. Pick 1–2 frames per shot (a shot's first frames
carry the cut glitch, so sample ~10 frames in). **Open the sheet and look.**

Check for:
- a subject cut off by the narrow frame
- props blocking the camera (desk edges, lamp posts, rocks)
- text colliding with captions (keep pop-ups above `top: 70%`)
- unreadable dark faces
- a recurring prop looking different from its model sheet
- custom clips: foot sliding, jitter, hands not meeting their prop

Do one contact-sheet pass per scene group, fix, and re-render just those
frames. The first sheet of a new video is usually mostly black or empty;
work through the table below.

| Symptom | Cause | Fix |
| --- | --- | --- |
| Spotlit areas dark everywhere | `<spotLight target-position>` aims at the origin | `<Spot target>` |
| Whole interior black | walls/ceiling shadow the key light | `shadow={false}` on interior shells |
| Opening street shot is just a wall | a building row runs *across* the view | two rows facing each other along z |
| Walking character missing | walks beside the camera, outside the ~24°-wide frame | camera behind the actor on the walking axis |
| Second subject out of shot | subjects side by side | stack in depth, within ±0.6 m of the look-at line |
| Ring/frame shows as a flat bar | `torusGeometry` rotated, but it already faces +z | remove the rotation |
| 3D canvas re-mounts every frame / flicker | shot component defined inside another component | define shot components at module level |
| Stamp/pop-up lingers over the next shot | no end | `until` prop |
| Face/texture missing in renders but fine in studio | asset loaded after the canvas rendered | add it to the asset gate (`assets.ts`) |
| Actor frozen in rest pose | clip not in `CLIP_NAMES`, or wrong name | add it and re-check the `list` name |
| Feet slide on a walk | `travel` off, or the actor is moved by hand too | use `travel`, don't animate `position` as well |
| Same prop looks different per shot | improvised per scene | canonical model + SPEC (props.md) |
| Error "Word … not in scene" | script changed, word gone | re-key the cut on a word that exists (the error lists them) |
| Face squashed / features low | head UV mapping off for this crop | adjust `EYE_Y`/`MOUTH_Y` in Head.tsx, check that landmarks match process_faces.py |
| Night scene crushed to black after VHS | VHS grade darkens | raise `ambient` / fill |

## Final render checks
```bash
npx remotion render src/index.ts HeistShort out/heist.mp4
ffprobe -v error -show_entries format=duration:stream=width,height,r_frame_rate -of compact out/heist.mp4
ffmpeg -i out/heist.mp4 -af volumedetect -f null - 2>&1 | grep -E "mean_volume|max_volume"   # max ≈ -2 dB
python scripts/contact_sheet.py out/heist-sheet.png --video out/heist.mp4 --every 2.5
```
Look at the whole-video sheet: every tile should show a clear subject, and
consecutive tiles should differ (the cut pacing). A full render takes ~5–8 min.
