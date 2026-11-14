import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Float, PresentationControls, RoundedBox, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { LogoMark } from "./Logo";

function ApexMark() {
  const { chevron, slash } = useMemo(() => {
    const makeExtrusion = (shape: THREE.Shape, depth: number) => {
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: true,
        bevelSegments: 5,
        steps: 1,
        bevelSize: 0.065,
        bevelThickness: 0.065,
        curveSegments: 12,
      });
      geometry.computeVertexNormals();
      return geometry;
    };

    const outer = new THREE.Shape();
    outer.moveTo(-1.5, -1.15);
    outer.lineTo(0, 1.65);
    outer.lineTo(1.5, -1.15);
    outer.lineTo(0.82, -1.15);
    outer.lineTo(0, 0.22);
    outer.lineTo(-0.82, -1.15);
    outer.closePath();

    const cross = new THREE.Shape();
    cross.moveTo(-0.85, -0.55);
    cross.lineTo(0.63, -0.08);
    cross.lineTo(0.83, -0.42);
    cross.lineTo(-0.72, -0.95);
    cross.closePath();

    return { chevron: makeExtrusion(outer, 0.38), slash: makeExtrusion(cross, 0.46) };
  }, []);

  return (
    <group rotation={[-0.08, -0.28, 0]} position={[0, 0.05, 0.05]}>
      <mesh geometry={chevron} castShadow>
        <meshPhysicalMaterial
          color="#72e7ff"
          emissive="#276d96"
          emissiveIntensity={0.58}
          metalness={0.5}
          roughness={0.17}
          clearcoat={1}
          clearcoatRoughness={0.13}
        />
      </mesh>
      <mesh geometry={slash} position={[0, 0, 0.015]} castShadow>
        <meshPhysicalMaterial
          color="#b2f4ff"
          emissive="#6755d9"
          emissiveIntensity={0.62}
          metalness={0.42}
          roughness={0.16}
          clearcoat={1}
        />
      </mesh>
    </group>
  );
}

function Sculpture({ animate }: { animate: boolean }) {
  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[4, 5, 6]} intensity={2.6} color="#edf7ff" />
      <pointLight position={[-3, 1, 3]} intensity={24} distance={10} color="#65e5ff" />
      <pointLight position={[3, -2, 2]} intensity={16} distance={8} color="#9a7cff" />
      <Float speed={animate ? 1.15 : 0.01} rotationIntensity={animate ? 0.16 : 0} floatIntensity={animate ? 0.42 : 0} floatingRange={[-0.12, 0.16]}>
        <group scale={0.94}>
          <RoundedBox args={[4.25, 4.25, 0.52]} radius={0.63} smoothness={7} position={[0, 0, -0.72]} receiveShadow>
            <meshPhysicalMaterial color="#10182b" metalness={0.72} roughness={0.28} clearcoat={0.85} clearcoatRoughness={0.25} />
          </RoundedBox>
          <RoundedBox args={[4.3, 4.3, 0.5]} radius={0.65} smoothness={7} position={[0, 0, -0.77]}>
            <meshBasicMaterial color="#72e7ff" wireframe transparent opacity={0.12} />
          </RoundedBox>
          <ApexMark />
          <mesh position={[0, 0, -1.12]} rotation={[Math.PI / 2.25, 0.2, 0.1]}>
            <torusGeometry args={[2.75, 0.012, 8, 160]} />
            <meshBasicMaterial color="#72e7ff" transparent opacity={0.32} />
          </mesh>
          <mesh position={[0, 0, -1.3]} rotation={[Math.PI / 1.8, -0.25, 0.5]}>
            <torusGeometry args={[3.2, 0.008, 8, 160]} />
            <meshBasicMaterial color="#9486ff" transparent opacity={0.18} />
          </mesh>
        </group>
      </Float>
      <Sparkles count={55} scale={[8, 6, 4]} size={1.8} speed={animate ? 0.25 : 0} opacity={0.5} color="#a9eeff" />
      <ContactShadows position={[0, -2.75, 0]} opacity={0.45} scale={10} blur={2.8} far={4.5} color="#4e9bd0" />
    </>
  );
}

export default function ApexScene() {
  const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <div className="apex-scene" role="img" aria-label="Interactive three-dimensional PropApex emblem. Drag to rotate.">
      <div className="scene-fallback"><LogoMark /></div>
      <Canvas
        shadows
        frameloop={reduceMotion ? "demand" : "always"}
        dpr={[1, 1.65]}
        camera={{ position: [0, 0.15, 7.2], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <Suspense fallback={null}>
          <PresentationControls
            global
            cursor
            snap
            speed={1.4}
            zoom={1}
            rotation={[0, 0, 0]}
            polar={[-0.32, 0.32]}
            azimuth={[-0.65, 0.65]}
          >
            <Sculpture animate={!reduceMotion} />
          </PresentationControls>
        </Suspense>
      </Canvas>
      <div className="scene-hint"><span className="drag-dot" /> Drag to rotate</div>
    </div>
  );
}
