import { create } from "zustand";
import type { Bean, Brew, Equipment, Product, Setup } from "@kvarn/db";
import { db, ensureSeeded, LOCAL_USER_ID, newId, nowIso } from "../data/db";

interface KvarnState {
  hydrated: boolean;
  products: Product[];
  equipment: Equipment[];
  setups: Setup[];
  beans: Bean[];
  brews: Brew[];
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
  commitBrew: (input: Omit<Brew, "id" | "userId" | "updatedAt" | "deletedAt" | "clientId">) => Promise<Brew>;
}

export const useKvarnStore = create<KvarnState>((set) => ({
  hydrated: false,
  products: [],
  equipment: [],
  setups: [],
  beans: [],
  brews: [],
  activeSetupId: null,
  activeBeanId: null,

  hydrate: async () => {
    await ensureSeeded();
    const [products, equipment, setups, beans, brews] = await Promise.all([
      db.products.toArray(),
      db.equipment.toArray(),
      db.setups.toArray(),
      db.beans.toArray().then((all) => all.filter((b) => !b.archived)),
      db.brews.orderBy("brewedAt").reverse().toArray(),
    ]);
    set({
      hydrated: true,
      products,
      equipment,
      setups,
      beans,
      brews,
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
    set((s) => ({ brews: [brew, ...s.brews] }));
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
