// ============================================================================
// IsoRasterizer — pre-renders isometric (RA2-style) building sprites to cached canvases
// Each building is an extruded diamond box with walls, roof, and pixel-art details.
// Supports both square (n x n) and non-square (1 x n for rail) footprints.
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

// === Iso diamond helpers (polygon-based, supports non-square) ===

/**
 * Compute the 4 screen-space corners of an iso diamond for a world-space W x H footprint.
 * Corners are: N (top/back), E (right), S (bottom/front), W (left).
 * All relative to (0,0) = building center on screen.
 *
 * Iso projection: sx = (wx - wy), sy = (wx + wy) * 0.5
 * Footprint: wx ∈ [-W/2, W/2], wy ∈ [-H/2, H/2]
 */
function isoCorners(w: number, h: number) {
  const hw = w / 2;
  const hh = h / 2;
  // World corners → screen
  // N: world (-hw, -hh) → screen (-(hw) - (-hh), (-hw + -hh)*0.5) = (-hw+hh, -(hw+hh)/2)
  // E: world (hw, -hh)  → screen (hw+hh, (hw-hh)/2)
  // S: world (hw, hh)   → screen (hw-hh, (hw+hh)/2)
  // W: world (-hw, hh)  → screen (-(hw+hh), (-hw+hh)/2) = (-(hw+hh), (hh-hw)/2)
  return {
    N: { x: -hw + hh, y: -(hw + hh) / 2 },
    E: { x: hw + hh, y: (hw - hh) / 2 },
    S: { x: hw - hh, y: (hw + hh) / 2 },
    W: { x: -(hw + hh), y: (hh - hw) / 2 },
  };
}

/** Fill a diamond (4 corners) as a polygon. */
function fillDiamondPoly(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  corners: { x: number; y: number }[],
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx + corners[0].x, cy + corners[0].y);
  for (let i = 1; i < corners.length; i++) {
    ctx.lineTo(cx + corners[i].x, cy + corners[i].y);
  }
  ctx.closePath();
  ctx.fill();
}

/** Stroke a diamond outline. */
function strokeDiamondPoly(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  corners: { x: number; y: number }[],
  color: string,
  lineWidth = 1,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(cx + corners[0].x, cy + corners[0].y);
  for (let i = 1; i < corners.length; i++) {
    ctx.lineTo(cx + corners[i].x, cy + corners[i].y);
  }
  ctx.closePath();
  ctx.stroke();
}

// === Iso building spec ===

interface IsoSpec {
  height: number;
  roof: "flat" | "dome" | "solar" | "radar" | "open" | "rails";
  windows?: boolean;
  antenna?: boolean;
  domeHeight?: number;
}

const SPECS: Record<BuildingTypeId, IsoSpec> = {
  nuclear_reactor:      { height: 22, roof: "dome", domeHeight: 14 },
  solar_array:          { height: 4, roof: "solar" },
  battery_bank:         { height: 14, roof: "flat", windows: true },
  crew_habitat:         { height: 28, roof: "flat", windows: true },
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
  footW: number,
  footH: number,
) {
  const spec = SPECS[typeId];
  if (!spec) return;
  const h = spec.height;
  const wallDark = darken(color, 0.4);
  const wallMid = color;
  const wallLight = lighten(color, 0.12);
  const roofColor = lighten(color, 0.2);
  const outline = darken(color, 0.65);

  const { N, E, S, W } = isoCorners(footW, footH);

  // === Draw left wall (front-left face: W → S → S-up → W-up) ===
  ctx.fillStyle = wallDark;
  ctx.beginPath();
  ctx.moveTo(cx + W.x, baseY + W.y);
  ctx.lineTo(cx + S.x, baseY + S.y);
  ctx.lineTo(cx + S.x, baseY + S.y - h);
  ctx.lineTo(cx + W.x, baseY + W.y - h);
  ctx.closePath();
  ctx.fill();

  // === Draw right wall (front-right face: S → E → E-up → S-up) ===
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
  ctx.moveTo(cx + W.x, baseY + W.y);
  ctx.lineTo(cx + S.x, baseY + S.y);
  ctx.moveTo(cx + W.x, baseY + W.y);
  ctx.lineTo(cx + W.x, baseY + W.y - h);
  ctx.moveTo(cx + S.x, baseY + S.y);
  ctx.lineTo(cx + E.x, baseY + E.y);
  ctx.moveTo(cx + E.x, baseY + E.y);
  ctx.lineTo(cx + E.x, baseY + E.y - h);
  ctx.moveTo(cx + S.x, baseY + S.y);
  ctx.lineTo(cx + S.x, baseY + S.y - h);
  ctx.stroke();

  // === Windows on walls ===
  if (spec.windows) {
    const winColor = "#ffe0a0";
    const winRows = Math.max(1, Math.floor(h / 8));
    const winColsL = Math.max(1, Math.floor(footW / 12));
    const winColsR = Math.max(1, Math.floor(footH / 12));
    for (let row = 0; row < winRows; row++) {
      const wy = baseY - 4 - row * 8;
      if (wy < baseY - h + 2) break;
      // Left wall windows (along W→S edge)
      for (let col = 0; col < winColsL; col++) {
        const t = (col + 0.5) / winColsL;
        const wx = cx + W.x + (S.x - W.x) * t;
        ctx.fillStyle = winColor;
        ctx.fillRect(wx - 1, wy - 1, 2, 2);
      }
      // Right wall windows (along S→E edge)
      for (let col = 0; col < winColsR; col++) {
        const t = (col + 0.5) / winColsR;
        const wx = cx + S.x + (E.x - S.x) * t;
        ctx.fillStyle = darken(winColor, 0.2);
        ctx.fillRect(wx - 1, wy - 1, 2, 2);
      }
    }
  }

  // === Roof ===
  const roofY = baseY - h;
  const roofCorners = [N, E, S, W];
  if (spec.roof === "flat") {
    fillDiamondPoly(ctx, cx, roofY, roofCorners, roofColor);
    strokeDiamondPoly(ctx, cx, roofY, roofCorners, outline);
    ctx.fillStyle = wallDark;
    ctx.fillRect(cx - 3, roofY - 2, 6, 4);
  } else if (spec.roof === "dome") {
    const dh = spec.domeHeight ?? 12;
    const steps = Math.max(4, Math.floor(dh / 2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const scaledCorners = roofCorners.map(c => ({ x: c.x * (1 - t * 0.8), y: c.y * (1 - t * 0.8) }));
      fillDiamondPoly(ctx, cx, roofY - t * dh, scaledCorners, i === steps ? roofColor : lighten(color, 0.15 + t * 0.1));
    }
    strokeDiamondPoly(ctx, cx, roofY, roofCorners, outline);
  } else if (spec.roof === "solar") {
    fillDiamondPoly(ctx, cx, roofY, roofCorners, "#1a1a2e");
    strokeDiamondPoly(ctx, cx, roofY, roofCorners, outline);
    // Panel grid lines
    ctx.fillStyle = darken(color, 0.5);
    for (let i = 1; i < 4; i++) {
      const t = i / 4;
      // Line from N-edge to S-edge at parameter t
      const p1 = { x: N.x + (E.x - N.x) * t, y: N.y + (E.y - N.y) * t };
      const p2 = { x: W.x + (S.x - W.x) * t, y: W.y + (S.y - W.y) * t };
      ctx.beginPath();
      ctx.moveTo(cx + p1.x, roofY + p1.y);
      ctx.lineTo(cx + p2.x, roofY + p2.y);
      ctx.stroke();
    }
  } else if (spec.roof === "radar") {
    fillDiamondPoly(ctx, cx, roofY, roofCorners, wallDark);
    strokeDiamondPoly(ctx, cx, roofY, roofCorners, outline);
    ctx.fillStyle = roofColor;
    ctx.beginPath();
    ctx.arc(cx, roofY - 4, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = outline;
    ctx.stroke();
  } else if (spec.roof === "open") {
    fillDiamondPoly(ctx, cx, roofY, roofCorners, darken(color, 0.3));
    strokeDiamondPoly(ctx, cx, roofY, roofCorners, outline);
    ctx.fillStyle = wallLight;
    ctx.fillRect(cx - 6, roofY - 3, 4, 4);
    ctx.fillRect(cx + 2, roofY - 3, 4, 4);
  } else if (spec.roof === "rails") {
    // Rail launch: draw rails along the long axis (E↔W direction)
    fillDiamondPoly(ctx, cx, roofY, roofCorners, darken(color, 0.2));
    strokeDiamondPoly(ctx, cx, roofY, roofCorners, outline);
    // Two rails parallel to the long axis (E-W)
    ctx.fillStyle = lighten(color, 0.3);
    // Draw rails as a series of small segments along the E-W diagonal
    const railOff = 2;
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // Rail 1: offset toward N
      const p1x = W.x + (E.x - W.x) * t;
      const p1y = W.y + (E.y - W.y) * t;
      // Offset perpendicular to E-W, toward N
      const dx = E.x - W.x;
      const dy = E.y - W.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = -dy / len * railOff;
      const ny = dx / len * railOff;
      ctx.fillRect(cx + p1x + nx - 0.5, roofY + p1y + ny - 0.5, 1, 1);
      ctx.fillRect(cx + p1x - nx - 0.5, roofY + p1y - ny - 0.5, 1, 1);
    }
    // Ties (cross bars)
    ctx.fillStyle = wallDark;
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const p1x = W.x + (E.x - W.x) * t;
      const p1y = W.y + (E.y - W.y) * t;
      const dx = E.x - W.x;
      const dy = E.y - W.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = -dy / len * railOff;
      const ny = dx / len * railOff;
      ctx.beginPath();
      ctx.moveTo(cx + p1x + nx, roofY + p1y + ny);
      ctx.lineTo(cx + p1x - nx, roofY + p1y - ny);
      ctx.strokeStyle = wallDark;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // === Antenna ===
  if (spec.antenna) {
    const antBase = roofY - (spec.domeHeight ?? 0);
    const antTop = antBase - 12;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, antBase);
    ctx.lineTo(cx, antTop);
    ctx.stroke();
    ctx.fillStyle = "#ff4444";
    ctx.fillRect(cx - 1, antTop - 1, 2, 2);
  }
}

// === Corridor renderer (iso) — polygon-based, no scanline artifacts ===

function drawIsoCorridor(
  ctx: CanvasRenderingContext2D,
  color: string,
  neighbors: CorridorNeighbors | undefined,
  cx: number,
  baseY: number,
  footW: number,
  footH: number,
) {
  const n = neighbors ?? { n: false, s: false, e: false, w: false };
  const h = 8;
  const wallDark = darken(color, 0.4);
  const outline = darken(color, 0.65);
  const roofColor = lighten(color, 0.15);
  const { N, E, S, W } = isoCorners(footW, footH);

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

  // Roof — polygon fill (no horizontal artifacts)
  const roofCorners = [
    { x: N.x, y: N.y - h },
    { x: E.x, y: E.y - h },
    { x: S.x, y: S.y - h },
    { x: W.x, y: W.y - h },
  ];
  fillDiamondPoly(ctx, cx, baseY, roofCorners, roofColor);
  strokeDiamondPoly(ctx, cx, baseY, roofCorners, outline);

  // Center window strip on roof
  ctx.fillStyle = "#88ccff";
  ctx.beginPath();
  ctx.moveTo(cx + N.x * 0.3, baseY + N.y * 0.3 - h);
  ctx.lineTo(cx + E.x * 0.3, baseY + E.y * 0.3 - h);
  ctx.lineTo(cx + S.x * 0.3, baseY + S.y * 0.3 - h);
  ctx.lineTo(cx + W.x * 0.3, baseY + W.y * 0.3 - h);
  ctx.closePath();
  ctx.fill();

  // Connector tubes toward neighbors — drawn as small extruded boxes extending outward
  const drawConnector = (dir: "n" | "s" | "e" | "w") => {
    if (!n[dir]) return;
    // Direction in screen space (from center toward edge midpoint)
    let edgeMid: { x: number; y: number };
    if (dir === "n") edgeMid = { x: (N.x + W.x) / 2, y: (N.y + W.y) / 2 };
    else if (dir === "s") edgeMid = { x: (S.x + E.x) / 2, y: (S.y + E.y) / 2 };
    else if (dir === "e") edgeMid = { x: (E.x + S.x) / 2, y: (E.y + S.y) / 2 };
    else edgeMid = { x: (W.x + N.x) / 2, y: (W.y + N.y) / 2 };

    // Extend outward by 8px
    const extLen = 8;
    const len = Math.sqrt(edgeMid.x * edgeMid.x + edgeMid.y * edgeMid.y);
    const ux = edgeMid.x / len;
    const uy = edgeMid.y / len;
    const tipX = edgeMid.x + ux * extLen;
    const tipY = edgeMid.y + uy * extLen;

    // Draw a small tube (rectangle from edgeMid to tip, height h)
    ctx.fillStyle = wallDark;
    ctx.beginPath();
    ctx.moveTo(cx + edgeMid.x, baseY + edgeMid.y);
    ctx.lineTo(cx + tipX, baseY + tipY);
    ctx.lineTo(cx + tipX, baseY + tipY - h);
    ctx.lineTo(cx + edgeMid.x, baseY + edgeMid.y - h);
    ctx.closePath();
    ctx.fill();

    // Top of tube
    ctx.fillStyle = roofColor;
    ctx.beginPath();
    ctx.moveTo(cx + edgeMid.x, baseY + edgeMid.y - h);
    ctx.lineTo(cx + tipX, baseY + tipY - h);
    ctx.lineTo(cx + tipX + 2, baseY + tipY - h);
    ctx.lineTo(cx + edgeMid.x + 2, baseY + edgeMid.y - h);
    ctx.closePath();
    ctx.fill();
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
  footW: number;
  footH: number;
} {
  const def = MODULE_CATALOG[typeId];
  if (!def) {
    return { canvasW: 100, canvasH: 100, baseCenterX: 50, baseCenterY: 80, footW: 40, footH: 40 };
  }

  const footW = def.size.w;
  const footH = def.size.h;
  const spec = SPECS[typeId];
  const h = spec?.height ?? 20;
  const domeH = spec?.domeHeight ?? 0;
  const antennaH = spec?.antenna ? 14 : 0;

  // Iso diamond bounding box: width = footW + footH, height = (footW + footH) / 2
  const diamondW = footW + footH;
  const diamondH = (footW + footH) / 2;

  const canvasW = Math.ceil(diamondW + 20);
  const canvasH = Math.ceil(diamondH + h + domeH + antennaH + 20);
  const baseCenterX = Math.floor(canvasW / 2);
  const baseCenterY = Math.floor(diamondH / 2 + h + 10);

  return { canvasW, canvasH, baseCenterX, baseCenterY, footW, footH };
}

// === Cache ===

const cache = new Map<string, HTMLCanvasElement>();

function neighborsKey(n?: CorridorNeighbors): string {
  if (!n) return "0";
  return `${n.n ? 1 : 0}${n.s ? 1 : 0}${n.e ? 1 : 0}${n.w ? 1 : 0}`;
}

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

  const { baseCenterX: cx, baseCenterY: baseY, footW, footH } = dims;

  if (typeId === "corridor") {
    drawIsoCorridor(ctx, color, neighbors, cx, baseY, footW, footH);
  } else {
    drawIsoBuilding(ctx, typeId, color, cx, baseY, footW, footH);
  }

  cache.set(key, canvas);
  return canvas;
}

export function prerasterizeAllBuildings(): void {
  const types = Object.keys(MODULE_CATALOG) as BuildingTypeId[];
  for (const t of types) {
    getBuildingCanvas(t);
  }
  for (let i = 0; i < 16; i++) {
    getBuildingCanvas("corridor", {
      n: !!(i & 1),
      s: !!(i & 2),
      e: !!(i & 4),
      w: !!(i & 8),
    });
  }
}

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
