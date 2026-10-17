// 1–3 word caption bites, white with a heavy black outline, lower-middle of the frame.
import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Word } from "./lib/timing";

export const CAPTION_TOP = 1340; // pop-ups must stay above ~70 % of the frame

type Bite = { text: string; start: number; end: number };

export function toBites(words: Word[], fps: number, maxWords = 3): Bite[] {
  const bites: Bite[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (!cur.length) return;
    bites.push({
      text: cur.map((w) => w.text).join(" "),
      start: Math.round((cur[0].startMs / 1000) * fps),
      end: Math.round((cur[cur.length - 1].endMs / 1000) * fps),
    });
    cur = [];
  };
  words.forEach((w, i) => {
    cur.push(w);
    const next = words[i + 1];
    const sentenceEnd = /[.?!;:,…]$/.test(w.text);
    const gap = next ? next.startMs - w.endMs > 300 : true;
    if (cur.length >= maxWords || sentenceEnd || gap) flush();
  });
  flush();
  // each bite stays up until the next one starts (or a short hold at the end)
  return bites.map((b, i) => ({ ...b, end: i + 1 < bites.length ? bites[i + 1].start : b.end + 12 }));
}

/** Scene-relative captions. ShortVideo mounts one per scene, above the VHS layers. */
export const Captions: React.FC<{ words: Word[] }> = ({ words }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bite = toBites(words, fps).find((b) => frame >= b.start && frame < b.end);
  if (!bite) return null;
  const pop = spring({ frame: frame - bite.start, fps, config: { damping: 12, stiffness: 220 } });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: CAPTION_TOP,
          left: 60,
          right: 60,
          textAlign: "center",
          fontFamily: "'Arial Black', 'Helvetica Neue', Impact, sans-serif",
          fontWeight: 900,
          fontSize: 92,
          lineHeight: 1.05,
          color: "white",
          WebkitTextStroke: "14px black",
          paintOrder: "stroke fill",
          textShadow: "0 8px 0 rgba(0,0,0,0.6)",
          transform: `scale(${0.8 + 0.2 * pop})`,
        }}
      >
        {bite.text}
      </div>
    </AbsoluteFill>
  );
};
