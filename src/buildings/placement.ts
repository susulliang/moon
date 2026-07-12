// ============================================================================
// Placement & collision helpers
// ============================================================================

import type { BuildingInstance, ModuleDef, TerrainData } from "@/sim/types";
import { sampleSlope, sampleElevation } from "@/terrain/generator";

export interface Rect { x: number; y: number; w: number; h: number; }

export function buildingFootprint(b: BuildingInstance | { typeId: string; x: number; y: number }, sizeLookup: (id: string) => { w: number; h: number }): Rect {
  const s = sizeLookup(b.typeId);
  return { x: b.x - s.w / 2, y: b.y - s.h / 2, w: s.w, h: s.h };
}

export function rectsOverlap(a: Rect, b: Rect, pad = 6): boolean {
  return !(
    a.x + a.w + pad < b.x ||
    b.x + b.w + pad < a.x ||
    a.y + a.h + pad < b.y ||
    b.y + b.h + pad < a.y
  );
}

export function canPlaceAt(
  worldX: number,
  worldY: number,
  module: ModuleDef,
  buildings: BuildingInstance[],
  terrain: TerrainData,
  worldExtent: number,
): { ok: boolean; reason?: string } {
  // world bounds
  const half = worldExtent / 2;
  if (Math.abs(worldX) > half - module.size.w / 2 - 20) return { ok: false, reason: "Out of bounds" };
  if (Math.abs(worldY) > half - module.size.h / 2 - 20) return { ok: false, reason: "Out of bounds" };
  // slope: too steep = no
  const slope = sampleSlope(terrain, worldX, worldY);
  if (slope > 0.7) return { ok: false, reason: "Terrain too steep" };
  // crater floor avoidance: don't place in deep craters
  const elev = sampleElevation(terrain, worldX, worldY);
  if (elev < 0.12) return { ok: false, reason: "Crater floor unstable" };
  // overlap with existing — corridors use 0 padding so they can sit flush against buildings
  const newRect: Rect = { x: worldX - module.size.w / 2, y: worldY - module.size.h / 2, w: module.size.w, h: module.size.h };
  const overlapPad = module.id === "corridor" ? 0 : 8;
  for (const b of buildings) {
    const m = lookupSize(b.typeId);
    const r: Rect = { x: b.x - m.w / 2, y: b.y - m.h / 2, w: m.w, h: m.h };
    // corridors can overlap with other corridors (they chain together)
    if (module.id === "corridor" && b.typeId === "corridor") continue;
    if (rectsOverlap(newRect, r, overlapPad)) return { ok: false, reason: "Overlap" };
  }
  return { ok: true };
}

// Local lookup — import catalog directly
import { MODULE_CATALOG } from "./catalog";
export function lookupSize(typeId: string): { w: number; h: number } {
  return (MODULE_CATALOG as any)[typeId]?.size ?? { w: 50, h: 50 };
}
