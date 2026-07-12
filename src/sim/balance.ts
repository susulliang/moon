// ============================================================================
// Balance constants & resource metadata
// ============================================================================

import type { ResourceId } from "./types";

export const TICK_HOURS = 1; // 1 sim-hour per tick
export const TICK_REAL_MS = 1000; // 1 real second per tick at 1x

export const COLONIST_O2_PER_TICK = 0.04;
export const COLONIST_WATER_PER_TICK = 0.03;
export const COLONIST_FOOD_PER_TICK = 0.025;
export const COLONIST_POWER_PER_TICK = 0.05;

export const POP_GROWTH_PER_TICK_PER_SURPLUS = 0.018;
export const POP_GROWTH_MIN_SURPLUS = 4; // need at least 4 surplus O2/water/food/hr to grow

export const WIN_POP = 10000;
export const WIN_MARS_FLIGHTS = 25;
export const WIN_RESEARCH_MILESTONES = 12;

export const RESEARCH_PER_MILESTONE = 100;

export const AUTOSAVE_EVERY_SIM_HOURS = 5;
export const SAVE_KEY = "moonbase.save.v1";

export const LAUNCH_COSTS: Record<string, { fuel: number; components: number; metals: number; buildTime: number }> = {
  satellite:  { fuel: 8,  components: 6,  metals: 4,  buildTime: 6 },
  equipment:  { fuel: 14, components: 14, metals: 8,  buildTime: 12 },
  mars_ship:  { fuel: 40, components: 30, metals: 25, buildTime: 24 },
};

export interface ResourceMeta {
  id: ResourceId;
  label: string;
  abbr: string;
  color: string;
  unit: string;
  icon: string; // lucide icon name
}

export const RESOURCE_META: Record<ResourceId, ResourceMeta> = {
  power:     { id: "power",     label: "Power",        abbr: "PWR", color: "#ffb454", unit: "kW", icon: "Zap" },
  oxygen:    { id: "oxygen",    label: "Oxygen",       abbr: "O2",  color: "#56d4e0", unit: "kg", icon: "Wind" },
  water:     { id: "water",     label: "Water",        abbr: "H2O", color: "#5fa8ff", unit: "L",  icon: "Droplets" },
  food:      { id: "food",      label: "Food",         abbr: "FD",  color: "#7be2a8", unit: "kg", icon: "Salad" },
  ore:       { id: "ore",       label: "Regolith Ore", abbr: "ORE", color: "#b8a98a", unit: "t",  icon: "Mountain" },
  metals:    { id: "metals",    label: "Refined Metal",abbr: "MTL", color: "#c8c8d0", unit: "t",  icon: "Layers" },
  fuel:      { id: "fuel",      label: "Fuel",         abbr: "FUL", color: "#e056a8", unit: "t",  icon: "Flame" },
  components:{ id: "components",label: "Components",   abbr: "CMP", color: "#ffd86b", unit: "u",  icon: "Cpu" },
  research:  { id: "research",  label: "Research",     abbr: "R&D", color: "#a8e0ff", unit: "pt", icon: "FlaskConical" },
  helium3:   { id: "helium3",   label: "Helium-3",     abbr: "He3", color: "#e0c8ff", unit: "g",  icon: "Atom" },
  credits:   { id: "credits",   label: "Credits",      abbr: "CR",  color: "#7be2a8", unit: "cr", icon: "Coins" },
};

export const RESOURCE_ORDER: ResourceId[] = [
  "power", "oxygen", "water", "food", "ore", "metals", "fuel", "components", "research", "helium3", "credits",
];

// Initial stockpile given on new game — generous to let players build freely
export const START_RESOURCES: Record<string, number> = {
  power: 2000,
  oxygen: 800,
  water: 800,
  food: 600,
  ore: 500,
  metals: 500,
  fuel: 200,
  components: 300,
  research: 0,
  helium3: 0,
  credits: 50000,
};

export const START_POPULATION = 24;
