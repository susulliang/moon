// ============================================================================
// Procedural lunar terrain: craters + maria + value-noise base elevation
// ============================================================================

import type { TerrainCrater, TerrainData } from "@/sim/types";
import { makeValueNoise2D, mulberry32, randInt, randRange } from "@/sim/random";

export interface GenerateOptions {
  size?: number;        // grid resolution
  worldExtent?: number; // total world size in meters (square)
  seed: number;
  craterCount?: number;
  sunAzimuth?: number; // radians (0 = east, increases CCW)
  sunElevation?: number; // radians above horizon
}

export function generateTerrain(opts: GenerateOptions): TerrainData {
  const size = opts.size ?? 320;
  const worldExtent = opts.worldExtent ?? 4000; // 4 km square
  const cellSize = worldExtent / size;
  const craterCount = opts.craterCount ?? 220;
  const sunAzimuth = opts.sunAzimuth ?? (-Math.PI / 4); // sun in NW
  const sunElevation = opts.sunElevation ?? (Math.PI / 5); // ~36 degrees above horizon

  const noise = makeValueNoise2D(opts.seed);
  const rng = mulberry32(opts.seed ^ 0x9e3779b9);

  const elevations = new Float32Array(size * size);

  // Base elevation: large-scale undulation + small-scale detail
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      // continental scale
      const cont = noise.fbm(nx * 3, ny * 3, 4, 2.0, 0.55) * 0.6;
      // medium detail
      const med = noise.fbm(nx * 10, ny * 10, 5, 2.1, 0.5) * 0.3;
      // fine regolith grain
      const fine = noise.fbm(nx * 40, ny * 40, 3, 2.0, 0.45) * 0.1;
      elevations[y * size + x] = (cont + med + fine) * 0.5;
    }
  }

  // Maria: large low-albedo (and slightly lower) basalt plains — additive depressions
  const mariaCount = randInt(rng, 3, 6);
  const craters: TerrainCrater[] = [];
  for (let i = 0; i < mariaCount; i++) {
    const cx = randRange(rng, 0.15, 0.85) * size;
    const cy = randRange(rng, 0.15, 0.85) * size;
    const r = randRange(rng, 0.18, 0.35) * size;
    stampDepression(elevations, size, cx, cy, r, 0.18, 0.5);
  }

  // Craters: rim + bowl + central peak
  for (let i = 0; i < craterCount; i++) {
    const cx = randRange(rng, -0.05, 1.05) * size;
    const cy = randRange(rng, -0.05, 1.05) * size;
    // Size distribution: many small, few large
    const sizeRoll = rng();
    let r: number;
    if (sizeRoll > 0.97) r = randRange(rng, 28, 48);
    else if (sizeRoll > 0.85) r = randRange(rng, 14, 28);
    else if (sizeRoll > 0.5) r = randRange(rng, 6, 14);
    else r = randRange(rng, 2, 6);
    const depth = r * randRange(rng, 0.16, 0.30);
    const rimHeight = r * randRange(rng, 0.05, 0.10);
    stampCrater(elevations, size, cx, cy, r, depth, rimHeight);
    // store visible crater for rendering aids (rims, ejecta rays)
    if (r > 6) {
      craters.push({ x: cx, y: cy, r, depth, rimHeight });
    }
  }

  // Small extra fine bumps for realism
  for (let i = 0; i < size * size * 0.005; i++) {
    const x = Math.floor(rng() * size);
    const y = Math.floor(rng() * size);
    elevations[y * size + x] += (rng() - 0.5) * 0.04;
  }

  // Normalize elevations to 0..1 range for stable hillshade
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < elevations.length; i++) {
    const v = elevations[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = Math.max(1e-6, max - min);
  for (let i = 0; i < elevations.length; i++) {
    elevations[i] = (elevations[i] - min) / range;
  }

  return {
    size,
    cellSize,
    elevations,
    craters,
    sunAzimuth,
    sunElevation,
  };
}

// Stamp a smooth bowl crater with raised rim
function stampCrater(
  elev: Float32Array,
  size: number,
  cx: number,
  cy: number,
  r: number,
  depth: number,
  rimHeight: number,
) {
  const rInt = Math.ceil(r * 1.5);
  const x0 = Math.max(0, Math.floor(cx - rInt));
  const x1 = Math.min(size - 1, Math.ceil(cx + rInt));
  const y0 = Math.max(0, Math.floor(cy - rInt));
  const y1 = Math.min(size - 1, Math.ceil(cy + rInt));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > r * 1.45) continue;
      const t = d / r;
      // Bowl: depressed floor inside, raised rim around t=1.0..1.4
      let delta = 0;
      if (t < 1.0) {
        // bowl: smooth depression, deepest at center, less near rim
        // Use a parabolic bowl with a slight central peak
        const bowl = -depth * (1 - t * t);
        // small central peak for larger craters
        const peak = r > 12 ? Math.max(0, 1 - (d / (r * 0.18)) ** 2) * depth * 0.18 : 0;
        delta = bowl + peak;
      } else if (t < 1.45) {
        // rim ring: bump up
        const u = (t - 1.0) / 0.45; // 0..1
        delta = rimHeight * Math.sin(Math.PI * u);
      }
      elev[y * size + x] += delta;
    }
  }
}

// Smooth large-scale depression (mare)
function stampDepression(
  elev: Float32Array,
  size: number,
  cx: number,
  cy: number,
  r: number,
  depth: number,
  falloff: number,
) {
  const rInt = Math.ceil(r * 1.2);
  const x0 = Math.max(0, Math.floor(cx - rInt));
  const x1 = Math.min(size - 1, Math.ceil(cx + rInt));
  const y0 = Math.max(0, Math.floor(cy - rInt));
  const y1 = Math.min(size - 1, Math.ceil(cy + rInt));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > r * 1.2) continue;
      const t = Math.min(1, d / r);
      // smooth falloff: high in center, fades to 0 at rim
      const u = 1 - t;
      const w = Math.pow(u, falloff);
      elev[y * size + x] -= depth * w;
    }
  }
}

// Sample elevation at world coordinates (clamped)
export function sampleElevation(terrain: TerrainData, worldX: number, worldY: number): number {
  const size = terrain.size;
  const halfWorld = (size * terrain.cellSize) / 2;
  // worldX/worldY are world coords centered at (0,0). Map to grid coords.
  const gx = (worldX + halfWorld) / terrain.cellSize;
  const gy = (worldY + halfWorld) / terrain.cellSize;
  const ix = Math.max(0, Math.min(size - 1, Math.floor(gx)));
  const iy = Math.max(0, Math.min(size - 1, Math.floor(gy)));
  return terrain.elevations[iy * size + ix];
}

// Slope at point (0..1, larger = steeper)
export function sampleSlope(terrain: TerrainData, worldX: number, worldY: number): number {
  const e = sampleElevation;
  const cs = terrain.cellSize * 4;
  const ex = e(terrain, worldX + cs, worldY) - e(terrain, worldX - cs, worldY);
  const ey = e(terrain, worldX, worldY + cs) - e(terrain, worldX, worldY - cs);
  return Math.sqrt(ex * ex + ey * ey);
}
