import Dexie, { type EntityTable } from "dexie";
import type { Bean, Brew, Equipment, Product, Recipe, Setup, WeatherSnapshot } from "@kvarn/db";

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
    // v2: grindScale gained subclicksEnabled (main-click/subclick grinders,
    // e.g. Kingrinder K6) — existing rows predate the field entirely, so
    // backfill it to false (flat scale, today's behavior) rather than
    // leaving it undefined everywhere reads happen to check it.
    this.version(2)
      .stores({})
      .upgrade((tx) =>
        tx
          .table("equipment")
          .toCollection()
          .modify((row: Equipment) => {
            if (row.grindScale && row.grindScale.subclicksEnabled === undefined) {
              row.grindScale.subclicksEnabled = false;
            }
          }),
      );
  }
}

export const db = new KvarnDB();

/**
 * Same backfill as the v2 upgrade above, exposed standalone so it's
 * unit-testable without spinning up a second real IndexedDB version chain
 * (Dexie only runs `.upgrade()` once per browser database, on the version
 * transition itself) — see apps/web/src/data/db.test.ts.
 */
export async function backfillGrindScaleSubclicks(): Promise<void> {
  const rows = await db.equipment.toArray();
  await Promise.all(
    rows
      .filter((row) => row.grindScale && row.grindScale.subclicksEnabled === undefined)
      .map((row) => db.equipment.update(row.id, { grindScale: { ...row.grindScale!, subclicksEnabled: false } })),
  );
}

const LOCAL_USER_ID = "local";
export { LOCAL_USER_ID };

type SeedProduct = Omit<Product, "updatedAt" | "deletedAt" | "clientId">;

// Bump when public/data/seed-products.json changes meaningfully (e.g. catalog
// size grows) so existing installs re-sync instead of keeping whatever they
// first seeded. bulkPut is an idempotent upsert, so re-running this is safe.
const SEED_CATALOG_VERSION = 6;
const SEED_VERSION_KEY = "kvarn:seedCatalogVersion";

/**
 * Fetched from public/data/seed-products.json rather than bundled via static
 * import — at ~390 curated devices the JSON is too big to ship in the main
 * JS chunk (violates the <2s app-start budget in docs/03_TECH_KONZEPT.md §9).
 */
export async function ensureSeeded(): Promise<void> {
  const storedVersion = Number(localStorage.getItem(SEED_VERSION_KEY) ?? "0");
  const count = await db.products.count();
  if (count > 0 && storedVersion === SEED_CATALOG_VERSION) return;

  const res = await fetch("/data/seed-products.json");
  const seedProducts = (await res.json()) as SeedProduct[];
  await db.products.bulkPut(
    seedProducts.map((p) => ({
      ...p,
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      clientId: p.id,
    })),
  );
  localStorage.setItem(SEED_VERSION_KEY, String(SEED_CATALOG_VERSION));
}

/**
 * Merges server-approved community products (see apps/worker's
 * /api/products) into the local catalog. Best-effort and non-blocking —
 * same pattern as weather: if the worker isn't reachable, just skip it.
 */
export async function syncApprovedProducts(): Promise<void> {
  try {
    const res = await fetch("/api/products");
    if (!res.ok) return;
    const approved = (await res.json()) as SeedProduct[];
    if (approved.length === 0) return;
    await db.products.bulkPut(
      approved.map((p) => ({
        ...p,
        updatedAt: new Date().toISOString(),
        deletedAt: null,
        clientId: p.id,
      })),
    );
  } catch {
    // Offline or worker not running locally — the static seed catalog still works.
  }
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * DSGVO data export (docs/03_TECH_KONZEPT.md §9): every user-created local
 * table as one JSON document. Excludes `products` — that's the shared
 * catalog, not user data.
 */
export async function exportAllData() {
  const [equipment, setups, beans, brews, weatherSnapshots, recipes] = await Promise.all([
    db.equipment.toArray(),
    db.setups.toArray(),
    db.beans.toArray(),
    db.brews.toArray(),
    db.weatherSnapshots.toArray(),
    db.recipes.toArray(),
  ]);
  return { exportedAt: nowIso(), equipment, setups, beans, brews, weatherSnapshots, recipes };
}

/** Deletes every local table's contents, including the seed catalog (re-fetched on next launch). */
export async function deleteAllLocalData(): Promise<void> {
  await db.delete();
  localStorage.removeItem(SEED_VERSION_KEY);
}
