// ============================================================================
// GamePage — composes the full game viewport (canvas + HUD + overlays)
// ============================================================================

import { useEffect } from "react";
import { GameCanvas } from "@/components/GameCanvas";
import { Hud } from "@/components/Hud";
import { BuildPalette } from "@/components/BuildPalette";
import { ModuleInfoPanel } from "@/components/ModuleInfoPanel";
import { GoalsPanel } from "@/components/GoalsPanel";
import { EventTicker } from "@/components/EventTicker";
import { IntroOverlay } from "@/components/IntroOverlay";
import { useGameStore } from "@/store/gameStore";
import { useGameLoop } from "@/hooks/useGameLoop";
import { useKeyboard } from "@/hooks/useKeyboard";

export function GamePage() {
  const terrain = useGameStore((s) => s.terrain);
  const initNew = useGameStore((s) => s.initNew);
  const showIntro = useGameStore((s) => s.showIntro);

  // Ensure the game is initialized on first mount (in case no save loaded yet)
  useEffect(() => {
    if (!terrain) {
      initNew();
    }
  }, [terrain, initNew]);

  // Start the sim loop + keyboard shortcuts
  useGameLoop();
  useKeyboard();

  return (
    <div className="relative w-full h-full overflow-hidden bg-graphite no-select">
      {/* Main viewport (terrain + buildings + interaction) */}
      <GameCanvas />

      {/* Top vitals strip + speed controls */}
      <Hud />

      {/* Floating panels */}
      <GoalsPanel />
      <ModuleInfoPanel />

      {/* Bottom dock */}
      <BuildPalette />

      {/* Bottom-left event feed */}
      <EventTicker />

      {/* First-load briefing / load-game modal */}
      {showIntro && <IntroOverlay />}
    </div>
  );
}
