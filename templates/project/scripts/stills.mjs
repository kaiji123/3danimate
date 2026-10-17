// Quick visual QA: bundle once, render stills, tile them into a contact sheet.
//   COMP=Example node scripts/stills.mjs out/qa 0 45 120          absolute frames
//   COMP=Example node scripts/stills.mjs out/qa ex-desk ex-desk+40  scene start (+offset)
// Scene starts are read from data/*/timeline.json, so they stay right after the
// audio is regenerated. Writes <dir>/<COMP>-<frame>.png and <dir>/sheet.png.
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const [outDir, ...specs] = process.argv.slice(2);
const comp = process.env.COMP;
if (!outDir || !specs.length || !comp) {
  console.error("usage: COMP=<composition> node scripts/stills.mjs <dir> <frame|scene-id[+n]> ...");
  process.exit(1);
}

const starts = {};
for (const v of existsSync("data") ? readdirSync("data") : []) {
  const f = path.join("data", v, "timeline.json");
  if (!existsSync(f)) continue;
  let at = 0;
  for (const s of JSON.parse(readFileSync(f, "utf8")).scenes) {
    starts[s.id] = at;
    at += s.frames;
  }
}
const toFrame = (spec) => {
  if (/^\d+$/.test(spec)) return Number(spec);
  const [id, off = "0"] = spec.split("+");
  if (!(id in starts)) throw new Error(`unknown scene "${id}" (known: ${Object.keys(starts).join(", ")})`);
  return starts[id] + Number(off);
};

mkdirSync(outDir, { recursive: true });
console.log("bundling...");
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id: comp, chromiumOptions: { gl: "angle" } });
const files = [];
for (const spec of specs) {
  const frame = Math.min(toFrame(spec), composition.durationInFrames - 1);
  const output = path.join(outDir, `${comp}-${String(frame).padStart(5, "0")}.png`);
  await renderStill({ composition, serveUrl, output, frame, chromiumOptions: { gl: "angle" }, imageFormat: "png" });
  console.log(`  ${output}`);
  files.push(output);
}
const sheet = path.join(outDir, "sheet.png");
const py = process.platform === "win32" ? "python" : "python3";
const r = spawnSync(py, ["scripts/contact_sheet.py", sheet, ...files, "--cols", String(Math.min(6, files.length))], { stdio: "inherit" });
if (r.status !== 0) console.log("(contact sheet skipped: needs python + Pillow)");
