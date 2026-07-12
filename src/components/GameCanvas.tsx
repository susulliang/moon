// ============================================================================
// GameCanvas — the main viewport: terrain blit + SVG building overlay
// Handles pan / zoom / pinch + click-to-place / click-to-select
// ============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { useGameStore, WORLD_EXTENT } from "@/store/gameStore";
import { clampZoom, screenToWorld, snap, type Camera } from "@/utils/geometry";
import { renderTerrainImage, paintTerrainCanvas } from "@/terrain/hillshade";
import { MODULE_CATALOG, moduleColor } from "@/buildings/catalog";
import { renderBuildingGlyph } from "@/buildings/glyphs";
import { BuildingLayer } from "./BuildingLayer";
import { RailLaunchLayer } from "./RailLaunchLayer";

export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const terrainCanvasRef = useRef<HTMLCanvasElement>(null);
  const [viewport, setViewport] = useState({ w: 800, h: 600 });
  const [cursorWorld, setCursorWorld] = useState<{ x: number; y: number } | null>(null);

  const terrain = useGameStore((s) => s.terrain);
  const camera = useGameStore((s) => s.camera);
  const setCamera = useGameStore((s) => s.setCamera);
  const placement = useGameStore((s) => s.placement);
  const commitPlacement = useGameStore((s) => s.commitPlacement);
  const canPlacePreview = useGameStore((s) => s.canPlacePreview);
  const selectBuilding = useGameStore((s) => s.selectBuilding);
  const startPlacement = useGameStore((s) => s.startPlacement);
  const buildings = useGameStore((s) => s.buildings);

  // === Render terrain to offscreen canvas once on terrain change ===
  const terrainCanvas = useMemo(() => {
    if (typeof document === "undefined") return null;
    return document.createElement("canvas");
  }, []);
  useEffect(() => {
    if (!terrain || !terrainCanvas) return;
    const pixels = renderTerrainImage(terrain);
    paintTerrainCanvas(terrainCanvas, terrain, pixels);
  }, [terrain, terrainCanvas]);

  // === Resize observer ===
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setViewport({ w: Math.floor(r.width), h: Math.floor(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // === Blit terrain into visible canvas each frame (camera change or viewport change) ===
  useEffect(() => {
    if (!terrain || !terrainCanvasRef.current || !terrainCanvas) return;
    const ctx = terrainCanvasRef.current.getContext("2d")!;
    const vw = viewport.w;
    const vh = viewport.h;
    terrainCanvasRef.current.width = vw;
    terrainCanvasRef.current.height = vh;

    ctx.clearRect(0, 0, vw, vh);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Draw terrain slice: map world rect to terrain canvas rect.
    // World extends from -WORLD_EXTENT/2 .. +WORLD_EXTENT/2 → 0..terrain.size
    const half = WORLD_EXTENT / 2;
    const worldLeft = camera.x - vw / 2 / camera.zoom;
    const worldTop = camera.y - vh / 2 / camera.zoom;
    const worldRight = camera.x + vw / 2 / camera.zoom;
    const worldBottom = camera.y + vh / 2 / camera.zoom;

    // terrain image: pixel (0,0) at world (-half,-half); pixel (size,size) at world (+half,+half)
    const size = terrain.size;
    const sx = ((worldLeft + half) / WORLD_EXTENT) * size;
    const sy = ((worldTop + half) / WORLD_EXTENT) * size;
    const sWidth = ((worldRight - worldLeft) / WORLD_EXTENT) * size;
    const sHeight = ((worldBottom - worldTop) / WORLD_EXTENT) * size;

    // background fill (in case terrain doesn't cover)
    ctx.fillStyle = "#0a0b0e";
    ctx.fillRect(0, 0, vw, vh);

    ctx.drawImage(
      terrainCanvas,
      sx, sy, sWidth, sHeight,
      0, 0, vw, vh,
    );

    // World bounds frame
    const worldToScreenX = (wx: number) => (wx - camera.x) * camera.zoom + vw / 2;
    const worldToScreenY = (wy: number) => (wy - camera.y) * camera.zoom + vh / 2;
    const bx0 = worldToScreenX(-half);
    const by0 = worldToScreenY(-half);
    const bx1 = worldToScreenX(half);
    const by1 = worldToScreenY(half);
    ctx.strokeStyle = "rgba(255, 180, 84, 0.25)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.strokeRect(bx0, by0, bx1 - bx0, by1 - by0);
    ctx.setLineDash([]);

    // Subtle grid overlay (only when zoomed in enough)
    if (camera.zoom > 0.4) {
      ctx.strokeStyle = "rgba(255, 180, 84, 0.06)";
      ctx.lineWidth = 0.5;
      const gridStep = 100; // world units
      const startX = Math.ceil(worldLeft / gridStep) * gridStep;
      const startY = Math.ceil(worldTop / gridStep) * gridStep;
      for (let x = startX; x <= worldRight; x += gridStep) {
        const sxg = worldToScreenX(x);
        ctx.beginPath();
        ctx.moveTo(sxg, 0);
        ctx.lineTo(sxg, vh);
        ctx.stroke();
      }
      for (let y = startY; y <= worldBottom; y += gridStep) {
        const syg = worldToScreenY(y);
        ctx.beginPath();
        ctx.moveTo(0, syg);
        ctx.lineTo(vw, syg);
        ctx.stroke();
      }
    }
  }, [terrain, terrainCanvas, camera, viewport]);

  // === Pan / Zoom interactions ===
  const dragState = useRef<{
    active: boolean;
    lastX: number;
    lastY: number;
    moved: boolean;
  }>({ active: false, lastX: 0, lastY: 0, moved: false });
  const pinchState = useRef<{
    active: boolean;
    dist: number;
    midX: number;
    midY: number;
    zoom: number;
  }>({ active: false, dist: 0, midX: 0, midY: 0, zoom: 0 });

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "touch" && e.isPrimary === false) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragState.current = {
      active: true,
      lastX: e.clientX,
      lastY: e.clientY,
      moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const world = screenToWorld(localX, localY, camera, viewport.w, viewport.h);
    setCursorWorld(world);

    if (dragState.current.active) {
      const dx = e.clientX - dragState.current.lastX;
      const dy = e.clientY - dragState.current.lastY;
      if (Math.abs(dx) + Math.abs(dy) > 3) dragState.current.moved = true;
      dragState.current.lastX = e.clientX;
      dragState.current.lastY = e.clientY;
      // pan: move camera opposite of drag, scaled by 1/zoom
      setCamera({
        x: camera.x - dx / camera.zoom,
        y: camera.y - dy / camera.zoom,
      });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const wasMoved = dragState.current.moved;
    dragState.current.active = false;

    if (wasMoved) return; // was a pan, not a click

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const world = screenToWorld(localX, localY, camera, viewport.w, viewport.h);

    if (placement) {
      const def = MODULE_CATALOG[placement.typeId];
      const sx = snap(world.x, def.size.w / 2);
      const sy = snap(world.y, def.size.h / 2);
      const res = commitPlacement(sx, sy);
      if (!res.ok && res.reason) {
        // visual feedback via selectedBuilding null + brief flash handled elsewhere
        // for simplicity, restart placement of same type
        startPlacement(placement.typeId);
      }
    } else {
      // hit-test buildings
      const hit = findBuildingAt(world.x, world.y, buildings);
      selectBuilding(hit ? hit.id : null);
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const worldBefore = screenToWorld(localX, localY, camera, viewport.w, viewport.h);
    const factor = Math.exp(-e.deltaY * 0.0014);
    const newZoom = clampZoom(camera.zoom * factor);
    // adjust camera so the world point under cursor stays put
    const worldAfter = {
      x: (localX - viewport.w / 2) / newZoom + camera.x,
      y: (localY - viewport.h / 2) / newZoom + camera.y,
    };
    void worldAfter;
    setCamera({
      zoom: newZoom,
      x: camera.x + (worldBefore.x - ((localX - viewport.w / 2) / newZoom + camera.x)),
      y: camera.y + (worldBefore.y - ((localY - viewport.h / 2) / newZoom + camera.y)),
    });
  };

  // Touch pinch
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dx = t1.clientX - t0.clientX;
      const dy = t1.clientY - t0.clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      pinchState.current = {
        active: true,
        dist,
        midX: (t0.clientX + t1.clientX) / 2,
        midY: (t0.clientY + t1.clientY) / 2,
        zoom: camera.zoom,
      };
      dragState.current.active = false;
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (pinchState.current.active && e.touches.length === 2) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dx = t1.clientX - t0.clientX;
      const dy = t1.clientY - t0.clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const factor = dist / pinchState.current.dist;
      const newZoom = clampZoom(pinchState.current.zoom * factor);
      setCamera({ zoom: newZoom });
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchState.current.active = false;
  };

  // === Placement preview position (snapped) ===
  const ghostBuilding = useMemo(() => {
    if (!placement || !cursorWorld) return null;
    const def = MODULE_CATALOG[placement.typeId];
    const sx = snap(cursorWorld.x, def.size.w / 2);
    const sy = snap(cursorWorld.y, def.size.h / 2);
    const preview = canPlacePreview(sx, sy);
    return { x: sx, y: sy, def, ok: preview.ok, reason: preview.reason };
  }, [placement, cursorWorld, canPlacePreview]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden bg-graphite no-select touch-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ cursor: placement ? "crosshair" : dragState.current.active ? "grabbing" : "grab" }}
    >
      <canvas ref={terrainCanvasRef} className="absolute inset-0 w-full h-full" />

      {/* SVG overlay for buildings + selection + ghost */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox={`0 0 ${viewport.w} ${viewport.h}`}
      >
        <defs>
          <filter id="building-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.55" />
          </filter>
          <filter id="glow-amber" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="placement-ok" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(123, 226, 168, 0.25)" />
            <stop offset="100%" stopColor="rgba(123, 226, 168, 0)" />
          </radialGradient>
          <radialGradient id="placement-bad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(224, 86, 168, 0.3)" />
            <stop offset="100%" stopColor="rgba(224, 86, 168, 0)" />
          </radialGradient>
        </defs>

        <BuildingLayer camera={camera} viewport={viewport} />
        <RailLaunchLayer camera={camera} viewport={viewport} />

        {/* Placement ghost */}
        {ghostBuilding && (() => {
          const sx = (ghostBuilding.x - camera.x) * camera.zoom + viewport.w / 2;
          const sy = (ghostBuilding.y - camera.y) * camera.zoom + viewport.h / 2;
          const r = Math.max(ghostBuilding.def.size.w, ghostBuilding.def.size.h) * camera.zoom * 0.65;
          return (
            <g transform={`translate(${sx} ${sy})`}>
              <circle
                r={r}
                fill={ghostBuilding.ok ? "url(#placement-ok)" : "url(#placement-bad)"}
              />
              <g transform={`scale(${camera.zoom / 50})`}>
                {renderBuildingGlyph(ghostBuilding.def.id, {
                  color: ghostBuilding.ok ? moduleColor(ghostBuilding.def.category) : "#e056a8",
                  fillOpacity: 0.22,
                })}
              </g>
              <rect
                x={-ghostBuilding.def.size.w * camera.zoom / 2 - 4}
                y={-ghostBuilding.def.size.h * camera.zoom / 2 - 4}
                width={ghostBuilding.def.size.w * camera.zoom + 8}
                height={ghostBuilding.def.size.h * camera.zoom + 8}
                fill="none"
                stroke={ghostBuilding.ok ? "#ffb454" : "#e056a8"}
                strokeWidth="1.2"
                strokeDasharray="4 3"
                className="ghost-flicker"
              />
              {ghostBuilding.reason && (
                <text
                  y={ghostBuilding.def.size.h * camera.zoom / 2 + 14}
                  fill="#e056a8"
                  fontSize="10"
                  fontFamily="IBM Plex Mono, monospace"
                  textAnchor="middle"
                >
                  {ghostBuilding.reason}
                </text>
              )}
            </g>
          );
        })()}
      </svg>

      <CameraReadout camera={camera} cursorWorld={cursorWorld} />
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function findBuildingAt(wx: number, wy: number, buildings: any[]): any | null {
  // Iterate in reverse to prefer topmost
  for (let i = buildings.length - 1; i >= 0; i--) {
    const b = buildings[i];
    const def = MODULE_CATALOG[b.typeId as keyof typeof MODULE_CATALOG];
    if (!def) continue;
    const halfW = def.size.w / 2 + 4;
    const halfH = def.size.h / 2 + 4;
    if (
      wx >= b.x - halfW && wx <= b.x + halfW &&
      wy >= b.y - halfH && wy <= b.y + halfH
    ) {
      return b;
    }
  }
  return null;
}

function CameraReadout({ camera, cursorWorld }: { camera: Camera; cursorWorld: { x: number; y: number } | null }) {
  return (
    <div className="absolute bottom-2 right-3 text-[10px] font-mono text-cream/40 pointer-events-none">
      <div>ZOOM ×{camera.zoom.toFixed(2)}</div>
      <div>CAM {camera.x.toFixed(0)}, {camera.y.toFixed(0)}</div>
      {cursorWorld && (
        <div>CUR {cursorWorld.x.toFixed(0)}, {cursorWorld.y.toFixed(0)}</div>
      )}
    </div>
  );
}
