// ============================================================================
// Game loop — rAF scheduler with accumulator pattern
// ============================================================================

import { useEffect, useRef } from "react";
import { useGameStore } from "@/store/gameStore";
import { TICK_REAL_MS } from "@/sim/balance";

export function useGameLoop() {
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const accumulatorRef = useRef<number>(0);

  useEffect(() => {
    const tick = (now: number) => {
      const last = lastTimeRef.current || now;
      const dt = now - last;
      lastTimeRef.current = now;

      const speed = useGameStore.getState().speed;
      if (speed > 0) {
        accumulatorRef.current += dt * speed;
        const tickMs = TICK_REAL_MS;
        const store = useGameStore.getState();
        // run multiple ticks if accumulator overflows
        let safety = 0;
        while (accumulatorRef.current >= tickMs && safety < 8) {
          store.advanceTick();
          accumulatorRef.current -= tickMs;
          safety += 1;
        }
        // autosave check
        store.autosaveIfNeeded();
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);
}
