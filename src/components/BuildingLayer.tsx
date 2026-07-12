// ============================================================================
// BuildingLayer — renders all buildings + selection highlight + construction
// ============================================================================

import { memo, useMemo } from "react";
import { useGameStore } from "@/store/gameStore";
import { MODULE_CATALOG, moduleColor } from "@/buildings/catalog";
import { renderBuildingGlyph } from "@/buildings/glyphs";
import type { Camera } from "@/utils/geometry";
import type { BuildingInstance } from "@/sim/types";

interface Props {
  camera: Camera;
  viewport: { w: number; h: number };
}

function BuildingLayerImpl({ camera, viewport }: Props) {
  const buildings = useGameStore((s) => s.buildings);
  const selectedId = useGameStore((s) => s.selectedBuildingId);
  const simTime = useGameStore((s) => s.simTime);

  // Cull buildings outside viewport (with margin)
  const margin = 200;
  const visible = useMemo(() => {
    const halfW = viewport.w / 2 / camera.zoom + margin;
    const halfH = viewport.h / 2 / camera.zoom + margin;
    return buildings.filter((b) => {
      const def = MODULE_CATALOG[b.typeId];
      if (!def) return false;
      const m = Math.max(def.size.w, def.size.h);
      return (
        b.x > camera.x - halfW - m && b.x < camera.x + halfW + m &&
        b.y > camera.y - halfH - m && b.y < camera.y + halfH + m
      );
    });
  }, [buildings, camera, viewport]);

  return (
    <g>
      {visible.map((b) => (
        <BuildingSprite
          key={b.id}
          building={b}
          camera={camera}
          viewport={viewport}
          selected={b.id === selectedId}
          simTime={simTime}
        />
      ))}
    </g>
  );
}

export const BuildingLayer = memo(BuildingLayerImpl);

interface SpriteProps {
  building: BuildingInstance;
  camera: Camera;
  viewport: { w: number; h: number };
  selected: boolean;
  simTime: number;
}

function BuildingSprite({ building, camera, viewport, selected, simTime }: SpriteProps) {
  const def = MODULE_CATALOG[building.typeId];
  if (!def) return null;
  const color = moduleColor(def.category);
  const sx = (building.x - camera.x) * camera.zoom + viewport.w / 2;
  const sy = (building.y - camera.y) * camera.zoom + viewport.h / 2;
  // Glyph is drawn in a 100x100 viewBox (coords -50..50). We want the visible footprint
  // to match def.size in world units, so the scale factor converts glyph units to pixels.
  const glyphScale = (def.size.w / 50) * camera.zoom;

  const isConstructing = building.status === "construction";

  return (
    <g transform={`translate(${sx} ${sy})`} filter={selected ? "url(#glow-amber)" : "url(#building-shadow)"}>
      {/* selection ring */}
      {selected && (
        <circle
          r={Math.max(def.size.w, def.size.h) * camera.zoom * 0.7}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeDasharray="3 3"
        >
          <animate attributeName="r" values={`${Math.max(def.size.w, def.size.h) * camera.zoom * 0.7};${Math.max(def.size.w, def.size.h) * camera.zoom * 0.78};${Math.max(def.size.w, def.size.h) * camera.zoom * 0.7}`} dur="2s" repeatCount="indefinite" />
        </circle>
      )}

      {/* construction scaffold */}
      {isConstructing && (
        <g>
          <rect
            x={-def.size.w * camera.zoom / 2 - 4}
            y={-def.size.h * camera.zoom / 2 - 4}
            width={def.size.w * camera.zoom + 8}
            height={def.size.h * camera.zoom + 8}
            fill="none"
            stroke={color}
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity={0.7}
          />
          {/* progress bar */}
          <rect
            x={-def.size.w * camera.zoom / 2}
            y={def.size.h * camera.zoom / 2 + 6}
            width={def.size.w * camera.zoom}
            height="3"
            fill="rgba(255,180,84,0.18)"
          />
          <rect
            x={-def.size.w * camera.zoom / 2}
            y={def.size.h * camera.zoom / 2 + 6}
            width={def.size.w * camera.zoom * building.constructionProgress}
            height="3"
            fill={color}
          >
            <animate attributeName="opacity" values="0.6;1;0.6" dur="1.2s" repeatCount="indefinite" />
          </rect>
        </g>
      )}

      {/* Building glyph */}
      <g transform={`scale(${glyphScale}) rotate(${building.rotation})`} opacity={isConstructing ? 0.45 : 1}>
        {renderBuildingGlyph(building.typeId, {
          color,
          fillOpacity: selected ? 0.35 : 0.15,
        })}
      </g>

      {/* level pips */}
      {def.maxLevel != null && def.maxLevel > 1 && building.level > 0 && (
        <g transform={`translate(${def.size.w * camera.zoom / 2 - 2} ${-def.size.h * camera.zoom / 2 + 2})`}>
          {Array.from({ length: def.maxLevel }).map((_, i) => (
            <rect
              key={i}
              x={-i * 4 - 3}
              y={0}
              width={3}
              height={3}
              fill={i < building.level ? color : "rgba(255,255,255,0.15)"}
            />
          ))}
        </g>
      )}

      {/* status indicator for active buildings when zoomed in */}
      {!isConstructing && camera.zoom > 0.8 && (
        <circle
          cx={def.size.w * camera.zoom / 2 - 3}
          cy={-def.size.h * camera.zoom / 2 + 3}
          r={2}
          fill={color}
        >
          <animate attributeName="opacity" values="0.4;1;0.4" dur={`${2 + (simTime % 3)}s`} repeatCount="indefinite" />
        </circle>
      )}
    </g>
  );
}
