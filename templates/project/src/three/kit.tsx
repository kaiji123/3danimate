// Shared low-poly set pieces. Boxes, cylinders and icosahedrons, all flat shaded.
// Recurring story props do NOT belong here: they get a SPEC + reference photo
// and one canonical model in src/<video>/models.tsx (see the skill's props guide).
import React, { useMemo } from "react";
import * as THREE from "three";

type V3 = [number, number, number];

export const Flat: React.FC<{ color: string; emissive?: string; emissiveIntensity?: number; metalness?: number; roughness?: number }> = ({
  color,
  emissive,
  emissiveIntensity = 0,
  metalness = 0,
  roughness = 0.85,
}) => (
  <meshStandardMaterial
    color={color}
    flatShading
    emissive={emissive ?? "black"}
    emissiveIntensity={emissiveIntensity}
    metalness={metalness}
    roughness={roughness}
  />
);

/** A box. `shadow={false}` for interior shells (walls/ceiling), or a high key light leaves the room black. */
export const Block: React.FC<{ size: V3; position?: V3; rotation?: V3; color: string; shadow?: boolean }> = ({
  size,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  color,
  shadow = true,
}) => (
  <mesh position={position} rotation={rotation} castShadow={shadow} receiveShadow>
    <boxGeometry args={size} />
    <Flat color={color} />
  </mesh>
);

export const Floor: React.FC<{ color?: string; size?: number }> = ({ color = "#2b2f3a", size = 60 }) => (
  <mesh rotation-x={-Math.PI / 2} receiveShadow>
    <planeGeometry args={[size, size]} />
    <Flat color={color} />
  </mesh>
);

/** Seat height matches the ActionForge sitting clips' pelvis. Place it at the actor's position. */
export const Chair: React.FC<{ position?: V3; rotationY?: number; color?: string }> = ({
  position = [0, 0, 0],
  rotationY = 0,
  color = "#5b3b2a",
}) => (
  <group position={position} rotation-y={rotationY}>
    <Block size={[0.46, 0.06, 0.44]} position={[0, 0.45, -0.02]} color={color} />
    <Block size={[0.46, 0.5, 0.05]} position={[0, 0.72, -0.24]} color={color} />
    {[[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.17], [0.2, 0.17]].map(([x, z], i) => (
      <Block key={i} size={[0.04, 0.45, 0.04]} position={[x, 0.225, z]} color={color} />
    ))}
  </group>
);

export const Desk: React.FC<{ position?: V3; rotationY?: number; color?: string }> = ({
  position = [0, 0, 0],
  rotationY = 0,
  color = "#6b4a32",
}) => (
  <group position={position} rotation-y={rotationY}>
    <Block size={[1.4, 0.05, 0.7]} position={[0, 0.75, 0]} color={color} />
    <Block size={[0.05, 0.73, 0.65]} position={[-0.65, 0.365, 0]} color={color} />
    <Block size={[0.05, 0.73, 0.65]} position={[0.65, 0.365, 0]} color={color} />
  </group>
);

/** Text on a plane, drawn on a canvas once (static). Keep labels within ±0.6 m of the look-at line at 4–5 m. */
export const Label3D: React.FC<{
  text: string;
  position?: V3;
  rotation?: V3;
  width?: number;
  color?: string;
  bg?: string;
  font?: string;
}> = ({ text, position = [0, 0, 0], rotation = [0, 0, 0], width = 1, color = "#111", bg = "#f4efe3", font = "bold 110px Arial" }) => {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, c.width / 2, c.height / 2);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [text, color, bg, font]);
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width, width / 4]} />
      <meshStandardMaterial map={tex} emissiveMap={tex} emissive="white" emissiveIntensity={0.3} />
    </mesh>
  );
};
