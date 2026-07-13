import { create } from "zustand";
import { fetchWeatherSnapshot, getRoughLocation } from "@kvarn/api-client";
import { formatClickParts } from "@kvarn/core";
import type { Bean, Brew, Equipment, Product, Recipe, Setup, WeatherSnapshot } from "@kvarn/db";
import { db, ensureSeeded, LOCAL_USER_ID, newId, nowIso, syncApprovedProducts } from "../data/db";
import { LAST_SYNCED_KEY } from "../sync/constants";

export type GrindScaleValue = NonNullable<Product["grindScale"]>;

export const DEFAULT_GRIND_SCALE: GrindScaleValue = {
  min: 0,
  max: 40,
  step: 0.5,
  unit: "clicks",
  label: "",
  finerDirection: -1,
  subclicksEnabled: false,
};

export interface KvarnState {
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
  lastSyncedAt: string | null;

  hydrate: () => Promise<void>;
  addEquipmentFromProduct: (productId: string, photoUrl?: string) => Promise<Equipment>;
  addCustomEquipment: (
    customName: string,
    kind: Exclude<Product["kind"], "bean">,
    photoUrl?: string,
    grindScale?: GrindScaleValue | null,
  ) => Promise<Equipment>;
  setEquipmentGrindScale: (equipmentId: string, grindScale: GrindScaleValue) => Promise<void>;
  setEquipmentCustomName: (equipmentId: string, customName: string | null) => Promise<void>;
  /** Throws EQUIPMENT_IN_USE if a setup still requires this equipment as its
   * (non-optional) grinder — callers should catch and surface that. Clears
   * the equipment from any setup's optional machine/accessory slots instead
   * of blocking, since those are safe to just unset. */
  deleteEquipment: (equipmentId: string) => Promise<void>;
  addSetup: (input: {
    name: string;
    method: Setup["method"];
    grinderEquipmentId: string;
    machineEquipmentId?: string | null;
    beanId?: string | null;
  }) => Promise<Setup>;
  /** Reuses a setup with the same grinder+machine+method combo if one exists, else creates it. */
  findOrCreateSetup: (input: {
    method: Setup["method"];
    grinderEquipmentId: string;
    machineEquipmentId?: string | null;
    beanId?: string | null;
  }) => Promise<Setup>;
  addBean: (input: {
    roaster: string;
    name: string;
    origin?: string;
    roastDate?: string;
    photoUrl?: string;
  }) => Promise<Bean>;
  archiveBean: (beanId: string) => Promise<void>;
  setEquipmentPhoto: (equipmentId: string, photoUrl: string) => Promise<void>;
  setEquipmentImage: (equipmentId: string, imageUrl: string) => Promise<void>;
  setBeanImage: (beanId: string, imageUrl: string) => Promise<void>;
  setActiveSetup: (setupId: string | null) => void;
  setActiveBean: (beanId: string | null) => void;
  setLastSyncedAt: (value: string | null) => void;
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
  // Not imported from ../sync/runSync — that module also imports
  // ../auth/client, which calls window.location.origin at top level and
  // would crash when store.ts is imported in the Node vitest environment.
  lastSyncedAt: localStorage.getItem(LAST_SYNCED_KEY),

  hydrate: async () => {
    await ensureSeeded();
    await syncApprovedProducts();
    const [products, equipment, setups, beans, brews, weatherSnapshots, recipes] = await Promise.all([
      db.products.toArray(),
      db.equipment.toArray().then((all) => all.filter((e) => !e.deletedAt)),
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

  addEquipmentFromProduct: async (productId, photoUrl) => {
    const product = get().products.find((p) => p.id === productId);
    const equipment: Equipment = {
      id: newId("equipment"),
      userId: LOCAL_USER_ID,
      productId,
      customName: null,
      kind: product && product.kind !== "bean" ? product.kind : null,
      notes: null,
      burrKg: null,
      grindScale: null,
      photoUrl: photoUrl ?? null,
      imageUrl: null,
      updatedAt: nowIso(),
      deletedAt: null,
      clientId: newId("client"),
    };
    await db.equipment.add(equipment);
    set((s) => ({ equipment: [...s.equipment, equipment] }));
    return equipment;
  },

  addCustomEquipment: async (customName, kind, photoUrl, grindScale) => {
    const equipment: Equipment = {
      id: newId("equipment"),
      userId: LOCAL_USER_ID,
      productId: null,
      customName,
      kind,
      notes: null,
      burrKg: null,
      grindScale: grindScale ?? null,
      photoUrl: photoUrl ?? null,
      imageUrl: null,
      updatedAt: nowIso(),
      deletedAt: null,
      clientId: newId("client"),
    };
    await db.equipment.add(equipment);
    set((s) => ({ equipment: [...s.equipment, equipment] }));
    return equipment;
  },

  setEquipmentGrindScale: async (equipmentId, grindScale) => {
    await db.equipment.update(equipmentId, { grindScale, updatedAt: nowIso() });
    set((s) => ({ equipment: s.equipment.map((e) => (e.id === equipmentId ? { ...e, grindScale } : e)) }));
  },

  setEquipmentCustomName: async (equipmentId, customName) => {
    await db.equipment.update(equipmentId, { customName, updatedAt: nowIso() });
    set((s) => ({ equipment: s.equipment.map((e) => (e.id === equipmentId ? { ...e, customName } : e)) }));
  },

  deleteEquipment: async (equipmentId) => {
    const state = get();
    const requiredBy = state.setups.filter((s) => s.grinderEquipmentId === equipmentId);
    if (requiredBy.length > 0) {
      throw new Error("EQUIPMENT_IN_USE");
    }

    const affectedSetups = state.setups.filter(
      (s) => s.machineEquipmentId === equipmentId || (s.accessoryEquipmentIds ?? []).includes(equipmentId),
    );
    await Promise.all(
      affectedSetups.map((s) =>
        db.setups.update(s.id, {
          machineEquipmentId: s.machineEquipmentId === equipmentId ? null : s.machineEquipmentId,
          accessoryEquipmentIds: (s.accessoryEquipmentIds ?? []).filter((id) => id !== equipmentId),
          updatedAt: nowIso(),
        }),
      ),
    );
    await db.equipment.update(equipmentId, { deletedAt: nowIso(), updatedAt: nowIso() });

    set((s) => ({
      equipment: s.equipment.filter((e) => e.id !== equipmentId),
      setups: s.setups.map((s2) =>
        s2.machineEquipmentId === equipmentId || (s2.accessoryEquipmentIds ?? []).includes(equipmentId)
          ? {
              ...s2,
              machineEquipmentId: s2.machineEquipmentId === equipmentId ? null : s2.machineEquipmentId,
              accessoryEquipmentIds: (s2.accessoryEquipmentIds ?? []).filter((id) => id !== equipmentId),
            }
          : s2,
      ),
    }));
  },

  addSetup: async ({ name, method, grinderEquipmentId, machineEquipmentId, beanId }) => {
    const setup: Setup = {
      id: newId("setup"),
      userId: LOCAL_USER_ID,
      name,
      method,
      grinderEquipmentId,
      machineEquipmentId: machineEquipmentId ?? null,
      beanId: beanId ?? null,
      accessoryEquipmentIds: [],
      updatedAt: nowIso(),
      deletedAt: null,
      clientId: newId("client"),
    };
    await db.setups.add(setup);
    set((s) => ({ setups: [...s.setups, setup], activeSetupId: s.activeSetupId ?? setup.id }));
    return setup;
  },

  findOrCreateSetup: async ({ method, grinderEquipmentId, machineEquipmentId, beanId }) => {
    const normalizedMachineId = machineEquipmentId ?? null;
    const existing = get().setups.find(
      (s) =>
        s.method === method &&
        s.grinderEquipmentId === grinderEquipmentId &&
        (s.machineEquipmentId ?? null) === normalizedMachineId,
    );
    if (existing) return existing;
    return get().addSetup({ name: method, method, grinderEquipmentId, machineEquipmentId: normalizedMachineId, beanId });
  },

  addBean: async ({ roaster, name, origin, roastDate, photoUrl }) => {
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
      photoUrl: photoUrl ?? null,
      imageUrl: null,
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

  setEquipmentPhoto: async (equipmentId, photoUrl) => {
    await db.equipment.update(equipmentId, { photoUrl, updatedAt: nowIso() });
    set((s) => ({ equipment: s.equipment.map((e) => (e.id === equipmentId ? { ...e, photoUrl } : e)) }));
  },

  setEquipmentImage: async (equipmentId, imageUrl) => {
    await db.equipment.update(equipmentId, { imageUrl, updatedAt: nowIso() });
    set((s) => ({ equipment: s.equipment.map((e) => (e.id === equipmentId ? { ...e, imageUrl } : e)) }));
  },

  setBeanImage: async (beanId, imageUrl) => {
    await db.beans.update(beanId, { imageUrl, updatedAt: nowIso() });
    set((s) => ({ beans: s.beans.map((b) => (b.id === beanId ? { ...b, imageUrl } : b)) }));
  },

  setActiveSetup: (setupId) => set({ activeSetupId: setupId }),
  setActiveBean: (beanId) => set({ activeBeanId: beanId }),
  setLastSyncedAt: (value) => set({ lastSyncedAt: value }),

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
        weatherCode: response.weatherCode,
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

/**
 * Best-effort equipment kind: the equipment's own `kind` if set, else the
 * linked product's kind, else "grinder" — the only kind custom equipment
 * could be before machines were supported, so it's the safe default for
 * rows created before the `kind` column existed.
 */
export function equipmentKind(state: KvarnState, equipmentId: string | null): Product["kind"] {
  const eq = state.equipment.find((e) => e.id === equipmentId);
  if (eq?.kind) return eq.kind;
  return equipmentProduct(state, equipmentId)?.kind ?? "grinder";
}

/**
 * Grind range to use for a given piece of equipment: the owner's own
 * override on the equipment record if they've set one, else the linked
 * catalog product's default, else a generic fallback for custom/unlisted
 * grinders. Only meaningful for grinder-kind equipment.
 */
export function equipmentGrindScale(state: KvarnState, equipmentId: string | null): GrindScaleValue {
  const eq = state.equipment.find((e) => e.id === equipmentId);
  if (eq?.grindScale) return eq.grindScale;
  return equipmentProduct(state, equipmentId)?.grindScale ?? DEFAULT_GRIND_SCALE;
}

/**
 * Human-readable grind value for display (logbook rows, recipe lines, the
 * live Compass hint) — "1,25"/"1.25" for a subclicks-enabled grinder,
 * otherwise the plain number. `locale` picks the decimal separator only;
 * the underlying stored value is always a plain JS number either way.
 */
export function formatGrindValue(state: KvarnState, equipmentId: string | null, value: number, locale: "de" | "en"): string {
  const scale = equipmentGrindScale(state, equipmentId);
  if (!scale.subclicksEnabled || scale.mainMin === undefined || scale.mainMax === undefined || scale.subMin === undefined || scale.subMax === undefined) {
    return String(value);
  }
  const { mainClick, subClick } = formatClickParts(value, {
    mainMin: scale.mainMin,
    mainMax: scale.mainMax,
    subMin: scale.subMin,
    subMax: scale.subMax,
  });
  return `${mainClick}${locale === "de" ? "," : "."}${subClick}`;
}

/**
 * Best available image for a piece of equipment: the catalog product's
 * illustration if linked, else this equipment's own generated illustration,
 * else its raw reference photo (custom/non-catalog gear only has the latter
 * two). EntityImage falls back to a category placeholder if this is null.
 */
export function equipmentImage(state: KvarnState, equipmentId: string | null): string | null {
  const eq = state.equipment.find((e) => e.id === equipmentId);
  if (!eq) return null;
  return equipmentProduct(state, equipmentId)?.imageUrl ?? eq.imageUrl ?? eq.photoUrl ?? null;
}

/** Most recent brew for this exact setup+bean combination, if any. */
export function lastBrewFor(state: KvarnState, setupId: string, beanId: string): Brew | undefined {
  return state.brews.find((b) => b.setupId === setupId && b.beanId === beanId);
}

export function weatherSnapshotFor(state: KvarnState, weatherId: string | null): WeatherSnapshot | undefined {
  if (!weatherId) return undefined;
  return state.weatherSnapshots.find((w) => w.id === weatherId);
}

/**
 * Most recently captured weather snapshot, if any — used for passive display
 * (e.g. Heute's weather strip) without triggering a new capture/location
 * prompt. Active capture (and the permission prompt that comes with it)
 * stays scoped to actually starting a brew, see Bruehen.tsx.
 */
export function latestWeatherSnapshot(state: KvarnState): WeatherSnapshot | undefined {
  return [...state.weatherSnapshots].sort((a, b) => b.takenAt.localeCompare(a.takenAt))[0];
}

export function recipeFor(state: KvarnState, setupId: string, beanId: string): Recipe | undefined {
  return state.recipes.find((r) => r.setupId === setupId && r.beanId === beanId);
}
