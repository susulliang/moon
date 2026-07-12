// ============================================================================
// GameCanvas — single-canvas renderer with rAF loop
// All rendering (terrain + grid + buildings + rail launch + ghost + selection)
// happens on ONE canvas via a requestAnimationFrame loop.
// Camera uses a ref (not React state) to avoid re-renders during pan/zoom.
// ============================================================================

import { useEffect, useMemo, useRef } from "react";
import { useGameStore, WORLD_EXTENT } from "@/store/gameStore";
import { clampZoom, screenToWorld, snap, GRID_SIZE, type Camera } from "@/utils/geometry";
import { renderTerrainImage, paintTerrainCanvas } from "@/terrain/hillshade";
import { MODULE_CATALOG, moduleColor } from "@/buildings/catalog";
import {
  getBuildingCanvas,
  prerasterizeAllBuildings,
  computeCorridorNeighborsMap,
} from "@/buildings/rasterize";
import type { CorridorNeighbors } from "@/buildings/glyphs";

export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // High-frequency state in refs (no React re-render)
  const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 0.7 });
  const viewportRef = useRef({ w: 800, h: 600 });
  const cursorWorldRef = useRef<{ x: number; y: number } | null>(null);
  const dragState = useRef({ active: false, lastX: 0, lastY: 0, moved: false });
  const pinchState = useRef({ active: false, dist: 0, zoom: 0 });

  // Sync camera ref from store (for programmatic changes: home button, keyboard)
  const storeCamera = useGameStore((s) => s.camera);
  useEffect(() => {
    cameraRef.current = storeCamera;
  }, [storeCamera]);

  // Terrain offscreen canvas (cached, rendered once)
  const terrainCanvas = useMemo(() => {
    if (typeof document === "undefined") return null;
    return document.createElement("canvas");
  }, []);
  const terrain = useGameStore((s) => s.terrain);

  // Render terrain image once on terrain change
  useEffect(() => {
    if (!terrain || !terrainCanvas) return;
    const pixels = renderTerrainImage(terrain);
    paintTerrainCanvas(terrainCanvas, terrain, pixels);
    // Pre-warm building cache
    prerasterizeAllBuildings();
  }, [terrain, terrainCanvas]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      viewportRef.current = { w: Math.floor(r.width), h: Math.floor(r.height) };
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // === Main rAF render loop ===
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      render();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  function render() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const state = useGameStore.getState();
    const camera = cameraRef.current;
    const vp = viewportRef.current;

    // Ensure canvas matches viewport
    if (canvas.width !== vp.w || canvas.height !== vp.h) {
      canvas.width = vp.w;
      canvas.height = vp.h;
    }
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    // 1. Background
    ctx.fillStyle = "#0a0b0e";
    ctx.fillRect(0, 0, vp.w, vp.h);

    if (!state.terrain || !terrainCanvas) return;

    const half = WORLD_EXTENT / 2;
    const worldLeft = camera.x - vp.w / 2 / camera.zoom;
    const worldTop = camera.y - vp.h / 2 / camera.zoom;
    const worldRight = camera.x + vp.w / 2 / camera.zoom;
    const worldBottom = camera.y + vp.h / 2 / camera.zoom;
    const size = state.terrain.size;

    // 2. Blit terrain slice
    const sx = ((worldLeft + half) / WORLD_EXTENT) * size;
    const sy = ((worldTop + half) / WORLD_EXTENT) * size;
    const sWidth = ((worldRight - worldLeft) / WORLD_EXTENT) * size;
    const sHeight = ((worldBottom - worldTop) / WORLD_EXTENT) * size;
    ctx.drawImage(terrainCanvas, sx, sy, sWidth, sHeight, 0, 0, vp.w, vp.h);

    // World→screen helpers
    const w2sX = (wx: number) => (wx - camera.x) * camera.zoom + vp.w / 2;
    const w2sY = (wy: number) => (wy - camera.y) * camera.zoom + vp.h / 2;

    // 3. World bounds frame
    ctx.strokeStyle = "rgba(255, 180, 84, 0.25)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.strokeRect(w2sX(-half), w2sY(-half), w2sX(half) - w2sX(-half), w2sY(half) - w2sY(-half));
    ctx.setLineDash([]);

    // 4. Grid (batched into single path)
    if (camera.zoom > 0.3) {
      ctx.strokeStyle = state.placement ? "rgba(255,180,84,0.18)" : "rgba(255,180,84,0.06)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      const step = GRID_SIZE;
      const startX = Math.ceil(worldLeft / step) * step;
      const startY = Math.ceil(worldTop / step) * step;
      for (let x = startX; x <= worldRight; x += step) {
        const px = w2sX(x);
        ctx.moveTo(px, 0);
        ctx.lineTo(px, vp.h);
      }
      for (let y = startY; y <= worldBottom; y += step) {
        const py = w2sY(y);
        ctx.moveTo(0, py);
        ctx.lineTo(vp.w, py);
      }
      ctx.stroke();
    }

    // 5. Buildings (rasterized, drawn via drawImage)
    const buildings = state.buildings;
    const selectedId = state.selectedBuildingId;
    const simTime = state.simTime;

    // Compute corridor neighbors
    const corridorNeighbors = computeCorridorNeighborsMap(buildings);

    // Cull + draw
    const margin = 200;
    const halfW = vp.w / 2 / camera.zoom + margin;
    const halfH = vp.h / 2 / camera.zoom + margin;

    for (const b of buildings) {
      const def = MODULE_CATALOG[b.typeId];
      if (!def) continue;
      const bm = Math.max(def.size.w, def.size.h);
      if (b.x < camera.x - halfW - bm || b.x > camera.x + halfW + bm ||
          b.y < camera.y - halfH - bm || b.y > camera.y + halfH + bm) continue;

      const neighbors = b.typeId === "corridor" ? corridorNeighbors.get(b.id) : undefined;
      const bc = getBuildingCanvas(b.typeId, neighbors);
      if (!bc) continue;

      const bsx = w2sX(b.x);
      const bsy = w2sY(b.y);
      // Building glyph canvas is 100x100 matching the viewBox.
      // The building's world size is def.size.w; scale glyph to match.
      const drawScale = (def.size.w / 50) * camera.zoom;
      const drawSize = 100 * drawScale;

      ctx.save();
      ctx.globalAlpha = b.status === "construction" ? 0.45 : 1;
      ctx.drawImage(bc, bsx - drawSize / 2, bsy - drawSize / 2, drawSize, drawSize);
      ctx.restore();

      // Selection ring
      if (b.id === selectedId) {
        const r = Math.max(def.size.w, def.size.h) * camera.zoom * 0.7;
        const pulse = 1 + Math.sin(simTime * 2) * 0.05;
        ctx.strokeStyle = moduleColor(b.typeId);
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(bsx, bsy, r * pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Construction scaffold + progress
      if (b.status === "construction") {
        ctx.strokeStyle = moduleColor(b.typeId);
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.globalAlpha = 0.7;
        ctx.strokeRect(
          bsx - def.size.w * camera.zoom / 2 - 4,
          bsy - def.size.h * camera.zoom / 2 - 4,
          def.size.w * camera.zoom + 8,
          def.size.h * camera.zoom + 8,
        );
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        const pbx = bsx - def.size.w * camera.zoom / 2;
        const pby = bsy + def.size.h * camera.zoom / 2 + 6;
        ctx.fillStyle = "rgba(255,180,84,0.18)";
        ctx.fillRect(pbx, pby, def.size.w * camera.zoom, 3);
        ctx.fillStyle = moduleColor(b.typeId);
        ctx.fillRect(pbx, pby, def.size.w * camera.zoom * b.constructionProgress, 3);
      }

      // Level pips
      if (def.maxLevel != null && def.maxLevel > 1 && b.level > 0) {
        for (let i = 0; i < def.maxLevel; i++) {
          ctx.fillStyle = i < b.level ? moduleColor(b.typeId) : "rgba(255,255,255,0.15)";
          ctx.fillRect(
            bsx + def.size.w * camera.zoom / 2 - 2 - i * 4 - 3,
            bsy - def.size.h * camera.zoom / 2 + 2,
            3, 3,
          );
        }
      }

      // Status indicator
      if (b.status !== "construction" && camera.zoom > 0.8) {
        const blink = 0.4 + Math.abs(Math.sin(simTime * 0.5 + b.x)) * 0.6;
        ctx.fillStyle = moduleColor(b.typeId);
        ctx.globalAlpha = blink;
        ctx.fillRect(bsx + def.size.w * camera.zoom / 2 - 4, bsy - def.size.h * camera.zoom / 2 + 2, 2, 2);
        ctx.globalAlpha = 1;
      }
    }

    // 6. Rail launch payload animation
    if (state.launchQueue.length > 0) {
      const rail = buildings.find((b) => b.typeId === "rail_launch" && b.status === "active");
      if (rail) {
        const def = MODULE_CATALOG.rail_launch;
        for (const job of state.launchQueue) {
          const travelExtent = 60;
          const px = rail.x - def.size.w / 2 + (def.size.w + travelExtent) * job.progress;
          const sxp = w2sX(px);
          const syp = w2sY(rail.y);

          // Streak
          ctx.strokeStyle = "rgba(255,180,84,0.6)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(sxp - 20 * camera.zoom, syp);
          ctx.lineTo(sxp, syp);
          ctx.stroke();

          // Payload glow
          const payloadColor = job.payload === "mars_ship" ? "#e056a8" : "#ffb454";
          ctx.fillStyle = payloadColor;
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.arc(sxp, syp, 4 * camera.zoom, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.3;
          ctx.beginPath();
          ctx.arc(sxp, syp, 8 * camera.zoom, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;

          // Progress label
          if (camera.zoom > 0.5) {
            ctx.fillStyle = "rgba(255,180,84,0.7)";
            ctx.font = "9px IBM Plex Mono, monospace";
            ctx.textAlign = "center";
            ctx.fillText(`${job.payload.toUpperCase()} ${(job.progress * 100).toFixed(0)}%`, sxp, syp - 14);
          }
        }
      }
    }

    // 7. Ghost preview (placement)
    if (state.placement && cursorWorldRef.current) {
      const def = MODULE_CATALOG[state.placement.typeId];
      if (def) {
        const gx = snap(cursorWorldRef.current.x, GRID_SIZE);
        const gy = snap(cursorWorldRef.current.y, GRID_SIZE);
        const preview = state.canPlacePreview(gx, gy);
        const ok = preview.ok;

        // Compute ghost corridor neighbors
        let ghostNeighbors: CorridorNeighbors | undefined;
        if (def.id === "corridor") {
          const check = (x: number, y: number) => {
            for (const b of buildings) {
              const bd = MODULE_CATALOG[b.typeId];
              if (!bd) continue;
              if (x >= b.x - bd.size.w / 2 && x <= b.x + bd.size.w / 2 &&
                  y >= b.y - bd.size.h / 2 && y <= b.y + bd.size.h / 2) return true;
            }
            return false;
          };
          ghostNeighbors = {
            n: check(gx, gy - GRID_SIZE),
            s: check(gx, gy + GRID_SIZE),
            e: check(gx + GRID_SIZE, gy),
            w: check(gx - GRID_SIZE, gy),
          };
        }

        const gsx = w2sX(gx);
        const gsy = w2sY(gy);

        // Glow circle
        const r = Math.max(def.size.w, def.size.h) * camera.zoom * 0.65;
        const grad = ctx.createRadialGradient(gsx, gsy, 0, gsx, gsy, r);
        if (ok) {
          grad.addColorStop(0, "rgba(123,226,168,0.25)");
          grad.addColorStop(1, "rgba(123,226,168,0)");
        } else {
          grad.addColorStop(0, "rgba(224,86,168,0.3)");
          grad.addColorStop(1, "rgba(224,86,168,0)");
        }
        ctx.fillStyle = grad;
        ctx.fillRect(gsx - r, gsy - r, r * 2, r * 2);

        // Ghost building
        const ghostCanvas = getBuildingCanvas(def.id, ghostNeighbors);
        if (ghostCanvas) {
          const drawScale = (def.size.w / 50) * camera.zoom;
          const drawSize = 100 * drawScale;
          ctx.globalAlpha = 0.5;
          ctx.drawImage(ghostCanvas, gsx - drawSize / 2, gsy - drawSize / 2, drawSize, drawSize);
          ctx.globalAlpha = 1;
        }

        // Dashed border
        ctx.strokeStyle = ok ? "#ffb454" : "#e056a8";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(
          gsx - def.size.w * camera.zoom / 2 - 4,
          gsy - def.size.h * camera.zoom / 2 - 4,
          def.size.w * camera.zoom + 8,
          def.size.h * camera.zoom + 8,
        );
        ctx.setLineDash([]);

        // Reason text
        if (preview.reason) {
          ctx.fillStyle = "#e056a8";
          ctx.font = "10px IBM Plex Mono, monospace";
          ctx.textAlign = "center";
          ctx.fillText(preview.reason, gsx, gsy + def.size.h * camera.zoom / 2 + 14);
        }
      }
    }
  }

  // === Pan / Zoom handlers (update refs directly, no React re-render) ===
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "touch" && e.isPrimary === false) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragState.current = { active: true, lastX: e.clientX, lastY: e.clientY, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const world = screenToWorld(localX, localY, cameraRef.current, viewportRef.current.w, viewportRef.current.h);
    cursorWorldRef.current = world;

    if (dragState.current.active) {
      const dx = e.clientX - dragState.current.lastX;
      const dy = e.clientY - dragState.current.lastY;
      if (Math.abs(dx) + Math.abs(dy) > 3) dragState.current.moved = true;
      dragState.current.lastX = e.clientX;
      dragState.current.lastY = e.clientY;
      cameraRef.current = {
        ...cameraRef.current,
        x: cameraRef.current.x - dx / cameraRef.current.zoom,
        y: cameraRef.current.y - dy / cameraRef.current.zoom,
      };
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const wasMoved = dragState.current.moved;
    dragState.current.active = false;

    // Sync camera to store (for save/keyboard)
    useGameStore.getState().setCamera(cameraRef.current);

    if (wasMoved) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const world = screenToWorld(localX, localY, cameraRef.current, viewportRef.current.w, viewportRef.current.h);
    const state = useGameStore.getState();

    if (state.placement) {
      const sx = snap(world.x, GRID_SIZE);
      const sy = snap(world.y, GRID_SIZE);
      const res = state.commitPlacement(sx, sy);
      if (!res.ok) {
        state.startPlacement(state.placement.typeId);
      }
    } else {
      const hit = findBuildingAt(world.x, world.y, state.buildings);
      state.selectBuilding(hit ? hit.id : null);
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const cam = cameraRef.current;
    const vp = viewportRef.current;
    const worldBefore = screenToWorld(localX, localY, cam, vp.w, vp.h);
    const factor = Math.exp(-e.deltaY * 0.0014);
    const newZoom = clampZoom(cam.zoom * factor);
    const worldAfter = {
      x: (localX - vp.w / 2) / newZoom + cam.x,
      y: (localY - vp.h / 2) / newZoom + cam.y,
    };
    cameraRef.current = {
      zoom: newZoom,
      x: cam.x + (worldBefore.x - worldAfter.x),
      y: cam.y + (worldBefore.y - worldAfter.y),
    };
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dx = t1.clientX - t0.clientX;
      const dy = t1.clientY - t0.clientY;
      pinchState.current = { active: true, dist: Math.sqrt(dx * dx + dy * dy), zoom: cameraRef.current.zoom };
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
      cameraRef.current = { ...cameraRef.current, zoom: clampZoom(pinchState.current.zoom * factor) };
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchState.current.active = false;
  };

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
      style={{ cursor: useGameStore.getState().placement ? "crosshair" : dragState.current.active ? "grabbing" : "grab" }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <CameraReadout cameraRef={cameraRef} cursorWorldRef={cursorWorldRef} />
    </div>
  );
}

function findBuildingAt(wx: number, wy: number, buildings: any[]): any | null {
  for (let i = buildings.length - 1; i >= 0; i--) {
    const b = buildings[i];
    const def = MODULE_CATALOG[b.typeId as keyof typeof MODULE_CATALOG];
    if (!def) continue;
    const halfW = def.size.w / 2 + 4;
    const halfH = def.size.h / 2 + 4;
    if (wx >= b.x - halfW && wx <= b.x + halfW && wy >= b.y - halfH && wy <= b.y + halfH) {
      return b;
    }
  }
  return null;
}

// Lightweight camera readout (updates via rAF, no React state)
function CameraReadout({
  cameraRef,
  cursorWorldRef,
}: {
  cameraRef: React.RefObject<Camera>;
  cursorWorldRef: React.RefObject<{ x: number; y: number } | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      if (ref.current) {
        const cam = cameraRef.current;
        const cur = cursorWorldRef.current;
        ref.current.innerHTML = `ZOOM ×${cam.zoom.toFixed(2)}<br/>CAM ${cam.x.toFixed(0)}, ${cam.y.toFixed(0)}${
          cur ? `<br/>CUR ${cur.x.toFixed(0)}, ${cur.y.toFixed(0)}` : ""
        }`;
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [cameraRef, cursorWorldRef]);
  return <div ref={ref} className="absolute bottom-2 right-3 text-[10px] font-mono text-cream/40 pointer-events-none" />;
}
