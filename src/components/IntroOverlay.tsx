// ============================================================================
// IntroOverlay — first-load briefing modal with mission overview + load option
// ============================================================================

import { useState } from "react";
import { Rocket, FlaskConical, Users, Cpu, X, Play, Upload } from "lucide-react";
import { useGameStore } from "@/store/gameStore";
import { WIN_MARS_FLIGHTS, WIN_POP, WIN_RESEARCH_MILESTONES } from "@/sim/balance";

export function IntroOverlay() {
  const showIntro = useGameStore((s) => s.showIntro);
  const setShowIntro = useGameStore((s) => s.setShowIntro);
  const initNew = useGameStore((s) => s.initNew);
  const loadGame = useGameStore((s) => s.loadGame);
  const [hasSave] = useState(() => {
    try {
      return !!localStorage.getItem("moonbase.save.v1");
    } catch {
      return false;
    }
  });

  if (!showIntro) return null;

  const startNew = () => {
    initNew();
    setShowIntro(false);
  };

  const loadExisting = () => {
    if (loadGame()) {
      setShowIntro(false);
    } else {
      startNew();
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-graphite/80 backdrop-blur-sm pointer-events-auto">
      <div className="hud-panel corner-brackets w-[520px] max-w-[92vw] relative scanlines">
        {/* close */}
        <button
          onClick={() => setShowIntro(false)}
          className="absolute top-2 right-2 text-cream/40 hover:text-amber z-10"
        >
          <X size={14} />
        </button>

        {/* header */}
        <div className="px-5 pt-5 pb-3 border-b border-amber/20">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-amber animate-pulse-amber" />
            <span className="font-display text-[11px] tracking-[0.22em] text-amber">
              MISSION BRIEFING · CLASSIFIED
            </span>
          </div>
          <h1 className="font-display text-2xl text-cream mt-2 leading-tight">
            MOONBASE 2050
          </h1>
          <p className="font-mono text-[10px] text-cyan/80 mt-1 tracking-wider">
            ISRU × SPACEX · LUNAR COLONY COMMAND
          </p>
        </div>

        {/* body */}
        <div className="px-5 py-4 space-y-3">
          <p className="font-mono text-[11px] text-cream/75 leading-relaxed">
            You command the first permanent lunar settlement — a self-sustaining
            outpost built atop portable nuclear reactors and ISRU mining.
            Earth still resupplies the colony via landing pads, but the goal
            is total autonomy: a 10,000-person city, manufacturing hub for
            Mars exploration, and a deep-space research center.
          </p>

          {/* objectives */}
          <div className="space-y-1.5">
            <span className="label-tag text-amber">PRIMARY OBJECTIVES</span>
            <Objective icon={<Users size={11} />} color="#7be2a8" text={`Sustain a colony of ${WIN_POP.toLocaleString()} colonists`} />
            <Objective icon={<Rocket size={11} />} color="#ffb454" text={`Complete ${WIN_MARS_FLIGHTS} Mars supply launches via rail system`} />
            <Objective icon={<FlaskConical size={11} />} color="#56d4e0" text={`Achieve ${WIN_RESEARCH_MILESTONES} research milestones`} />
          </div>

          {/* controls hint */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-2 border-t border-amber/15">
            <ControlHint keys="DRAG" label="Pan map" />
            <ControlHint keys="WHEEL" label="Zoom to cursor" />
            <ControlHint keys="SPACE" label="Pause / resume" />
            <ControlHint keys="1 2 3" label="Speed 1× 2× 4×" />
            <ControlHint keys="H" label="Recenter map" />
            <ControlHint keys="S" label="Save game" />
          </div>

          {/* starting modules */}
          <div className="pt-2 border-t border-amber/15">
            <span className="label-tag text-amber">PRE-DEPLOYED ASSETS</span>
            <p className="font-mono text-[10px] text-cream/60 mt-1 leading-snug">
              Nuclear reactor · Crew habitat · Greenhouse · O₂ / H₂O plants ·
              Regolith harvester · Fab bay · Storage depot · Rail launch system
            </p>
          </div>

          {/* signature note */}
          <div className="flex items-start gap-2 pt-2 border-t border-amber/15">
            <Cpu size={11} className="text-cyan mt-0.5 shrink-0" />
            <p className="font-mono text-[10px] text-cream/55 leading-snug italic">
              All telemetry rendered as vector graphics over a procedurally
              generated lunar heightmap with hillshade & shadow modeling.
              Pan, zoom, and click any module to inspect or upgrade.
            </p>
          </div>
        </div>

        {/* footer actions */}
        <div className="px-5 py-3 border-t border-amber/20 flex gap-2">
          <button className="btn-rect flex-1 justify-center" onClick={startNew}>
            <Play size={11} /> NEW COLONY
          </button>
          {hasSave && (
            <button className="btn-rect btn-rect-cyan flex-1 justify-center" onClick={loadExisting}>
              <Upload size={11} /> LOAD SAVE
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Objective({
  icon,
  color,
  text,
}: {
  icon: React.ReactNode;
  color: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color }}>{icon}</span>
      <span className="font-mono text-[11px] text-cream/85">{text}</span>
    </div>
  );
}

function ControlHint({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-display text-[9px] text-amber tracking-wider min-w-[48px]">
        {keys}
      </span>
      <span className="font-mono text-[10px] text-cream/55">{label}</span>
    </div>
  );
}
