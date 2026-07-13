// ============================================================================
// MOONBASE 2050 — Shared types
// ============================================================================

export type ResourceId =
  | "power"
  | "oxygen"
  | "water"
  | "food"
  | "ore"
  | "metals"
  | "fuel"
  | "components"
  | "research"
  | "helium3";

export type Resources = Partial<Record<ResourceId, number>>;

export type BuildingCategoryId =
  | "power"
  | "habitat"
  | "life"
  | "isru"
  | "mfg"
  | "research"
  | "logistics"
  | "signature";

export type BuildingTypeId =
  // power
  | "nuclear_reactor"
  | "solar_array"
  | "battery_bank"
  // habitat
  | "crew_habitat"
  | "residential_dome"
  | "medical_bay"
  // life support
  | "water_plant"
  | "oxygen_plant"
  | "greenhouse"
  | "waste_recycler"
  // isru / mining
  | "regolith_harvester"
  | "regolith_excavator"
  | "helium3_extractor"
  // manufacturing
  | "fab_bay"
  | "parts_factory"
  | "shipyard"
  // research
  | "research_lab"
  | "observatory"
  | "mars_mission_control"
  // logistics
  | "storage_depot"
  | "landing_pad"
  | "rover_depot"
  | "corridor"
  // signature
  | "rail_launch";

export type BuildingStatus = "construction" | "active" | "disabled" | "damaged";

export interface ModuleDef {
  id: BuildingTypeId;
  category: BuildingCategoryId;
  name: string;
  blurb: string;
  cost: Resources;
  buildTime: number; // sim hours
  size: { w: number; h: number }; // footprint in world units (meters-ish)
  production?: Resources; // per tick when active
  consumption?: Resources; // per tick when active
  housing?: number;
  storage?: Partial<Record<ResourceId, number>>;
  popRequired?: number; // min colonists needed to operate
  prereq?: { pop?: number; researchMilestones?: number };
  maxLevel?: number;
}

export interface BuildingInstance {
  id: string;
  typeId: BuildingTypeId;
  x: number;
  y: number;
  rotation: number;
  level: number;
  status: BuildingStatus;
  constructionProgress: number; // 0..1
}

export type PayloadKind = "satellite" | "equipment" | "mars_ship";

export interface LaunchJob {
  id: string;
  payload: PayloadKind;
  progress: number; // 0..1
  startedAt: number;
}

export interface GameEvent {
  id: string;
  t: number; // sim-time
  kind: "info" | "warn" | "good" | "bad";
  text: string;
}

export type SpeedMode = 0 | 1 | 2 | 4;

export interface TerrainCrater {
  x: number;
  y: number;
  r: number;
  depth: number;
  rimHeight: number;
}

export interface TerrainData {
  size: number;            // grid resolution (e.g., 320)
  cellSize: number;        // world units per cell
  elevations: Float32Array;
  craters: TerrainCrater[];
  sunAzimuth: number;      // radians
  sunElevation: number;    // radians
}
