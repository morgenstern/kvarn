import { create } from "zustand";
import { fetchWeatherSnapshot, getRoughLocation } from "@kvarn/api-client";
import { formatClickParts } from "@kvarn/core";
import type { Bean, Brew, Equipment, Product, Recipe, WeatherSnapshot } from "@kvarn/db";
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
  beans: Bean[];
  brews: Brew[];
  weatherSnapshots: WeatherSnapshot[];
  recipes: Recipe[];
  activeGrinderEquipmentId: string | null;
  activeMachineEquipmentId: string | null;
  activeBeanId: string | null;
  lastSyncedAt: string | null;

  hydrate: () => Promise<void>;
  addEquipmentFromProduct: (productId: string, photoUrl?: string) => Promise<Equipment>;
  addCustomEquipment: (
    customName: string,
    kind: Exclude<Product["kind"], "bean">,
    photoUrl?: string,
    grindScale?: GrindScaleValue | null,
    methodHint?: Equipment["methodHint"] | null,
  ) => Promise<Equipment>;
  setEquipmentGrindScale: (equipmentId: string, grindScale: GrindScaleValue) => Promise<void>;
  setEquipmentCustomName: (equipmentId: string, customName: string | null) => Promise<void>;
  deleteEquipment: (equipmentId: string) => Promise<void>;
  addBean: (input: {
    roaster: string;
    name: string;
    origin?: string;
    roastDate?: string;
    photoUrl?: string;
    beanType?: Bean["beanType"] | null;
  }) => Promise<Bean>;
  archiveBean: (beanId: string) => Promise<void>;
  setEquipmentPhoto: (equipmentId: string, photoUrl: string) => Promise<void>;
  setEquipmentImage: (equipmentId: string, imageUrl: string) => Promise<void>;
  setBeanImage: (beanId: string, imageUrl: string) => Promise<void>;
  setActiveGrinder: (equipmentId: string | null) => void;
  setActiveMachine: (equipmentId: string | null) => void;
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
  beans: [],
  brews: [],
  weatherSnapshots: [],
  recipes: [],
  activeGrinderEquipmentId: null,
  activeMachineEquipmentId: null,
  activeBeanId: null,
  // Not imported from ../sync/runSync — that module also imports
  // ../auth/client, which calls window.location.origin at top level and
  // would crash when store.ts is imported in the Node vitest environment.
  lastSyncedAt: localStorage.getItem(LAST_SYNCED_KEY),

  hydrate: async () => {
    await ensureSeeded();
    await syncApprovedProducts();
    const [products, equipment, beans, brews, weatherSnapshots, recipes] = await Promise.all([
      db.products.toArray(),
      db.equipment.toArray().then((all) => all.filter((e) => !e.deletedAt)),
      db.beans.toArray().then((all) => all.filter((b) => !b.archived)),
      db.brews.orderBy("brewedAt").reverse().toArray(),
      db.weatherSnapshots.toArray(),
      db.recipes.toArray(),
    ]);
    // brews is newest-first (orderBy(...).reverse() above) — the first row
    // is the most recently used grinder/machine/bean combo, used to seed the
    // "active" picks so Bruehen/Heute default to "brew the same thing again"
    // without needing a saved Setup. See lastUsedCombo() below for the same
    // logic exposed as a selector (used after hydrate, e.g. post-sync).
    //
    // Falls back to the first grinder/machine-or-brewer/bean in the user's
    // collection when there's no brew history yet (e.g. right after
    // onboarding, before the very first brew is logged) — otherwise
    // activeGrinderEquipmentId/activeMachineEquipmentId would stay null on
    // every reload despite equipment existing, breaking Home's ready card.
    const latest = brews[0];
    // Same resolution order as equipmentKind() below (own kind, then linked
    // product's kind, then "grinder"), inlined because that helper needs a
    // fully-built KvarnState, which doesn't exist yet at this point.
    const resolveKind = (e: Equipment): Product["kind"] =>
      e.kind ?? products.find((p) => p.id === e.productId)?.kind ?? "grinder";
    const firstGrinder = equipment.find((e) => resolveKind(e) === "grinder");
    const firstMachine = equipment.find((e) => {
      const kind = resolveKind(e);
      return kind === "machine" || kind === "brewer";
    });
    set({
      hydrated: true,
      products,
      equipment,
      beans,
      brews,
      weatherSnapshots,
      recipes,
      activeGrinderEquipmentId: latest?.grinderEquipmentId ?? firstGrinder?.id ?? null,
      activeMachineEquipmentId: latest?.machineEquipmentId ?? firstMachine?.id ?? null,
      activeBeanId: latest?.beanId ?? beans[0]?.id ?? null,
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
      methodHint: null,
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

  addCustomEquipment: async (customName, kind, photoUrl, grindScale, methodHint) => {
    const equipment: Equipment = {
      id: newId("equipment"),
      userId: LOCAL_USER_ID,
      productId: null,
      customName,
      kind,
      methodHint: methodHint ?? null,
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

  // No more "in use by a setup" blocking — without setups, a grinder/machine
  // can always be soft-deleted; past brews keep pointing at its (now gone)
  // id, same as how deleting a bean already worked via archiving.
  deleteEquipment: async (equipmentId) => {
    await db.equipment.update(equipmentId, { deletedAt: nowIso(), updatedAt: nowIso() });
    set((s) => ({ equipment: s.equipment.filter((e) => e.id !== equipmentId) }));
  },

  addBean: async ({ roaster, name, origin, roastDate, photoUrl, beanType }) => {
    const bean: Bean = {
      id: newId("bean"),
      userId: LOCAL_USER_ID,
      roaster,
      name,
      origin: origin ?? null,
      variety: null,
      process: null,
      beanType: beanType ?? null,
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

  setActiveGrinder: (equipmentId) => set({ activeGrinderEquipmentId: equipmentId }),
  setActiveMachine: (equipmentId) => set({ activeMachineEquipmentId: equipmentId }),
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
    const existingRecipe = state.recipes.find(
      (r) =>
        r.grinderEquipmentId === brew.grinderEquipmentId &&
        (r.machineEquipmentId ?? null) === (brew.machineEquipmentId ?? null) &&
        r.beanId === brew.beanId,
    );
    const brewCount = (existingRecipe?.brewCount ?? 0) + 1;
    const avgRating = existingRecipe
      ? (existingRecipe.avgRating ?? brew.ratingTotal) * (brewCount - 1) / brewCount + brew.ratingTotal / brewCount
      : brew.ratingTotal;
    const confidence = Math.round(Math.min(1, brewCount / RECIPE_CONFIDENCE_TARGET_BREWS) * 100) / 100;
    const recipe: Recipe = {
      id: existingRecipe?.id ?? newId("recipe"),
      userId: LOCAL_USER_ID,
      grinderEquipmentId: brew.grinderEquipmentId,
      machineEquipmentId: brew.machineEquipmentId,
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
      activeGrinderEquipmentId: brew.grinderEquipmentId,
      activeMachineEquipmentId: brew.machineEquipmentId,
      activeBeanId: brew.beanId,
    }));
    return brew;
  },
}));

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
 * Which brew method this piece of gear makes: its own methodHint if set,
 * else the linked catalog product's methodHint, else null (custom gear with
 * no hint set, or a grinder/accessory, which never have one). Feeds
 * deriveBrewMethod (packages/core/src/brewMethod.ts) — same
 * override-then-catalog-fallback pattern as equipmentGrindScale below.
 */
export function equipmentMethodHint(state: KvarnState, equipmentId: string | null): Equipment["methodHint"] {
  const eq = state.equipment.find((e) => e.id === equipmentId);
  if (eq?.methodHint) return eq.methodHint;
  return equipmentProduct(state, equipmentId)?.methodHint ?? null;
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

/** Most recent brew for this exact grinder+machine+bean combination, if any. */
export function lastBrewFor(
  state: KvarnState,
  grinderEquipmentId: string,
  machineEquipmentId: string | null,
  beanId: string,
): Brew | undefined {
  return state.brews.find(
    (b) => b.grinderEquipmentId === grinderEquipmentId && (b.machineEquipmentId ?? null) === machineEquipmentId && b.beanId === beanId,
  );
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

export function recipeFor(
  state: KvarnState,
  grinderEquipmentId: string,
  machineEquipmentId: string | null,
  beanId: string,
): Recipe | undefined {
  return state.recipes.find(
    (r) => r.grinderEquipmentId === grinderEquipmentId && (r.machineEquipmentId ?? null) === machineEquipmentId && r.beanId === beanId,
  );
}

/**
 * The grinder/machine/bean used in the single most recent brew, if any (all
 * fields null if there's no brew history yet). hydrate() inlines the same
 * "latest brew" lookup for its initial active-picks fallback; Home's "ready
 * for your next brew" card reads the persisted active* fields directly
 * instead (those already have a no-brew-history fallback, this doesn't).
 */
export function lastUsedCombo(state: KvarnState): {
  grinderEquipmentId: string | null;
  machineEquipmentId: string | null;
  beanId: string | null;
} {
  const latest = state.brews[0];
  return {
    grinderEquipmentId: latest?.grinderEquipmentId ?? null,
    machineEquipmentId: latest?.machineEquipmentId ?? null,
    beanId: latest?.beanId ?? null,
  };
}

/**
 * Sorts items "most recently used in a brew first"; anything never brewed
 * with falls back to its own `updatedAt` (which is set at creation time and
 * only touched by later edits — for a freshly added, never-edited item this
 * is effectively "when it was added"), so a brand-new grinder/machine/bean
 * outranks something last brewed with days ago. `brews` is always kept
 * newest-first (see hydrate/commitBrew), so the first match for an id is
 * its most recent use.
 */
function sortByLastUsed<T extends { id: string; updatedAt: string }>(
  items: T[],
  brews: Brew[],
  matches: (brew: Brew, itemId: string) => boolean,
): T[] {
  const lastUsedAt = new Map<string, string>();
  for (const item of items) {
    const brew = brews.find((b) => matches(b, item.id));
    lastUsedAt.set(item.id, brew?.brewedAt ?? item.updatedAt);
  }
  return [...items].sort((a, b) => (lastUsedAt.get(b.id) ?? "").localeCompare(lastUsedAt.get(a.id) ?? ""));
}

export function sortedGrinders(state: KvarnState): Equipment[] {
  const grinders = state.equipment.filter((e) => equipmentKind(state, e.id) === "grinder");
  return sortByLastUsed(grinders, state.brews, (b, id) => b.grinderEquipmentId === id);
}

/** Includes both "machine" (espresso machines) and "brewer" (V60/Aeropress/
 * French press/moka — see Task 9) kind equipment: from the user's
 * perspective there's one "what did you brew on" picker, not two. */
export function sortedMachines(state: KvarnState): Equipment[] {
  const machines = state.equipment.filter((e) => {
    const kind = equipmentKind(state, e.id);
    return kind === "machine" || kind === "brewer";
  });
  return sortByLastUsed(machines, state.brews, (b, id) => b.machineEquipmentId === id);
}

export function sortedBeans(state: KvarnState): Bean[] {
  return sortByLastUsed(state.beans, state.brews, (b, id) => b.beanId === id);
}
