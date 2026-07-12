// ============================================================================
// Rasterizer — pre-renders pixel-art building glyphs to cached offscreen canvases
// Eliminates per-frame SVG node creation; drawImage is orders of magnitude faster
// ============================================================================

import type { BuildingTypeId } from "@/sim/types";
import type { CorridorNeighbors } from "./glyphs";
import { moduleColor } from "./catalog";

// === Color helpers ===

function darken(hex: string, amt: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = (v: number) => Math.max(0, Math.floor(v * (1 - amt)));
  return `#${f(r).toString(16).padStart(2, "0")}${f(g).toString(16).padStart(2, "0")}${f(b).toString(16).padStart(2, "0")}`;
}

function buildPalette(color: string): Record<string, string> {
  return {
    "#": color,
    o: "#0a0a0a",
    "=": darken(color, 0.45),
    "-": darken(color, 0.2),
    "+": "#ffe0b0",
  };
}

// === Pixel map data (same maps as glyphs.tsx) ===

const MAPS: Partial<Record<BuildingTypeId, string[]>> = {
  nuclear_reactor: [
    "....oooo....",
    "..oo######oo",
    ".o##########o",
    "o####=++=####o",
    "o###=++++=###o",
    "o##=++##++=##o",
    "o##=++##++=##o",
    "o###=++++=###o",
    "o####=++=####o",
    ".o##########o",
    "..oo######oo",
    "....oooo....",
  ],
  solar_array: [
    ".oooooooooo.",
    "o==========o",
    "o##########o",
    "o==========o",
    "o##########o",
    "o==========o",
    "o##########o",
    ".oooooooooo.",
    ".....##.....",
    ".....##.....",
    "....####....",
    "....####....",
  ],
  battery_bank: [
    ".++.++.++...",
    "o#oo#oo#oo..",
    "o#oo#oo#oo..",
    "o#oo#oo#oo..",
    "o#oo#oo#oo..",
    "o#oo#oo#oo..",
    "o#oo#oo#oo..",
    "o=oo=oo=oo..",
    ".o..o..o....",
    "............",
    "............",
    "............",
  ],
  crew_habitat: [
    ".oooooooooo.",
    "o##########o",
    "o#+######+#o",
    "o##########o",
    "o##########o",
    "o#+######+#o",
    "o##########o",
    "o##########o",
    "o#+######+#o",
    "o##########o",
    ".oooooooooo.",
    "............",
  ],
  residential_dome: [
    "....oooo....",
    "..oo####oo..",
    ".o########o.",
    "o##########o",
    "o###====###o",
    "o#========#o",
    "o#==####==#o",
    ".o========o.",
    "..o##o##o##o",
    "...o##o##o.",
    "....oooo....",
    "............",
  ],
  medical_bay: [
    ".oooooooooo.",
    "o##########o",
    "o##++++++##o",
    "o###++++###o",
    "o###++++###o",
    "o++++++++++o",
    "o++++++++++o",
    "o###++++###o",
    "o###++++###o",
    "o##++++++##o",
    ".oooooooooo.",
    "............",
  ],
  water_plant: [
    ".oooooooooo.",
    "o##o####o##o",
    "o##o####o##o",
    "o##o####o##o",
    "o##o####o##o",
    "o##o====o##o",
    "o##o====o##o",
    "o##o####o##o",
    "o##o####o##o",
    ".ooo####ooo.",
    "............",
    "............",
  ],
  oxygen_plant: [
    ".oooooooooo.",
    "o#+o###+o##o",
    "o#oo###oo##o",
    "o#oo###oo##o",
    "o#oo###oo##o",
    "o#oo###oo##o",
    "o#oo###oo##o",
    "o#oo###oo##o",
    "o==o===o===o",
    ".oo.oo.oo.oo",
    "............",
    "............",
  ],
  greenhouse: [
    ".oooooooooo.",
    "o++++++++++o",
    "o##======##o",
    "o#+######+#o",
    "o##======##o",
    "o#+######+#o",
    "o##======##o",
    "o#+######+#o",
    "o##======##o",
    "o##########o",
    ".oooooooooo.",
    "............",
  ],
  waste_recycler: [
    ".oooooooooo.",
    "o##########o",
    "o##=##=##=##o",
    "o#========#o",
    "o##=##=##=##o",
    "o##########o",
    "o##=##=##=##o",
    "o#========#o",
    "o##=##=##=##o",
    "o##########o",
    ".oooooooooo.",
    "............",
  ],
  regolith_harvester: [
    ".oooooooooo.",
    "o##########o",
    "o##########o",
    "o###====###o",
    "o###====###o",
    "o##########o",
    "o##########o",
    "o==o##o##o==o",
    ".oo.oo.oo.oo",
    "............",
    "............",
    "............",
  ],
  regolith_excavator: [
    "....o##o....",
    "....o##o....",
    "....o##o....",
    ".oooooooooo.",
    "o##########o",
    "o##======##o",
    "o##########o",
    "o##########o",
    ".oooooooooo.",
    "....####....",
    "...######...",
    "............",
  ],
  helium3_extractor: [
    "....oooo....",
    "..o##==##o..",
    ".o##====##o.",
    "o##=####=##o",
    "o#==####==#o",
    "o##=####=##o",
    "o#==####==#o",
    "o##=####=##o",
    ".o##====##o.",
    "..o##==##o..",
    "....oooo....",
    "............",
  ],
  fab_bay: [
    ".oooooooooo.",
    "o##o####o##o",
    "o##o####o##o",
    "o##########o",
    "o##======##o",
    "o##=++++=##o",
    "o##=++++=##o",
    "o##======##o",
    "o##########o",
    ".oooooooooo.",
    "............",
    "............",
  ],
  parts_factory: [
    "oooooooooooo",
    "o#o#o#o####o",
    "o#o#o#o####o",
    "o##########o",
    "o##======##o",
    "o##======##o",
    "o##########o",
    "o##########o",
    ".oooooooooo.",
    "............",
    "............",
    "............",
  ],
  shipyard: [
    "oooooooooooo",
    "o==========o",
    "o##o####o##o",
    "o##o####o##o",
    "o##o####o##o",
    "o##o####o##o",
    "o##o####o##o",
    "o==========o",
    "oooooooooooo",
    "............",
    "............",
    "............",
  ],
  research_lab: [
    ".oooooooooo.",
    "o##########o",
    "o##=++++=##o",
    "o##=++++=##o",
    "o##======##o",
    "o##########o",
    "o##======##o",
    "o##======##o",
    "o##########o",
    ".oooooooooo.",
    "............",
    "............",
  ],
  observatory: [
    "....oooo....",
    "...o####o...",
    "..o######o..",
    ".o########o.",
    "o##########o",
    "o###====###o",
    "o##########o",
    "o##########o",
    "o##########o",
    ".oooooooooo.",
    "............",
    "............",
  ],
  mars_mission_control: [
    "....o##o....",
    "....o##o....",
    "...o####o...",
    ".oooooooooo.",
    "o##########o",
    "o##======##o",
    "o##======##o",
    "o##########o",
    "o##########o",
    ".oooooooooo.",
    "............",
    "............",
  ],
  storage_depot: [
    ".oooooooooo.",
    "o#o##o##o##o",
    "o#o##o##o##o",
    "o#o##o##o##o",
    "o#o##o##o##o",
    "o#o##o##o##o",
    "o#o##o##o##o",
    "o#o##o##o##o",
    ".oo.oo.oo.oo",
    "............",
    "............",
    "............",
  ],
  landing_pad: [
    "....oooo....",
    "..oo####oo..",
    ".o##====##o.",
    "o##=++++=##o",
    "o#==++++==#o",
    "o#==++++==#o",
    "o##=++++=##o",
    ".o##====##o.",
    "..oo####oo..",
    "....oooo....",
    "............",
    "............",
  ],
  rover_depot: [
    ".oooooooooo.",
    "o##########o",
    "o#+######+#o",
    "o##########o",
    "o##======##o",
    "o##======##o",
    "o#o####o##o#",
    ".oo.oo.oo.o.",
    "............",
    "............",
    "............",
    "............",
  ],
};

// === Canvas pixel-art renderer ===

function drawPixelMap(
  ctx: CanvasRenderingContext2D,
  map: string[],
  palette: Record<string, string>,
  cx: number,
  cy: number,
  ps: number,
) {
  const rows = map.length;
  const cols = Math.max(...map.map((r) => r.length));
  const offX = cx - Math.floor((cols * ps) / 2);
  const offY = cy - Math.floor((rows * ps) / 2);
  for (let y = 0; y < rows; y++) {
    const row = map[y] || "";
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c === " " || c === ".") continue;
      const fill = palette[c];
      if (!fill) continue;
      ctx.fillStyle = fill;
      ctx.fillRect(offX + x * ps, offY + y * ps, ps, ps);
    }
  }
}

// === Corridor renderer (dynamic based on neighbors) ===

function drawCorridor(
  ctx: CanvasRenderingContext2D,
  color: string,
  neighbors: CorridorNeighbors | undefined,
  cx: number,
  cy: number,
  ps: number,
) {
  const n = neighbors ?? { n: false, s: false, e: false, w: false };
  const o = "#0a0a0a";
  const d = darken(color, 0.4);
  const l = darken(color, 0.15);

  const hubHalf = Math.floor((2 * ps) + (ps * 2)); // ~8 units in glyph space
  const hubHalfPx = hubHalf;
  const tubeHalf = Math.floor(ps * 1.75);
  const edge = 50;

  // Hub outline
  ctx.fillStyle = o;
  ctx.fillRect(cx - hubHalfPx - ps, cy - hubHalfPx - ps, (hubHalfPx + ps) * 2, ps);
  ctx.fillRect(cx - hubHalfPx - ps, cy + hubHalfPx, (hubHalfPx + ps) * 2, ps);
  ctx.fillRect(cx - hubHalfPx - ps, cy - hubHalfPx, ps, hubHalfPx * 2);
  ctx.fillRect(cx + hubHalfPx, cy - hubHalfPx, ps, hubHalfPx * 2);

  // Hub interior
  ctx.fillStyle = color;
  ctx.fillRect(cx - hubHalfPx, cy - hubHalfPx, hubHalfPx * 2, hubHalfPx * 2);

  // Center detail
  ctx.fillStyle = d;
  ctx.fillRect(cx - ps / 2, cy - ps / 2, ps, ps);

  const drawConnector = (dir: "n" | "s" | "e" | "w") => {
    if (!n[dir]) return;
    if (dir === "n") {
      for (let y = -edge; y < -hubHalfPx - ps; y += ps) {
        ctx.fillStyle = o;
        ctx.fillRect(cx - tubeHalf - ps, cy + y, ps, ps);
        ctx.fillRect(cx + tubeHalf, cy + y, ps, ps);
        ctx.fillStyle = color;
        ctx.fillRect(cx - tubeHalf, cy + y, tubeHalf * 2, ps);
      }
      for (let y = -edge + ps * 2; y < -hubHalfPx - ps; y += ps * 2) {
        ctx.fillStyle = d;
        ctx.fillRect(cx - tubeHalf, cy + y, tubeHalf * 2, ps);
      }
      ctx.fillStyle = l;
      for (let y = -edge; y < -hubHalfPx - ps; y += ps) {
        ctx.fillRect(cx - 1, cy + y, 2, ps);
      }
    }
    if (dir === "s") {
      for (let y = hubHalfPx + ps; y < edge; y += ps) {
        ctx.fillStyle = o;
        ctx.fillRect(cx - tubeHalf - ps, cy + y, ps, ps);
        ctx.fillRect(cx + tubeHalf, cy + y, ps, ps);
        ctx.fillStyle = color;
        ctx.fillRect(cx - tubeHalf, cy + y, tubeHalf * 2, ps);
      }
      for (let y = hubHalfPx + ps * 2; y < edge; y += ps * 2) {
        ctx.fillStyle = d;
        ctx.fillRect(cx - tubeHalf, cy + y, tubeHalf * 2, ps);
      }
      ctx.fillStyle = l;
      for (let y = hubHalfPx + ps; y < edge; y += ps) {
        ctx.fillRect(cx - 1, cy + y, 2, ps);
      }
    }
    if (dir === "e") {
      for (let x = hubHalfPx + ps; x < edge; x += ps) {
        ctx.fillStyle = o;
        ctx.fillRect(cx + x, cy - tubeHalf - ps, ps, ps);
        ctx.fillRect(cx + x, cy + tubeHalf, ps, ps);
        ctx.fillStyle = color;
        ctx.fillRect(cx + x, cy - tubeHalf, ps, tubeHalf * 2);
      }
      for (let x = hubHalfPx + ps * 2; x < edge; x += ps * 2) {
        ctx.fillStyle = d;
        ctx.fillRect(cx + x, cy - tubeHalf, ps, tubeHalf * 2);
      }
      ctx.fillStyle = l;
      for (let x = hubHalfPx + ps; x < edge; x += ps) {
        ctx.fillRect(cx + x, cy - 1, ps, 2);
      }
    }
    if (dir === "w") {
      for (let x = -edge; x < -hubHalfPx - ps; x += ps) {
        ctx.fillStyle = o;
        ctx.fillRect(cx + x, cy - tubeHalf - ps, ps, ps);
        ctx.fillRect(cx + x, cy + tubeHalf, ps, ps);
        ctx.fillStyle = color;
        ctx.fillRect(cx + x, cy - tubeHalf, ps, tubeHalf * 2);
      }
      for (let x = -edge + ps * 2; x < -hubHalfPx - ps; x += ps * 2) {
        ctx.fillStyle = d;
        ctx.fillRect(cx + x, cy - tubeHalf, ps, tubeHalf * 2);
      }
      ctx.fillStyle = l;
      for (let x = -edge; x < -hubHalfPx - ps; x += ps) {
        ctx.fillRect(cx + x, cy - 1, ps, 2);
      }
    }
  };

  drawConnector("n");
  drawConnector("s");
  drawConnector("e");
  drawConnector("w");

  // End caps if no neighbors
  if (!n.n && !n.s && !n.e && !n.w) {
    ctx.fillStyle = o;
    ctx.fillRect(cx - hubHalfPx - ps, cy - hubHalfPx - ps * 2, (hubHalfPx + ps) * 2, ps);
    ctx.fillRect(cx - hubHalfPx - ps, cy + hubHalfPx + ps, (hubHalfPx + ps) * 2, ps);
  }
}

// === Rail launch renderer ===

function drawRailLaunch(
  ctx: CanvasRenderingContext2D,
  color: string,
  cx: number,
  cy: number,
  ps: number,
) {
  const o = "#0a0a0a";
  const d = darken(color, 0.4);

  // Two rails
  for (let x = -48; x <= 44; x += ps) {
    ctx.fillStyle = color;
    ctx.fillRect(cx + x, cy - 8, ps, ps);
    ctx.fillRect(cx + x, cy + 4, ps, ps);
  }
  // Ties
  for (let x = -44; x <= 44; x += 12) {
    ctx.fillStyle = d;
    ctx.fillRect(cx + x, cy - 6, ps, 12);
  }
  // Outline top + bottom
  for (let x = -48; x <= 44; x += ps) {
    ctx.fillStyle = o;
    ctx.fillRect(cx + x, cy - 12, ps, ps);
    ctx.fillRect(cx + x, cy + 8, ps, ps);
  }
  // Gantry
  ctx.fillStyle = o;
  ctx.fillRect(cx + 36, cy - 16, 12, 28);
  ctx.fillStyle = d;
  ctx.fillRect(cx + 38, cy - 14, 8, 24);
  ctx.fillStyle = o;
  ctx.fillRect(cx + 40, cy - 20, 4, 4);
}

// === Cache ===

const CANVAS_SIZE = 100; // matches SVG viewBox
const PIXEL_SIZE = 5; // matches pxArt default

const cache = new Map<string, HTMLCanvasElement>();

function neighborsKey(n?: CorridorNeighbors): string {
  if (!n) return "0";
  return `${n.n ? 1 : 0}${n.s ? 1 : 0}${n.e ? 1 : 0}${n.w ? 1 : 0}`;
}

/**
 * Get a cached offscreen canvas with the building glyph pre-rendered.
 * The canvas is 100x100 px, centered at (50,50), matching the SVG viewBox.
 */
export function getBuildingCanvas(
  typeId: BuildingTypeId,
  neighbors?: CorridorNeighbors,
): HTMLCanvasElement | null {
  const color = moduleColor(typeId);
  const key = `${typeId}:${neighborsKey(neighbors)}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  if (typeId === "corridor") {
    drawCorridor(ctx, color, neighbors, 50, 50, 4);
  } else if (typeId === "rail_launch") {
    drawRailLaunch(ctx, color, 50, 50, 4);
  } else {
    const map = MAPS[typeId];
    if (!map) return null;
    const pal = buildPalette(color);
    drawPixelMap(ctx, map, pal, 50, 50, PIXEL_SIZE);
  }

  cache.set(key, canvas);
  return canvas;
}

/**
 * Pre-warm the cache for all building types (call on game init).
 */
export function prerasterizeAllBuildings(): void {
  const types = Object.keys(MAPS) as BuildingTypeId[];
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
  // Rail launch
  getBuildingCanvas("rail_launch");
}

// === Corridor neighbor computation (shared) ===

import { MODULE_CATALOG } from "./catalog";
import type { BuildingInstance } from "@/sim/types";

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
