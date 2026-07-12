// ============================================================================
// Zustand game store — single source of truth for game state
// ============================================================================

import { create } from "zustand";
import type {
  BuildingInstance,
  BuildingTypeId,
  GameEvent,
  LaunchJob,
  PayloadKind,
  ResourceId,
  SpeedMode,
  TerrainData,
} from "@/sim/types";
import {
  AUTOSAVE_EVERY_SIM_HOURS,
  LAUNCH_COSTS,
  SAVE_KEY,
  START_POPULATION,
  START_RESOURCES,
} from "@/sim/balance";
import { generateTerrain } from "@/terrain/generator";
import { MODULE_CATALOG } from "@/buildings/catalog";
import { canPlaceAt } from "@/buildings/placement";
import { canAfford, earthResupply, isPrereqMet, rid, simulateTick, type TickInputs } from "@/sim/tick";
import { makeSeedFromTime } from "@/sim/random";
import type { Camera } from "@/utils/geometry";

export const WORLD_EXTENT = 4000; // meters

interface GameState {
  // World / terrain
  seed: number;
  terrain: TerrainData | null;
  // Time
  simTime: number;          // sim hours since start
  speed: SpeedMode;
  paused: boolean;
  researchAccrued: number;

  // Resources
  resources: Record<string, number>;
  rates: Record<string, number>;
  storageCapacity: Record<string, number>;

  // Population
  population: number;
  housingCapacity: number;

  // Buildings
  buildings: BuildingInstance[];
  selectedBuildingId: string | null;
  placement: { typeId: BuildingTypeId } | null;

  // Rail launches
  launchQueue: LaunchJob[];
  marsFlightsCompleted: number;
  researchMilestonesCompleted: number;

  // Events
  events: GameEvent[];

  // Win
  win: boolean;

  // Camera (separate from store updates because it changes a lot; but kept here for simplicity)
  camera: Camera;
  showIntro: boolean;

  // === Actions ===
  initNew: () => void;
  initFromSave: (data: any) => void;
  setSpeed: (s: SpeedMode) => void;
  togglePause: () => void;
  advanceTick: () => void;

  startPlacement: (typeId: BuildingTypeId) => void;
  cancelPlacement: () => void;
  commitPlacement: (x: number, y: number) => { ok: boolean; reason?: string };
  canPlacePreview: (x: number, y: number) => { ok: boolean; reason?: string };

  selectBuilding: (id: string | null) => void;
  upgradeBuilding: (id: string) => void;
  dismantleBuilding: (id: string) => void;

  queueLaunch: (payload: PayloadKind) => { ok: boolean; reason?: string };

  setCamera: (c: Partial<Camera>) => void;
  setShowIntro: (v: boolean) => void;

  autosaveIfNeeded: () => void;
  saveGame: () => void;
  loadGame: () => boolean;
  lastAutosaveSimTime: number;
}

const DEFAULT_CAMERA: Camera = { x: 0, y: 0, zoom: 0.7 };

function makeInitialBuildings(seed: number): BuildingInstance[] {
  // Pre-seed: 1 nuclear reactor, 1 crew habitat, 1 greenhouse, 1 oxygen plant, 1 water plant,
  // 1 regolith harvester, 1 fab bay, 1 storage depot, 1 rail launch system
  const layout: { typeId: BuildingTypeId; x: number; y: number; rotation: number }[] = [
    { typeId: "nuclear_reactor",     x: -120, y: -60,  rotation: 0 },
    { typeId: "crew_habitat",         x: 0,    y: -60,  rotation: 0 },
    { typeId: "greenhouse",           x: 120,  y: -60,  rotation: 0 },
    { typeId: "oxygen_plant",         x: -60,  y: 40,   rotation: 0 },
    { typeId: "water_plant",          x: 60,   y: 40,   rotation: 0 },
    { typeId: "regolith_harvester",   x: -180, y: 80,   rotation: 0 },
    { typeId: "fab_bay",              x: 180,  y: 80,   rotation: 0 },
    { typeId: "storage_depot",        x: 0,    y: 100,  rotation: 0 },
    { typeId: "rail_launch",          x: 0,    y: 220,  rotation: 0 },
  ];
  return layout.map((l) => ({
    id: rid(),
    typeId: l.typeId,
    x: l.x,
    y: l.y,
    rotation: l.rotation,
    level: 1,
    status: "active",
    constructionProgress: 1,
  }));
}

export const useGameStore = create<GameState>((set, get) => ({
  seed: 0,
  terrain: null,
  simTime: 0,
  speed: 1,
  paused: false,
  researchAccrued: 0,

  resources: { ...START_RESOURCES },
  rates: {},
  storageCapacity: { ore: 200, metals: 200, fuel: 100, components: 100, helium3: 50, power: 200 },

  population: START_POPULATION,
  housingCapacity: 8,

  buildings: [],
  selectedBuildingId: null,
  placement: null,

  launchQueue: [],
  marsFlightsCompleted: 0,
  researchMilestonesCompleted: 0,

  events: [],
  win: false,

  camera: DEFAULT_CAMERA,
  showIntro: true,
  lastAutosaveSimTime: 0,

  initNew: () => {
    const seed = makeSeedFromTime();
    const terrain = generateTerrain({ seed, size: 320, worldExtent: WORLD_EXTENT });
    const buildings = makeInitialBuildings(seed);
    set({
      seed,
      terrain,
      simTime: 0,
      speed: 1,
      paused: false,
      researchAccrued: 0,
      resources: { ...START_RESOURCES },
      rates: {},
      storageCapacity: { ore: 200, metals: 200, fuel: 100, components: 100, helium3: 50, power: 200 },
      population: START_POPULATION,
      housingCapacity: 8,
      buildings,
      selectedBuildingId: null,
      placement: null,
      launchQueue: [],
      marsFlightsCompleted: 0,
      researchMilestonesCompleted: 0,
      events: [
        {
          id: rid(),
          t: 0,
          kind: "info" as const,
          text: "MOONBASE 2050 // Initial colony established. ISRU + SpaceX operational.",
        },
      ],
      win: false,
      camera: DEFAULT_CAMERA,
      showIntro: true,
      lastAutosaveSimTime: 0,
    });
  },

  initFromSave: (data: any) => {
    const seed = data.seed ?? makeSeedFromTime();
    const terrain = generateTerrain({ seed, size: 320, worldExtent: WORLD_EXTENT });
    set({
      seed,
      terrain,
      simTime: data.simTime ?? 0,
      speed: 1,
      paused: false,
      researchAccrued: data.researchAccrued ?? 0,
      resources: data.resources ?? { ...START_RESOURCES },
      rates: {},
      storageCapacity: data.storageCapacity ?? { ore: 200, metals: 200, fuel: 100, components: 100, helium3: 50, power: 200 },
      population: data.population ?? START_POPULATION,
      housingCapacity: data.housingCapacity ?? 8,
      buildings: data.buildings ?? [],
      selectedBuildingId: null,
      placement: null,
      launchQueue: data.launchQueue ?? [],
      marsFlightsCompleted: data.marsFlightsCompleted ?? 0,
      researchMilestonesCompleted: data.researchMilestonesCompleted ?? 0,
      events: data.events ?? [],
      win: data.win ?? false,
      camera: data.camera ?? DEFAULT_CAMERA,
      showIntro: false,
      lastAutosaveSimTime: data.simTime ?? 0,
    });
  },

  setSpeed: (s) => set({ speed: s, paused: s === 0 }),
  togglePause: () => set((st) => ({ paused: !st.paused, speed: st.paused ? 1 : 0 })),

  advanceTick: () => {
    const st = get();
    if (st.paused || st.speed === 0 || st.win) return;
    if (!st.terrain) return;

    // Run `speed` ticks per real-frame? No: the game loop calls advanceTick at speed-adjusted rate.
    // Here we do ONE tick.
    const roverDepotCount = st.buildings.filter(
      (b) => b.typeId === "rover_depot" && b.status === "active",
    ).length;
    const landingPadCount = st.buildings.filter(
      (b) => b.typeId === "landing_pad" && b.status === "active",
    ).length;

    const inputs: TickInputs = {
      simTime: st.simTime,
      resources: st.resources,
      population: st.population,
      buildings: st.buildings,
      launchQueue: st.launchQueue,
      marsFlightsCompleted: st.marsFlightsCompleted,
      researchMilestonesCompleted: st.researchMilestonesCompleted,
      roverDepotCount,
      landingPadCount,
    };

    const { result, newResearchAccrued } = simulateTick(inputs, st.events, st.researchAccrued);

    // Earth resupply every 24 sim hours if any landing pad exists
    let resources = result.resources;
    if (landingPadCount > 0 && (st.simTime + 1) % 24 === 0) {
      const sup = earthResupply(landingPadCount);
      resources = {
        ...resources,
        credits: (resources.credits ?? 0) + sup.credits,
        metals: (resources.metals ?? 0) + sup.metals,
        components: (resources.components ?? 0) + sup.components,
        food: (resources.food ?? 0) + sup.food,
      };
      result.events = [
        ...result.events,
        {
          id: rid(),
          t: st.simTime + 1,
          kind: "info" as const,
          text: `Earth resupply landed (+${sup.credits} cr, +${sup.metals} mtl, +${sup.components} cmp, +${sup.food} fd)`,
        },
      ].slice(-40);
    }

    set({
      simTime: st.simTime + 1,
      resources,
      rates: result.rates,
      storageCapacity: result.storageCapacity,
      population: Math.max(0, st.population + result.populationDelta),
      housingCapacity: result.housingCapacity,
      buildings: result.buildings,
      launchQueue: result.launchQueue,
      marsFlightsCompleted: result.marsFlightsCompleted,
      researchMilestonesCompleted: result.researchMilestonesCompleted,
      researchAccrued: newResearchAccrued,
      events: result.events,
      win: result.win,
    });
  },

  startPlacement: (typeId) => {
    const st = get();
    const def = MODULE_CATALOG[typeId];
    if (!isPrereqMet(def.prereq, st.population, st.researchMilestonesCompleted)) {
      set({
        events: [
          ...st.events,
          { id: rid(), t: st.simTime, kind: "warn" as const, text: `${def.name}: prereqs not met` },
        ].slice(-40),
      });
      return;
    }
    set({ placement: { typeId }, selectedBuildingId: null });
  },
  cancelPlacement: () => set({ placement: null }),

  canPlacePreview: (x, y) => {
    const st = get();
    if (!st.terrain || !st.placement) return { ok: false };
    const def = MODULE_CATALOG[st.placement.typeId];
    return canPlaceAt(x, y, def, st.buildings, st.terrain, WORLD_EXTENT);
  },

  commitPlacement: (x, y) => {
    const st = get();
    if (!st.terrain || !st.placement) return { ok: false, reason: "No placement active" };
    const def = MODULE_CATALOG[st.placement.typeId];

    if (!isPrereqMet(def.prereq, st.population, st.researchMilestonesCompleted)) {
      return { ok: false, reason: "Prereqs not met" };
    }
    if (!canAfford(def.cost as any, st.resources)) {
      return { ok: false, reason: "Insufficient resources" };
    }
    const place = canPlaceAt(x, y, def, st.buildings, st.terrain, WORLD_EXTENT);
    if (!place.ok) return place;

    // Deduct cost, add building under construction
    const newResources: Record<string, number> = { ...st.resources };
    for (const [k, v] of Object.entries(def.cost)) {
      newResources[k] = (newResources[k] ?? 0) - (v as number);
    }
    const newBuilding: BuildingInstance = {
      id: rid(),
      typeId: st.placement.typeId,
      x,
      y,
      rotation: 0,
      level: 1,
      status: "construction",
      constructionProgress: 0,
    };
    set({
      resources: newResources,
      buildings: [...st.buildings, newBuilding],
      events: [
        ...st.events,
        { id: rid(), t: st.simTime, kind: "info" as const, text: `${def.name} construction started` },
      ].slice(-40),
      placement: null,
    });
    return { ok: true };
  },

  selectBuilding: (id) => set({ selectedBuildingId: id, placement: null }),
  upgradeBuilding: (id) => {
    const st = get();
    const b = st.buildings.find((x) => x.id === id);
    if (!b) return;
    const def = MODULE_CATALOG[b.typeId];
    if (def.maxLevel != null && b.level >= def.maxLevel) return;
    // upgrade cost = 70% of base cost
    const upCost: Record<string, number> = {};
    for (const [k, v] of Object.entries(def.cost)) {
      upCost[k] = Math.ceil((v as number) * 0.7);
    }
    if (!canAfford(upCost as any, st.resources)) {
      set({
        events: [
          ...st.events,
          { id: rid(), t: st.simTime, kind: "warn" as const, text: `Upgrade failed: insufficient resources` },
        ].slice(-40),
      });
      return;
    }
    const newResources: Record<string, number> = { ...st.resources };
    for (const [k, v] of Object.entries(upCost)) {
      newResources[k] = (newResources[k] ?? 0) - v;
    }
    set({
      resources: newResources,
      buildings: st.buildings.map((x) =>
        x.id === id ? { ...x, level: x.level + 1 } : x,
      ),
      events: [
        ...st.events,
        { id: rid(), t: st.simTime, kind: "good" as const, text: `${def.name} upgraded to L${b.level + 1}` },
      ].slice(-40),
    });
  },
  dismantleBuilding: (id) => {
    const st = get();
    const b = st.buildings.find((x) => x.id === id);
    if (!b) return;
    // refund 40%
    const def = MODULE_CATALOG[b.typeId];
    const newResources: Record<string, number> = { ...st.resources };
    for (const [k, v] of Object.entries(def.cost)) {
      newResources[k] = (newResources[k] ?? 0) + Math.floor((v as number) * 0.4);
    }
    set({
      resources: newResources,
      buildings: st.buildings.filter((x) => x.id !== id),
      selectedBuildingId: null,
      events: [
        ...st.events,
        { id: rid(), t: st.simTime, kind: "warn" as const, text: `${def.name} dismantled (40% refunded)` },
      ].slice(-40),
    });
  },

  queueLaunch: (payload) => {
    const st = get();
    const cost = LAUNCH_COSTS[payload];
    const need: Partial<Record<ResourceId, number>> = {
      fuel: cost.fuel,
      components: cost.components,
      metals: cost.metals,
    };
    if (!canAfford(need, st.resources)) {
      return { ok: false, reason: "Insufficient resources" };
    }
    // Must have an active rail_launch
    const hasRail = st.buildings.some((b) => b.typeId === "rail_launch" && b.status === "active");
    if (!hasRail) return { ok: false, reason: "No active Rail Launch System" };

    const newResources: Record<string, number> = { ...st.resources };
    for (const [k, v] of Object.entries(need)) {
      newResources[k] = (newResources[k] ?? 0) - (v as number);
    }
    const job: LaunchJob = {
      id: rid(),
      payload,
      progress: 0,
      startedAt: st.simTime,
    };
    set({
      resources: newResources,
      launchQueue: [...st.launchQueue, job],
      events: [
        ...st.events,
        { id: rid(), t: st.simTime, kind: "info" as const, text: `${payload.replace("_", " ")} launch queued` },
      ].slice(-40),
    });
    return { ok: true };
  },

  setCamera: (c) => set((st) => ({ camera: { ...st.camera, ...c } })),
  setShowIntro: (v) => set({ showIntro: v }),

  autosaveIfNeeded: () => {
    const st = get();
    if (st.simTime - st.lastAutosaveSimTime >= AUTOSAVE_EVERY_SIM_HOURS) {
      get().saveGame();
      set({ lastAutosaveSimTime: st.simTime });
    }
  },

  saveGame: () => {
    const st = get();
    const data = {
      seed: st.seed,
      simTime: st.simTime,
      researchAccrued: st.researchAccrued,
      resources: st.resources,
      storageCapacity: st.storageCapacity,
      population: st.population,
      housingCapacity: st.housingCapacity,
      buildings: st.buildings,
      launchQueue: st.launchQueue,
      marsFlightsCompleted: st.marsFlightsCompleted,
      researchMilestonesCompleted: st.researchMilestonesCompleted,
      events: st.events,
      win: st.win,
      camera: st.camera,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      // ignore quota errors
      void e;
    }
  },

  loadGame: () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      get().initFromSave(data);
      return true;
    } catch (e) {
      void e;
      return false;
    }
  },
}));

// === Selectors ===
export function useHudVitals() {
  return useGameStore((s) => ({
    resources: s.resources,
    rates: s.rates,
    population: s.population,
    housingCapacity: s.housingCapacity,
    storageCapacity: s.storageCapacity,
  }));
}

export function useGoals() {
  return useGameStore((s) => ({
    population: s.population,
    marsFlights: s.marsFlightsCompleted,
    researchMilestones: s.researchMilestonesCompleted,
    win: s.win,
  }));
}
