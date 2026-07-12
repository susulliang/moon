// ============================================================================
// Hud — top vitals strip + speed controls + sim clock + save buttons
// ============================================================================

import {
  Atom,
  Coins,
  Cpu,
  Droplets,
  Flame,
  FlaskConical,
  Layers,
  Mountain,
  Pause,
  Play,
  Salad,
  Users,
  Wind,
  Zap,
  FastForward,
  Save,
  RotateCcw,
  Home,
} from "lucide-react";
import { useGameStore } from "@/store/gameStore";
import { RESOURCE_META, RESOURCE_ORDER } from "@/sim/balance";
import { fmtClock, fmtNum, fmtRate } from "@/utils/format";
import type { ResourceId } from "@/sim/types";

const ICON_MAP: Record<string, any> = {
  Zap, Wind, Droplets, Salad, Mountain, Layers, Flame, Cpu, FlaskConical, Atom, Coins,
};

export function Hud() {
  const resources = useGameStore((s) => s.resources);
  const rates = useGameStore((s) => s.rates);
  const population = useGameStore((s) => s.population);
  const housingCapacity = useGameStore((s) => s.housingCapacity);
  const simTime = useGameStore((s) => s.simTime);
  const speed = useGameStore((s) => s.speed);
  const paused = useGameStore((s) => s.paused);
  const setSpeed = useGameStore((s) => s.setSpeed);
  const saveGame = useGameStore((s) => s.saveGame);
  const setShowIntro = useGameStore((s) => s.setShowIntro);
  const setCamera = useGameStore((s) => s.setCamera);
  const marsFlights = useGameStore((s) => s.marsFlightsCompleted);
  const researchMilestones = useGameStore((s) => s.researchMilestonesCompleted);

  return (
    <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
      {/* Top bar: vitals */}
      <div className="flex items-stretch gap-1 p-2 pointer-events-auto">
        {/* Identity chip */}
        <div className="hud-panel corner-brackets flex flex-col justify-between px-3 py-1.5 min-w-[160px]">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-amber animate-pulse-amber" />
            <span className="font-display text-[10px] tracking-[0.18em] text-amber">MOONBASE 2050</span>
          </div>
          <div className="font-mono text-[10px] text-cream/60 mt-1">
            T+ {fmtClock(simTime)}
          </div>
          <div className="font-mono text-[9px] text-cyan/70">
            MARS·{marsFlights.toString().padStart(2, "0")} · R&D·{researchMilestones.toString().padStart(2, "0")}
          </div>
        </div>

        {/* Population */}
        <div className="hud-panel corner-brackets px-3 py-1.5 flex flex-col justify-between min-w-[110px]">
          <div className="flex items-center gap-1.5">
            <Users size={11} className="text-mint" />
            <span className="label-tag text-mint">CREW</span>
          </div>
          <div className="mono-num text-base text-cream leading-none mt-0.5">
            {fmtNum(population)}
          </div>
          <div className="font-mono text-[9px] text-cream/40 leading-none">
            CAP {fmtNum(housingCapacity)}
          </div>
        </div>

        {/* Resource chips — main vitals */}
        <div className="hud-panel corner-brackets px-2 py-1.5 flex flex-row gap-3 items-center">
          {RESOURCE_ORDER.slice(0, 8).map((rid) => (
            <ResourceChip key={rid} rid={rid} value={resources[rid] ?? 0} rate={rates[rid] ?? 0} />
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Speed controls */}
        <div className="hud-panel corner-brackets px-2 py-1.5 flex items-center gap-1">
          <span className="label-tag mr-1">SPEED</span>
          <SpeedButton label={<Pause size={11} />} active={speed === 0} onClick={() => setSpeed(0)} title="Pause (0)" />
          <SpeedButton label={<Play size={11} />} active={speed === 1 && !paused} onClick={() => setSpeed(1)} title="1x (1)" />
          <SpeedButton label={<FastForward size={11} />} active={speed === 2} onClick={() => setSpeed(2)} title="2x (2)" />
          <SpeedButton label={<><FastForward size={11} /><FastForward size={11} className="-ml-1.5" /></>} active={speed === 4} onClick={() => setSpeed(4)} title="4x (3)" />
          <div className="w-px h-5 bg-amber/30 mx-1" />
          <button className="btn-rect" onClick={() => { saveGame(); }} title="Save (S)">
            <Save size={11} />
          </button>
          <button className="btn-rect" onClick={() => setShowIntro(true)} title="Briefing">
            <RotateCcw size={11} />
          </button>
          <button className="btn-rect" onClick={() => setCamera({ x: 0, y: 0, zoom: 0.7 })} title="Home (H)">
            <Home size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ResourceChip({ rid, value, rate }: { rid: ResourceId; value: number; rate: number }) {
  const meta = RESOURCE_META[rid];
  const Icon = ICON_MAP[meta.icon] ?? Zap;
  const rateColor = rate > 0 ? "text-mint" : rate < 0 ? "text-magenta" : "text-cream/40";
  return (
    <div className="flex flex-col items-start min-w-[58px]">
      <div className="flex items-center gap-1">
        <Icon size={10} style={{ color: meta.color }} />
        <span className="label-tag" style={{ color: meta.color + "cc" }}>{meta.abbr}</span>
      </div>
      <div className="mono-num text-[12px] text-cream leading-tight">
        {fmtNum(value)}
      </div>
      <div className={`mono-num text-[9px] leading-none ${rateColor}`}>
        {fmtRate(rate)}
      </div>
    </div>
  );
}

function SpeedButton({ label, active, onClick, title }: { label: React.ReactNode; active: boolean; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-7 h-7 flex items-center justify-center border transition-all ${
        active
          ? "bg-amber text-graphite border-amber shadow-glow-amber"
          : "border-amber/30 text-cream hover:border-amber hover:text-amber"
      }`}
    >
      {label}
    </button>
  );
}


