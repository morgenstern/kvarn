import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../data/db";
import {
  equipmentKind,
  formatGrindValue,
  lastUsedCombo,
  recipeFor,
  sortedBeans,
  sortedGrinders,
  sortedMachines,
  useKvarnStore,
} from "./store";

const RESET_STATE = {
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
  // Zustand's setState (no `replace: true`) shallow-merges — any key
  // missing here silently keeps whatever a prior test left behind.
  lastSyncedAt: null,
};

async function clearAllTables() {
  await db.products.clear();
  await db.equipment.clear();
  await db.beans.clear();
  await db.brews.clear();
  await db.weatherSnapshots.clear();
  await db.recipes.clear();
}

function baseBrewInput(overrides: Record<string, unknown> = {}) {
  return {
    weatherId: null,
    brewedAt: new Date().toISOString(),
    grindSetting: 10,
    doseG: 18,
    targetYieldG: 36,
    waterTempC: null,
    preinfusionS: null,
    puckPrep: null,
    beanAgeDays: null,
    timeTotalS: 28,
    timeFirstDropS: null,
    pressureAvgBar: null,
    pressurePeakBar: null,
    actualYieldG: 36,
    flowGs: 1.3,
    balance: 0,
    sweetness: null,
    body: null,
    crema: null,
    visualTags: [],
    flavorTags: [],
    tdsPct: null,
    note: null,
    photoUrl: null,
    isDialIn: false,
    isManualEntry: false,
    recipeId: null,
    ratingTotal: 7,
    ...overrides,
  };
}

describe("useKvarnStore", () => {
  beforeEach(async () => {
    await clearAllTables();
    useKvarnStore.setState(RESET_STATE);
  });

  it("hydrate seeds the product catalog on first run", async () => {
    await useKvarnStore.getState().hydrate();
    const { products, hydrated } = useKvarnStore.getState();
    expect(hydrated).toBe(true);
    expect(products.length).toBeGreaterThan(0);
  });

  it("full brew loop: equipment -> bean -> brew, active picks updated", async () => {
    await useKvarnStore.getState().hydrate();
    const grinderProduct = useKvarnStore.getState().products.find((p) => p.kind === "grinder")!;
    const grinderEq = await useKvarnStore.getState().addEquipmentFromProduct(grinderProduct.id);
    const bean = await useKvarnStore.getState().addBean({ roaster: "Test Rösterei", name: "Test Blend" });

    const brew = await useKvarnStore.getState().commitBrew(
      baseBrewInput({ grinderEquipmentId: grinderEq.id, machineEquipmentId: null, beanId: bean.id }) as never,
    );

    expect(brew.id).toBeTruthy();
    expect(useKvarnStore.getState().brews[0]?.id).toBe(brew.id);
    expect(await db.brews.count()).toBe(1);
    expect(useKvarnStore.getState().activeGrinderEquipmentId).toBe(grinderEq.id);
    expect(useKvarnStore.getState().activeBeanId).toBe(bean.id);
  });

  it("upserts one recipe per grinder+machine+bean combination across repeated brews", async () => {
    await useKvarnStore.getState().hydrate();
    const grinderProduct = useKvarnStore.getState().products.find((p) => p.kind === "grinder")!;
    const grinderEq = await useKvarnStore.getState().addEquipmentFromProduct(grinderProduct.id);
    const bean = await useKvarnStore.getState().addBean({ roaster: "Test Rösterei", name: "Test Blend" });

    const base = baseBrewInput({ grinderEquipmentId: grinderEq.id, machineEquipmentId: null, beanId: bean.id });
    await useKvarnStore.getState().commitBrew({ ...base, ratingTotal: 6 } as never);
    await useKvarnStore.getState().commitBrew({ ...base, ratingTotal: 8 } as never);

    const recipes = useKvarnStore.getState().recipes;
    expect(recipes).toHaveLength(1);
    expect(recipes[0]?.brewCount).toBe(2);
    expect(recipes[0]?.avgRating).toBe(7);
    expect(await db.recipes.count()).toBe(1);
  });

  it("recipeFor distinguishes combos by machine, not just grinder+bean", async () => {
    await useKvarnStore.getState().hydrate();
    const grinderProduct = useKvarnStore.getState().products.find((p) => p.kind === "grinder")!;
    const machineProduct = useKvarnStore.getState().products.find((p) => p.kind === "machine")!;
    const grinderEq = await useKvarnStore.getState().addEquipmentFromProduct(grinderProduct.id);
    const machineEq = await useKvarnStore.getState().addEquipmentFromProduct(machineProduct.id);
    const bean = await useKvarnStore.getState().addBean({ roaster: "Test Rösterei", name: "Test Blend" });

    await useKvarnStore.getState().commitBrew(
      baseBrewInput({ grinderEquipmentId: grinderEq.id, machineEquipmentId: null, beanId: bean.id }) as never,
    );
    await useKvarnStore.getState().commitBrew(
      baseBrewInput({ grinderEquipmentId: grinderEq.id, machineEquipmentId: machineEq.id, beanId: bean.id }) as never,
    );

    const state = useKvarnStore.getState();
    expect(state.recipes).toHaveLength(2);
    expect(recipeFor(state, grinderEq.id, null, bean.id)?.machineEquipmentId).toBeNull();
    expect(recipeFor(state, grinderEq.id, machineEq.id, bean.id)?.machineEquipmentId).toBe(machineEq.id);
  });

  it("equipmentKind falls back to the linked product's kind, then grinder for legacy custom gear", async () => {
    await useKvarnStore.getState().hydrate();
    const state = useKvarnStore.getState();
    const machine = state.products.find((p) => p.kind === "machine")!;

    const linked = await useKvarnStore.getState().addEquipmentFromProduct(machine.id);
    expect(equipmentKind(useKvarnStore.getState(), linked.id)).toBe("machine");

    const custom = await useKvarnStore.getState().addCustomEquipment("My rig", "machine");
    expect(equipmentKind(useKvarnStore.getState(), custom.id)).toBe("machine");

    await db.equipment.update(custom.id, { kind: null });
    useKvarnStore.setState((s) => ({
      equipment: s.equipment.map((e) => (e.id === custom.id ? { ...e, kind: null } : e)),
    }));
    expect(equipmentKind(useKvarnStore.getState(), custom.id)).toBe("grinder");
  });

  it("deleteEquipment soft-deletes (sets deletedAt) instead of removing the row, so a tombstone can sync", async () => {
    await useKvarnStore.getState().hydrate();
    const grinderProduct = useKvarnStore.getState().products.find((p) => p.kind === "grinder")!;
    const machineProduct = useKvarnStore.getState().products.find((p) => p.kind === "machine")!;
    const grinderEq = await useKvarnStore.getState().addEquipmentFromProduct(grinderProduct.id);
    const machineEq = await useKvarnStore.getState().addEquipmentFromProduct(machineProduct.id);

    await useKvarnStore.getState().deleteEquipment(machineEq.id);

    expect(useKvarnStore.getState().equipment.find((e) => e.id === machineEq.id)).toBeUndefined();

    const row = await db.equipment.get(machineEq.id);
    expect(row).toBeDefined();
    expect(row?.deletedAt).not.toBeNull();

    useKvarnStore.setState(RESET_STATE);
    await useKvarnStore.getState().hydrate();
    expect(useKvarnStore.getState().equipment.find((e) => e.id === machineEq.id)).toBeUndefined();
    expect(useKvarnStore.getState().equipment.find((e) => e.id === grinderEq.id)).toBeDefined();
  });
});

describe("sortedGrinders / sortedMachines / sortedBeans", () => {
  beforeEach(async () => {
    await clearAllTables();
    useKvarnStore.setState(RESET_STATE);
  });

  it("sorts by most recent brew first, and never-used items by their own updatedAt (most recently added first)", async () => {
    await useKvarnStore.getState().hydrate();
    const grinderProduct = useKvarnStore.getState().products.find((p) => p.kind === "grinder")!;

    const older = await useKvarnStore.getState().addEquipmentFromProduct(grinderProduct.id);
    const bean = await useKvarnStore.getState().addBean({ roaster: "R1", name: "B1" });
    await useKvarnStore.getState().commitBrew(
      baseBrewInput({ grinderEquipmentId: older.id, machineEquipmentId: null, beanId: bean.id, brewedAt: "2020-01-01T00:00:00.000Z" }) as never,
    );

    const fresh = await useKvarnStore.getState().addEquipmentFromProduct(grinderProduct.id);

    const sorted = sortedGrinders(useKvarnStore.getState());
    expect(sorted[0]?.id).toBe(fresh.id);
    expect(sorted[1]?.id).toBe(older.id);
  });

  it("sortedMachines includes both machine and brewer kind equipment", async () => {
    await useKvarnStore.getState().hydrate();
    const machineProduct = useKvarnStore.getState().products.find((p) => p.kind === "machine")!;
    const brewerProduct = useKvarnStore.getState().products.find((p) => p.kind === "brewer");
    const machineEq = await useKvarnStore.getState().addEquipmentFromProduct(machineProduct.id);

    const sortedIds = sortedMachines(useKvarnStore.getState()).map((e) => e.id);
    expect(sortedIds).toContain(machineEq.id);

    if (brewerProduct) {
      const brewerEq = await useKvarnStore.getState().addEquipmentFromProduct(brewerProduct.id);
      expect(sortedMachines(useKvarnStore.getState()).map((e) => e.id)).toContain(brewerEq.id);
    }
  });

  it("lastUsedCombo reflects the single most recent brew", async () => {
    await useKvarnStore.getState().hydrate();
    expect(lastUsedCombo(useKvarnStore.getState())).toEqual({
      grinderEquipmentId: null,
      machineEquipmentId: null,
      beanId: null,
    });

    const grinderProduct = useKvarnStore.getState().products.find((p) => p.kind === "grinder")!;
    const grinderEq = await useKvarnStore.getState().addEquipmentFromProduct(grinderProduct.id);
    const bean = await useKvarnStore.getState().addBean({ roaster: "R1", name: "B1" });
    await useKvarnStore.getState().commitBrew(
      baseBrewInput({ grinderEquipmentId: grinderEq.id, machineEquipmentId: null, beanId: bean.id }) as never,
    );

    expect(lastUsedCombo(useKvarnStore.getState())).toEqual({
      grinderEquipmentId: grinderEq.id,
      machineEquipmentId: null,
      beanId: bean.id,
    });
  });

  it("sortedBeans sorts the same way", async () => {
    await useKvarnStore.getState().hydrate();
    const older = await useKvarnStore.getState().addBean({ roaster: "Old", name: "Bean" });
    // Back-date "older"'s updatedAt: two addBean calls in the same test can
    // land in the same millisecond, which would otherwise make this
    // comparison racy against real clock resolution (both entries tie under
    // sortByLastUsed's localeCompare and the stable sort keeps insertion
    // order, masking the bug this test means to catch). Mirrors how the
    // grinder-sort test above forces separation via a backdated brewedAt.
    await db.beans.update(older.id, { updatedAt: "2020-01-01T00:00:00.000Z" });
    useKvarnStore.setState((s) => ({
      beans: s.beans.map((b) => (b.id === older.id ? { ...b, updatedAt: "2020-01-01T00:00:00.000Z" } : b)),
    }));
    const fresh = await useKvarnStore.getState().addBean({ roaster: "Fresh", name: "Bean" });
    const sorted = sortedBeans(useKvarnStore.getState());
    expect(sorted[0]?.id).toBe(fresh.id);
    expect(sorted[1]?.id).toBe(older.id);
  });
});

describe("formatGrindValue", () => {
  beforeEach(async () => {
    await clearAllTables();
    useKvarnStore.setState(RESET_STATE);
  });

  it("renders a flat-scale value as a plain number", async () => {
    await useKvarnStore.getState().hydrate();
    const grinder = useKvarnStore.getState().products.find((p) => p.kind === "grinder")!;
    const equipment = await useKvarnStore.getState().addEquipmentFromProduct(grinder.id);
    expect(formatGrindValue(useKvarnStore.getState(), equipment.id, 12.5, "de")).toBe("12.5");
  });

  it("renders a subclicks-enabled value as main,sub with a locale-appropriate separator", async () => {
    await useKvarnStore.getState().hydrate();
    const grinder = useKvarnStore.getState().products.find((p) => p.kind === "grinder")!;
    const equipment = await useKvarnStore.getState().addEquipmentFromProduct(grinder.id);
    await useKvarnStore.getState().setEquipmentGrindScale(equipment.id, {
      min: 1, max: 4.4, step: 0.01, unit: "clicks", label: "", finerDirection: -1,
      subclicksEnabled: true, mainMin: 1, mainMax: 4, subMin: 0, subMax: 40,
    });
    expect(formatGrindValue(useKvarnStore.getState(), equipment.id, 1.25, "de")).toBe("1,25");
    expect(formatGrindValue(useKvarnStore.getState(), equipment.id, 1.05, "de")).toBe("1,05");
    expect(formatGrindValue(useKvarnStore.getState(), equipment.id, 1.25, "en")).toBe("1.25");
  });
});
