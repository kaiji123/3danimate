// Pop-ups: big numbers / key words that pop in, the rubber stamp for the
// ending, and name/place tags. Keep them above ~70 % of the frame (captions).
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const heavy: React.CSSProperties = {
  fontFamily: "'Arial Black', 'Helvetica Neue', Impact, sans-serif",
  fontWeight: 900,
  WebkitTextStroke: "12px black",
  paintOrder: "stroke fill",
};

/** `<PopText text="+$3" at={F("won")} />`. `at`/`until` are scene-relative frames. */
export const PopText: React.FC<{
  text: string;
  at: number;
  until?: number;
  top?: number; // px from the top (1920 tall frame)
  size?: number;
  color?: string;
  rotate?: number;
}> = ({ text, at, until, top = 420, size = 190, color = "#ffd23f", rotate = -4 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at || (until !== undefined && frame >= until)) return null;
  const s = spring({ frame: frame - at, fps, config: { damping: 9, stiffness: 260 } });
  const out = until !== undefined ? interpolate(frame, [until - 5, until], [1, 0], { extrapolateLeft: "clamp" }) : 1;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          ...heavy,
          position: "absolute",
          top,
          width: "100%",
          textAlign: "center",
          fontSize: size,
          color,
          opacity: out,
          transform: `scale(${s}) rotate(${rotate}deg)`,
          textShadow: "0 12px 0 rgba(0,0,0,0.55)",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

/** Rubber stamp that slams in (pair it with the thud SFX). Always give it an `until`
 *  if anything follows, or it stays on screen over the next shot. */
export const Stamp: React.FC<{ text: string; at: number; until?: number; color?: string; top?: number }> = ({
  text,
  at,
  until,
  color = "#d42a2a",
  top = 640,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at || (until !== undefined && frame >= until)) return null;
  const s = spring({ frame: frame - at, fps, config: { damping: 14, stiffness: 400, mass: 0.6 } });
  const scale = interpolate(s, [0, 1], [2.6, 1]);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top,
          left: "50%",
          transform: `translateX(-50%) rotate(-14deg) scale(${scale})`,
          opacity: Math.min(1, s * 2),
          border: `14px solid ${color}`,
          borderRadius: 18,
          padding: "10px 40px",
          color,
          fontFamily: "'Arial Black', Impact, sans-serif",
          fontWeight: 900,
          fontSize: 120,
          letterSpacing: 6,
          whiteSpace: "nowrap",
          background: "rgba(255,255,255,0.06)",
          mixBlendMode: "normal",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

/** Lower-third style tag for a name or place, placed above the captions. */
export const Tag: React.FC<{ title: string; sub?: string; at: number; until?: number; top?: number }> = ({
  title,
  sub,
  at,
  until,
  top = 1120,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at || (until !== undefined && frame >= until)) return null;
  const s = spring({ frame: frame - at, fps, config: { damping: 16 } });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top,
          left: 70,
          transform: `translateX(${(1 - s) * -700}px)`,
          background: "#ffd23f",
          color: "#111",
          padding: "12px 28px",
          fontFamily: "'Arial Black', Impact, sans-serif",
          fontSize: 58,
          borderLeft: "16px solid #111",
        }}
      >
        {title}
        {sub && <div style={{ fontSize: 34, fontFamily: "Arial, sans-serif", fontWeight: 700 }}>{sub}</div>}
      </div>
    </AbsoluteFill>
  );
};
