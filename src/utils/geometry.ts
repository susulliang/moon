// ============================================================================
// Geometry helpers — isometric (RA2-style 2:1) world/screen transforms
// ============================================================================

export interface Camera {
  x: number;       // world position at viewport center
  y: number;
  zoom: number;    // world-to-screen scale
}

export const MIN_ZOOM = 0.08;
export const MAX_ZOOM = 3;

/** Grid cell size in world units. Buildings + corridors snap to this grid. */
export const GRID_SIZE = 40;

export function clampZoom(z: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
}

// === Isometric projection (2:1 diamond ratio) ===
// worldX, worldY → screenX, screenY
//   sx = (wx - wy) * zoom
//   sy = (wx + wy) * zoom * 0.5

export function worldToScreen(
  wx: number,
  wy: number,
  cam: Camera,
  vw: number,
  vh: number,
): { x: number; y: number } {
  const dx = wx - cam.x;
  const dy = wy - cam.y;
  return {
    x: (dx - dy) * cam.zoom + vw / 2,
    y: (dx + dy) * cam.zoom * 0.5 + vh / 2,
  };
}

export function screenToWorld(
  sx: number,
  sy: number,
  cam: Camera,
  vw: number,
  vh: number,
): { x: number; y: number } {
  const dx = sx - vw / 2;
  const dy = sy - vh / 2;
  return {
    x: (dx + 2 * dy) / (2 * cam.zoom) + cam.x,
    y: (2 * dy - dx) / (2 * cam.zoom) + cam.y,
  };
}

// Snap a world coordinate to a grid of cell size `g`
export function snap(v: number, g: number): number {
  return Math.round(v / g) * g;
}

// Distance helper
export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}
