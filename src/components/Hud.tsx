// ============================================================================
// Hud — compact top vitals strip + speed controls
// ============================================================================

import {
  Atom,
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
import { fmtClock, fmtNum } from "@/utils/format";
import type { ResourceId } from "@/sim/types";

const ICON_MAP: Record<string, any> = {
  Zap, Wind, Droplets, Salad, Mountain, Layers, Flame, Cpu, FlaskConical, Atom,
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

  return (
    <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
      <div className="flex items-center gap-1 p-1.5 pointer-events-auto">
        {/* Identity + clock (compact) */}
        <div className="hud-panel corner-brackets flex items-center gap-2 px-2.5 py-1">
          <div className="w-1.5 h-1.5 bg-amber animate-pulse-amber" />
          <span className="font-display text-[9px] tracking-[0.18em] text-amber">MOONBASE 2050</span>
          <span className="font-mono text-[9px] text-cream/60">T+{fmtClock(simTime)}</span>
        </div>

        {/* Crew */}
        <div className="hud-panel corner-brackets flex items-center gap-1.5 px-2.5 py-1">
          <Users size={11} className="text-mint" />
          <span className="mono-num text-[12px] text-cream leading-none">{fmtNum(population)}</span>
          <span className="font-mono text-[8px] text-cream/40 leading-none">/{fmtNum(housingCapacity)}</span>
        </div>

        {/* Resources — compact single-line chips */}
        <div className="hud-panel corner-brackets flex items-center gap-2 px-2 py-1">
          {RESOURCE_ORDER.slice(0, 8).map((rid) => (
            <ResourceChip key={rid} rid={rid} value={resources[rid] ?? 0} rate={rates[rid] ?? 0} />
          ))}
        </div>

        <div className="flex-1" />

        {/* Speed + actions */}
        <div className="hud-panel corner-brackets flex items-center gap-1 px-1.5 py-1">
          <SpeedButton label={<Pause size={10} />} active={speed === 0} onClick={() => setSpeed(0)} title="Pause (0)" />
          <SpeedButton label={<Play size={10} />} active={speed === 1 && !paused} onClick={() => setSpeed(1)} title="1x (1)" />
          <SpeedButton label={<FastForward size={10} />} active={speed === 2} onClick={() => setSpeed(2)} title="2x (2)" />
          <SpeedButton label={<><FastForward size={10} /><FastForward size={10} className="-ml-1.5" /></>} active={speed === 4} onClick={() => setSpeed(4)} title="4x (3)" />
          <div className="w-px h-4 bg-amber/30 mx-0.5" />
          <button className="btn-rect" onClick={() => { saveGame(); }} title="Save (S)"><Save size={10} /></button>
          <button className="btn-rect" onClick={() => setShowIntro(true)} title="Briefing"><RotateCcw size={10} /></button>
          <button className="btn-rect" onClick={() => setCamera({ x: 0, y: 0, zoom: 0.5 })} title="Home (H)"><Home size={10} /></button>
        </div>
      </div>
    </div>
  );
}

function ResourceChip({ rid, value, rate }: { rid: ResourceId; value: number; rate: number }) {
  const meta = RESOURCE_META[rid];
  const Icon = ICON_MAP[meta.icon] ?? Zap;
  const rateColor = rate > 0 ? "text-mint" : rate < 0 ? "text-magenta" : "text-cream/30";
  const rateSign = rate > 0 ? "+" : "";
  return (
    <div className="flex items-center gap-1 min-w-[52px]">
      <Icon size={10} style={{ color: meta.color }} />
      <span className="mono-num text-[11px] text-cream leading-none">{fmtNum(value)}</span>
      {rate !== 0 && (
        <span className={`mono-num text-[8px] leading-none ${rateColor}`}>{rateSign}{fmtNum(Math.abs(rate))}</span>
      )}
    </div>
  );
}

function SpeedButton({ label, active, onClick, title }: { label: React.ReactNode; active: boolean; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-6 h-6 flex items-center justify-center border transition-all ${
        active
          ? "bg-amber text-graphite border-amber shadow-glow-amber"
          : "border-amber/30 text-cream hover:border-amber hover:text-amber"
      }`}
    >
      {label}
    </button>
  );
}
