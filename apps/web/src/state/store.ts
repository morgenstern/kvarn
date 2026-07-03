import { create } from "zustand";
import { fetchWeatherSnapshot, getRoughLocation } from "@kvarn/api-client";
import type { Bean, Brew, Equipment, Product, Recipe, Setup, WeatherSnapshot } from "@kvarn/db";
import { db, ensureSeeded, LOCAL_USER_ID, newId, nowIso } from "../data/db";

interface KvarnState {
  hydrated: boolean;
  products: Product[];
  equipment: Equipment[];
  setups: Setup[];
  beans: Bean[];
  brews: Brew[];
  weatherSnapshots: WeatherSnapshot[];
  recipes: Recipe[];
  activeSetupId: string | null;
  activeBeanId: string | null;

  hydrate: () => Promise<void>;
  addEquipmentFromProduct: (productId: string) => Promise<Equipment>;
  addCustomEquipment: (customName: string) => Promise<Equipment>;
  addSetup: (input: { name: string; method: Setup["method"]; grinderEquipmentId: string }) => Promise<Setup>;
  addBean: (input: {
    roaster: string;
    name: string;
    origin?: string;
    roastDate?: string;
  }) => Promise<Bean>;
  archiveBean: (beanId: string) => Promise<void>;
  setActiveSetup: (setupId: string | null) => void;
  setActiveBean: (beanId: string | null) => void;
  captureWeatherSnapshot: () => Promise<WeatherSnapshot | null>;
  commitBrew: (input: Omit<Brew, "id" | "userId" | "updatedAt" | "deletedAt" | "clientId">) => Promise<Brew>;
}

const RECIPE_CONFIDENCE_TARGET_BREWS = 10;

export const useKvarnStore = create<KvarnState>((set, get) => ({
  hydrated: false,
  products: [],
  equipment: [],
  setups: [],
  beans: [],
  brews: [],
  weatherSnapshots: [],
  recipes: [],
  activeSetupId: null,
  activeBeanId: null,

  hydrate: async () => {
    await ensureSeeded();
    const [products, equipment, setups, beans, brews, weatherSnapshots, recipes] = await Promise.all([
      db.products.toArray(),
      db.equipment.toArray(),
      db.setups.toArray(),
      db.beans.toArray().then((all) => all.filter((b) => !b.archived)),
      db.brews.orderBy("brewedAt").reverse().toArray(),
      db.weatherSnapshots.toArray(),
      db.recipes.toArray(),
    ]);
    set({
      hydrated: true,
      products,
      equipment,
      setups,
      beans,
      brews,
      weatherSnapshots,
      recipes,
      activeSetupId: setups[0]?.id ?? null,
      activeBeanId: beans[0]?.id ?? null,
    });
  },

  addEquipmentFromProduct: async (productId) => {
    const equipment: Equipment = {
      id: newId("equipment"),
      userId: LOCAL_USER_ID,
      productId,
      customName: null,
      notes: null,
      burrKg: null,
      updatedAt: nowIso(),
      deletedAt: null,
      clientId: newId("client"),
    };
    await db.equipment.add(equipment);
    set((s) => ({ equipment: [...s.equipment, equipment] }));
    return equipment;
  },

  addCustomEquipment: async (customName) => {
    const equipment: Equipment = {
      id: newId("equipment"),
      userId: LOCAL_USER_ID,
      productId: null,
      customName,
      notes: null,
      burrKg: null,
      updatedAt: nowIso(),
      deletedAt: null,
      clientId: newId("client"),
    };
    await db.equipment.add(equipment);
    set((s) => ({ equipment: [...s.equipment, equipment] }));
    return equipment;
  },

  addSetup: async ({ name, method, grinderEquipmentId }) => {
    const setup: Setup = {
      id: newId("setup"),
      userId: LOCAL_USER_ID,
      name,
      method,
      grinderEquipmentId,
      machineEquipmentId: null,
      accessoryEquipmentIds: [],
      updatedAt: nowIso(),
      deletedAt: null,
      clientId: newId("client"),
    };
    await db.setups.add(setup);
    set((s) => ({ setups: [...s.setups, setup], activeSetupId: s.activeSetupId ?? setup.id }));
    return setup;
  },

  addBean: async ({ roaster, name, origin, roastDate }) => {
    const bean: Bean = {
      id: newId("bean"),
      userId: LOCAL_USER_ID,
      roaster,
      name,
      origin: origin ?? null,
      variety: null,
      process: null,
      roastLevel: null,
      roastDate: roastDate ?? null,
      openedAt: null,
      photoUrl: null,
      barcode: null,
      archived: false,
      updatedAt: nowIso(),
      deletedAt: null,
      clientId: newId("client"),
    };
    await db.beans.add(bean);
    set((s) => ({ beans: [...s.beans, bean], activeBeanId: s.activeBeanId ?? bean.id }));
    return bean;
  },

  archiveBean: async (beanId) => {
    await db.beans.update(beanId, { archived: true, updatedAt: nowIso() });
    set((s) => ({
      beans: s.beans.filter((b) => b.id !== beanId),
      activeBeanId: s.activeBeanId === beanId ? null : s.activeBeanId,
    }));
  },

  setActiveSetup: (setupId) => set({ activeSetupId: setupId }),
  setActiveBean: (beanId) => set({ activeBeanId: beanId }),

  captureWeatherSnapshot: async () => {
    const location = await getRoughLocation();
    if (!location) return null;
    try {
      const response = await fetchWeatherSnapshot(location.lat, location.lon);
      const snapshot: WeatherSnapshot = {
        id: newId("weather"),
        takenAt: response.takenAt,
        tempC: response.tempC,
        humidityPct: response.humidityPct,
        pressureHpa: response.pressureHpa,
        source: response.source,
        geoCell: response.geoCell,
        updatedAt: nowIso(),
        deletedAt: null,
        clientId: newId("client"),
      };
      await db.weatherSnapshots.add(snapshot);
      set((s) => ({ weatherSnapshots: [...s.weatherSnapshots, snapshot] }));
      return snapshot;
    } catch {
      // Weather is optional context, never a blocker — see docs/02_UX_KONZEPT.md.
      return null;
    }
  },

  commitBrew: async (input) => {
    const brew: Brew = {
      id: newId("brew"),
      userId: LOCAL_USER_ID,
      updatedAt: nowIso(),
      deletedAt: null,
      clientId: newId("client"),
      ...input,
    };
    await db.brews.add(brew);

    const state = get();
    const existingRecipe = state.recipes.find((r) => r.setupId === brew.setupId && r.beanId === brew.beanId);
    const brewCount = (existingRecipe?.brewCount ?? 0) + 1;
    const avgRating = existingRecipe
      ? (existingRecipe.avgRating ?? brew.ratingTotal) * (brewCount - 1) / brewCount + brew.ratingTotal / brewCount
      : brew.ratingTotal;
    const confidence = Math.round(Math.min(1, brewCount / RECIPE_CONFIDENCE_TARGET_BREWS) * 100) / 100;
    const recipe: Recipe = {
      id: existingRecipe?.id ?? newId("recipe"),
      userId: LOCAL_USER_ID,
      setupId: brew.setupId,
      beanId: brew.beanId,
      beanProfile: null,
      params: {
        grindSetting: brew.grindSetting,
        doseG: brew.doseG,
        targetYieldG: brew.targetYieldG,
        waterTempC: brew.waterTempC,
      },
      confidence,
      brewCount,
      avgRating: Math.round(avgRating * 10) / 10,
      updatedAt: nowIso(),
      deletedAt: null,
      clientId: existingRecipe?.clientId ?? newId("client"),
    };
    await db.recipes.put(recipe);

    set((s) => ({
      brews: [brew, ...s.brews],
      recipes: existingRecipe ? s.recipes.map((r) => (r.id === recipe.id ? recipe : r)) : [...s.recipes, recipe],
    }));
    return brew;
  },
}));

export function activeSetup(state: KvarnState): Setup | undefined {
  return state.setups.find((s) => s.id === state.activeSetupId);
}

export function activeBean(state: KvarnState): Bean | undefined {
  return state.beans.find((b) => b.id === state.activeBeanId);
}

export function equipmentProduct(state: KvarnState, equipmentId: string | null): Product | undefined {
  const eq = state.equipment.find((e) => e.id === equipmentId);
  if (!eq?.productId) return undefined;
  return state.products.find((p) => p.id === eq.productId);
}

/** Most recent brew for this exact setup+bean combination, if any. */
export function lastBrewFor(state: KvarnState, setupId: string, beanId: string): Brew | undefined {
  return state.brews.find((b) => b.setupId === setupId && b.beanId === beanId);
}

export function weatherSnapshotFor(state: KvarnState, weatherId: string | null): WeatherSnapshot | undefined {
  if (!weatherId) return undefined;
  return state.weatherSnapshots.find((w) => w.id === weatherId);
}

export function recipeFor(state: KvarnState, setupId: string, beanId: string): Recipe | undefined {
  return state.recipes.find((r) => r.setupId === setupId && r.beanId === beanId);
}
