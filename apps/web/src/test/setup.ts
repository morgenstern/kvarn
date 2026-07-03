import "fake-indexeddb/auto";
import { vi } from "vitest";

/** Minimal in-memory localStorage polyfill — not reliably a Node global across versions. */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  key(index: number) {
    return [...this.store.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}
vi.stubGlobal("localStorage", new MemoryStorage());

/**
 * ensureSeeded() and syncApprovedProducts() fetch over HTTP in the real app
 * (see apps/web/src/data/db.ts) — there's no dev server in the test
 * environment, so stub a minimal catalog for /data/seed-products.json and a
 * 404 for everything else (e.g. /api/products, which callers already treat
 * as "no server-approved products yet").
 */
const TEST_SEED_PRODUCTS = [
  {
    id: "test-grinder-1",
    kind: "grinder",
    brand: "Test",
    model: "Grinder",
    grindScale: { min: 0, max: 10, step: 0.1, unit: "turns", label: "Umdrehungen", finerDirection: -1 },
    specs: {},
    status: "seed",
  },
  {
    id: "test-machine-1",
    kind: "machine",
    brand: "Test",
    model: "Machine",
    grindScale: null,
    specs: {},
    status: "seed",
  },
];

vi.stubGlobal(
  "fetch",
  vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/data/seed-products.json")) {
      return new Response(JSON.stringify(TEST_SEED_PRODUCTS));
    }
    return new Response("not found", { status: 404 });
  }),
);
