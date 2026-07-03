import Dexie, { type EntityTable } from "dexie";
import type { Bean, Brew, Equipment, Product, Recipe, Setup, WeatherSnapshot } from "@kvarn/db";
import seedProducts from "./seed-products.json";

/**
 * Local-first store for the web app, backed by IndexedDB via Dexie.
 * Field shapes mirror the shared @kvarn/db Drizzle schema (see docs/03_TECH_KONZEPT.md §5)
 * so the same types carry over once this swaps to sqlite-wasm or syncs to D1 (open M0 spike,
 * see docs/04_DEV_PLAN.md §5). IndexedDB has no foreign keys, so relations are just ids.
 */
export class KvarnDB extends Dexie {
  products!: EntityTable<Product, "id">;
  equipment!: EntityTable<Equipment, "id">;
  setups!: EntityTable<Setup, "id">;
  beans!: EntityTable<Bean, "id">;
  brews!: EntityTable<Brew, "id">;
  weatherSnapshots!: EntityTable<WeatherSnapshot, "id">;
  recipes!: EntityTable<Recipe, "id">;

  constructor() {
    super("kvarn");
    this.version(1).stores({
      products: "id, kind, brand",
      equipment: "id, userId, productId",
      setups: "id, userId, method",
      beans: "id, userId",
      brews: "id, userId, setupId, beanId, brewedAt",
      weatherSnapshots: "id, geoCell, takenAt",
      recipes: "id, userId, setupId, beanId",
    });
  }
}

export const db = new KvarnDB();

const LOCAL_USER_ID = "local";
export { LOCAL_USER_ID };

/**
 * Uses bulkPut (idempotent upsert) rather than bulkAdd so concurrent calls
 * (e.g. React StrictMode double-invoking effects in dev) never race on a
 * count-then-insert check and throw a duplicate-key BulkError.
 */
export async function ensureSeeded(): Promise<void> {
  const count = await db.products.count();
  if (count > 0) return;
  await db.products.bulkPut(
    (seedProducts as Array<Omit<Product, "updatedAt" | "deletedAt" | "clientId">>).map((p) => ({
      ...p,
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      clientId: p.id,
    })),
  );
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
