// VHS tape treatment. Picture and overlays are separate layers so captions stay crisp:
//   <VhsPicture>  SVG filter + CSS grade + jitter, wraps all scenes
//   <VhsOverlay/> grain, scanlines, tracking band, head-switch noise, vignette
//   <VhsOsd/>     "PLAY ►", "SP", running timecode, date stamp
//   <Captions/>   rendered after these, unfiltered
import React, { createContext, useContext } from "react";
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from "remotion";

export const VhsContext = createContext(false);
export const useVhs = () => useContext(VhsContext);

// Tuning: chroma offset (px), per-line wobble (displacement scale), CRT strength.
export const VHS = { split: 3, wobble: 6, heavySplit: 9, heavyWobble: 40, scanlineAlpha: 0.16 };

const RGB_SPLIT = (id: string, wobble: number, split: number, seed: number) => (
  <filter id={id} x="-2%" y="0%" width="104%" height="100%" colorInterpolationFilters="sRGB">
    {/* y-only noise frequency -> each scanline gets its own x offset */}
    <feTurbulence type="fractalNoise" baseFrequency="0 0.035" numOctaves={2} seed={seed} result="n" />
    {/* R carries the noise, G is a constant 0.5 so the y displacement is zero */}
    <feColorMatrix in="n" type="matrix" values="1 0 0 0 0  0 0 0 0 0.5  0 0 0 0 0  0 0 0 0 1" result="map" />
    <feDisplacementMap in="SourceGraphic" in2="map" scale={wobble} xChannelSelector="R" yChannelSelector="G" result="d" />
    <feColorMatrix in="d" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r0" />
    <feOffset in="r0" dx={split} result="r" />
    <feColorMatrix in="d" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
    <feColorMatrix in="d" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b0" />
    <feOffset in="b0" dx={-split} result="b" />
    <feBlend in="r" in2="g" mode="screen" result="rg" />
    <feBlend in="rg" in2="b" mode="screen" result="rgb" />
    {/* VHS has low horizontal resolution: blur more across than down */}
    <feGaussianBlur in="rgb" stdDeviation="1.6 0.4" />
  </filter>
);

/** SVG filter defs. Mount once (ShortVideo does). Seeds change every frame. */
export const VhsDefs: React.FC = () => {
  const frame = useCurrentFrame();
  const seed = (frame % 97) + 1;
  return (
    <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
      <defs>
        {RGB_SPLIT("vhs", VHS.wobble, VHS.split, seed)}
        {RGB_SPLIT("vhs-heavy", VHS.heavyWobble, VHS.heavySplit, seed)}
        <filter id="vhs-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={1} seed={seed} />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <filter id="vhs-band" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.004 0.6" numOctaves={2} seed={seed} />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </defs>
    </svg>
  );
};

/** Wraps the 3D scenes. Rare random hiccups switch to the heavy filter for a few frames. */
export const VhsPicture: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const hiccup = random(`hiccup-${Math.floor(frame / 3)}`) < 0.025;
  const jx = (random(`jx-${frame}`) - 0.5) * 0.8;
  const jy = (random(`jy-${frame}`) - 0.5) * 0.5;
  return (
    <AbsoluteFill
      style={{
        filter: `url(#${hiccup ? "vhs-heavy" : "vhs"}) saturate(.78) contrast(1.12) brightness(1.04) sepia(.18)`,
        transform: `translate(${jx}px, ${jy}px)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** About 4 frames of heavy wobble + tearing lines right after a cut. Used by <Shots>. */
export const CutGlitch: React.FC<{ frames?: number }> = ({ frames = 4 }) => {
  const f = useCurrentFrame();
  if (f >= frames) return null;
  const lines = Array.from({ length: 5 }, (_, i) => ({
    top: random(`tear-y-${f}-${i}`) * 100,
    h: 2 + random(`tear-h-${f}-${i}`) * 10,
    dx: (random(`tear-x-${f}-${i}`) - 0.5) * 80,
  }));
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {lines.map((l, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: l.dx,
            right: -l.dx,
            top: `${l.top}%`,
            height: l.h,
            background: "rgba(255,255,255,0.35)",
            mixBlendMode: "screen",
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

export const VhsOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  // tracking band rolls down every 4 s, taking 1.2 s
  const cycle = frame % (fps * 4);
  const bandT = cycle / (fps * 1.2);
  const bandY = bandT <= 1 ? -80 + bandT * (height + 160) : null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* grain */}
      <svg width="100%" height="100%" style={{ position: "absolute", opacity: 0.13, mixBlendMode: "overlay" }}>
        <rect width="100%" height="100%" filter="url(#vhs-grain)" />
      </svg>
      {/* scanlines */}
      <AbsoluteFill
        style={{
          background: `repeating-linear-gradient(to bottom, rgba(0,0,0,${VHS.scanlineAlpha}) 0px, rgba(0,0,0,${VHS.scanlineAlpha}) 1px, transparent 1px, transparent 3px)`,
        }}
      />
      {/* tracking band */}
      {bandY !== null && (
        <svg
          width="100%"
          height={70}
          style={{ position: "absolute", top: bandY, opacity: 0.35, mixBlendMode: "screen" }}
        >
          <rect width="100%" height="100%" filter="url(#vhs-band)" />
        </svg>
      )}
      {/* head-switching noise along the bottom edge */}
      <svg width="100%" height={22} style={{ position: "absolute", bottom: 0, opacity: 0.55 }}>
        <rect width="100%" height="100%" filter="url(#vhs-band)" />
      </svg>
      {/* vignette */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
    </AbsoluteFill>
  );
};

const osdText: React.CSSProperties = {
  position: "absolute",
  fontFamily: "'VCR OSD Mono', 'Courier New', monospace",
  fontWeight: 700,
  fontSize: 46,
  color: "#f2f2f2",
  letterSpacing: 2,
  textShadow: "3px 3px 0 rgba(0,0,0,0.6)",
};

/** Camcorder on-screen display. Set `date` to the story's date/year. */
export const VhsOsd: React.FC<{ date: string }> = ({ date }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = Math.floor(frame / fps);
  const tc = `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const blink = Math.floor(frame / 15) % 2 === 0;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ ...osdText, left: 70, top: 90 }}>PLAY {blink ? "►" : " "}</div>
      <div style={{ ...osdText, right: 70, top: 90 }}>SP</div>
      <div style={{ ...osdText, left: 70, bottom: 120, fontSize: 40 }}>{tc}</div>
      <div style={{ ...osdText, right: 70, bottom: 120, fontSize: 40 }}>{date}</div>
    </AbsoluteFill>
  );
};
