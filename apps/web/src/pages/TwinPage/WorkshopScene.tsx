import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Grid, OrbitControls, useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import type { Group, Mesh, MeshStandardMaterial, ShaderMaterial } from "three";
import type { AssetStatus, TelemetryPayload } from "@imc/shared-types";
import {
  createHeatMaterial,
  HEAT_TEMP_MAX_C,
  HEAT_TEMP_MIN_C,
  HEAT_THRESHOLD_C,
  setHeatUniforms,
} from "./HeatMaterial";
import {
  modelUrlForType,
  TWIN_MODEL_URLS,
  TWIN_PLACEMENTS,
  type TwinPlacement,
} from "./twinLayout";

const STATUS_COLOR: Record<AssetStatus, string> = {
  RUNNING: "#1c7ed6",
  IDLE: "#868e96",
  FAULT: "#c92a2a",
  OFFLINE: "#343a40",
};

export interface WorkshopSceneProps {
  liveByAsset: Record<string, TelemetryPayload>;
  selectedId: string | null;
  activeAlarmIds: Set<string>;
  onSelect: (assetId: string | null) => void;
}

export function WorkshopScene({
  liveByAsset,
  selectedId,
  activeAlarmIds,
  onSelect,
}: WorkshopSceneProps) {
  return (
    <div className="twin-canvas">
      <Canvas
        shadows
        camera={{ position: [10, 11, 12], fov: 50, near: 0.1, far: 100 }}
        onPointerMissed={() => onSelect(null)}
        gl={{ antialias: true }}
        style={{ background: "#0b1220" }}
      >
        <fog attach="fog" args={["#0b1220", 18, 42]} />
        <ambientLight intensity={0.55} color="#9bb4d4" />
        <directionalLight
          castShadow
          intensity={1.05}
          position={[8, 14, 6]}
          shadow-mapSize={[1024, 1024]}
        />

        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[22, 14]} />
          <meshStandardMaterial color="#152038" metalness={0.15} roughness={0.85} />
        </mesh>

        <Grid
          args={[22, 22]}
          cellSize={1}
          cellThickness={0.6}
          cellColor="#1d2a42"
          sectionSize={5}
          sectionThickness={1.1}
          sectionColor="#2b6cb0"
          fadeDistance={28}
          fadeStrength={1}
          position={[0, 0.01, 0]}
        />

        <mesh position={[0, 3, -7]}>
          <planeGeometry args={[22, 6]} />
          <meshStandardMaterial color="#121a2b" metalness={0.05} roughness={0.9} />
        </mesh>
        <mesh position={[-11, 3, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[14, 6]} />
          <meshStandardMaterial color="#121a2b" metalness={0.05} roughness={0.9} />
        </mesh>

        <Suspense fallback={null}>
          {TWIN_PLACEMENTS.map((p) => (
            <AssetModel
              key={p.assetId}
              placement={p}
              live={liveByAsset[p.assetId]}
              selected={selectedId === p.assetId}
              alarmed={activeAlarmIds.has(p.assetId)}
              onSelect={onSelect}
            />
          ))}
        </Suspense>

        <ContactShadows
          position={[0, 0.02, 0]}
          opacity={0.35}
          scale={24}
          blur={2.2}
          far={8}
        />

        <OrbitControls
          makeDefault
          target={[0, 0.5, 0]}
          enableDamping
          maxPolarAngle={Math.PI * 0.48}
          minDistance={6}
          maxDistance={28}
        />
      </Canvas>
    </div>
  );
}

function AssetModel({
  placement,
  live,
  selected,
  alarmed,
  onSelect,
}: {
  placement: TwinPlacement;
  live?: TelemetryPayload;
  selected: boolean;
  alarmed: boolean;
  onSelect: (assetId: string | null) => void;
}) {
  const url = modelUrlForType(placement.type);
  const { scene } = useGLTF(url);
  const groupRef = useRef<Group>(null);
  const lampRef = useRef<Mesh>(null);
  const status: AssetStatus = live?.status ?? "OFFLINE";
  const baseColor = STATUS_COLOR[status];

  const { root, heatMats } = useMemo(() => {
    const cloned = scene.clone(true);
    const mats: ShaderMaterial[] = [];
    cloned.traverse((obj) => {
      const mesh = obj as unknown as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const heat = createHeatMaterial();
      mats.push(heat);
      mesh.material = heat;
    });
    return { root: cloned, heatMats: mats };
  }, [scene]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const offline = !live || status === "OFFLINE";
    const tempC = live?.metrics.temperature ?? HEAT_TEMP_MIN_C;
    for (const mat of heatMats) {
      setHeatUniforms(mat, {
        tempC,
        offline,
        selected,
        alarmed,
        time: t,
      });
    }

    const lamp = lampRef.current;
    if (!lamp) return;
    const mat = lamp.material as MeshStandardMaterial;
    if (status === "FAULT" || alarmed) {
      mat.emissiveIntensity = 0.6 + Math.sin(t * 8) * 0.5;
    } else if (status === "RUNNING") {
      mat.emissiveIntensity = 0.9;
    } else if (status === "IDLE") {
      mat.emissiveIntensity = 0.35;
    } else {
      mat.emissiveIntensity = 0.05;
    }
  });

  function onClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation();
    onSelect(placement.assetId);
  }

  return (
    <group
      ref={groupRef}
      position={[placement.x, 0, placement.z]}
      onClick={onClick}
    >
      <group scale={[placement.width, placement.height, placement.depth]}>
        <primitive object={root} />
      </group>
      <mesh
        ref={lampRef}
        position={[0, placement.height + 0.25, 0]}
        onClick={onClick}
      >
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={baseColor}
          emissiveIntensity={0.8}
        />
      </mesh>
    </group>
  );
}

for (const url of TWIN_MODEL_URLS) {
  useGLTF.preload(url);
}

export { HEAT_TEMP_MAX_C, HEAT_TEMP_MIN_C, HEAT_THRESHOLD_C };
