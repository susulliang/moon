// ============================================================================
// Hillshade renderer — produces a realistic sun-lit lunar relief canvas
// ============================================================================

import type { TerrainData } from "@/sim/types";

/**
 * Render the terrain's elevations into an ImageData of shaded pixels.
 * Combines:
 *  - Lambertian hillshade from a sun direction vector
 *  - Soft ambient occlusion in deep craters (extra darkening)
 *  - Albedo modulation (maria = darker basalt plains, highlands = brighter)
 *  - Sun-facing rim highlights (warm cream tint) and shadowed sides (cool blue)
 * Output: rgba bytes in an Uint8ClampedArray of length size*size*4.
 */
export function renderTerrainImage(terrain: TerrainData): Uint8ClampedArray {
  const { size, elevations, sunAzimuth, sunElevation } = terrain;
  const out = new Uint8ClampedArray(size * size * 4);

  // Sun direction in world/grid space.
  // Grid: +x = right, +y = down. We treat azimuth as 0=east (+x), CCW positive.
  const cosA = Math.cos(sunAzimuth);
  const sinA = Math.sin(sunAzimuth);
  const cosE = Math.cos(sunElevation);
  const sinE = Math.sin(sunElevation);
  // Sun unit vector (points from surface TO sun).
  // In grid space with +y=down, we negate sinA so "north" is up.
  const sx = cosA * cosE;
  const sy = -sinA * cosE;
  const sz = sinE;

  // Vertical exaggeration factor — bigger = more dramatic relief.
  const zScale = 6.0;
  // Slope computation kernel spacing (cells)
  const k = 1;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const e = elevations[i];

      const eL = elevations[y * size + Math.max(0, x - k)];
      const eR = elevations[y * size + Math.min(size - 1, x + k)];
      const eU = elevations[Math.max(0, y - k) * size + x];
      const eD = elevations[Math.min(size - 1, y + k) * size + x];

      // Surface normal (in grid space, +z = up). dx points +x, dy points +y(down).
      // Use central differences.
      const dzdx = (eR - eL) * zScale;
      const dzdy = (eD - eU) * zScale;
      // Normal = (-dzdx, -dzdy, 1) normalized. (Because +y is down, the slope along +y
      // means the surface dips downward as y increases; the normal component along +y
      // is -dzdy. But we want a normal whose dot with the sun vector gives correct
      // lighting for the visible "down-is-south" perspective. Empirically the sign
      // below works well visually.)
      const nx = -dzdx;
      const ny = -dzdy;
      const nz = 1.0;
      const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
      const nxN = nx / nLen;
      const nyN = ny / nLen;
      const nzN = nz / nLen;

      // Lambertian: dot(normal, sun)
      let lambert = nxN * sx + nyN * sy + nzN * sz;
      // clamp to [0,1]
      if (lambert < 0) lambert = 0;
      // Soft ambient + lambert
      const ambient = 0.18;
      let shade = ambient + (1 - ambient) * lambert;

      // Local slope for crater shadow effects
      const slope = Math.sqrt(dzdx * dzdx + dzdy * dzdy);

      // Albedo: lower elevations = mare (darker basalt), higher = highland (brighter)
      // Combine with subtle noise from elevation derivative for regolith grain
      const albedoBase = 0.55 + 0.45 * e;

      // Sun-facing slope tint: warm cream highlight
      // The "warmth" rises with how directly the slope faces the sun (high lambert).
      const warm = Math.min(1, lambert * 1.4);
      // Shadowed-slope tint: cool blue
      const cool = Math.min(1, (1 - lambert) * slope * 0.9);

      // Base regolith color (cool grey)
      let r = 132, g = 130, b = 124;
      // Apply albedo
      r *= albedoBase; g *= albedoBase; b *= albedoBase;
      // Apply shade
      r *= shade; g *= shade; b *= shade;
      // Warm highlight (sun-facing) — push toward cream
      r += warm * 95;
      g += warm * 80;
      b += warm * 50;
      // Cool shadow tint — push toward blue
      r -= cool * 35;
      g -= cool * 18;
      b += cool * 5;

      // Extra deep-crater darkening: if elevation very low AND slope moderate, occlude
      if (e < 0.18 && slope < 0.5) {
        const occ = (0.18 - e) / 0.18;
        const occW = Math.min(1, occ * 0.9);
        r *= (1 - 0.35 * occW);
        g *= (1 - 0.4 * occW);
        b *= (1 - 0.45 * occW);
      }

      // Subtle contrast curve
      const contrast = 1.08;
      r = (r - 128) * contrast + 128;
      g = (g - 128) * contrast + 128;
      b = (b - 128) * contrast + 128;

      // Clamp
      out[i * 4 + 0] = clampByte(r);
      out[i * 4 + 1] = clampByte(g);
      out[i * 4 + 2] = clampByte(b);
      out[i * 4 + 3] = 255;
    }
  }

  return out;
}

function clampByte(v: number): number {
  if (v < 0) return 0;
  if (v > 255) return 255;
  return v | 0;
}

/**
 * Paint the rendered terrain image into the given canvas at full grid resolution.
 * The caller can then use Canvas2D transforms to draw a viewport slice.
 */
export function paintTerrainCanvas(
  canvas: HTMLCanvasElement,
  terrain: TerrainData,
  pixels: Uint8ClampedArray,
) {
  const { size } = terrain;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.createImageData(size, size);
  imageData.data.set(pixels);
  ctx.putImageData(imageData, 0, 0);

  // Add subtle vignette overlay via gradient for atmospheric depth
  const grad = ctx.createRadialGradient(
    size / 2, size / 2, size * 0.3,
    size / 2, size / 2, size * 0.75,
  );
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
}
