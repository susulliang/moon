// ============================================================================
// Building catalog — module definitions, costs, production, prereqs
// All building sizes are multiples of GRID_SIZE (40) and square (n x n).
// Only rail_launch is 1 x n (long thin).
// ============================================================================

import type { ModuleDef, BuildingTypeId, BuildingCategoryId } from "@/sim/types";
import { GRID_SIZE } from "@/utils/geometry";

function grid(n: number): { w: number; h: number } {
  return { w: n * GRID_SIZE, h: n * GRID_SIZE };
}

export const MODULE_CATALOG: Record<BuildingTypeId, ModuleDef> = {
  // ===================== POWER =====================
  nuclear_reactor: {
    id: "nuclear_reactor",
    category: "power",
    name: "Fission Reactor",
    blurb: "Kilopower-class reactor. Baseline power day and night.",
    cost: { metals: 30, components: 20, credits: 800 },
    buildTime: 8,
    size: grid(2),
    production: { power: 90 },
    popRequired: 2,
    maxLevel: 4,
  },
  solar_array: {
    id: "solar_array",
    category: "power",
    name: "Solar Array",
    blurb: "Cheap, expandable. Generates power during the lunar day.",
    cost: { metals: 12, components: 8, credits: 250 },
    buildTime: 3,
    size: grid(2),
    production: { power: 35 },
    popRequired: 1,
    maxLevel: 3,
  },
  battery_bank: {
    id: "battery_bank",
    category: "power",
    name: "Battery Bank",
    blurb: "Buffers surplus power for night-side operations.",
    cost: { metals: 10, components: 14, credits: 300 },
    buildTime: 2,
    size: grid(1),
    storage: { power: 400 },
    popRequired: 0,
    maxLevel: 3,
  },

  // ===================== HABITAT =====================
  crew_habitat: {
    id: "crew_habitat",
    category: "habitat",
    name: "Crew Habitat",
    blurb: "Inflatable module housing 8 colonists.",
    cost: { metals: 14, components: 12, credits: 400 },
    buildTime: 4,
    size: grid(1),
    housing: 8,
    consumption: { power: 4, oxygen: 0.3, water: 0.2 },
    maxLevel: 3,
  },
  residential_dome: {
    id: "residential_dome",
    category: "habitat",
    name: "Residential Dome",
    blurb: "Pressurized dome housing 60 colonists.",
    cost: { metals: 60, components: 40, credits: 1800 },
    buildTime: 14,
    size: grid(3),
    housing: 60,
    consumption: { power: 20, oxygen: 2, water: 1.5 },
    prereq: { pop: 100 },
    maxLevel: 3,
  },
  medical_bay: {
    id: "medical_bay",
    category: "habitat",
    name: "Medical Bay",
    blurb: "Boosts population growth rate by improving survivability.",
    cost: { metals: 18, components: 22, credits: 900 },
    buildTime: 6,
    size: grid(1),
    consumption: { power: 8, oxygen: 0.5 },
    popRequired: 6,
    prereq: { pop: 50 },
  },

  // ===================== LIFE SUPPORT =====================
  water_plant: {
    id: "water_plant",
    category: "life",
    name: "Water Plant",
    blurb: "Extracts water from icy regolith.",
    cost: { metals: 16, components: 14, credits: 500 },
    buildTime: 4,
    size: grid(1),
    production: { water: 6 },
    consumption: { power: 10, ore: 1 },
    popRequired: 2,
    maxLevel: 4,
  },
  oxygen_plant: {
    id: "oxygen_plant",
    category: "life",
    name: "Oxygen Plant",
    blurb: "Electrolyzes regolith to produce oxygen.",
    cost: { metals: 14, components: 12, credits: 450 },
    buildTime: 4,
    size: grid(1),
    production: { oxygen: 8 },
    consumption: { power: 12, ore: 1 },
    popRequired: 2,
    maxLevel: 4,
  },
  greenhouse: {
    id: "greenhouse",
    category: "life",
    name: "Greenhouse",
    blurb: "Grow food crops; produces small oxygen byproduct.",
    cost: { metals: 18, components: 16, credits: 600 },
    buildTime: 5,
    size: grid(2),
    production: { food: 4, oxygen: 1 },
    consumption: { power: 8, water: 2 },
    popRequired: 2,
    maxLevel: 4,
  },
  waste_recycler: {
    id: "waste_recycler",
    category: "life",
    name: "Waste Recycler",
    blurb: "Closes the life-support loop, reducing input demand.",
    cost: { metals: 12, components: 18, credits: 550 },
    buildTime: 4,
    size: grid(1),
    production: { water: 2, oxygen: 1 },
    consumption: { power: 6 },
    popRequired: 2,
    prereq: { pop: 80 },
  },

  // ===================== ISRU / MINING =====================
  regolith_harvester: {
    id: "regolith_harvester",
    category: "isru",
    name: "Regolith Harvester",
    blurb: "Surface scraper extracting ore from regolith.",
    cost: { metals: 14, components: 10, credits: 350 },
    buildTime: 3,
    size: grid(1),
    production: { ore: 5 },
    consumption: { power: 6 },
    popRequired: 1,
    maxLevel: 4,
  },
  regolith_excavator: {
    id: "regolith_excavator",
    category: "isru",
    name: "Regolith Excavator",
    blurb: "Deep bore excavator. Higher yield, higher power draw.",
    cost: { metals: 30, components: 22, credits: 900 },
    buildTime: 7,
    size: grid(2),
    production: { ore: 14, helium3: 0.04 },
    consumption: { power: 18 },
    popRequired: 4,
    prereq: { pop: 200 },
    maxLevel: 3,
  },
  helium3_extractor: {
    id: "helium3_extractor",
    category: "isru",
    name: "Helium-3 Extractor",
    blurb: "Refines He-3 from regolith. Critical for advanced research.",
    cost: { metals: 40, components: 35, credits: 1500 },
    buildTime: 9,
    size: grid(1),
    production: { helium3: 0.5 },
    consumption: { power: 20, ore: 6 },
    popRequired: 6,
    prereq: { researchMilestones: 3 },
    maxLevel: 3,
  },

  // ===================== MANUFACTURING =====================
  fab_bay: {
    id: "fab_bay",
    category: "mfg",
    name: "Fabrication Bay",
    blurb: "Smelts ore into refined metals.",
    cost: { metals: 18, components: 16, credits: 600 },
    buildTime: 5,
    size: grid(2),
    production: { metals: 4 },
    consumption: { power: 14, ore: 8 },
    popRequired: 3,
    maxLevel: 4,
  },
  parts_factory: {
    id: "parts_factory",
    category: "mfg",
    name: "Parts Factory",
    blurb: "Refines metals into machine components.",
    cost: { metals: 30, components: 20, credits: 1000 },
    buildTime: 7,
    size: grid(2),
    production: { components: 5 },
    consumption: { power: 16, metals: 6 },
    popRequired: 5,
    prereq: { pop: 100 },
    maxLevel: 4,
  },
  shipyard: {
    id: "shipyard",
    category: "mfg",
    name: "Shipyard",
    blurb: "Manufactures Mars-bound ship components and fuel cells.",
    cost: { metals: 80, components: 50, credits: 3000 },
    buildTime: 16,
    size: grid(3),
    production: { fuel: 4, components: 2 },
    consumption: { power: 30, metals: 10 },
    popRequired: 12,
    prereq: { researchMilestones: 4, pop: 500 },
    maxLevel: 3,
  },

  // ===================== RESEARCH =====================
  research_lab: {
    id: "research_lab",
    category: "research",
    name: "Research Lab",
    blurb: "Generates research points. Unlocks advanced modules.",
    cost: { metals: 20, components: 24, credits: 1000 },
    buildTime: 6,
    size: grid(1),
    production: { research: 1.5 },
    consumption: { power: 12 },
    popRequired: 4,
    maxLevel: 4,
  },
  observatory: {
    id: "observatory",
    category: "research",
    name: "Observatory",
    blurb: "Deep-space observation. Boosts research and logistics scanning.",
    cost: { metals: 30, components: 30, credits: 1400 },
    buildTime: 8,
    size: grid(2),
    production: { research: 2 },
    consumption: { power: 10 },
    popRequired: 4,
    prereq: { researchMilestones: 1 },
    maxLevel: 3,
  },
  mars_mission_control: {
    id: "mars_mission_control",
    category: "research",
    name: "Mars Mission Control",
    blurb: "Coordinates Mars flights. Boosts rail launch throughput.",
    cost: { metals: 60, components: 60, credits: 4000 },
    buildTime: 14,
    size: grid(2),
    production: { research: 1.5 },
    consumption: { power: 20 },
    popRequired: 10,
    prereq: { researchMilestones: 5, pop: 800 },
    maxLevel: 2,
  },

  // ===================== LOGISTICS =====================
  storage_depot: {
    id: "storage_depot",
    category: "logistics",
    name: "Storage Depot",
    blurb: "Increases storage capacity for ore, metals, fuel, components.",
    cost: { metals: 14, components: 8, credits: 300 },
    buildTime: 3,
    size: grid(1),
    storage: { ore: 200, metals: 200, fuel: 100, components: 100, helium3: 50 },
    popRequired: 0,
    maxLevel: 4,
  },
  landing_pad: {
    id: "landing_pad",
    category: "logistics",
    name: "Landing Pad",
    blurb: "Receives Earth resupply landings. Periodic credit + supplies.",
    cost: { metals: 24, components: 12, credits: 700 },
    buildTime: 5,
    size: grid(2),
    popRequired: 2,
    maxLevel: 2,
  },
  rover_depot: {
    id: "rover_depot",
    category: "logistics",
    name: "Rover Depot",
    blurb: "Boosts intra-base logistics efficiency (+5% mining & mfg).",
    cost: { metals: 18, components: 14, credits: 500 },
    buildTime: 4,
    size: grid(1),
    popRequired: 2,
    maxLevel: 3,
  },
  corridor: {
    id: "corridor",
    category: "logistics",
    name: "Corridor",
    blurb: "Pressurized walkway connecting modules for crew movement.",
    cost: { metals: 4, credits: 80 },
    buildTime: 1,
    size: grid(1),
    popRequired: 0,
    maxLevel: 1,
  },

  // ===================== SIGNATURE =====================
  rail_launch: {
    id: "rail_launch",
    category: "signature",
    name: "Rail Launch System",
    blurb: "Electromagnetic mass driver. Launches payloads to orbit / Mars.",
    cost: { metals: 120, components: 80, credits: 6000 },
    buildTime: 18,
    size: { w: GRID_SIZE, h: GRID_SIZE * 7 }, // 1 x 7 grid (long thin)
    production: {},
    consumption: { power: 40 },
    popRequired: 8,
    maxLevel: 2,
  },
};

export const CATEGORY_ORDER: BuildingCategoryId[] = [
  "power", "habitat", "life", "isru", "mfg", "research", "logistics", "signature",
];

export const CATEGORY_LABELS: Record<BuildingCategoryId, string> = {
  power: "Power",
  habitat: "Habitat",
  life: "Life",
  isru: "Mining",
  mfg: "Mfg",
  research: "R&D",
  logistics: "Logistics",
  signature: "Signature",
};

export function getModulesByCategory(cat: BuildingCategoryId): ModuleDef[] {
  return Object.values(MODULE_CATALOG).filter((m) => m.category === cat);
}

/** Category-level color — mostly greyscale. */
export function categoryColor(category: BuildingCategoryId): string {
  switch (category) {
    case "power":     return "#9aa4b0";
    case "habitat":   return "#b0a89c";
    case "life":      return "#8a94a0";
    case "isru":      return "#a89a82";
    case "mfg":       return "#8a9098";
    case "research":  return "#889aaa";
    case "logistics": return "#a0988a";
    case "signature": return "#8a94a8";
  }
}

/**
 * Per-building color. Mostly greyscale with specific accents:
 *  - oxygen_plant → blue
 *  - greenhouse   → green (plants/food)
 *  - rail_launch   → steel
 *  - corridor      → light steel
 */
export function moduleColor(typeId: BuildingTypeId): string {
  switch (typeId) {
    case "oxygen_plant":  return "#56d4e0";
    case "greenhouse":    return "#7be2a8";
    case "rail_launch":   return "#8a94a8";
    case "corridor":      return "#9aa4b0";
    default: {
      const def = MODULE_CATALOG[typeId];
      return def ? categoryColor(def.category) : "#9aa4b0";
    }
  }
}
