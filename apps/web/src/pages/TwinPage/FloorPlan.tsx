import type { AssetStatus, TelemetryPayload } from "@imc/shared-types";
import { TWIN_PLACEMENTS } from "./twinLayout";
import "./FloorPlan.css";

const STATUS_FILL: Record<AssetStatus, string> = {
  RUNNING: "#2b6cb0",
  IDLE: "#6c757d",
  FAULT: "#c92a2a",
  OFFLINE: "#243049",
};

export function FloorPlan({
  liveByAsset,
  selectedId,
  activeAlarmIds,
  onSelect,
}: {
  liveByAsset: Record<string, TelemetryPayload>;
  selectedId: string | null;
  activeAlarmIds: Set<string>;
  onSelect: (assetId: string) => void;
}) {
  const pad = 2.5;
  const xs = TWIN_PLACEMENTS.map((p) => p.x);
  const zs = TWIN_PLACEMENTS.map((p) => p.z);
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minZ = Math.min(...zs) - pad;
  const maxZ = Math.max(...zs) + pad;
  const w = maxX - minX;
  const h = maxZ - minZ;

  return (
    <div className="floor-wrap">
      <svg
        className="floor-svg"
        viewBox={`${minX} ${minZ} ${w} ${h}`}
        role="img"
        aria-label="Workshop A 2D floor plan"
      >
        <rect
          x={minX}
          y={minZ}
          width={w}
          height={h}
          className="floor-bg"
        />
        {TWIN_PLACEMENTS.map((p) => {
          const live = liveByAsset[p.assetId];
          const status: AssetStatus = live?.status ?? "OFFLINE";
          const selected = selectedId === p.assetId;
          const alarmed = activeAlarmIds.has(p.assetId);
          const bw = Math.max(p.width, 0.8);
          const bd = Math.max(p.depth, 0.8);
          return (
            <g
              key={p.assetId}
              className="floor-asset"
              onClick={() => onSelect(p.assetId)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelect(p.assetId);
              }}
            >
              <rect
                x={p.x - bw / 2}
                y={p.z - bd / 2}
                width={bw}
                height={bd}
                rx={0.12}
                fill={STATUS_FILL[status]}
                stroke={selected ? "#7db7ff" : alarmed ? "#ff6b6b" : "#1b2538"}
                strokeWidth={selected ? 0.18 : alarmed ? 0.14 : 0.06}
              />
              <text
                x={p.x}
                y={p.z + 0.12}
                textAnchor="middle"
                className="floor-label"
                fontSize={0.42}
              >
                {p.assetId.replace(/0+/, "")}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="floor-hint">Click a block · color = live status · red stroke = open alarm</p>
    </div>
  );
}
