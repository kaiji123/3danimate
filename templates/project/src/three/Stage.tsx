// 3D stage: a full-frame ThreeCanvas with moody defaults, plus Cam and Spot.
// Everything is driven by props computed from useCurrentFrame(): no useFrame,
// no self-running animation, so every frame renders the same every time.
import React, { useState } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { useVideoConfig } from "remotion";

type V3 = [number, number, number];

export const Stage: React.FC<{
  children: React.ReactNode;
  bg?: string;
  /** [near, far] in metres, coloured like the background. false = no fog. */
  fog?: [number, number] | false;
  /** Hemisphere fill. Dark scenes need more than looks right: the VHS grade crushes blacks. */
  ambient?: number;
}> = ({ children, bg = "#11131a", fog = [8, 30], ambient = 0.6 }) => {
  const { width, height } = useVideoConfig();
  return (
    <ThreeCanvas
      width={width}
      height={height}
      shadows
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      camera={{ fov: 40, near: 0.03, far: 300, position: [0, 1.6, 5] }}
    >
      <color attach="background" args={[bg]} />
      {fog && <fog attach="fog" args={[bg, fog[0], fog[1]]} />}
      <hemisphereLight args={["#9fb4ff", "#3a2a20", ambient]} />
      {children}
    </ThreeCanvas>
  );
};

/**
 * Mutates the default camera during render, so the frame is fully determined
 * by props. Vertical frame = narrow horizontal FOV: 40° vertical on 9:16 is
 * only ~24° wide. Stack subjects in depth, not side by side.
 */
export const Cam: React.FC<{ pos: V3; look?: V3; fov?: number; roll?: number }> = ({
  pos,
  look = [0, 1.2, 0],
  fov = 40,
  roll = 0,
}) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  camera.position.set(...pos);
  camera.up.set(0, 1, 0);
  camera.lookAt(...look);
  if (roll) camera.rotateZ(roll);
  if (camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  camera.updateMatrixWorld();
  return null;
};

/**
 * Spot light that actually aims at `target`. A bare <spotLight target-position>
 * silently aims at the origin because its target object isn't in the scene.
 * Physically based units: spots/points need 60–180.
 */
export const Spot: React.FC<{
  position: V3;
  target?: V3;
  color?: string;
  intensity?: number;
  angle?: number;
  penumbra?: number;
  castShadow?: boolean;
}> = ({ position, target = [0, 0, 0], color = "#ffd9a8", intensity = 120, angle = 0.55, penumbra = 0.6, castShadow = true }) => {
  const [tgt] = useState(() => new THREE.Object3D());
  tgt.position.set(...target);
  tgt.updateMatrixWorld();
  return (
    <>
      <primitive object={tgt} />
      <spotLight
        position={position}
        target={tgt}
        color={color}
        intensity={intensity}
        angle={angle}
        penumbra={penumbra}
        decay={2}
        castShadow={castShadow}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
      />
    </>
  );
};

/** Warm key + cool fill, the default mood. Directional lights work at ~1–2.5. */
export const KeyFill: React.FC<{ keyPos?: V3; keyIntensity?: number; fillIntensity?: number }> = ({
  keyPos = [3, 6, 4],
  keyIntensity = 2,
  fillIntensity = 0.8,
}) => (
  <>
    <directionalLight
      position={keyPos}
      color="#ffcf9a"
      intensity={keyIntensity}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-8}
      shadow-camera-right={8}
      shadow-camera-top={8}
      shadow-camera-bottom={-8}
      shadow-bias={-0.0005}
    />
    <directionalLight position={[-4, 3, -2]} color="#7f9cff" intensity={fillIntensity} />
  </>
);
