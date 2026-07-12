// ============================================================================
// ModuleInfoPanel — floating card showing selected building details + actions
// ============================================================================

import {
  ArrowUpCircle,
  Trash2,
  X,
  Satellite,
  Package,
  Rocket as RocketIcon,
} from "lucide-react";
import { useGameStore } from "@/store/gameStore";
import { MODULE_CATALOG, moduleColor } from "@/buildings/catalog";
import { renderBuildingGlyph } from "@/buildings/glyphs";
import { RESOURCE_META, LAUNCH_COSTS } from "@/sim/balance";
import { fmtRate } from "@/utils/format";
import type { PayloadKind } from "@/sim/types";

export function ModuleInfoPanel() {
  const selectedId = useGameStore((s) => s.selectedBuildingId);
  const buildings = useGameStore((s) => s.buildings);
  const selectBuilding = useGameStore((s) => s.selectBuilding);
  const upgradeBuilding = useGameStore((s) => s.upgradeBuilding);
  const dismantleBuilding = useGameStore((s) => s.dismantleBuilding);
  const queueLaunch = useGameStore((s) => s.queueLaunch);
  const resources = useGameStore((s) => s.resources);
  const launchQueue = useGameStore((s) => s.launchQueue);
  const marsFlights = useGameStore((s) => s.marsFlightsCompleted);

  if (!selectedId) return null;
  const b = buildings.find((x) => x.id === selectedId);
  if (!b) return null;
  const def = MODULE_CATALOG[b.typeId];
  const color = moduleColor(b.typeId);

  const isRail = b.typeId === "rail_launch";
  const activeLaunches = launchQueue.length;

  return (
    <div className="absolute right-2 top-[68px] z-30 pointer-events-auto w-[260px]">
      <div className="hud-panel corner-brackets">
        {/* header */}
        <div className="flex items-start justify-between p-2 border-b border-amber/20">
          <div className="flex items-center gap-2">
            <svg viewBox="-50 -50 100 100" className="w-9 h-9">
              {renderBuildingGlyph(b.typeId, { color, fillOpacity: 0.25 })}
            </svg>
            <div>
              <div className="font-display text-[11px] text-cream leading-tight">{def.name}</div>
              <div className="font-mono text-[9px] text-cream/50">
                L{b.level}{def.maxLevel ? `/${def.maxLevel}` : ""} · {b.status.toUpperCase()}
              </div>
            </div>
          </div>
          <button
            onClick={() => selectBuilding(null)}
            className="text-cream/40 hover:text-amber"
          >
            <X size={12} />
          </button>
        </div>

        {/* body */}
        <div className="p-2 space-y-2">
          <p className="font-mono text-[10px] text-cream/70 leading-snug">{def.blurb}</p>

          {/* production / consumption */}
          {(def.production || def.consumption) && (
            <div className="space-y-1">
              <div className="label-tag">PER TICK (L{b.level})</div>
              <div className="flex flex-wrap gap-1">
                {def.production && Object.entries(def.production).map(([k, v]) => {
                  const meta = RESOURCE_META[k as keyof typeof RESOURCE_META];
                  if (!meta) return null;
                  const mult = 1 + 0.5 * (b.level - 1);
                  return (
                    <span
                      key={k}
                      className="mono-num text-[10px] px-1.5 py-0.5 border"
                      style={{ color: meta.color, borderColor: meta.color + "55" }}
                    >
                      +{fmtRate((v as number) * mult)} {meta.abbr}
                    </span>
                  );
                })}
                {def.consumption && Object.entries(def.consumption).map(([k, v]) => {
                  const meta = RESOURCE_META[k as keyof typeof RESOURCE_META];
                  if (!meta) return null;
                  const mult = 1 + 0.5 * (b.level - 1);
                  return (
                    <span
                      key={k}
                      className="mono-num text-[10px] px-1.5 py-0.5 border border-magenta/40 text-magenta"
                    >
                      −{fmtRate((v as number) * mult)} {meta.abbr}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* housing / storage */}
          {def.housing && (
            <div className="font-mono text-[10px] text-mint">
              HOUSING +{Math.round(def.housing * (1 + 0.5 * (b.level - 1)))}
            </div>
          )}
          {def.storage && (
            <div className="font-mono text-[10px] text-cyan">
              STORAGE {Object.entries(def.storage).map(([k, v]) => `${(RESOURCE_META as any)[k]?.abbr ?? k}+${v}`).join("  ")}
            </div>
          )}

          {/* construction progress */}
          {b.status === "construction" && (
            <div>
              <div className="flex items-center justify-between">
                <span className="label-tag">CONSTRUCTING</span>
                <span className="mono-num text-[10px] text-amber">
                  {Math.floor(b.constructionProgress * 100)}%
                </span>
              </div>
              <div className="h-1 bg-amber/15 mt-1">
                <div
                  className="h-full bg-amber transition-all"
                  style={{ width: `${b.constructionProgress * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* rail launch UI */}
          {isRail && b.status === "active" && (
            <div className="space-y-1.5 pt-1 border-t border-amber/20">
              <div className="flex items-center justify-between">
                <span className="label-tag">LAUNCH QUEUE</span>
                <span className="mono-num text-[10px] text-amber">{activeLaunches} PENDING</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <LaunchButton
                  icon={<Satellite size={11} />}
                  label="SAT"
                  cost={LAUNCH_COSTS.satellite}
                  resources={resources}
                  onClick={() => queueLaunch("satellite" as PayloadKind)}
                />
                <LaunchButton
                  icon={<Package size={11} />}
                  label="EQP"
                  cost={LAUNCH_COSTS.equipment}
                  resources={resources}
                  onClick={() => queueLaunch("equipment" as PayloadKind)}
                />
                <LaunchButton
                  icon={<RocketIcon size={11} />}
                  label="MARS"
                  cost={LAUNCH_COSTS.mars_ship}
                  resources={resources}
                  onClick={() => queueLaunch("mars_ship" as PayloadKind)}
                />
              </div>
              <div className="font-mono text-[9px] text-cyan/70">
                MARS FLIGHTS COMPLETED: {marsFlights}
              </div>
            </div>
          )}

          {/* actions */}
          {b.status === "active" && (
            <div className="flex gap-1 pt-1 border-t border-amber/20">
              <button
                className="btn-rect flex-1 justify-center"
                disabled={def.maxLevel != null && b.level >= def.maxLevel}
                onClick={() => upgradeBuilding(b.id)}
                title="Upgrade (70% of base cost)"
              >
                <ArrowUpCircle size={11} /> UPGRADE
              </button>
              <button
                className="btn-rect btn-rect-cyan flex-1 justify-center"
                onClick={() => dismantleBuilding(b.id)}
                title="Dismantle (40% refund)"
              >
                <Trash2 size={11} /> SCRAP
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LaunchButton({
  icon,
  label,
  cost,
  resources,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  cost: { fuel: number; components: number; metals: number; buildTime: number };
  resources: Record<string, number>;
  onClick: () => void;
}) {
  const canAffordIt =
    (resources.fuel ?? 0) >= cost.fuel &&
    (resources.components ?? 0) >= cost.components &&
    (resources.metals ?? 0) >= cost.metals;
  return (
    <button
      disabled={!canAffordIt}
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 py-1.5 border transition-all ${
        canAffordIt
          ? "border-amber/40 hover:bg-amber hover:text-graphite text-amber"
          : "border-cream/15 text-cream/30 cursor-not-allowed"
      }`}
      title={`Fuel ${cost.fuel}, Components ${cost.components}, Metals ${cost.metals}`}
    >
      {icon}
      <span className="font-display text-[9px] tracking-wider">{label}</span>
      <span className="mono-num text-[8px] opacity-70">{cost.buildTime}h</span>
    </button>
  );
}
