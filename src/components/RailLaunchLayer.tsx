// ============================================================================
// RailLaunchLayer — animates payloads travelling along the rail launch track
// ============================================================================

import { useMemo } from "react";
import { useGameStore } from "@/store/gameStore";
import { MODULE_CATALOG } from "@/buildings/catalog";
import type { Camera } from "@/utils/geometry";
import type { BuildingInstance } from "@/sim/types";

interface Props {
  camera: Camera;
  viewport: { w: number; h: number };
}

const PAYLOAD_COLOR: Record<string, string> = {
  satellite: "#56d4e0",
  equipment: "#ffd86b",
  mars_ship: "#ffb454",
};

export function RailLaunchLayer({ camera, viewport }: Props) {
  const buildings = useGameStore((s) => s.buildings);
  const launchQueue = useGameStore((s) => s.launchQueue);

  const rails = useMemo(
    () => buildings.filter((b) => b.typeId === "rail_launch" && b.status === "active"),
    [buildings],
  );

  if (rails.length === 0 || launchQueue.length === 0) return null;

  // Each rail processes one launch at a time (the oldest un-launched)
  const activeJobs = launchQueue.slice(0, rails.length);

  return (
    <g>
      {rails.map((rail, idx) => {
        const job = activeJobs[idx];
        if (!job) return null;
        return <PayloadSprite key={job.id} rail={rail} job={job} camera={camera} viewport={viewport} />;
      })}
    </g>
  );
}

function PayloadSprite({
  rail,
  job,
  camera,
  viewport,
}: {
  rail: BuildingInstance;
  job: { id: string; payload: string; progress: number };
  camera: Camera;
  viewport: { w: number; h: number };
}) {
  // The rail glyph is drawn horizontally with the launch end on the right (+x).
  // The payload travels from the back of the rail (left, x = -size.w/2) toward
  // the front (right, x = +size.w/2) and off into space.
  const size = MODULE_CATALOG[rail.typeId].size;
  const travelExtent = size.w / 2 + 100; // continue past the rail end
  const x = rail.x - size.w / 2 + (size.w + travelExtent) * job.progress;
  const y = rail.y;
  const sx = (x - camera.x) * camera.zoom + viewport.w / 2;
  const sy = (y - camera.y) * camera.zoom + viewport.h / 2;
  const color = PAYLOAD_COLOR[job.payload] ?? "#ffb454";
  const payloadScale = camera.zoom * (job.payload === "mars_ship" ? 1.2 : 0.8);

  // Streak: visible as a horizontal bright trail
  const streakLen = 24 * camera.zoom;

  return (
    <g transform={`translate(${sx} ${sy})`}>
      {/* streak */}
      <line
        x1={-streakLen}
        y1={0}
        x2={0}
        y2={0}
        stroke={color}
        strokeWidth={2}
        opacity={0.7}
      >
        <animate attributeName="opacity" values="0.4;0.9;0.4" dur="0.4s" repeatCount="indefinite" />
      </line>
      {/* payload glow */}
      <circle r={6 * payloadScale} fill={color} opacity={0.3}>
        <animate attributeName="r" values={`${5 * payloadScale};${9 * payloadScale};${5 * payloadScale}`} dur="0.6s" repeatCount="indefinite" />
      </circle>
      {/* payload body */}
      <circle r={3 * payloadScale} fill={color} />

      {/* progress label */}
      {camera.zoom > 0.5 && (
        <text
          y={-14}
          fontSize={9}
          fontFamily="IBM Plex Mono, monospace"
          fill={color}
          textAnchor="middle"
          opacity={0.85}
        >
          {job.payload.replace("_", " ")} · {Math.floor(job.progress * 100)}%
        </text>
      )}
    </g>
  );
}
