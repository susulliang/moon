// ============================================================================
// BuildPalette — bottom dock with categorized module catalog
// ============================================================================

import { useState } from "react";
import { X, ChevronRight } from "lucide-react";
import { useGameStore } from "@/store/gameStore";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  getModulesByCategory,
  categoryColor,
  moduleColor,
} from "@/buildings/catalog";
import { renderBuildingGlyph } from "@/buildings/glyphs";
import { RESOURCE_META } from "@/sim/balance";
import { canAfford, isPrereqMet } from "@/sim/tick";
import type { BuildingCategoryId } from "@/sim/types";
import { fmtNum } from "@/utils/format";

const CATEGORY_ICON: Record<BuildingCategoryId, string> = {
  power: "PWR",
  habitat: "HAB",
  life: "LFE",
  isru: "ISR",
  mfg: "MFG",
  research: "R&D",
  logistics: "LOG",
  signature: "SIG",
};

export function BuildPalette() {
  const [category, setCategory] = useState<BuildingCategoryId>("power");
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
        <button
          className="btn-rect"
          onClick={() => setCollapsed(false)}
        >
          <ChevronRight size={11} className="rotate-180" /> BUILD
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-30 pointer-events-auto w-full max-w-[920px] px-2 pb-2">
      <div className="hud-panel corner-brackets flex flex-col">
        {/* Category tabs */}
        <div className="flex items-stretch border-b border-amber/20">
          {CATEGORY_ORDER.map((cat) => {
            const active = cat === category;
            const color = categoryColor(cat);
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`flex-1 px-3 py-1.5 flex items-center justify-center gap-1.5 font-display text-[10px] tracking-[0.14em] transition-all border-r border-amber/15 last:border-r-0 ${
                  active
                    ? "bg-amber/15 text-cream"
                    : "text-cream/50 hover:text-cream hover:bg-amber/5"
                }`}
                style={active ? { color, boxShadow: `inset 0 -2px 0 ${color}` } : {}}
              >
                <span
                  className="w-1.5 h-1.5"
                  style={{ background: color, opacity: active ? 1 : 0.5 }}
                />
                {CATEGORY_LABELS[cat]}
              </button>
            );
          })}
          <button
            onClick={() => setCollapsed(true)}
            className="px-2 text-cream/40 hover:text-amber"
            title="Collapse"
          >
            <X size={12} />
          </button>
        </div>

        {/* Module cards */}
        <ModuleList category={category} />
      </div>
    </div>
  );
}

function ModuleList({ category }: { category: BuildingCategoryId }) {
  const modules = getModulesByCategory(category);
  const population = useGameStore((s) => s.population);
  const researchMilestones = useGameStore((s) => s.researchMilestonesCompleted);
  const resources = useGameStore((s) => s.resources);
  const startPlacement = useGameStore((s) => s.startPlacement);
  const placement = useGameStore((s) => s.placement);
  const catColor = categoryColor(category);

  return (
    <div className="flex gap-2 p-2 overflow-x-auto thin-scroll">
      {modules.map((m) => {
        const prereqMet = isPrereqMet(m.prereq, population, researchMilestones);
        const affordable = canAfford(m.cost as any, resources);
        const enabled = prereqMet && affordable;
        const isSelected = placement?.typeId === m.id;
        return (
          <button
            key={m.id}
            disabled={!enabled}
            onClick={() => startPlacement(m.id)}
            className={`relative flex flex-col w-[120px] min-w-[120px] p-2 border transition-all ${
              isSelected
                ? "border-amber bg-amber/10 shadow-glow-amber"
                : enabled
                ? "border-amber/30 hover:border-amber hover:bg-amber/5"
                : "border-cream/10 opacity-50 cursor-not-allowed"
            }`}
            title={m.blurb}
          >
            {/* glyph preview */}
            <div className="h-[44px] flex items-center justify-center">
              <svg viewBox="-50 -50 100 100" className="w-11 h-11">
                {renderBuildingGlyph(m.id, { color: moduleColor(m.id), fillOpacity: 0.2 })}
              </svg>
            </div>

            <div className="font-display text-[10px] text-cream leading-tight mt-1 line-clamp-2 min-h-[24px]">
              {m.name}
            </div>

            {/* cost row */}
            <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 mt-1">
              {Object.entries(m.cost).map(([k, v]) => {
                const meta = RESOURCE_META[k as keyof typeof RESOURCE_META];
                if (!meta) return null;
                const have = (resources[k] ?? 0) >= (v as number);
                return (
                  <span
                    key={k}
                    className={`mono-num text-[8px] ${have ? "text-cream/60" : "text-magenta"}`}
                    style={{ color: have ? meta.color + "aa" : "#e056a8" }}
                  >
                    {meta.abbr}{fmtNum(v as number)}
                  </span>
                );
              })}
            </div>

            {/* prereq / status */}
            {!prereqMet && (
              <div className="font-mono text-[8px] text-magenta mt-1 leading-none">
                {m.prereq?.pop != null && population < m.prereq.pop ? `NEED POP ${m.prereq.pop}` : ""}
                {m.prereq?.researchMilestones != null && researchMilestones < m.prereq.researchMilestones ? ` NEED R&D ${m.prereq.researchMilestones}` : ""}
              </div>
            )}
            {prereqMet && (
              <div className="font-mono text-[8px] text-cream/40 mt-1 leading-none">
                {CATEGORY_ICON[category]} · {m.buildTime}h
              </div>
            )}

            {/* corner index */}
            <span
              className="absolute top-1 left-1 font-display text-[8px] opacity-50"
              style={{ color: catColor }}
            >
              {m.id.slice(0, 3).toUpperCase()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
