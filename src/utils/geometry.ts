// ============================================================================
// Geometry helpers — world/screen transforms, pan/zoom math
// ============================================================================

export interface Camera {
  x: number;       // world position at viewport center
  y: number;
  zoom: number;    // world-to-screen scale
}

export const MIN_ZOOM = 0.18;
export const MAX_ZOOM = 6;

export function clampZoom(z: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
}

// World → screen coordinates given a viewport size + camera
export function worldToScreen(
  wx: number,
  wy: number,
  cam: Camera,
  vw: number,
  vh: number,
): { x: number; y: number } {
  return {
    x: (wx - cam.x) * cam.zoom + vw / 2,
    y: (wy - cam.y) * cam.zoom + vh / 2,
  };
}

export function screenToWorld(
  sx: number,
  sy: number,
  cam: Camera,
  vw: number,
  vh: number,
): { x: number; y: number } {
  return {
    x: (sx - vw / 2) / cam.zoom + cam.x,
    y: (sy - vh / 2) / cam.zoom + cam.y,
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
