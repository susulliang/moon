// ============================================================================
// EventTicker — bottom-left event feed; auto-hides after a few seconds
// ============================================================================

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Siren } from "lucide-react";
import { useGameStore } from "@/store/gameStore";
import { fmtTime } from "@/utils/format";
import type { GameEvent } from "@/sim/types";

const KIND_STYLE: Record<
  GameEvent["kind"],
  { icon: React.ReactNode; color: string }
> = {
  info: { icon: <Info size={10} />, color: "#56d4e0" },
  good: { icon: <CheckCircle2 size={10} />, color: "#7be2a8" },
  warn: { icon: <AlertTriangle size={10} />, color: "#ffb454" },
  bad: { icon: <Siren size={10} />, color: "#e056a8" },
};

const HIDE_DELAY_MS = 4500;

export function EventTicker() {
  const events = useGameStore((s) => s.events);
  const recent = events.slice(-5).reverse();
  const [visible, setVisible] = useState(true);
  const lastCount = useRef(events.length);
  const timer = useRef<number | undefined>(undefined);

  // Show on new events, auto-hide after delay
  useEffect(() => {
    if (events.length > lastCount.current) {
      setVisible(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setVisible(false), HIDE_DELAY_MS);
    }
    lastCount.current = events.length;
  }, [events.length]);

  // Initial hide timer for the very first event
  useEffect(() => {
    timer.current = window.setTimeout(() => setVisible(false), HIDE_DELAY_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  return (
    <div
      className={`absolute bottom-2 left-2 z-30 pointer-events-auto w-[300px] transition-all duration-500 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
      }`}
      onMouseEnter={() => {
        if (timer.current) window.clearTimeout(timer.current);
        setVisible(true);
      }}
      onMouseLeave={() => {
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setVisible(false), HIDE_DELAY_MS);
      }}
    >
      <div className="hud-panel corner-brackets">
        <div className="flex items-center justify-between px-2 py-1 border-b border-amber/20">
          <span className="label-tag text-amber">EVENT LOG</span>
          <span className="mono-num text-[9px] text-cream/40">{events.length} ENTRIES</span>
        </div>
        <div className="max-h-[110px] overflow-y-auto thin-scroll">
          {recent.length === 0 ? (
            <div className="px-2 py-3 font-mono text-[10px] text-cream/40">
              Awaiting telemetry...
            </div>
          ) : (
            recent.map((ev) => {
              const style = KIND_STYLE[ev.kind];
              return (
                <div
                  key={ev.id}
                  className="flex items-start gap-1.5 px-2 py-1 border-b border-cream/5 last:border-b-0"
                >
                  <span style={{ color: style.color }} className="mt-0.5 shrink-0">
                    {style.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[9px] text-cream/40 leading-none">
                      {fmtTime(ev.t)}
                    </div>
                    <div
                      className="font-mono text-[10px] leading-snug truncate"
                      style={{ color: ev.kind === "info" ? "rgba(232,226,212,0.85)" : style.color }}
                      title={ev.text}
                    >
                      {ev.text}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
