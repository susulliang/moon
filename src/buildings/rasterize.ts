// ============================================================================
// IsoRasterizer — pre-renders isometric (RA2-style) building sprites to cached canvases
// Each building is an extruded diamond box with walls, roof, and pixel-art details.
// ============================================================================

import type { BuildingTypeId } from "@/sim/types";
import type { CorridorNeighbors } from "./glyphs";
import { moduleColor } from "./catalog";
import { MODULE_CATALOG } from "./catalog";
import type { BuildingInstance } from "@/sim/types";

// === Color helpers ===

function darken(hex: string, amt: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = (v: number) => Math.max(0, Math.floor(v * (1 - amt)));
  return `#${f(r).toString(16).padStart(2, "0")}${f(g).toString(16).padStart(2, "0")}${f(b).toString(16).padStart(2, "0")}`;
}

function lighten(hex: string, amt: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = (v: number) => Math.min(255, Math.floor(v + (255 - v) * amt));
  return `#${f(r).toString(16).padStart(2, "0")}${f(g).toString(16).padStart(2, "0")}${f(b).toString(16).padStart(2, "0")}`;
}

// === Iso diamond helpers ===

/** Fill a diamond shape using horizontal scanlines (pixel-art crisp). */
function fillDiamond(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  color: string,
) {
  ctx.fillStyle = color;
  for (let y = -halfH; y < halfH; y++) {
    const t = 1 - Math.abs(y + 0.5) / halfH;
    const w = Math.ceil(halfW * t);
    ctx.fillRect(cx - w, cy + y, w * 2, 1);
  }
}

/** Stroke a diamond outline. */
function strokeDiamond(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  color: string,
) {
  ctx.fillStyle = color;
  // Top half: left + right edges
  for (let y = -halfH; y <= 0; y++) {
    const t = 1 - Math.abs(y + 0.5) / halfH;
    const w = Math.ceil(halfW * t);
    ctx.fillRect(cx - w - 1, cy + y, 1, 1);
    ctx.fillRect(cx + w, cy + y, 1, 1);
  }
  // Bottom half
  for (let y = 0; y <= halfH; y++) {
    const t = 1 - Math.abs(y + 0.5) / halfH;
    const w = Math.ceil(halfW * t);
    ctx.fillRect(cx - w - 1, cy + y, 1, 1);
    ctx.fillRect(cx + w, cy + y, 1, 1);
  }
}

// === Iso building spec ===

interface IsoSpec {
  height: number;      // wall height in sprite px
  roof: "flat" | "dome" | "solar" | "radar" | "open" | "rails";
  windows?: boolean;
  antenna?: boolean;
  domeHeight?: number; // for dome roof
}

const SPECS: Record<BuildingTypeId, IsoSpec> = {
  nuclear_reactor:      { height: 22, roof: "dome", domeHeight: 14 },
  solar_array:          { height: 4, roof: "solar" },
  battery_bank:         { height: 14, roof: "flat", windows: true },
  crew_habitat:         { height: 32, roof: "flat", windows: true },
  residential_dome:     { height: 20, roof: "dome", domeHeight: 22, windows: true },
  medical_bay:          { height: 24, roof: "flat", windows: true },
  water_plant:          { height: 20, roof: "flat", windows: true },
  oxygen_plant:         { height: 22, roof: "flat", windows: true },
  greenhouse:           { height: 16, roof: "dome", domeHeight: 18 },
  waste_recycler:       { height: 16, roof: "flat" },
  regolith_harvester:   { height: 12, roof: "flat" },
  regolith_excavator:   { height: 10, roof: "open" },
  helium3_extractor:    { height: 28, roof: "radar", antenna: true },
  fab_bay:              { height: 20, roof: "flat", windows: true },
  parts_factory:        { height: 24, roof: "flat", windows: true },
  shipyard:             { height: 18, roof: "open" },
  research_lab:         { height: 28, roof: "flat", windows: true },
  observatory:          { height: 20, roof: "dome", domeHeight: 16, antenna: true },
  mars_mission_control: { height: 30, roof: "flat", windows: true, antenna: true },
  storage_depot:        { height: 14, roof: "flat" },
  landing_pad:          { height: 3, roof: "open" },
  rover_depot:          { height: 12, roof: "flat" },
  corridor:             { height: 8, roof: "open" },
  rail_launch:          { height: 6, roof: "rails" },
};

// === Main iso building renderer ===

function drawIsoBuilding(
  ctx: CanvasRenderingContext2D,
  typeId: BuildingTypeId,
  color: string,
  cx: number,
  baseY: number,
  halfW: number,
  halfH: number,
) {
  const spec = SPECS[typeId];
  if (!spec) return;
  const h = spec.height;
  const wallDark = darken(color, 0.4);
  const wallMid = color;
  const wallLight = lighten(color, 0.12);
  const roofColor = lighten(color, 0.2);
  const outline = darken(color, 0.65);

  // Diamond corners (relative to cx, baseY)
  // N = back (top), E = right, S = front (bottom), W = left
  const N = { x: 0, y: -halfH };
  const E = { x: halfW, y: 0 };
  const S = { x: 0, y: halfH };
  const W = { x: -halfW, y: 0 };

  // === Draw left wall (front-left face) ===
  // Parallelogram: W → S → S-up → W-up
  ctx.fillStyle = wallDark;
  ctx.beginPath();
  ctx.moveTo(cx + W.x, baseY + W.y);
  ctx.lineTo(cx + S.x, baseY + S.y);
  ctx.lineTo(cx + S.x, baseY + S.y - h);
  ctx.lineTo(cx + W.x, baseY + W.y - h);
  ctx.closePath();
  ctx.fill();

  // === Draw right wall (front-right face) ===
  ctx.fillStyle = wallMid;
  ctx.beginPath();
  ctx.moveTo(cx + S.x, baseY + S.y);
  ctx.lineTo(cx + E.x, baseY + E.y);
  ctx.lineTo(cx + E.x, baseY + E.y - h);
  ctx.lineTo(cx + S.x, baseY + S.y - h);
  ctx.closePath();
  ctx.fill();

  // === Wall outlines ===
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1;
  ctx.beginPath();
  // Left wall edges
  ctx.moveTo(cx + W.x, baseY + W.y);
  ctx.lineTo(cx + S.x, baseY + S.y);
  ctx.moveTo(cx + W.x, baseY + W.y);
  ctx.lineTo(cx + W.x, baseY + W.y - h);
  // Right wall edges
  ctx.moveTo(cx + S.x, baseY + S.y);
  ctx.lineTo(cx + E.x, baseY + E.y);
  ctx.moveTo(cx + E.x, baseY + E.y);
  ctx.lineTo(cx + E.x, baseY + E.y - h);
  // Vertical front edge
  ctx.moveTo(cx + S.x, baseY + S.y);
  ctx.lineTo(cx + S.x, baseY + S.y - h);
  ctx.stroke();

  // === Windows on walls ===
  if (spec.windows) {
    const winColor = "#ffe0a0";
    const winRows = Math.max(1, Math.floor(h / 8));
    const winCols = Math.max(1, Math.floor(halfW / 8));
    for (let row = 0; row < winRows; row++) {
      const wy = baseY - 4 - row * 8;
      if (wy < baseY - h + 2) break;
      // Left wall windows
      for (let col = 0; col < winCols; col++) {
        const t = (col + 0.5) / winCols;
        const wx = cx + W.x + (S.x - W.x) * t;
        ctx.fillStyle = winColor;
        ctx.fillRect(wx - 1, wy - 1, 2, 2);
      }
      // Right wall windows
      for (let col = 0; col < winCols; col++) {
        const t = (col + 0.5) / winCols;
        const wx = cx + S.x + (E.x - S.x) * t;
        ctx.fillStyle = darken(winColor, 0.2);
        ctx.fillRect(wx - 1, wy - 1, 2, 2);
      }
    }
  }

  // === Roof ===
  const roofY = baseY - h;
  if (spec.roof === "flat") {
    fillDiamond(ctx, cx, roofY, halfW, halfH, roofColor);
    strokeDiamond(ctx, cx, roofY, halfW, halfH, outline);
    // Roof detail: small rect in center
    ctx.fillStyle = wallDark;
    ctx.fillRect(cx - 3, roofY - 2, 6, 4);
  } else if (spec.roof === "dome") {
    const dh = spec.domeHeight ?? 12;
    // Draw dome as stacked diamonds getting smaller
    const steps = Math.max(4, Math.floor(dh / 2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const dh2 = halfH * (1 - t * 0.8);
      const dw = halfW * (1 - t * 0.8);
      const dy = roofY - t * dh;
      fillDiamond(ctx, cx, dy, dw, dh2, i === steps ? roofColor : lighten(color, 0.15 + t * 0.1));
    }
    strokeDiamond(ctx, cx, roofY, halfW, halfH, outline);
  } else if (spec.roof === "solar") {
    // Flat dark panels
    fillDiamond(ctx, cx, roofY, halfW, halfH, "#1a1a2e");
    strokeDiamond(ctx, cx, roofY, halfW, halfH, outline);
    // Panel grid lines
    ctx.fillStyle = darken(color, 0.5);
    for (let i = 1; i < 4; i++) {
      const t = i / 4;
      // Horizontal lines (along the diamond)
      const wy = roofY - halfH * (1 - t * 2);
      const ww = halfW * (1 - Math.abs(t * 2 - 1));
      if (ww > 0) ctx.fillRect(cx - ww, wy, ww * 2, 1);
    }
  } else if (spec.roof === "radar") {
    fillDiamond(ctx, cx, roofY, halfW, halfH, wallDark);
    strokeDiamond(ctx, cx, roofY, halfW, halfH, outline);
    // Radar dish: small circle + line
    ctx.fillStyle = roofColor;
    ctx.beginPath();
    ctx.arc(cx, roofY - 4, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = outline;
    ctx.stroke();
  } else if (spec.roof === "open") {
    // Just outline the roof diamond (flat top, no cover)
    fillDiamond(ctx, cx, roofY, halfW, halfH, darken(color, 0.3));
    strokeDiamond(ctx, cx, roofY, halfW, halfH, outline);
    // Draw some internal details (machinery)
    ctx.fillStyle = wallLight;
    ctx.fillRect(cx - 6, roofY - 3, 4, 4);
    ctx.fillRect(cx + 2, roofY - 3, 4, 4);
  } else if (spec.roof === "rails") {
    // Rail launch: flat top with rails
    fillDiamond(ctx, cx, roofY, halfW, halfH, darken(color, 0.2));
    strokeDiamond(ctx, cx, roofY, halfW, halfH, outline);
    // Draw rails along the east-west axis
    ctx.fillStyle = lighten(color, 0.3);
    for (let x = -halfW + 4; x < halfW - 4; x += 2) {
      ctx.fillRect(cx + x, roofY - 2, 1, 1);
      ctx.fillRect(cx + x, roofY + 1, 1, 1);
    }
    // Ties
    ctx.fillStyle = wallDark;
    for (let x = -halfW + 6; x < halfW - 6; x += 6) {
      ctx.fillRect(cx + x, roofY - 2, 2, 4);
    }
  }

  // === Antenna ===
  if (spec.antenna) {
    const antTop = roofY - (spec.domeHeight ?? 0) - 12;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, roofY - (spec.domeHeight ?? 0));
    ctx.lineTo(cx, antTop);
    ctx.stroke();
    // Antenna tip
    ctx.fillStyle = "#ff4444";
    ctx.fillRect(cx - 1, antTop - 1, 2, 2);
  }
}

// === Corridor renderer (iso) ===

function drawIsoCorridor(
  ctx: CanvasRenderingContext2D,
  color: string,
  neighbors: CorridorNeighbors | undefined,
  cx: number,
  baseY: number,
  halfW: number,
  halfH: number,
) {
  const n = neighbors ?? { n: false, s: false, e: false, w: false };
  const h = 8;
  const wallDark = darken(color, 0.4);
  const outline = darken(color, 0.65);
  const roofColor = lighten(color, 0.15);

  // Draw as a low extruded box (same as building but short)
  const N = { x: 0, y: -halfH };
  const E = { x: halfW, y: 0 };
  const S = { x: 0, y: halfH };
  const W = { x: -halfW, y: 0 };

  // Left wall
  ctx.fillStyle = wallDark;
  ctx.beginPath();
  ctx.moveTo(cx + W.x, baseY + W.y);
  ctx.lineTo(cx + S.x, baseY + S.y);
  ctx.lineTo(cx + S.x, baseY + S.y - h);
  ctx.lineTo(cx + W.x, baseY + W.y - h);
  ctx.closePath();
  ctx.fill();

  // Right wall
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx + S.x, baseY + S.y);
  ctx.lineTo(cx + E.x, baseY + E.y);
  ctx.lineTo(cx + E.x, baseY + E.y - h);
  ctx.lineTo(cx + S.x, baseY + S.y - h);
  ctx.closePath();
  ctx.fill();

  // Roof
  fillDiamond(ctx, cx, baseY - h, halfW, halfH, roofColor);
  strokeDiamond(ctx, cx, baseY - h, halfW, halfH, outline);

  // Center detail (window strip on roof)
  ctx.fillStyle = "#88ccff";
  ctx.fillRect(cx - halfW + 4, baseY - h - 1, halfW * 2 - 8, 1);

  // Connector tubes toward neighbors
  const tubeW = 6;
  const tubeH = 3;
  const drawConnector = (dir: "n" | "s" | "e" | "w") => {
    if (!n[dir]) return;
    // In iso space:
    // N (world) → top-left of diamond → direction (-1, -0.5)
    // S (world) → bottom-right → direction (+1, +0.5)
    // E (world) → right → direction (+1, -0.5)
    // W (world) → left → direction (-1, +0.5)
    let dx = 0, dy = 0;
    if (dir === "n") { dx = -1; dy = -0.5; }
    if (dir === "s") { dx = 1; dy = 0.5; }
    if (dir === "e") { dx = 1; dy = -0.5; }
    if (dir === "w") { dx = -1; dy = 0.5; }

    // Draw a small tube from the edge of the diamond outward
    const startX = cx + dx * halfW * 0.5;
    const startY = baseY + dy * halfH * 0.5 - h / 2;
    const endX = cx + dx * (halfW + 10);
    const endY = baseY + dy * (halfH + 5) - h / 2;

    ctx.fillStyle = wallDark;
    ctx.fillRect(
      Math.min(startX, endX),
      startY - tubeH,
      Math.abs(endX - startX) || 1,
      tubeH * 2,
    );
    ctx.fillStyle = roofColor;
    ctx.fillRect(
      Math.min(startX, endX),
      startY - tubeH,
      Math.abs(endX - startX) || 1,
      1,
    );
  };

  drawConnector("n");
  drawConnector("s");
  drawConnector("e");
  drawConnector("w");
}

// === Canvas sizing ===

function getSpriteDimensions(typeId: BuildingTypeId): {
  canvasW: number;
  canvasH: number;
  baseCenterX: number;
  baseCenterY: number;
  halfW: number;
  halfH: number;
} {
  const def = MODULE_CATALOG[typeId];
  if (!def) {
    return { canvasW: 100, canvasH: 100, baseCenterX: 50, baseCenterY: 80, halfW: 40, halfH: 20 };
  }

  const halfW = def.size.w;
  const halfH = def.size.w / 2; // 2:1 iso ratio
  const spec = SPECS[typeId];
  const h = spec?.height ?? 20;
  const domeH = spec?.domeHeight ?? 0;
  const antennaH = spec?.antenna ? 14 : 0;

  const canvasW = halfW * 2 + 20;
  const canvasH = halfH * 2 + h + domeH + antennaH + 20;
  const baseCenterX = Math.floor(canvasW / 2);
  const baseCenterY = halfH + h + 10; // base center from top of canvas

  return { canvasW, canvasH, baseCenterX, baseCenterY, halfW, halfH };
}

// === Cache ===

const cache = new Map<string, HTMLCanvasElement>();

function neighborsKey(n?: CorridorNeighbors): string {
  if (!n) return "0";
  return `${n.n ? 1 : 0}${n.s ? 1 : 0}${n.e ? 1 : 0}${n.w ? 1 : 0}`;
}

/**
 * Get a cached offscreen canvas with the iso building sprite pre-rendered.
 */
export function getBuildingCanvas(
  typeId: BuildingTypeId,
  neighbors?: CorridorNeighbors,
): HTMLCanvasElement | null {
  const color = moduleColor(typeId);
  const key = `${typeId}:${neighborsKey(neighbors)}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const dims = getSpriteDimensions(typeId);
  const canvas = document.createElement("canvas");
  canvas.width = dims.canvasW;
  canvas.height = dims.canvasH;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  const { baseCenterX: cx, baseCenterY: baseY, halfW, halfH } = dims;

  if (typeId === "corridor") {
    drawIsoCorridor(ctx, color, neighbors, cx, baseY, halfW, halfH);
  } else {
    drawIsoBuilding(ctx, typeId, color, cx, baseY, halfW, halfH);
  }

  cache.set(key, canvas);
  return canvas;
}

/**
 * Pre-warm the cache for all building types.
 */
export function prerasterizeAllBuildings(): void {
  const types = Object.keys(MODULE_CATALOG) as BuildingTypeId[];
  for (const t of types) {
    getBuildingCanvas(t);
  }
  // Corridor: all 16 neighbor combos
  for (let i = 0; i < 16; i++) {
    getBuildingCanvas("corridor", {
      n: !!(i & 1),
      s: !!(i & 2),
      e: !!(i & 4),
      w: !!(i & 8),
    });
  }
}

// === Metadata for rendering ===

export function getSpriteDims(typeId: BuildingTypeId) {
  return getSpriteDimensions(typeId);
}

// === Corridor neighbor computation (shared) ===

export function computeCorridorNeighborsMap(
  buildings: BuildingInstance[],
): Map<string, CorridorNeighbors> {
  const map = new Map<string, CorridorNeighbors>();
  const check = (x: number, y: number, excludeId: string) => {
    for (const b of buildings) {
      if (b.id === excludeId) continue;
      const def = MODULE_CATALOG[b.typeId];
      if (!def) continue;
      if (
        x >= b.x - def.size.w / 2 &&
        x <= b.x + def.size.w / 2 &&
        y >= b.y - def.size.h / 2 &&
        y <= b.y + def.size.h / 2
      ) {
        return true;
      }
    }
    return false;
  };
  const d = 40;
  for (const b of buildings) {
    if (b.typeId !== "corridor") continue;
    map.set(b.id, {
      n: check(b.x, b.y - d, b.id),
      s: check(b.x, b.y + d, b.id),
      e: check(b.x + d, b.y, b.id),
      w: check(b.x - d, b.y, b.id),
    });
  }
  return map;
}
