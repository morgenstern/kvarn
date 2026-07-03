import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../data/db";
import { equipmentKind, useKvarnStore } from "./store";

describe("useKvarnStore", () => {
  beforeEach(async () => {
    await db.products.clear();
    await db.equipment.clear();
    await db.setups.clear();
    await db.beans.clear();
    await db.brews.clear();
    await db.weatherSnapshots.clear();
    await db.recipes.clear();
    useKvarnStore.setState({
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
    });
  });

  it("hydrate seeds the product catalog on first run", async () => {
    await useKvarnStore.getState().hydrate();
    const { products, hydrated } = useKvarnStore.getState();
    expect(hydrated).toBe(true);
    expect(products.length).toBeGreaterThan(0);
  });

  it("full brew loop: equipment -> setup -> bean -> brew", async () => {
    await useKvarnStore.getState().hydrate();
    const grinder = useKvarnStore.getState().products.find((p) => p.kind === "grinder");
    expect(grinder).toBeDefined();

    const equipment = await useKvarnStore.getState().addEquipmentFromProduct(grinder!.id);
    const setup = await useKvarnStore.getState().addSetup({
      name: "Test Setup",
      method: "espresso",
      grinderEquipmentId: equipment.id,
    });
    const bean = await useKvarnStore.getState().addBean({ roaster: "Test Rösterei", name: "Test Blend" });

    const brew = await useKvarnStore.getState().commitBrew({
      setupId: setup.id,
      beanId: bean.id,
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
      ratingTotal: 8,
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
      recipeId: null,
    });

    expect(brew.id).toBeTruthy();
    expect(useKvarnStore.getState().brews[0]?.id).toBe(brew.id);
    expect(await db.brews.count()).toBe(1);
  });

  it("upserts one recipe per setup+bean combination across repeated brews", async () => {
    await useKvarnStore.getState().hydrate();
    const grinder = useKvarnStore.getState().products.find((p) => p.kind === "grinder")!;
    const equipment = await useKvarnStore.getState().addEquipmentFromProduct(grinder.id);
    const setup = await useKvarnStore.getState().addSetup({
      name: "Test Setup",
      method: "espresso",
      grinderEquipmentId: equipment.id,
    });
    const bean = await useKvarnStore.getState().addBean({ roaster: "Test Rösterei", name: "Test Blend" });

    const baseBrew = {
      setupId: setup.id,
      beanId: bean.id,
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
      recipeId: null,
    };

    await useKvarnStore.getState().commitBrew({ ...baseBrew, ratingTotal: 6 });
    await useKvarnStore.getState().commitBrew({ ...baseBrew, ratingTotal: 8 });

    const recipes = useKvarnStore.getState().recipes;
    expect(recipes).toHaveLength(1);
    expect(recipes[0]?.brewCount).toBe(2);
    expect(recipes[0]?.avgRating).toBe(7);
    expect(await db.recipes.count()).toBe(1);
  });

  it("findOrCreateSetup reuses an existing grinder+machine+method combo instead of duplicating it", async () => {
    await useKvarnStore.getState().hydrate();
    const grinder = useKvarnStore.getState().products.find((p) => p.kind === "grinder")!;
    const machine = useKvarnStore.getState().products.find((p) => p.kind === "machine")!;
    const grinderEq = await useKvarnStore.getState().addEquipmentFromProduct(grinder.id);
    const machineEq = await useKvarnStore.getState().addEquipmentFromProduct(machine.id);

    const first = await useKvarnStore.getState().findOrCreateSetup({
      method: "espresso",
      grinderEquipmentId: grinderEq.id,
      machineEquipmentId: machineEq.id,
    });
    const second = await useKvarnStore.getState().findOrCreateSetup({
      method: "espresso",
      grinderEquipmentId: grinderEq.id,
      machineEquipmentId: machineEq.id,
    });
    const withoutMachine = await useKvarnStore.getState().findOrCreateSetup({
      method: "espresso",
      grinderEquipmentId: grinderEq.id,
      machineEquipmentId: null,
    });

    expect(second.id).toBe(first.id);
    expect(withoutMachine.id).not.toBe(first.id);
    expect(useKvarnStore.getState().setups).toHaveLength(2);
  });

  it("equipmentKind falls back to the linked product's kind, then grinder for legacy custom gear", async () => {
    await useKvarnStore.getState().hydrate();
    const state = useKvarnStore.getState();
    const machine = state.products.find((p) => p.kind === "machine")!;

    const linked = await useKvarnStore.getState().addEquipmentFromProduct(machine.id);
    expect(equipmentKind(useKvarnStore.getState(), linked.id)).toBe("machine");

    const custom = await useKvarnStore.getState().addCustomEquipment("My rig", "machine");
    expect(equipmentKind(useKvarnStore.getState(), custom.id)).toBe("machine");

    // Simulate a pre-migration row with no kind column populated.
    await db.equipment.update(custom.id, { kind: null });
    useKvarnStore.setState((s) => ({
      equipment: s.equipment.map((e) => (e.id === custom.id ? { ...e, kind: null } : e)),
    }));
    expect(equipmentKind(useKvarnStore.getState(), custom.id)).toBe("grinder");
  });
});
