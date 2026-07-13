// ============================================================================
// GameCanvas — isometric (RA2-style) single-canvas renderer with rAF loop
// Terrain drawn as diamond via canvas transform. Buildings depth-sorted.
// ============================================================================

import { useEffect, useMemo, useRef } from "react";
import { useGameStore, WORLD_EXTENT } from "@/store/gameStore";
import { clampZoom, screenToWorld, snap, GRID_SIZE, type Camera } from "@/utils/geometry";
import { renderTerrainImage, paintTerrainCanvas } from "@/terrain/hillshade";
import { MODULE_CATALOG, moduleColor } from "@/buildings/catalog";
import {
  getBuildingCanvas,
  getSpriteDims,
  prerasterizeAllBuildings,
  computeCorridorNeighborsMap,
} from "@/buildings/rasterize";
import type { CorridorNeighbors } from "@/buildings/glyphs";
import type { BuildingInstance } from "@/sim/types";

export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 0.18 });
  const viewportRef = useRef({ w: 800, h: 600 });
  const cursorWorldRef = useRef<{ x: number; y: number } | null>(null);
  const dragState = useRef({ active: false, lastX: 0, lastY: 0, moved: false });
  const pinchState = useRef({ active: false, dist: 0, zoom: 0 });

  // Sync camera ref from store
  const storeCamera = useGameStore((s) => s.camera);
  useEffect(() => {
    cameraRef.current = storeCamera;
  }, [storeCamera]);

  // Terrain offscreen canvas
  const terrainCanvas = useMemo(() => {
    if (typeof document === "undefined") return null;
    return document.createElement("canvas");
  }, []);
  const terrain = useGameStore((s) => s.terrain);

  useEffect(() => {
    if (!terrain || !terrainCanvas) return;
    const pixels = renderTerrainImage(terrain);
    paintTerrainCanvas(terrainCanvas, terrain, pixels);
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

  // === Iso helpers ===
  function w2sX(wx: number, wy: number, cam: Camera, vw: number): number {
    return (wx - cam.x - (wy - cam.y)) * cam.zoom + vw / 2;
  }
  function w2sY(wx: number, wy: number, cam: Camera, vh: number): number {
    return ((wx - cam.x) + (wy - cam.y)) * cam.zoom * 0.5 + vh / 2;
  }

  function render() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const state = useGameStore.getState();
    const cam = cameraRef.current;
    const vp = viewportRef.current;

    if (canvas.width !== vp.w || canvas.height !== vp.h) {
      canvas.width = vp.w;
      canvas.height = vp.h;
    }
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    // 1. Background
    ctx.fillStyle = "#08090c";
    ctx.fillRect(0, 0, vp.w, vp.h);

    if (!state.terrain || !terrainCanvas) return;

    const half = WORLD_EXTENT / 2;

    // 2. Blit terrain as iso diamond using canvas transform
    // Iso transform: world (x,y) → screen (sx, sy)
    //   sx = (x - y) * zoom + vw/2 - (cam.x - cam.y) * zoom
    //   sy = (x + y) * zoom * 0.5 + vh/2 - (cam.x + cam.y) * zoom * 0.5
    // Matrix: [zoom, zoom*0.5, -zoom, zoom*0.5, e, f]
    ctx.save();
    ctx.setTransform(
      cam.zoom,           // a
      cam.zoom * 0.5,     // b
      -cam.zoom,          // c
      cam.zoom * 0.5,     // d
      vp.w / 2 - (cam.x - cam.y) * cam.zoom,          // e
      vp.h / 2 - (cam.x + cam.y) * cam.zoom * 0.5,    // f
    );
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(terrainCanvas, -half, -half, WORLD_EXTENT, WORLD_EXTENT);
    ctx.restore();

    // Reset transform to identity for screen-space drawing
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // 3. World bounds frame (iso diamond)
    ctx.strokeStyle = "rgba(255, 180, 84, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    // Diamond corners: (-half,-half), (half,-half), (half,half), (-half,half)
    ctx.moveTo(w2sX(-half, -half, cam, vp.w), w2sY(-half, -half, cam, vp.h));
    ctx.lineTo(w2sX(half, -half, cam, vp.w), w2sY(half, -half, cam, vp.h));
    ctx.lineTo(w2sX(half, half, cam, vp.w), w2sY(half, half, cam, vp.h));
    ctx.lineTo(w2sX(-half, half, cam, vp.w), w2sY(-half, half, cam, vp.h));
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Grid (iso diamond grid)
    if (cam.zoom > 0.08) {
      ctx.strokeStyle = state.placement ? "rgba(255,180,84,0.15)" : "rgba(255,180,84,0.05)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      const step = GRID_SIZE;
      // Lines along world X axis (varying Y)
      for (let y = -half; y <= half; y += step) {
        ctx.moveTo(w2sX(-half, y, cam, vp.w), w2sY(-half, y, cam, vp.h));
        ctx.lineTo(w2sX(half, y, cam, vp.w), w2sY(half, y, cam, vp.h));
      }
      // Lines along world Y axis (varying X)
      for (let x = -half; x <= half; x += step) {
        ctx.moveTo(w2sX(x, -half, cam, vp.w), w2sY(x, -half, cam, vp.h));
        ctx.lineTo(w2sX(x, half, cam, vp.w), w2sY(x, half, cam, vp.h));
      }
      ctx.stroke();
    }

    // 5. Buildings — depth-sorted (painter's algorithm: back to front)
    const buildings = state.buildings;
    const selectedId = state.selectedBuildingId;
    const simTime = state.simTime;

    const corridorNeighbors = computeCorridorNeighborsMap(buildings);

    // Sort by (x + y) ascending — lower sum = farther back = drawn first
    const sorted = [...buildings].sort((a, b) => {
      const da = a.x + a.y + (a.typeId === "corridor" ? -50 : 0);
      const db = b.x + b.y + (b.typeId === "corridor" ? -50 : 0);
      return da - db;
    });

    for (const b of sorted) {
      const def = MODULE_CATALOG[b.typeId];
      if (!def) continue;

      const bsx = w2sX(b.x, b.y, cam, vp.w);
      const bsy = w2sY(b.x, b.y, cam, vp.h);

      // Cull if off-screen
      const dims = getSpriteDims(b.typeId);
      const drawW = dims.canvasW * cam.zoom;
      const drawH = dims.canvasH * cam.zoom;
      if (bsx + drawW < 0 || bsx - drawW > vp.w || bsy + drawH < 0 || bsy - drawH > vp.h) continue;

      const hw = def.size.w * cam.zoom;
      const hh = def.size.w * 0.5 * cam.zoom;

      const neighbors = b.typeId === "corridor" ? corridorNeighbors.get(b.id) : undefined;
      const bc = getBuildingCanvas(b.typeId, neighbors);
      if (!bc) continue;

      // Draw building sprite: base center aligned to building's iso screen position
      const drawX = bsx - dims.baseCenterX * cam.zoom;
      const drawY = bsy - dims.baseCenterY * cam.zoom;

      ctx.save();
      ctx.globalAlpha = b.status === "construction" ? 0.45 : 1;
      ctx.drawImage(bc, drawX, drawY, drawW, drawH);
      ctx.restore();

      // Selection ring (iso diamond)
      if (b.id === selectedId) {
        const pulse = 1 + Math.sin(simTime * 2) * 0.05;
        ctx.strokeStyle = moduleColor(b.typeId);
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(bsx, bsy - hh * pulse);
        ctx.lineTo(bsx + hw * pulse, bsy);
        ctx.lineTo(bsx, bsy + hh * pulse);
        ctx.lineTo(bsx - hw * pulse, bsy);
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Construction progress bar
      if (b.status === "construction") {
        const pbx = bsx - 20 * cam.zoom;
        const pby = bsy + def.size.w * 0.5 * cam.zoom + 8;
        ctx.fillStyle = "rgba(255,180,84,0.18)";
        ctx.fillRect(pbx, pby, 40 * cam.zoom, 3);
        ctx.fillStyle = moduleColor(b.typeId);
        ctx.fillRect(pbx, pby, 40 * cam.zoom * b.constructionProgress, 3);
      }

      // Level pips
      if (def.maxLevel != null && def.maxLevel > 1 && b.level > 0 && cam.zoom > 0.15) {
        const pipSize = Math.max(2, 3 * cam.zoom);
        for (let i = 0; i < def.maxLevel; i++) {
          ctx.fillStyle = i < b.level ? moduleColor(b.typeId) : "rgba(255,255,255,0.15)";
          ctx.fillRect(
            bsx + hw - 2 - i * (pipSize + 1),
            bsy - hh - pipSize - 2,
            pipSize, pipSize,
          );
        }
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
          const py = rail.y;
          const sxp = w2sX(px, py, cam, vp.w);
          const syp = w2sY(px, py, cam, vp.h);

          // Streak (along iso east direction)
          ctx.strokeStyle = "rgba(255,180,84,0.5)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(sxp - 20 * cam.zoom, syp - 10 * cam.zoom);
          ctx.lineTo(sxp, syp);
          ctx.stroke();

          // Payload glow
          const payloadColor = job.payload === "mars_ship" ? "#e056a8" : "#ffb454";
          ctx.fillStyle = payloadColor;
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.arc(sxp, syp, 4 * cam.zoom, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.3;
          ctx.beginPath();
          ctx.arc(sxp, syp, 8 * cam.zoom, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
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

        const gsx = w2sX(gx, gy, cam, vp.w);
        const gsy = w2sY(gx, gy, cam, vp.h);

        // Diamond footprint outline
        const hw = def.size.w * cam.zoom;
        const hh = def.size.w * 0.5 * cam.zoom;

        // Fill diamond
        ctx.fillStyle = ok ? "rgba(123,226,168,0.15)" : "rgba(224,86,168,0.15)";
        ctx.beginPath();
        ctx.moveTo(gsx, gsy - hh);
        ctx.lineTo(gsx + hw, gsy);
        ctx.lineTo(gsx, gsy + hh);
        ctx.lineTo(gsx - hw, gsy);
        ctx.closePath();
        ctx.fill();

        // Outline
        ctx.strokeStyle = ok ? "#7be2a8" : "#e056a8";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Ghost building sprite
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

        const ghostCanvas = getBuildingCanvas(def.id, ghostNeighbors);
        if (ghostCanvas) {
          const gd = getSpriteDims(def.id);
          const drawX = gsx - gd.baseCenterX * cam.zoom;
          const drawY = gsy - gd.baseCenterY * cam.zoom;
          ctx.globalAlpha = 0.5;
          ctx.drawImage(ghostCanvas, drawX, drawY, gd.canvasW * cam.zoom, gd.canvasH * cam.zoom);
          ctx.globalAlpha = 1;
        }

        // Reason text
        if (preview.reason) {
          ctx.fillStyle = "#e056a8";
          ctx.font = "10px IBM Plex Mono, monospace";
          ctx.textAlign = "center";
          ctx.fillText(preview.reason, gsx, gsy + hh + 14);
        }
      }
    }
  }

  // === Pan / Zoom (iso-aware) ===
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

      // Iso pan: grab-and-pull (drag right → map moves right, like RA2).
      // Negate the screen-to-world delta so the world follows the cursor.
      const z = cameraRef.current.zoom;
      cameraRef.current = {
        ...cameraRef.current,
        x: cameraRef.current.x - (dx + 2 * dy) / (2 * z),
        y: cameraRef.current.y - (2 * dy - dx) / (2 * z),
      };
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const wasMoved = dragState.current.moved;
    dragState.current.active = false;
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
    const worldAfter = screenToWorld(localX, localY, { ...cam, zoom: newZoom }, vp.w, vp.h);
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
      style={{ cursor: useGameStore.getState().placement ? "crosshair" : "grab" }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <CameraReadout cameraRef={cameraRef} cursorWorldRef={cursorWorldRef} />
    </div>
  );
}

function findBuildingAt(wx: number, wy: number, buildings: BuildingInstance[]): BuildingInstance | null {
  for (let i = buildings.length - 1; i >= 0; i--) {
    const b = buildings[i];
    const def = MODULE_CATALOG[b.typeId];
    if (!def) continue;
    const halfW = def.size.w / 2 + 4;
    const halfH = def.size.h / 2 + 4;
    if (wx >= b.x - halfW && wx <= b.x + halfW && wy >= b.y - halfH && wy <= b.y + halfH) {
      return b;
    }
  }
  return null;
}

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
        ref.current.textContent = `ZOOM ×${cam.zoom.toFixed(2)}  CAM ${cam.x.toFixed(0)},${cam.y.toFixed(0)}${
          cur ? `  CUR ${cur.x.toFixed(0)},${cur.y.toFixed(0)}` : ""
        }`;
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [cameraRef, cursorWorldRef]);
  return <div ref={ref} className="absolute bottom-2 right-3 text-[10px] font-mono text-cream/40 pointer-events-none" />;
}
