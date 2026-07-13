// ============================================================================
// Core simulation tick
// ============================================================================

import type {
  BuildingInstance,
  GameEvent,
  LaunchJob,
  ResourceId,
} from "./types";
import {
  COLONIST_FOOD_PER_TICK,
  COLONIST_O2_PER_TICK,
  COLONIST_POWER_PER_TICK,
  COLONIST_WATER_PER_TICK,
  LAUNCH_COSTS,
  POP_GROWTH_MIN_SURPLUS,
  POP_GROWTH_PER_TICK_PER_SURPLUS,
  RESEARCH_PER_MILESTONE,
} from "./balance";
import { MODULE_CATALOG } from "@/buildings/catalog";

export interface TickInputs {
  simTime: number;
  resources: Record<string, number>;
  population: number;
  buildings: BuildingInstance[];
  launchQueue: LaunchJob[];
  marsFlightsCompleted: number;
  researchMilestonesCompleted: number;
  roverDepotCount: number;
  landingPadCount: number;
}

export interface TickResult {
  resources: Record<string, number>;
  rates: Record<string, number>;
  populationDelta: number;
  housingCapacity: number;
  storageCapacity: Record<string, number>;
  events: GameEvent[];
  buildings: BuildingInstance[];     // with updated constructionProgress / status
  launchQueue: LaunchJob[];          // with updated progress
  marsFlightsCompleted: number;
  researchMilestonesCompleted: number;
  researchAccrued: number;           // running research total toward next milestone
  win: boolean;
}

export function simulateTick(
  prev: TickInputs,
  events: GameEvent[],
  researchAccrued: number,
): { result: TickResult; newResearchAccrued: number } {
  const next: Record<string, number> = { ...prev.resources };
  const rates: Record<string, number> = {};
  const newEvents: GameEvent[] = [];
  let housingCapacity = 0;
  let storageCapacity: Record<string, number> = { ore: 200, metals: 200, fuel: 100, components: 100, helium3: 50, power: 200 };
  let marsFlightsCompleted = prev.marsFlightsCompleted;
  let researchMilestonesCompleted = prev.researchMilestonesCompleted;
  let researchAccum = researchAccrued;

  // Logistics multiplier from rover depots (each adds +5% throughput)
  const logisticsMult = 1 + 0.05 * prev.roverDepotCount;

  // Iterate buildings: production, consumption, housing, storage
  let producedPower = 0;
  let consumedPower = 0;

  const updatedBuildings = prev.buildings.map((b) => {
    // Construction progress
    if (b.status === "construction") {
      const def = MODULE_CATALOG[b.typeId];
      const progDelta = 1 / Math.max(1, def.buildTime);
      const newProg = b.constructionProgress + progDelta;
      if (newProg >= 1) {
        newEvents.push({
          id: rid(),
          t: prev.simTime + 1,
          kind: "good",
          text: `${def.name} completed`,
        });
        return { ...b, constructionProgress: 1, status: "active" as const };
      }
      return { ...b, constructionProgress: newProg };
    }
    return b;
  });

  for (const b of updatedBuildings) {
    if (b.status !== "active") continue;
    const def = MODULE_CATALOG[b.typeId];
    const levelMult = 1 + 0.5 * (b.level - 1); // level 1=1x, 2=1.5x, 3=2x, 4=2.5x

    // housing
    if (def.housing) housingCapacity += Math.round(def.housing * levelMult);
    // storage
    if (def.storage) {
      for (const [k, v] of Object.entries(def.storage)) {
        storageCapacity[k] = (storageCapacity[k] ?? 0) + (v as number) * levelMult;
      }
    }

    // production (apply logistics mult to mining/mfg outputs)
    if (def.production) {
      for (const [k, v] of Object.entries(def.production)) {
        const cat = def.category;
        const applyLogistics = cat === "isru" || cat === "mfg";
        const amount = (v as number) * levelMult * (applyLogistics ? logisticsMult : 1);
        next[k] = (next[k] ?? 0) + amount;
        rates[k] = (rates[k] ?? 0) + amount;
      }
    }
    // consumption
    if (def.consumption) {
      for (const [k, v] of Object.entries(def.consumption)) {
        const amount = (v as number) * levelMult;
        next[k] = (next[k] ?? 0) - amount;
        rates[k] = (rates[k] ?? 0) - amount;
        if (k === "power") consumedPower += amount;
      }
    }
    if (def.production?.power) producedPower += (def.production.power as number) * levelMult;
  }

  // Colonist consumption
  const pop = prev.population;
  const o2Use = pop * COLONIST_O2_PER_TICK;
  const waterUse = pop * COLONIST_WATER_PER_TICK;
  const foodUse = pop * COLONIST_FOOD_PER_TICK;
  const powerUse = pop * COLONIST_POWER_PER_TICK;
  next.oxygen = (next.oxygen ?? 0) - o2Use;
  next.water = (next.water ?? 0) - waterUse;
  next.food = (next.food ?? 0) - foodUse;
  next.power = (next.power ?? 0) - powerUse;
  rates.oxygen = (rates.oxygen ?? 0) - o2Use;
  rates.water = (rates.water ?? 0) - waterUse;
  rates.food = (rates.food ?? 0) - foodUse;
  rates.power = (rates.power ?? 0) - powerUse;
  consumedPower += powerUse;

  // Clamp to storage capacity (no overstocking)
  for (const k of ["ore", "metals", "fuel", "components", "helium3", "power"] as const) {
    const cap = storageCapacity[k] ?? 0;
    if ((next[k] ?? 0) > cap) {
      next[k] = cap;
    }
    if ((next[k] ?? 0) < 0) {
      // deficit — set to 0, log warning occasionally
      if (k !== "power") next[k] = 0;
    }
  }

  // Population growth: only if all life support surpluses positive
  const surplusO2 = (rates.oxygen ?? 0);
  const surplusWater = (rates.water ?? 0);
  const surplusFood = (rates.food ?? 0);
  const surplusPower = (rates.power ?? 0);
  const housingRoom = housingCapacity - pop;
  let popDelta = 0;
  if (
    surplusO2 > POP_GROWTH_MIN_SURPLUS &&
    surplusWater > POP_GROWTH_MIN_SURPLUS &&
    surplusFood > POP_GROWTH_MIN_SURPLUS &&
    surplusPower > 0 &&
    housingRoom > 0
  ) {
    const minSurplus = Math.min(surplusO2, surplusWater, surplusFood);
    const growth = Math.min(housingRoom, pop * POP_GROWTH_PER_TICK_PER_SURPLUS * Math.sqrt(minSurplus));
    popDelta = Math.max(1, Math.floor(growth));
    if (popDelta > 0) {
      // Maybe push a growth event every 25 colonists
      if ((Math.floor((pop + popDelta) / 25) > Math.floor(pop / 25))) {
        newEvents.push({
          id: rid(),
          t: prev.simTime + 1,
          kind: "good",
          text: `Population +${popDelta} (total ${pop + popDelta})`,
        });
      }
    }
  } else if (surplusO2 < 0 || surplusWater < 0 || surplusFood < 0) {
    // life support failing — slowly lose population
    const deficit = Math.abs(Math.min(surplusO2, surplusWater, surplusFood));
    popDelta = -Math.max(1, Math.floor(pop * 0.01 * Math.sqrt(deficit)));
    if (popDelta < 0) {
      newEvents.push({
        id: rid(),
        t: prev.simTime + 1,
        kind: "bad",
        text: `Life support deficit! ${popDelta} colonists lost`,
      });
    }
  }

  // Research: accumulate research points; on hitting RESEARCH_PER_MILESTONE, milestone!
  const researchRate = rates.research ?? 0;
  if (researchRate > 0) {
    researchAccum += researchRate;
    while (researchAccum >= RESEARCH_PER_MILESTONE) {
      researchAccum -= RESEARCH_PER_MILESTONE;
      researchMilestonesCompleted += 1;
      newEvents.push({
        id: rid(),
        t: prev.simTime + 1,
        kind: "good",
        text: `Research milestone ${researchMilestonesCompleted} achieved`,
      });
    }
  }

  // Launch queue progress
  const updatedLaunches: LaunchJob[] = [];
  for (const job of prev.launchQueue) {
    const cost = LAUNCH_COSTS[job.payload];
    const progDelta = 1 / Math.max(1, cost.buildTime);
    const newProg = job.progress + progDelta;
    if (newProg >= 1) {
      if (job.payload === "mars_ship") {
        marsFlightsCompleted += 1;
        newEvents.push({
          id: rid(),
          t: prev.simTime + 1,
          kind: "good",
          text: `Mars ship launched! Flight #${marsFlightsCompleted}`,
        });
      } else {
        // satellite / equipment → small research + materials bonus (no credits)
        const bonus = job.payload === "satellite"
          ? { research: 4, components: 4 }
          : { research: 8, metals: 10, components: 6 };
        for (const [k, v] of Object.entries(bonus)) {
          next[k] = (next[k] ?? 0) + (v as number);
        }
        newEvents.push({
          id: rid(),
          t: prev.simTime + 1,
          kind: "info",
          text: `${job.payload} payload launched (+${bonus.research} R&D)`,
        });
      }
    } else {
      updatedLaunches.push({ ...job, progress: newProg });
    }
  }

  // Landing pad: every 24 sim hours, deliver supplies
  // (triggered from store at hour intervals; not here directly)

  // Win check
  const win =
    (pop + popDelta) >= 10000 &&
    marsFlightsCompleted >= 25 &&
    researchMilestonesCompleted >= 12;
  if (win) {
    newEvents.push({
      id: rid(),
      t: prev.simTime + 1,
      kind: "good",
      text: "COLONY GOAL ACHIEVED — 10,000+ self-sustaining Mars-logistics hub",
    });
  }

  const allEvents = [...events, ...newEvents].slice(-40);

  // unused warnings (mute)
  void producedPower; void consumedPower;

  return {
    result: {
      resources: next,
      rates,
      populationDelta: popDelta,
      housingCapacity,
      storageCapacity,
      events: allEvents,
      buildings: updatedBuildings,
      launchQueue: updatedLaunches,
      marsFlightsCompleted,
      researchMilestonesCompleted,
      researchAccrued: researchAccum,
      win,
    },
    newResearchAccrued: researchAccum,
  };
}

export function rid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Earth resupply from landing pad: every N hours, delivers raw materials (no credits).
export function earthResupply(landingPadCount: number): { metals: number; components: number; food: number; ore: number; fuel: number } {
  if (landingPadCount <= 0) return { metals: 0, components: 0, food: 0, ore: 0, fuel: 0 };
  return {
    metals: 30 * landingPadCount,
    components: 20 * landingPadCount,
    food: 20 * landingPadCount,
    ore: 40 * landingPadCount,
    fuel: 10 * landingPadCount,
  };
}

// Check prereqs for a module given current state
export function isPrereqMet(
  prereq: { pop?: number; researchMilestones?: number } | undefined,
  pop: number,
  researchMilestones: number,
): boolean {
  if (!prereq) return true;
  if (prereq.pop != null && pop < prereq.pop) return false;
  if (prereq.researchMilestones != null && researchMilestones < prereq.researchMilestones) return false;
  return true;
}

// Can the player afford the cost right now?
export function canAfford(cost: Partial<Record<ResourceId, number>>, resources: Record<string, number>): boolean {
  for (const [k, v] of Object.entries(cost)) {
    if ((resources[k] ?? 0) < (v as number)) return false;
  }
  return true;
}
