import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../data/db";
import { useKvarnStore } from "./store";

describe("useKvarnStore", () => {
  beforeEach(async () => {
    await db.products.clear();
    await db.equipment.clear();
    await db.setups.clear();
    await db.beans.clear();
    await db.brews.clear();
    useKvarnStore.setState({
      hydrated: false,
      products: [],
      equipment: [],
      setups: [],
      beans: [],
      brews: [],
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
});
