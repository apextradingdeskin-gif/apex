import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
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

function SceneReady({ onReady }: { onReady: () => void }) {
  const { invalidate } = useThree();
  const called = useRef(false);
  useEffect(() => { invalidate(); }, [invalidate]);
  useFrame(() => { if (!called.current) { called.current = true; window.requestAnimationFrame(onReady); } });
  return null;
}

function MarketStage({ animate }: { animate: boolean }) {
  const ring = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (!animate || !ring.current) return;
    ring.current.rotation.y += Math.min(delta, 0.05) * 0.12;
    ring.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.25) * 0.015;
  });
  const candles = [[-2.55, 0.52, 0.08], [-2.12, 0.8, -0.12], [2.25, 0.65, -0.15], [2.7, 1.02, 0.12]];
  return <group position={[0, -2.32, -0.5]}>
    <mesh receiveShadow castShadow><cylinderGeometry args={[2.7, 2.78, 0.17, 96]} /><meshPhysicalMaterial color="#0e192d" metalness={0.8} roughness={0.28} clearcoat={1} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]}><torusGeometry args={[2.56, 0.012, 8, 120]} /><meshBasicMaterial color="#72e7ff" transparent opacity={0.4} /></mesh>
    <group ref={ring} position={[0, 0.11, 0]}>
      {Array.from({ length: 36 }, (_, index) => {
        const angle = index * Math.PI * 2 / 36;
        return <mesh key={index} position={[Math.sin(angle) * 2.43, 0, Math.cos(angle) * 2.43]} rotation={[-Math.PI / 2, 0, -angle]}><planeGeometry args={[0.017, index % 3 === 0 ? 0.1 : 0.04]} /><meshBasicMaterial color={index % 3 === 0 ? "#a69aff" : "#72e7ff"} transparent opacity={0.45} /></mesh>;
      })}
    </group>
    {candles.map(([x, height, z], index) => <group key={index} position={[x, height / 2 + 0.12, z - 0.3]}>
      <RoundedBox args={[0.16, height, 0.16]} radius={0.025} smoothness={3} castShadow><meshPhysicalMaterial color={index % 2 === 0 ? "#9382ff" : "#72e7ff"} emissive={index % 2 === 0 ? "#4b3587" : "#194c65"} emissiveIntensity={0.4} metalness={0.45} roughness={0.2} /></RoundedBox>
      <mesh><boxGeometry args={[0.022, height + 0.34, 0.022]} /><meshBasicMaterial color={index % 2 === 0 ? "#a99aff" : "#9befff"} /></mesh>
    </group>)}
  </group>;
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
            <meshPhysicalMaterial color="#203a51" metalness={0.65} roughness={0.32} emissive="#15374a" emissiveIntensity={0.15} />
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
      <MarketStage animate={animate} />
      <Sparkles count={22} scale={[8, 6, 4]} size={1.6} speed={animate ? 0.15 : 0} opacity={0.4} color="#a9eeff" />
      <ContactShadows position={[0, -2.75, 0]} opacity={0.45} scale={10} blur={2.8} far={4.5} color="#4e9bd0" />
    </>
  );
}

export default function ApexScene() {
  const [reduceMotion, setReduceMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const animate = !reduceMotion && !paused;
  return (
    <div className="apex-scene" data-ready={ready} role="group" aria-label="Interactive three-dimensional APEX Trading emblem. Drag to rotate.">
      <div className="scene-fallback"><LogoMark /></div>
      <Canvas
        shadows
        frameloop={animate ? "always" : "demand"}
        dpr={[1, 1.65]}
        camera={{ position: [0, 0.15, 8.7], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <Suspense fallback={null}>
          <PresentationControls
            cursor
            snap
            speed={1.4}
            zoom={1}
            rotation={[0, 0, 0]}
            polar={[-0.32, 0.32]}
            azimuth={[-0.65, 0.65]}
          >
            <Sculpture animate={animate} />
            <SceneReady onReady={onReady} />
          </PresentationControls>
        </Suspense>
      </Canvas>
      <div className="scene-hint"><span className="drag-dot" /> Drag to explore <button type="button" disabled={reduceMotion} aria-pressed={paused || reduceMotion} onClick={() => setPaused((value) => !value)}>{reduceMotion ? "Reduced motion enabled" : paused ? "Resume motion" : "Pause motion"}</button></div>
    </div>
  );
}
