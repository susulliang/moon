// ============================================================================
// GoalsPanel — win condition progress (top-right)
// ============================================================================

import { Users, Rocket, FlaskConical, Trophy } from "lucide-react";
import { useGameStore } from "@/store/gameStore";
import { WIN_MARS_FLIGHTS, WIN_POP, WIN_RESEARCH_MILESTONES } from "@/sim/balance";
import { fmtNum } from "@/utils/format";

export function GoalsPanel() {
  const population = useGameStore((s) => s.population);
  const marsFlights = useGameStore((s) => s.marsFlightsCompleted);
  const researchMilestones = useGameStore((s) => s.researchMilestonesCompleted);
  const win = useGameStore((s) => s.win);

  return (
    <div className="absolute left-2 top-[68px] z-30 pointer-events-auto w-[220px]">
      <div className="hud-panel-cyan corner-brackets">
        <div className="flex items-center justify-between p-2 border-b border-cyan/20">
          <span className="label-tag text-cyan">COLONY GOALS</span>
          <Trophy size={11} className={win ? "text-amber animate-pulse-amber" : "text-cream/40"} />
        </div>
        <div className="p-2 space-y-2">
          <GoalRow
            icon={<Users size={11} className="text-mint" />}
            label="POPULATION"
            value={population}
            target={WIN_POP}
            color="#7be2a8"
          />
          <GoalRow
            icon={<Rocket size={11} className="text-amber" />}
            label="MARS FLIGHTS"
            value={marsFlights}
            target={WIN_MARS_FLIGHTS}
            color="#ffb454"
          />
          <GoalRow
            icon={<FlaskConical size={11} className="text-cyan" />}
            label="R&D MILESTONES"
            value={researchMilestones}
            target={WIN_RESEARCH_MILESTONES}
            color="#56d4e0"
          />
          {win && (
            <div className="mt-1 p-1.5 border border-amber bg-amber/10 text-center">
              <div className="font-display text-[10px] text-amber tracking-[0.18em] animate-pulse-amber">
                SELF-SUSTAINING COLONY
              </div>
              <div className="font-mono text-[9px] text-cream/70 mt-0.5">
                Mars logistics hub operational
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GoalRow({
  icon,
  label,
  value,
  target,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  target: number;
  color: string;
}) {
  const pct = Math.min(1, value / target);
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="label-tag" style={{ color }}>{label}</span>
        </div>
        <span className="mono-num text-[10px] text-cream">
          {fmtNum(value)}<span className="text-cream/40">/{fmtNum(target)}</span>
        </span>
      </div>
      <div className="h-1 bg-cream/10 mt-1 overflow-hidden">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${pct * 100}%`, background: color, boxShadow: `0 0 6px ${color}` }}
        />
      </div>
    </div>
  );
}
