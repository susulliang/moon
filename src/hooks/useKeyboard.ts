// ============================================================================
// Keyboard hotkeys
// ============================================================================

import { useEffect } from "react";
import { useGameStore } from "@/store/gameStore";
import { clampZoom, MAX_ZOOM, MIN_ZOOM } from "@/utils/geometry";

export function useKeyboard() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // ignore when typing in input
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

      const store = useGameStore.getState();

      switch (e.key) {
        case " ":
          e.preventDefault();
          store.togglePause();
          break;
        case "1":
          store.setSpeed(1);
          break;
        case "2":
          store.setSpeed(2);
          break;
        case "3":
          store.setSpeed(4);
          break;
        case "0":
          store.setSpeed(0);
          break;
        case "Escape":
          if (store.placement) store.cancelPlacement();
          else store.selectBuilding(null);
          break;
        case "+":
        case "=":
          store.setCamera({ zoom: clampZoom(store.camera.zoom * 1.18) });
          break;
        case "-":
        case "_":
          store.setCamera({ zoom: clampZoom(store.camera.zoom / 1.18) });
          break;
        case "ArrowUp":
          store.setCamera({ y: store.camera.y - 80 / store.camera.zoom });
          break;
        case "ArrowDown":
          store.setCamera({ y: store.camera.y + 80 / store.camera.zoom });
          break;
        case "ArrowLeft":
          store.setCamera({ x: store.camera.x - 80 / store.camera.zoom });
          break;
        case "ArrowRight":
          store.setCamera({ x: store.camera.x + 80 / store.camera.zoom });
          break;
        case "h":
        case "H":
          store.setCamera({ x: 0, y: 0, zoom: 0.7 });
          break;
        case "s":
        case "S":
          store.saveGame();
          store.setShowIntro(false);
          break;
      }
      // unused
      void MIN_ZOOM; void MAX_ZOOM;
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
