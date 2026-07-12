// ============================================================================
// Hillshade renderer — greyscale pixelated lunar relief (like a real moon shot)
// ============================================================================

import type { TerrainData } from "@/sim/types";

/**
 * Render the terrain's elevations into an ImageData of shaded pixels.
 * Pure greyscale (no warm/cool tints) + blocky pixelation for a retro
 * remote-sensing aesthetic.
 * Output: rgba bytes in an Uint8ClampedArray of length size*size*4.
 */
export function renderTerrainImage(terrain: TerrainData, pixelSize = 2): Uint8ClampedArray {
  const { size, elevations, sunAzimuth, sunElevation } = terrain;
  const out = new Uint8ClampedArray(size * size * 4);

  // Sun direction in grid space.
  const cosA = Math.cos(sunAzimuth);
  const sinA = Math.sin(sunAzimuth);
  const cosE = Math.cos(sunElevation);
  const sinE = Math.sin(sunElevation);
  const sx = cosA * cosE;
  const sy = -sinA * cosE;
  const sz = sinE;

  const zScale = 6.0;
  const k = 1;

  // Iterate in blocks for pixelated look
  for (let by = 0; by < size; by += pixelSize) {
    for (let bx = 0; bx < size; bx += pixelSize) {
      // Sample center of block
      const cx = Math.min(size - 1, bx + (pixelSize >> 1));
      const cy = Math.min(size - 1, by + (pixelSize >> 1));
      const i = cy * size + cx;
      const e = elevations[i];

      const eL = elevations[cy * size + Math.max(0, cx - k)];
      const eR = elevations[cy * size + Math.min(size - 1, cx + k)];
      const eU = elevations[Math.max(0, cy - k) * size + cx];
      const eD = elevations[Math.min(size - 1, cy + k) * size + cx];

      const dzdx = (eR - eL) * zScale;
      const dzdy = (eD - eU) * zScale;
      const nx = -dzdx;
      const ny = -dzdy;
      const nz = 1.0;
      const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
      const nxN = nx / nLen;
      const nyN = ny / nLen;
      const nzN = nz / nLen;

      // Lambertian: dot(normal, sun)
      let lambert = nxN * sx + nyN * sy + nzN * sz;
      if (lambert < 0) lambert = 0;
      const ambient = 0.16;
      let shade = ambient + (1 - ambient) * lambert;

      const slope = Math.sqrt(dzdx * dzdx + dzdy * dzdy);

      // Albedo: lower elevations = mare (darker basalt), higher = highland (brighter)
      const albedoBase = 0.50 + 0.50 * e;

      // Pure greyscale — like real moon surface
      let grey = 128 * albedoBase * shade;

      // Extra deep-crater darkening
      if (e < 0.18 && slope < 0.5) {
        const occ = (0.18 - e) / 0.18;
        const occW = Math.min(1, occ * 0.9);
        grey *= (1 - 0.4 * occW);
      }

      // Subtle brightening on sun-facing slopes (still grey, just brighter)
      const highlight = Math.min(1, lambert * 1.3);
      grey += highlight * 35;

      // Contrast curve
      grey = (grey - 128) * 1.1 + 128;

      grey = clampByte(grey);

      // Fill entire block with this value
      for (let dy = 0; dy < pixelSize && by + dy < size; dy++) {
        for (let dx = 0; dx < pixelSize && bx + dx < size; dx++) {
          const oi = ((by + dy) * size + (bx + dx)) * 4;
          out[oi] = grey;
          out[oi + 1] = grey;
          out[oi + 2] = grey;
          out[oi + 3] = 255;
        }
      }
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

  // Subtle vignette for depth
  const grad = ctx.createRadialGradient(
    size / 2, size / 2, size * 0.3,
    size / 2, size / 2, size * 0.75,
  );
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.4)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
}
