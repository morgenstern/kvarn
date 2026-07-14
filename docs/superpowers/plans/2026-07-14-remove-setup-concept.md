# Remove the Setup Concept Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the "Setup" entity entirely. Grinders, machines, and beans are managed independently and picked independently for each brew session. Brew method (espresso/v60/aeropress/frenchpress/moka) is derived from the bean's type + the machine's method hint instead of chosen explicitly.

**Architecture:** `brew`/`recipe` gain `grinderEquipmentId`/`machineEquipmentId` columns (replacing `setupId`); `bean` gains `beanType`; `equipment`/`product` gain `methodHint`. A single migration (local Dexie v3 + one D1 SQL migration) backfills the new columns from existing `setup` rows, then drops the `setup` table. A new pure `deriveBrewMethod` function in `packages/core` replaces the method dropdown. The store gains three independent "active" picks (grinder/machine/bean) plus last-used-sorted selectors, replacing `activeSetupId`/`addSetup`/`findOrCreateSetup`. Every screen that read `setup.*` is updated to read the three entities directly.

**Tech Stack:** Drizzle ORM (SQLite/D1), Dexie (IndexedDB), Zustand, React 18, TanStack Router, Vitest.

**Design doc:** `docs/superpowers/specs/2026-07-14-remove-setup-concept-design.md`

---

### Task 1: Extend the Drizzle schema — new columns, drop `setup`

**Files:**
- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/schema.test.ts`

- [ ] **Step 1: Edit `packages/db/src/schema.ts`**

In the `product` table (currently lines 44-61), add a `methodHint` column right after `grindScale` (mirrors how `grindScale` already works: a catalog default that `equipment.grindScale`/`equipment.methodHint` can override):

```typescript
export const product = sqliteTable("product", {
  id: text("id").primaryKey(),
  kind: text("kind", { enum: ["grinder", "machine", "brewer", "accessory", "bean"] }).notNull(),
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  imageUrl: text("image_url"),
  grindScale: text("grind_scale", { mode: "json" }).$type<GrindScaleJson>(),
  // Catalog default for machine/brewer products — which brew method this
  // piece of gear makes (e.g. an Aeropress product → "aeropress", a Rancilio
  // → "espresso"). Null for grinder/accessory/bean products. See
  // equipment.methodHint below and packages/core/src/brewMethod.ts.
  methodHint: text("method_hint", {
    enum: ["espresso", "v60", "aeropress", "frenchpress", "moka"],
  }),
  specs: text("specs", { mode: "json" }).$type<Record<string, unknown> | null>(),
  status: text("status", { enum: ["seed", "community", "verified"] })
    .notNull()
    .default("seed"),
  ...syncColumns,
});
```

In the `equipment` table (currently lines 63-92), add `methodHint` right after the existing `kind` column:

```typescript
  kind: text("kind", { enum: ["grinder", "machine", "brewer", "accessory"] }),
  // Which brew method this specific machine/brewer makes — the owner's own
  // override if set, else falls back to the linked product's methodHint (see
  // equipmentMethodHint in apps/web/src/state/store.ts). Only meaningful for
  // "machine"/"brewer" kind equipment; null on grinders/accessories, and the
  // only source of truth for custom (non-catalog) gear, which has no linked
  // product to fall back to.
  methodHint: text("method_hint", {
    enum: ["espresso", "v60", "aeropress", "frenchpress", "moka"],
  }),
  notes: text("notes"),
```

Delete the entire `setup` table block (currently lines 94-111):

```typescript
export const setup = sqliteTable("setup", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  method: text("method", {
    enum: ["espresso", "v60", "aeropress", "frenchpress", "moka", "auto"],
  }).notNull(),
  grinderEquipmentId: text("grinder_equipment_id")
    .notNull()
    .references(() => equipment.id),
  machineEquipmentId: text("machine_equipment_id").references(() => equipment.id),
  beanId: text("bean_id").references(() => bean.id),
  accessoryEquipmentIds: text("accessory_equipment_ids", { mode: "json" }).$type<string[]>().default([]),
  ...syncColumns,
});
```

In the `bean` table (currently lines 113-133), add `beanType` right after `process`:

```typescript
  process: text("process", {
    enum: ["washed", "natural", "honey", "anaerobic", "other"],
  }),
  // Distinguishes espresso vs. filter/pour-over beans — feeds deriveBrewMethod
  // (packages/core/src/brewMethod.ts) as the fallback when the selected
  // machine has no methodHint of its own. Null means unknown (existing rows,
  // or a user who skipped the field) — deriveBrewMethod treats that the same
  // as "no info", defaulting to espresso.
  beanType: text("bean_type", { enum: ["espresso", "filter"] }),
  roastLevel: integer("roast_level"),
```

In the `recipe` table (currently lines 149-162), replace the `setupId` column:

```typescript
  setupId: text("setup_id")
    .notNull()
    .references(() => setup.id),
```

with:

```typescript
  grinderEquipmentId: text("grinder_equipment_id")
    .notNull()
    .references(() => equipment.id),
  machineEquipmentId: text("machine_equipment_id").references(() => equipment.id),
```

In the `brew` table (currently lines 164-213), replace the `setupId` column:

```typescript
  setupId: text("setup_id")
    .notNull()
    .references(() => setup.id),
```

with:

```typescript
  grinderEquipmentId: text("grinder_equipment_id")
    .notNull()
    .references(() => equipment.id),
  machineEquipmentId: text("machine_equipment_id").references(() => equipment.id),
```

Delete the `Setup`/`NewSetup` type exports (currently lines 219-220):

```typescript
export type Setup = typeof setup.$inferSelect;
export type NewSetup = typeof setup.$inferInsert;
```

- [ ] **Step 2: Update `packages/db/src/schema.test.ts`**

Current full content:

```typescript
import { describe, expect, it } from "vitest";
import { bean, brew, equipment, product, recipe, setup, weatherSnapshot } from "./schema";

describe("schema", () => {
  it("exports all core tables", () => {
    expect(product).toBeDefined();
    expect(equipment).toBeDefined();
    expect(setup).toBeDefined();
    expect(bean).toBeDefined();
    expect(weatherSnapshot).toBeDefined();
    expect(brew).toBeDefined();
    expect(recipe).toBeDefined();
  });
});
```

Replace with:

```typescript
import { describe, expect, it } from "vitest";
import { bean, brew, equipment, product, recipe, weatherSnapshot } from "./schema";

describe("schema", () => {
  it("exports all core tables", () => {
    expect(product).toBeDefined();
    expect(equipment).toBeDefined();
    expect(bean).toBeDefined();
    expect(weatherSnapshot).toBeDefined();
    expect(brew).toBeDefined();
    expect(recipe).toBeDefined();
  });
});
```

- [ ] **Step 3: Typecheck (expect errors elsewhere — that's fine for now)**

Run: `pnpm --filter @kvarn/db typecheck && pnpm --filter @kvarn/db test`
Expected: PASS (this package alone doesn't reference `setup` anywhere else).

Run: `pnpm --filter @kvarn/db lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema.ts packages/db/src/schema.test.ts
git commit -m "Schema: add beanType/methodHint columns, replace setupId with grinder/machine ids, drop setup table"
```

Note: this commit alone breaks `apps/worker` and `apps/web` typechecks (they still reference `setup`/`Setup`/`setupId` everywhere) — that's expected and fixed by later tasks in this plan. Don't run the full workspace typecheck until Task 8.

---

### Task 2: Generate and hand-fix the D1 migration

**Files:**
- Create: `packages/db/migrations/00XX_<auto-generated-name>.sql` (exact filename decided by drizzle-kit at generation time)

- [ ] **Step 1: Generate the migration**

Run: `pnpm --filter @kvarn/db generate`

This produces a new file `packages/db/migrations/00XX_<name>.sql` (drizzle-kit picks the number and a random two-word name — use whatever it generates). It will contain, in some order, statements resembling:
- `ALTER TABLE product ADD method_hint text;`
- `ALTER TABLE equipment ADD method_hint text;`
- `ALTER TABLE bean ADD bean_type text;`
- `ALTER TABLE recipe ADD grinder_equipment_id text NOT NULL REFERENCES equipment(id);` (and `machine_equipment_id`)
- `ALTER TABLE brew ADD grinder_equipment_id text NOT NULL REFERENCES equipment(id);` (and `machine_equipment_id`)
- `ALTER TABLE recipe DROP COLUMN setup_id;`
- `ALTER TABLE brew DROP COLUMN setup_id;`
- `DROP TABLE setup;`

Read the generated file in full before continuing.

- [ ] **Step 2: Reorder if needed and insert backfill UPDATEs**

The generated statements MUST end up in this order (drizzle-kit may not order them correctly for our purposes — a `NOT NULL` add on `brew.grinder_equipment_id`/`recipe.grinder_equipment_id` without a `DEFAULT` will fail on existing non-empty tables, so this needs manual adjustment regardless):

1. All `ALTER TABLE ... ADD ...` statements (product/equipment/bean method_hint+bean_type, and recipe/brew's new grinder_equipment_id/machine_equipment_id — added WITHOUT `NOT NULL` initially, see below).
2. The two backfill `UPDATE` statements (write these yourself — drizzle-kit never generates data-migration UPDATEs, only structural ALTER/DROP statements).
3. `ALTER TABLE brew DROP COLUMN setup_id;` / `ALTER TABLE recipe DROP COLUMN setup_id;`
4. `DROP TABLE setup;`

Since SQLite's `ALTER TABLE ADD COLUMN ... NOT NULL` requires a `DEFAULT` when the table already has rows, and D1's existing `brew`/`recipe` rows have no sensible default grinder id, add `grinder_equipment_id`/`machine_equipment_id` as plain nullable columns first, backfill them, and only enforce non-null at the application/TypeScript layer (matching this schema's existing pattern — e.g. `weatherId`/`machineEquipmentId` are nullable FKs with no DB-level `NOT NULL` enforcement beyond what Drizzle's schema.ts types declare for future inserts). Concretely: if drizzle-kit generated `grinder_equipment_id text NOT NULL REFERENCES equipment(id)`, remove the `NOT NULL` from the SQL migration (Drizzle's `schema.ts` TypeScript type still says `.notNull()` for new rows going forward — SQLite itself just won't enforce it retroactively on the ALTER, which is fine and matches how this codebase already treats FK columns).

Write the final migration file content as:

```sql
ALTER TABLE `product` ADD `method_hint` text;--> statement-breakpoint
ALTER TABLE `equipment` ADD `method_hint` text;--> statement-breakpoint
ALTER TABLE `bean` ADD `bean_type` text;--> statement-breakpoint
ALTER TABLE `recipe` ADD `grinder_equipment_id` text REFERENCES equipment(id);--> statement-breakpoint
ALTER TABLE `recipe` ADD `machine_equipment_id` text REFERENCES equipment(id);--> statement-breakpoint
ALTER TABLE `brew` ADD `grinder_equipment_id` text REFERENCES equipment(id);--> statement-breakpoint
ALTER TABLE `brew` ADD `machine_equipment_id` text REFERENCES equipment(id);--> statement-breakpoint
UPDATE `recipe` SET `grinder_equipment_id` = (SELECT `grinder_equipment_id` FROM `setup` WHERE `setup`.`id` = `recipe`.`setup_id`), `machine_equipment_id` = (SELECT `machine_equipment_id` FROM `setup` WHERE `setup`.`id` = `recipe`.`setup_id`);--> statement-breakpoint
UPDATE `brew` SET `grinder_equipment_id` = (SELECT `grinder_equipment_id` FROM `setup` WHERE `setup`.`id` = `brew`.`setup_id`), `machine_equipment_id` = (SELECT `machine_equipment_id` FROM `setup` WHERE `setup`.`id` = `brew`.`setup_id`);--> statement-breakpoint
ALTER TABLE `recipe` DROP COLUMN `setup_id`;--> statement-breakpoint
ALTER TABLE `brew` DROP COLUMN `setup_id`;--> statement-breakpoint
DROP TABLE `setup`;
```

(Use the exact same `--> statement-breakpoint` separator convention already present in this project's other multi-statement migrations, e.g. `packages/db/migrations/0003_supreme_zemo.sql`. If drizzle-kit generated different literal column ordering or a different journal/meta entry, keep whatever filename and `packages/db/migrations/meta/_journal.json` entry it created — only the SQL body above needs to match this content, adjusted to the actual generated filename.)

- [ ] **Step 2: Apply and verify against local D1**

Run: `cd apps/worker && pnpm db:migrate:local`
Expected: applies cleanly with no errors.

Run: `cd apps/worker && npx wrangler d1 execute kvarn --local --command "SELECT sql FROM sqlite_master WHERE type='table' AND name IN ('brew','recipe','bean','equipment','product')"`
Expected: shows `grinder_equipment_id`/`machine_equipment_id` on brew/recipe, `bean_type` on bean, `method_hint` on equipment/product, and confirms `setup_id` is gone from brew/recipe. If you have pre-existing local dev data with setups/brews, additionally run `SELECT grinder_equipment_id, machine_equipment_id FROM brew LIMIT 5;` to confirm the backfill actually populated real (non-null) ids rather than nulls — if your local D1 has no pre-existing brew rows, this check will just return no rows, which is fine.

- [ ] **Step 3: Commit**

```bash
git add packages/db/migrations
git commit -m "Add D1 migration: backfill grinder/machine ids from setup, then drop setup table"
```

Do not run `pnpm --filter @kvarn/worker db:migrate:remote` yet — that's Task 19's job, after everything else in this plan is verified end-to-end.

---

### Task 3: `deriveBrewMethod` — pure derivation logic

**Files:**
- Create: `packages/core/src/brewMethod.ts`
- Create: `packages/core/src/brewMethod.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/brewMethod.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { deriveBrewMethod } from "./brewMethod";

describe("deriveBrewMethod", () => {
  it("prefers the machine's methodHint when set, regardless of bean type", () => {
    expect(deriveBrewMethod("filter", "espresso")).toBe("espresso");
    expect(deriveBrewMethod("espresso", "aeropress")).toBe("aeropress");
    expect(deriveBrewMethod(null, "moka")).toBe("moka");
  });

  it("falls back to bean type when the machine has no methodHint", () => {
    expect(deriveBrewMethod("espresso", null)).toBe("espresso");
    expect(deriveBrewMethod("espresso", undefined)).toBe("espresso");
    expect(deriveBrewMethod("filter", null)).toBe("v60");
  });

  it("defaults to espresso when nothing is known", () => {
    expect(deriveBrewMethod(null, null)).toBe("espresso");
    expect(deriveBrewMethod(undefined, undefined)).toBe("espresso");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @kvarn/core test -- brewMethod`
Expected: FAIL with "Cannot find module './brewMethod'" or similar.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/brewMethod.ts`:

```typescript
import type { BrewMethod } from "./units";

export type MachineMethodHint = "espresso" | "v60" | "aeropress" | "frenchpress" | "moka";
export type BeanType = "espresso" | "filter";

/**
 * Replaces the old explicit method dropdown (setup.method): the machine's
 * own methodHint wins if set (a Rancilio is always "espresso", an Aeropress
 * is always "aeropress"); otherwise the bean's type picks a sensible bucket
 * ("filter" beans default to the "v60" target-time profile, the most
 * generic non-espresso method); if neither is known, espresso — see
 * docs/superpowers/specs/2026-07-14-remove-setup-concept-design.md §2.
 */
export function deriveBrewMethod(
  beanType: BeanType | null | undefined,
  machineMethodHint: MachineMethodHint | null | undefined,
): BrewMethod {
  if (machineMethodHint) return machineMethodHint;
  if (beanType === "espresso") return "espresso";
  if (beanType === "filter") return "v60";
  return "espresso";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @kvarn/core test -- brewMethod`
Expected: PASS, 3 tests.

- [ ] **Step 5: Export from the package index**

In `packages/core/src/index.ts`, current full content:

```typescript
export * from "./units";
export * from "./ratio";
export * from "./compass";
export * from "./freshness";
export * from "./weather";
export * from "./grindClicks";
```

Add one line:

```typescript
export * from "./units";
export * from "./ratio";
export * from "./compass";
export * from "./freshness";
export * from "./weather";
export * from "./grindClicks";
export * from "./brewMethod";
```

- [ ] **Step 6: Typecheck and lint**

Run: `pnpm --filter @kvarn/core typecheck && pnpm --filter @kvarn/core lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/brewMethod.ts packages/core/src/brewMethod.test.ts packages/core/src/index.ts
git commit -m "Add deriveBrewMethod: bean type + machine method hint replace the method dropdown"
```

---

### Task 4: Local Dexie v3 migration — backfill from setup, drop setups table

**Files:**
- Modify: `apps/web/src/data/db.ts`
- Modify: `apps/web/src/data/db.test.ts`

- [ ] **Step 1: Write the failing test**

The migration's data-transform logic is extracted as a pure function (`backfillFromSetup`) so it's testable without a live Dexie `setups` table — once v3 lands, `db.setups` no longer exists as a queryable table at all, so the v2 precedent's "write a legacy row into the live table" approach doesn't apply here.

Add to `apps/web/src/data/db.test.ts` (after the existing `describe("Dexie migration to version 2", ...)` block, before the final closing — i.e. as a new top-level `describe`):

```typescript
describe("backfillFromSetup (v3 migration: setup -> grinder/machine ids)", () => {
  it("maps setupId to grinderEquipmentId/machineEquipmentId and drops setupId", async () => {
    const { backfillFromSetup } = await import("./db");
    const setups = [{ id: "setup_1", grinderEquipmentId: "equipment_grinder", machineEquipmentId: "equipment_machine" }];
    const result = backfillFromSetup(setups, { id: "brew_1", setupId: "setup_1", doseG: 18 });
    expect(result).toEqual({ id: "brew_1", doseG: 18, grinderEquipmentId: "equipment_grinder", machineEquipmentId: "equipment_machine" });
    expect("setupId" in result).toBe(false);
  });

  it("falls back to null grinder/machine ids for an orphaned setupId (shouldn't happen in practice, but is safe)", async () => {
    const { backfillFromSetup } = await import("./db");
    const result = backfillFromSetup([], { id: "brew_2", setupId: "missing_setup" });
    expect(result.grinderEquipmentId).toBeNull();
    expect(result.machineEquipmentId).toBeNull();
  });

  it("carries a setup with no machine through as machineEquipmentId: null", async () => {
    const { backfillFromSetup } = await import("./db");
    const setups = [{ id: "setup_2", grinderEquipmentId: "equipment_grinder", machineEquipmentId: null }];
    const result = backfillFromSetup(setups, { id: "recipe_1", setupId: "setup_2", beanId: "bean_1" });
    expect(result.grinderEquipmentId).toBe("equipment_grinder");
    expect(result.machineEquipmentId).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @kvarn/web test -- db.test`
Expected: FAIL — `backfillFromSetup` is not exported yet.

- [ ] **Step 3: Implement the migration**

In `apps/web/src/data/db.ts`, current top of file:

```typescript
import Dexie, { type EntityTable } from "dexie";
import type { Bean, Brew, Equipment, Product, Recipe, Setup, WeatherSnapshot } from "@kvarn/db";
```

Replace with (drop the now-nonexistent `Setup` type import):

```typescript
import Dexie, { type EntityTable } from "dexie";
import type { Bean, Brew, Equipment, Product, Recipe, WeatherSnapshot } from "@kvarn/db";
```

Current class definition:

```typescript
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
```

Replace with (remove the `setups!` field, remove `setups`/`setupId` from every `.stores()` map, add the v3 version bump):

```typescript
export class KvarnDB extends Dexie {
  products!: EntityTable<Product, "id">;
  equipment!: EntityTable<Equipment, "id">;
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
    // v3: removes the "Setup" concept entirely — brews/recipes now record
    // grinderEquipmentId/machineEquipmentId directly instead of a saved
    // setupId, and the setups table itself is dropped. `setups: null` is
    // Dexie's syntax for deleting a table in a version upgrade.
    this.version(3)
      .stores({
        setups: null,
        brews: "id, userId, grinderEquipmentId, machineEquipmentId, beanId, brewedAt",
        recipes: "id, userId, grinderEquipmentId, machineEquipmentId, beanId",
      })
      .upgrade(async (tx) => {
        const setups = (await tx.table("setups").toArray()) as LegacySetup[];
        const brews = (await tx.table("brews").toArray()) as LegacyRowWithSetup[];
        const recipes = (await tx.table("recipes").toArray()) as LegacyRowWithSetup[];
        await Promise.all([
          ...brews.map((row) => tx.table("brews").put(backfillFromSetup(setups, row))),
          ...recipes.map((row) => tx.table("recipes").put(backfillFromSetup(setups, row))),
        ]);
      });
  }
}
```

Add these types and the exported pure function right before the `export class KvarnDB` line:

```typescript
interface LegacySetup {
  id: string;
  grinderEquipmentId: string;
  machineEquipmentId: string | null;
}

interface LegacyRowWithSetup {
  id: string;
  setupId: string;
  [key: string]: unknown;
}

/**
 * Maps a row that had `setupId` onto the new grinderEquipmentId/
 * machineEquipmentId shape, using its linked setup — pure and Dexie-free so
 * it's directly unit-testable (see db.test.ts) without needing a live
 * `setups` table, which no longer exists once v3's `.stores()` above takes
 * effect. The v3 `.upgrade()` is a thin wrapper: read the (about-to-be-
 * removed) setups table plus brews/recipes, call this, write results back.
 * An orphaned setupId (shouldn't happen in practice — every setup existed
 * before any brew could reference it) falls back to null for both new
 * fields rather than throwing, since this runs inside a real user's
 * migration and must never fail their upgrade.
 */
export function backfillFromSetup(setups: LegacySetup[], row: LegacyRowWithSetup): Record<string, unknown> {
  const { setupId, ...rest } = row;
  const setup = setups.find((s) => s.id === setupId);
  return { ...rest, grinderEquipmentId: setup?.grinderEquipmentId ?? null, machineEquipmentId: setup?.machineEquipmentId ?? null };
}
```

- [ ] **Step 4: Update `exportAllData()`**

Current:

```typescript
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
```

Replace with:

```typescript
export async function exportAllData() {
  const [equipment, beans, brews, weatherSnapshots, recipes] = await Promise.all([
    db.equipment.toArray(),
    db.beans.toArray(),
    db.brews.toArray(),
    db.weatherSnapshots.toArray(),
    db.recipes.toArray(),
  ]);
  return { exportedAt: nowIso(), equipment, beans, brews, weatherSnapshots, recipes };
}
```

- [ ] **Step 5: Bump the seed catalog version**

`ensureSeeded()`'s `SEED_CATALOG_VERSION` constant must bump since Task 9 will add `methodHint` to every machine/brewer entry in `seed-products.json` — existing installs need to re-sync the catalog to pick that up. Current:

```typescript
const SEED_CATALOG_VERSION = 6;
```

Change to:

```typescript
const SEED_CATALOG_VERSION = 7;
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @kvarn/web test -- db.test`
Expected: PASS, all tests including the 3 new `backfillFromSetup` ones.

- [ ] **Step 7: Typecheck and lint**

Run: `pnpm --filter @kvarn/web typecheck`
Expected: still FAILS at this point — `state/store.ts` and every screen still reference `db.setups`, `Setup`, etc. This is expected; Task 5 fixes the store, later tasks fix the screens. Confirm the errors are ONLY in files this plan hasn't touched yet (not in `db.ts` or `db.test.ts` themselves) — `pnpm --filter @kvarn/web typecheck 2>&1 | grep -v "state/store\|routes/\|components/\|hooks/"` should show no remaining errors once you exclude those known-not-yet-fixed paths.

Run: `pnpm --filter @kvarn/web lint`
Expected: PASS for `db.ts`/`db.test.ts` specifically (lint doesn't cross-reference other files' type errors the way typecheck does).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/data/db.ts apps/web/src/data/db.test.ts
git commit -m "Dexie v3: backfill grinder/machine ids from setup, drop setups table"
```

---

### Task 5: Rewrite `apps/web/src/state/store.ts`

**Files:**
- Modify: `apps/web/src/state/store.ts`

This is a full-file rewrite — nearly every export changes. Replace the entire file with:

```typescript
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
    const latest = brews[0];
    set({
      hydrated: true,
      products,
      equipment,
      beans,
      brews,
      weatherSnapshots,
      recipes,
      activeGrinderEquipmentId: latest?.grinderEquipmentId ?? null,
      activeMachineEquipmentId: latest?.machineEquipmentId ?? null,
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
 * fields null if there's no brew history yet) — powers Home's "ready for
 * your next brew" prefilled card, and hydrate()'s initial active picks.
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
```

- [ ] **Step 2: Typecheck (still expect errors in files this task doesn't touch)**

Run: `pnpm --filter @kvarn/web typecheck 2>&1 | grep -c "error TS"`

Compare the error count against before this task's edit — it should have dropped substantially (no more errors originating from `store.ts` itself), with remaining errors confined to route/component/hook files not yet updated (Tasks 7-18 fix those). Read through the remaining error list once to confirm none of them point at `state/store.ts`.

- [ ] **Step 3: Lint**

Run: `pnpm --filter @kvarn/web lint`
Expected: PASS (ESLint doesn't cross-file typecheck, so this should be clean even though other files still reference removed store exports).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/state/store.ts
git commit -m "Store: replace setup state/actions with independent grinder/machine/bean picks"
```

---

### Task 6: Rewrite `apps/web/src/state/store.test.ts`

**Files:**
- Modify: `apps/web/src/state/store.test.ts`

- [ ] **Step 1: Replace the full file**

Replace the entire file with:

```typescript
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

    // Simulate a pre-migration row with no kind column populated.
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

    // Never brewed with — added after `older`, so its updatedAt is later,
    // and it should sort ahead despite having zero brew history.
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
```

Note: `baseBrewInput(...) as never` casts are used at each `commitBrew(...)` call site because the helper deliberately omits `grinderEquipmentId`/`machineEquipmentId`/`beanId` (each test supplies those itself via the object spread) — TypeScript can't see that the spread always fills them in, so the cast avoids fighting the compiler over a pattern the test file controls end-to-end. This mirrors how the codebase already tolerates targeted `as any`/`as never` in test fixtures (e.g. `db.test.ts`'s legacy-row fixtures) rather than over-engineering test-only types.

- [ ] **Step 2: Run tests**

Run: `pnpm --filter @kvarn/web test -- store.test`
Expected: PASS, all tests.

- [ ] **Step 3: Typecheck and lint**

Run: `pnpm --filter @kvarn/web typecheck 2>&1 | grep -c "error TS"`
Compare against Task 5's count — should be unchanged or lower (this task only touches the test file).

Run: `pnpm --filter @kvarn/web lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/state/store.test.ts
git commit -m "Update store tests for grinder/machine/bean picks replacing setup"
```

---

### Task 7: Update `apps/worker/src/sync.ts` and its test

**Files:**
- Modify: `apps/worker/src/sync.ts`
- Modify: `apps/worker/src/sync.test.ts`

- [ ] **Step 1: Edit `apps/worker/src/sync.ts`**

Current imports (top of file):

```typescript
import { Hono } from "hono";
import { and, eq, gt, inArray } from "drizzle-orm";
import {
  equipment,
  setup,
  bean,
  brew,
  recipe,
  weatherSnapshot,
  type Equipment,
  type Setup,
  type Bean,
  type Brew,
  type Recipe,
  type WeatherSnapshot,
} from "@kvarn/db";
import type { Env } from "./env";
import { getDb } from "./db";
import { createAuth } from "./auth";
```

Replace with (drop `setup`/`Setup`):

```typescript
import { Hono } from "hono";
import { and, eq, gt, inArray } from "drizzle-orm";
import {
  equipment,
  bean,
  brew,
  recipe,
  weatherSnapshot,
  type Equipment,
  type Bean,
  type Brew,
  type Recipe,
  type WeatherSnapshot,
} from "@kvarn/db";
import type { Env } from "./env";
import { getDb } from "./db";
import { createAuth } from "./auth";
```

Current `SyncPushBody` interface:

```typescript
interface SyncPushBody {
  since: string | null;
  equipment: Equipment[];
  setups: Setup[];
  beans: Bean[];
  brews: Brew[];
  recipes: Recipe[];
  weatherSnapshots: WeatherSnapshot[];
}
```

Replace with (drop `setups`):

```typescript
interface SyncPushBody {
  since: string | null;
  equipment: Equipment[];
  beans: Bean[];
  brews: Brew[];
  recipes: Recipe[];
  weatherSnapshots: WeatherSnapshot[];
}
```

Delete the entire `mergeSetups` function:

```typescript
async function mergeSetups(db: ReturnType<typeof getDb>, userId: string, rows: Setup[]) {
  for (const row of rows) {
    const existing = await db.select().from(setup).where(and(eq(setup.userId, userId), eq(setup.clientId, row.clientId))).get();
    if (existing && existing.updatedAt >= row.updatedAt) continue;
    if (existing) await db.update(setup).set({ ...row, userId }).where(and(eq(setup.userId, userId), eq(setup.clientId, row.clientId)));
    else await db.insert(setup).values({ ...row, userId });
  }
}
```

In the `sync.post("/", ...)` handler, remove the `mergeSetups` call:

```typescript
  await mergeEquipment(db, userId, body.equipment);
  await mergeSetups(db, userId, body.setups);
  await mergeBeans(db, userId, body.beans);
```

becomes:

```typescript
  await mergeEquipment(db, userId, body.equipment);
  await mergeBeans(db, userId, body.beans);
```

Remove `setup`/`setupsOut` from the pull-query `Promise.all`:

```typescript
  const since = body.since ?? EPOCH;
  const [equipmentOut, setupsOut, beansOut, brewsOut, recipesOut] = await Promise.all([
    db.select().from(equipment).where(and(eq(equipment.userId, userId), gt(equipment.updatedAt, since))),
    db.select().from(setup).where(and(eq(setup.userId, userId), gt(setup.updatedAt, since))),
    db.select().from(bean).where(and(eq(bean.userId, userId), gt(bean.updatedAt, since))),
    db.select().from(brew).where(and(eq(brew.userId, userId), gt(brew.updatedAt, since))),
    db.select().from(recipe).where(and(eq(recipe.userId, userId), gt(recipe.updatedAt, since))),
  ]);
```

becomes:

```typescript
  const since = body.since ?? EPOCH;
  const [equipmentOut, beansOut, brewsOut, recipesOut] = await Promise.all([
    db.select().from(equipment).where(and(eq(equipment.userId, userId), gt(equipment.updatedAt, since))),
    db.select().from(bean).where(and(eq(bean.userId, userId), gt(bean.updatedAt, since))),
    db.select().from(brew).where(and(eq(brew.userId, userId), gt(brew.updatedAt, since))),
    db.select().from(recipe).where(and(eq(recipe.userId, userId), gt(recipe.updatedAt, since))),
  ]);
```

And drop `setups` from the final response:

```typescript
  return c.json({
    syncedAt: new Date().toISOString(),
    equipment: equipmentOut,
    setups: setupsOut,
    beans: beansOut,
    brews: brewsOut,
    recipes: recipesOut,
    weatherSnapshots: weatherSnapshotsOut,
  });
```

becomes:

```typescript
  return c.json({
    syncedAt: new Date().toISOString(),
    equipment: equipmentOut,
    beans: beansOut,
    brews: brewsOut,
    recipes: recipesOut,
    weatherSnapshots: weatherSnapshotsOut,
  });
```

`mergeBrews`/`mergeRecipes` themselves need no code changes — they already spread `{ ...row, userId }` generically, so the new `grinderEquipmentId`/`machineEquipmentId` columns pass through automatically.

- [ ] **Step 2: Update `apps/worker/src/sync.test.ts`**

Current:

```typescript
        body: JSON.stringify({ since: null, equipment: [], setups: [], beans: [], brews: [], recipes: [], weatherSnapshots: [] }),
```

Replace with:

```typescript
        body: JSON.stringify({ since: null, equipment: [], beans: [], brews: [], recipes: [], weatherSnapshots: [] }),
```

- [ ] **Step 3: Typecheck, lint, test**

Run: `pnpm --filter @kvarn/worker typecheck && pnpm --filter @kvarn/worker lint && pnpm --filter @kvarn/worker test`
Expected: all PASS (this package has no other `setup` references — `apps/worker/src/index.ts` and other routes don't touch it).

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/sync.ts apps/worker/src/sync.test.ts
git commit -m "Remove setup merge/pull from POST /api/sync"
```

---

### Task 8: Update `apps/web/src/sync/runSync.ts`

**Files:**
- Modify: `apps/web/src/sync/runSync.ts`

- [ ] **Step 1: Edit the file**

Current imports:

```typescript
import type { Bean, Brew, Equipment, Recipe, Setup, WeatherSnapshot } from "@kvarn/db";
```

Replace with:

```typescript
import type { Bean, Brew, Equipment, Recipe, WeatherSnapshot } from "@kvarn/db";
```

Current `SyncResponseBody` interface:

```typescript
interface SyncResponseBody {
  syncedAt: string;
  equipment: Equipment[];
  setups: Setup[];
  beans: Bean[];
  brews: Brew[];
  recipes: Recipe[];
  weatherSnapshots: WeatherSnapshot[];
}
```

Replace with:

```typescript
interface SyncResponseBody {
  syncedAt: string;
  equipment: Equipment[];
  beans: Bean[];
  brews: Brew[];
  recipes: Recipe[];
  weatherSnapshots: WeatherSnapshot[];
}
```

In `doRunSync()`, current push-side fetch:

```typescript
    const since = getLastSyncedAt();
    const [equipment, setups, beans, brews, recipes, weatherSnapshots] = await Promise.all([
      db.equipment.toArray(),
      db.setups.toArray(),
      db.beans.toArray(),
      db.brews.toArray(),
      db.recipes.toArray(),
      db.weatherSnapshots.toArray(),
    ]);
    const isChanged = (row: { updatedAt: string }) => !since || row.updatedAt > since;

    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        since,
        equipment: equipment.filter(isChanged),
        setups: setups.filter(isChanged),
        beans: beans.filter(isChanged),
        brews: brews.filter(isChanged),
        recipes: recipes.filter(isChanged),
        weatherSnapshots: weatherSnapshots.filter(isChanged),
      }),
    });
```

Replace with:

```typescript
    const since = getLastSyncedAt();
    const [equipment, beans, brews, recipes, weatherSnapshots] = await Promise.all([
      db.equipment.toArray(),
      db.beans.toArray(),
      db.brews.toArray(),
      db.recipes.toArray(),
      db.weatherSnapshots.toArray(),
    ]);
    const isChanged = (row: { updatedAt: string }) => !since || row.updatedAt > since;

    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        since,
        equipment: equipment.filter(isChanged),
        beans: beans.filter(isChanged),
        brews: brews.filter(isChanged),
        recipes: recipes.filter(isChanged),
        weatherSnapshots: weatherSnapshots.filter(isChanged),
      }),
    });
```

Current pull-side write-back:

```typescript
    const body = (await res.json()) as SyncResponseBody;
    // bulkPut is an idempotent upsert keyed on id, and the server merge is
    // idempotent LWW keyed on (userId, clientId) — safe to retry from
    // scratch (same `since`) if a write below throws partway through.
    await Promise.all([
      db.equipment.bulkPut(body.equipment),
      db.setups.bulkPut(body.setups),
      db.beans.bulkPut(body.beans),
      db.brews.bulkPut(body.brews),
      db.recipes.bulkPut(body.recipes),
      db.weatherSnapshots.bulkPut(body.weatherSnapshots),
    ]);
```

Replace with:

```typescript
    const body = (await res.json()) as SyncResponseBody;
    // bulkPut is an idempotent upsert keyed on id, and the server merge is
    // idempotent LWW keyed on (userId, clientId) — safe to retry from
    // scratch (same `since`) if a write below throws partway through.
    await Promise.all([
      db.equipment.bulkPut(body.equipment),
      db.beans.bulkPut(body.beans),
      db.brews.bulkPut(body.brews),
      db.recipes.bulkPut(body.recipes),
      db.weatherSnapshots.bulkPut(body.weatherSnapshots),
    ]);
```

- [ ] **Step 2: Typecheck and lint**

Run: `pnpm --filter @kvarn/web typecheck 2>&1 | grep -c "error TS"`
Compare against Task 6's count — should have dropped (no more errors from `runSync.ts`).

Run: `pnpm --filter @kvarn/web lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/sync/runSync.ts
git commit -m "Drop setups from the client-side sync payload"
```

---

### Task 9: Add `methodHint` to the product catalog

**Files:**
- Modify: `apps/web/public/data/seed-products.json`
- Modify: `packages/db/seed/products.sql` (regenerated, not hand-edited)

The catalog has 191 "machine" (espresso machine) products and 6 "brewer" (V60/Aeropress/French press/moka/pourover dripper/kettle) products — all "machine" kind entries get `methodHint: "espresso"`; the 6 "brewer" entries get a specific mapping. Since hand-editing 197 JSON entries isn't practical, this is done with a one-off script, run once, then deleted.

- [ ] **Step 1: Write and run the one-off script**

Create a scratch file `/tmp/add-method-hints.mjs` (NOT committed — deleted after running) with:

```javascript
#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const path = "apps/web/public/data/seed-products.json";
const products = JSON.parse(readFileSync(path, "utf8"));

// Specific-brewer mapping — everything else falls through to the kind-based
// rule below. brewer-fellow-stagg-x6 is a gooseneck kettle (an accessory
// mis-categorized as "brewer" in the existing catalog, pre-dating this
// feature) with no coherent brew method of its own — left null, which
// deriveBrewMethod treats the same as "unknown" (falls back to bean type).
const BREWER_METHOD_HINTS = {
  "brewer-hario-v60-02-ceramic": "v60",
  "brewer-aeropress-original": "aeropress",
  "brewer-bodum-chambord-french-press": "frenchpress",
  "brewer-bialetti-moka-express": "moka",
  "brewer-origami-dripper-s": "v60",
  "brewer-fellow-stagg-x6": null,
};

let updated = 0;
for (const p of products) {
  if (p.kind === "machine") {
    p.methodHint = "espresso";
    updated++;
  } else if (p.kind === "brewer") {
    const hint = BREWER_METHOD_HINTS[p.id] ?? null;
    if (hint) p.methodHint = hint;
    updated++;
  }
}

writeFileSync(path, JSON.stringify(products, null, 2) + "\n");
console.log(`Updated ${updated} product entries with methodHint.`);
```

Run: `cd /Users/helgemorgenstern/Projekte/kvarn_coffee_grinder_app/kvarn && node /tmp/add-method-hints.mjs`
Expected output: `Updated 197 product entries with methodHint.`

Delete the scratch script: `rm /tmp/add-method-hints.mjs`

- [ ] **Step 2: Verify the diff looks right**

Run: `git diff apps/web/public/data/seed-products.json | head -60`
Expected: a large diff, every "machine"/"brewer" kind object gaining one new `"methodHint": "..."` line, JSON formatting otherwise unchanged (same 2-space indent as before — confirm by checking a few unrelated lines show no diff).

Run: `grep -c '"methodHint"' apps/web/public/data/seed-products.json`
Expected: `196` (191 machine + 5 brewer entries that got a non-null hint; the kettle stays without the key since `if (hint)` skipped writing it for a null value).

- [ ] **Step 3: Regenerate the D1 seed SQL mirror**

Run: `node packages/db/scripts/generate-seed-sql.mjs`
Expected output: `Wrote <N> product rows to .../packages/db/seed/products.sql` (N = total catalog size, unchanged count from before).

Run: `git diff --stat packages/db/seed/products.sql`
Expected: every row changed (the generated `INSERT` statements now include a `method_hint` value) — this is expected, not a bug, since the script regenerates the whole file from scratch each time.

- [ ] **Step 4: Typecheck and lint (JSON/SQL files aren't typechecked, but confirm nothing else broke)**

Run: `pnpm --filter @kvarn/web typecheck 2>&1 | grep -c "error TS"`
Expected: unchanged from Task 8 (this task doesn't touch any TypeScript).

- [ ] **Step 5: Commit**

```bash
git add apps/web/public/data/seed-products.json packages/db/seed/products.sql
git commit -m "Add methodHint to catalog machine/brewer products"
```

---

### Task 10: Widen `EquipmentSearchSection` to include "brewer" gear, add a method-hint field for custom gear

**Files:**
- Modify: `apps/web/src/components/EquipmentSearchSection.tsx`
- Modify: `apps/web/src/i18n/de.ts`
- Modify: `apps/web/src/i18n/en.ts`

Today, searching under `kind="machine"` only matches catalog products with `product.kind === "machine"` — the 6 "brewer" kind products (V60, Aeropress, etc.) are unreachable through this search entirely. Since Task 9 gave brewer products method hints and the store's `sortedMachines()` (Task 5) already treats "machine"+"brewer" as one picker, this section needs to actually surface both when searching under `kind="machine"`.

- [ ] **Step 1: Add i18n strings**

In `apps/web/src/i18n/de.ts`, inside the `setup` namespace, right after `submitError` (an arbitrary but stable anchor point — the important thing is these land inside the `setup` object):

```typescript
    submitError: "Ging gerade nicht (kein Server erreichbar?). Später erneut versuchen.",
```

Add after it:

```typescript
    submitError: "Ging gerade nicht (kein Server erreichbar?). Später erneut versuchen.",
    methodHintPlaceholder: "Zubereitungsart (optional)",
    methodHintEspresso: "Espresso",
    methodHintV60: "V60",
    methodHintAeropress: "Aeropress",
    methodHintFrenchpress: "French Press",
    methodHintMoka: "Moka",
```

In `apps/web/src/i18n/en.ts`, same anchor:

```typescript
    submitError: "Couldn't submit (server unreachable?). Try again later.",
```

Add after it:

```typescript
    submitError: "Couldn't submit (server unreachable?). Try again later.",
    methodHintPlaceholder: "Brew method (optional)",
    methodHintEspresso: "Espresso",
    methodHintV60: "V60",
    methodHintAeropress: "Aeropress",
    methodHintFrenchpress: "French press",
    methodHintMoka: "Moka pot",
```

- [ ] **Step 2: Edit `EquipmentSearchSection.tsx`**

Current imports:

```typescript
import { useMemo, useState } from "react";
import { Button, Card, EntityImage, ProductCard, SectionLabel } from "@kvarn/ui";
import { generateIllustrationFromPhoto, submitProduct, uploadPhoto } from "@kvarn/api-client";
import type { LucideIcon } from "lucide-react";
import { Camera, Users } from "lucide-react";
import { exampleEquipment } from "../utils/exampleEquipment";
import { useKvarnStore } from "../state/store";
import { useT } from "../i18n";
```

Replace with (add `Select` and `Equipment` type):

```typescript
import { useMemo, useState } from "react";
import { Button, Card, EntityImage, ProductCard, SectionLabel, Select } from "@kvarn/ui";
import { generateIllustrationFromPhoto, submitProduct, uploadPhoto } from "@kvarn/api-client";
import type { Equipment } from "@kvarn/db";
import type { LucideIcon } from "lucide-react";
import { Camera, Users } from "lucide-react";
import { exampleEquipment } from "../utils/exampleEquipment";
import { useKvarnStore } from "../state/store";
import { useT } from "../i18n";

const METHOD_HINTS: NonNullable<Equipment["methodHint"]>[] = ["espresso", "v60", "aeropress", "frenchpress", "moka"];
const METHOD_HINT_LABEL_KEYS: Record<NonNullable<Equipment["methodHint"]>, string> = {
  espresso: "methodHintEspresso",
  v60: "methodHintV60",
  aeropress: "methodHintAeropress",
  frenchpress: "methodHintFrenchpress",
  moka: "methodHintMoka",
};
```

Current state block:

```typescript
  const { products, addEquipmentFromProduct, addCustomEquipment, setEquipmentImage } = useKvarnStore();
  const t = useT("setup");
  const [query, setQuery] = useState("");
  const examples = useMemo(() => exampleEquipment(products, kind), [products, kind]);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submitBrand, setSubmitBrand] = useState("");
  const [submitModel, setSubmitModel] = useState("");
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const [customPhotoFile, setCustomPhotoFile] = useState<File | null>(null);
  const [customPhotoBusy, setCustomPhotoBusy] = useState(false);

  const filteredProducts = useMemo(() => {
    if (!query) return [];
    const q = query.toLowerCase();
    return products.filter((p) => p.kind === kind && `${p.brand} ${p.model}`.toLowerCase().includes(q)).slice(0, 8);
  }, [products, query, kind]);

  async function handleAddCustom() {
    setCustomPhotoBusy(true);
    try {
      const photoUrl = customPhotoFile ? await uploadPhoto(customPhotoFile).catch(() => undefined) : undefined;
      const created = await addCustomEquipment(query, kind, photoUrl);
```

Replace with:

```typescript
  const { products, addEquipmentFromProduct, addCustomEquipment, setEquipmentImage } = useKvarnStore();
  const t = useT("setup");
  const [query, setQuery] = useState("");
  const examples = useMemo(() => exampleEquipment(products, kind), [products, kind]);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submitBrand, setSubmitBrand] = useState("");
  const [submitModel, setSubmitModel] = useState("");
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const [customPhotoFile, setCustomPhotoFile] = useState<File | null>(null);
  const [customPhotoBusy, setCustomPhotoBusy] = useState(false);
  const [customMethodHint, setCustomMethodHint] = useState<Equipment["methodHint"]>(null);

  // "machine" also surfaces catalog "brewer" products (V60, Aeropress, French
  // press, moka pot) — from the user's perspective there's one "what did you
  // brew on" concept, not two separate catalog kinds. See sortedMachines() in
  // state/store.ts, which groups them the same way.
  const filteredProducts = useMemo(() => {
    if (!query) return [];
    const q = query.toLowerCase();
    return products
      .filter((p) => (p.kind === kind || (kind === "machine" && p.kind === "brewer")) && `${p.brand} ${p.model}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [products, query, kind]);

  async function handleAddCustom() {
    setCustomPhotoBusy(true);
    try {
      const photoUrl = customPhotoFile ? await uploadPhoto(customPhotoFile).catch(() => undefined) : undefined;
      const created = await addCustomEquipment(query, kind, photoUrl, undefined, kind === "machine" ? customMethodHint : undefined);
```

Current custom-add success handling (right after the `addCustomEquipment` call, unchanged structurally but reset the new field too):

```typescript
      const label = query;
      setQuery("");
      setCustomPhotoFile(null);
      onAdded?.(created.id);
```

Replace with:

```typescript
      const label = query;
      setQuery("");
      setCustomPhotoFile(null);
      setCustomMethodHint(null);
      onAdded?.(created.id);
```

Current JSX for the "no catalog match" branch:

```tsx
      {query && filteredProducts.length === 0 ? (
        <div className="mt-2 flex flex-col gap-2 items-start">
          <label className="flex items-center gap-1.5 text-[13px] text-muted cursor-pointer py-2.5 -my-2.5">
```

Replace with (add the method-hint select, only for `kind === "machine"`, right before the photo label):

```tsx
      {query && filteredProducts.length === 0 ? (
        <div className="mt-2 flex flex-col gap-2 items-start w-full">
          {kind === "machine" ? (
            <Select
              value={customMethodHint ?? ""}
              onChange={(v) => setCustomMethodHint((v || null) as Equipment["methodHint"])}
              placeholder={t("methodHintPlaceholder")}
              options={METHOD_HINTS.map((m) => ({ value: m, label: t(METHOD_HINT_LABEL_KEYS[m]) }))}
            />
          ) : null}
          <label className="flex items-center gap-1.5 text-[13px] text-muted cursor-pointer py-2.5 -my-2.5">
```

- [ ] **Step 3: Typecheck and lint**

Run: `pnpm --filter @kvarn/web typecheck 2>&1 | grep -c "error TS"`
Compare against Task 9's count (unchanged, since Task 9 didn't touch TS) — should drop now that `EquipmentSearchSection.tsx`'s `addCustomEquipment` call matches the new 5-arg signature from Task 5.

Run: `pnpm --filter @kvarn/web lint`
Expected: PASS.

- [ ] **Step 4: Manual verification**

Using this project's preview tooling: open Setup (or Onboarding's machine step), search for "aeropress" or "v60" under the "Add machine" section — confirm the catalog brewer products now appear (previously they didn't). Try adding a custom "machine" and confirm the optional method-hint select appears and works; confirm it does NOT appear when adding a custom grinder.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/EquipmentSearchSection.tsx apps/web/src/i18n/de.ts apps/web/src/i18n/en.ts
git commit -m "Search brewer-kind gear under 'machine'; add optional method hint for custom gear"
```

---

### Task 11: Add `beanType` to `BeanForm`

**Files:**
- Modify: `apps/web/src/components/BeanForm.tsx`
- Modify: `apps/web/src/i18n/de.ts`
- Modify: `apps/web/src/i18n/en.ts`

- [ ] **Step 1: Add i18n strings**

In `apps/web/src/i18n/de.ts`, inside the `regal` namespace, right after `originPlaceholder`:

```typescript
    originPlaceholder: "Herkunft (optional)",
```

Add after it:

```typescript
    originPlaceholder: "Herkunft (optional)",
    beanTypePlaceholder: "Espresso oder Filter?",
    beanTypeEspresso: "Espresso",
    beanTypeFilter: "Filter",
```

In `apps/web/src/i18n/en.ts`, same anchor:

```typescript
    originPlaceholder: "Origin (optional)",
```

Add after it:

```typescript
    originPlaceholder: "Origin (optional)",
    beanTypePlaceholder: "Espresso or filter?",
    beanTypeEspresso: "Espresso",
    beanTypeFilter: "Filter",
```

- [ ] **Step 2: Edit `BeanForm.tsx`**

Current imports:

```typescript
import { useMemo, useState } from "react";
import { Button } from "@kvarn/ui";
import { generateIllustrationFromPhoto, uploadPhoto } from "@kvarn/api-client";
import type { Bean } from "@kvarn/db";
import { Camera, Search } from "lucide-react";
import { useKvarnStore } from "../state/store";
import { useT } from "../i18n";
```

Replace with:

```typescript
import { useMemo, useState } from "react";
import { Button, Select } from "@kvarn/ui";
import { generateIllustrationFromPhoto, uploadPhoto } from "@kvarn/api-client";
import type { Bean } from "@kvarn/db";
import { Camera, Search } from "lucide-react";
import { useKvarnStore } from "../state/store";
import { useT } from "../i18n";
```

Current state block:

```typescript
  const [origin, setOrigin] = useState("");
  const [roastDate, setRoastDate] = useState("");
```

Replace with:

```typescript
  const [origin, setOrigin] = useState("");
  const [beanType, setBeanType] = useState<Bean["beanType"]>(null);
  const [roastDate, setRoastDate] = useState("");
```

Current `submit` function:

```typescript
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!roaster || !name) return;
    const bean = await addBean({ roaster, name, origin: origin || undefined, roastDate: roastDate || undefined, photoUrl });
    if (photoUrl) {
      // Best-effort: the raw photo already shows fine — the generated
      // illustration just swaps in once/if it's ready.
      generateIllustrationFromPhoto({ photoUrl, label: `${roaster} ${name}`, kind: "bean" })
        .then((result) => setBeanImage(bean.id, result.imageUrl))
        .catch(() => {});
    }
    setRoaster("");
    setName("");
    setOrigin("");
    setRoastDate("");
    setPhotoUrl(undefined);
    onSaved?.(bean);
  }
```

Replace with:

```typescript
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!roaster || !name) return;
    const bean = await addBean({ roaster, name, origin: origin || undefined, roastDate: roastDate || undefined, photoUrl, beanType });
    if (photoUrl) {
      // Best-effort: the raw photo already shows fine — the generated
      // illustration just swaps in once/if it's ready.
      generateIllustrationFromPhoto({ photoUrl, label: `${roaster} ${name}`, kind: "bean" })
        .then((result) => setBeanImage(bean.id, result.imageUrl))
        .catch(() => {});
    }
    setRoaster("");
    setName("");
    setOrigin("");
    setBeanType(null);
    setRoastDate("");
    setPhotoUrl(undefined);
    onSaved?.(bean);
  }
```

Current JSX (origin input, immediately followed by the roast-date label):

```tsx
      <input
        className="border border-linen rounded-control px-3 py-2 text-base bg-birch"
        placeholder={t("originPlaceholder")}
        value={origin}
        onChange={(e) => setOrigin(e.target.value)}
      />
      <label className="text-sm text-muted -mb-2">{t("roastDateLabel")}</label>
```

Replace with (insert the beanType select between origin and roast date):

```tsx
      <input
        className="border border-linen rounded-control px-3 py-2 text-base bg-birch"
        placeholder={t("originPlaceholder")}
        value={origin}
        onChange={(e) => setOrigin(e.target.value)}
      />
      <Select
        value={beanType ?? ""}
        onChange={(v) => setBeanType((v || null) as Bean["beanType"])}
        placeholder={t("beanTypePlaceholder")}
        options={[
          { value: "espresso", label: t("beanTypeEspresso") },
          { value: "filter", label: t("beanTypeFilter") },
        ]}
      />
      <label className="text-sm text-muted -mb-2">{t("roastDateLabel")}</label>
```

- [ ] **Step 3: Typecheck and lint**

Run: `pnpm --filter @kvarn/web typecheck 2>&1 | grep -c "error TS"`
Should drop further (BeanForm's `addBean` call now matches the store's updated signature).

Run: `pnpm --filter @kvarn/web lint`
Expected: PASS.

- [ ] **Step 4: Manual verification**

Using the preview tooling: open Regal's "add bean" form (or Onboarding's bean step, which reuses `BeanForm`), confirm the "Espresso or filter?" select appears between origin and roast date, and saving a bean with it set persists correctly (check via `preview_eval` reading `db.beans` or just re-opening the bean's detail — full display isn't required by this task, just that the value round-trips).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/BeanForm.tsx apps/web/src/i18n/de.ts apps/web/src/i18n/en.ts
git commit -m "Add beanType field to BeanForm"
```

---

### Task 12: Shared `GrinderMachineBeanPicker` component, update `useGrindSuggestion`, delete `SetupThumbnail`

**Files:**
- Create: `apps/web/src/components/GrinderMachineBeanPicker.tsx`
- Modify: `apps/web/src/hooks/useGrindSuggestion.ts`
- Delete: `apps/web/src/components/SetupThumbnail.tsx`

- [ ] **Step 1: Create the shared picker component**

Create `apps/web/src/components/GrinderMachineBeanPicker.tsx`:

```tsx
import { EntityImage, ProductCard, SectionLabel } from "@kvarn/ui";
import { Coffee, Package, SlidersHorizontal, X } from "lucide-react";
import { equipmentProduct, sortedBeans, sortedGrinders, sortedMachines, useKvarnStore } from "../state/store";
import { useT } from "../i18n";

/**
 * Shared grinder → machine → bean picker for starting a brew session (live
 * timer or manual historical entry) — replaces the old saved-"Setup" picker
 * and the inline "combo" assembly UI. Each list is pre-sorted most-recently-
 * used first (see sortedGrinders/sortedMachines/sortedBeans in
 * state/store.ts). Controlled component — the caller owns which ids are
 * selected (either the store's global active picks, for the live-brew flow,
 * or its own local state, for manual historical entry).
 */
export function GrinderMachineBeanPicker({
  grinderEquipmentId,
  machineEquipmentId,
  beanId,
  onGrinderChange,
  onMachineChange,
  onBeanChange,
}: {
  grinderEquipmentId: string;
  machineEquipmentId: string | null;
  beanId: string;
  onGrinderChange: (id: string) => void;
  onMachineChange: (id: string | null) => void;
  onBeanChange: (id: string) => void;
}) {
  const state = useKvarnStore();
  const t = useT("bruehen");
  const grinders = sortedGrinders(state);
  const machines = sortedMachines(state);
  const beans = sortedBeans(state);

  return (
    <>
      <SectionLabel icon={SlidersHorizontal} className="mt-5">{t("pickGrinder")}</SectionLabel>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5">
        {grinders.map((eq) => (
          <ProductCard
            key={eq.id}
            className="w-28 flex-none"
            active={grinderEquipmentId === eq.id}
            onClick={() => onGrinderChange(eq.id)}
            image={<EntityImage src={equipmentProduct(state, eq.id)?.imageUrl} kind="grinder" className="w-full h-full" />}
          >
            <div className="text-[13px] font-medium leading-tight truncate">
              {eq.customName ?? equipmentProduct(state, eq.id)?.model ?? "—"}
            </div>
          </ProductCard>
        ))}
      </div>

      <SectionLabel icon={Coffee} className="mt-5">{t("pickMachine")}</SectionLabel>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5">
        <ProductCard
          className="w-28 flex-none"
          active={machineEquipmentId === null}
          onClick={() => onMachineChange(null)}
          image={
            <div className="w-full h-full flex items-center justify-center text-muted">
              <X size={28} strokeWidth={1.5} />
            </div>
          }
        >
          <div className="text-[13px] font-medium leading-tight truncate">{t("noMachine")}</div>
        </ProductCard>
        {machines.map((eq) => (
          <ProductCard
            key={eq.id}
            className="w-28 flex-none"
            active={machineEquipmentId === eq.id}
            onClick={() => onMachineChange(eq.id)}
            image={<EntityImage src={equipmentProduct(state, eq.id)?.imageUrl} kind="machine" className="w-full h-full" />}
          >
            <div className="text-[13px] font-medium leading-tight truncate">
              {eq.customName ?? equipmentProduct(state, eq.id)?.model ?? "—"}
            </div>
          </ProductCard>
        ))}
      </div>

      <SectionLabel icon={Package} className="mt-5">{t("pickBean")}</SectionLabel>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5">
        {beans.map((b) => (
          <ProductCard
            key={b.id}
            className="w-28 flex-none"
            active={beanId === b.id}
            onClick={() => onBeanChange(b.id)}
            image={<EntityImage src={b.imageUrl ?? b.photoUrl} kind="bean" className="w-full h-full" />}
          >
            <div className="text-[13px] font-medium leading-tight truncate">{b.roaster}</div>
          </ProductCard>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Update `useGrindSuggestion.ts`**

Current full content:

```typescript
import { useMemo } from "react";
import { nextGrindSuggestion } from "@kvarn/core";
import type { Bean, Setup, WeatherSnapshot } from "@kvarn/db";
import { equipmentGrindScale, lastBrewFor, weatherSnapshotFor, type KvarnState } from "../state/store";
import { beanAgeDaysFor } from "../utils/beanAge";

/**
 * Shared with Bruehen (active weather capture) and Heute (passive preview of
 * the latest known snapshot) — same Kompass reasoning, different weather
 * sourcing per docs/02_UX_KONZEPT.md's "weather never blocks/prompts
 * unexpectedly" rule.
 */
export function useGrindSuggestion(
  state: KvarnState,
  setup: Setup | undefined,
  bean: Bean | undefined,
  weatherSnapshot: WeatherSnapshot | null | undefined,
) {
  const grindScale = equipmentGrindScale(state, setup?.grinderEquipmentId ?? null);

  const suggestion = useMemo(() => {
    if (!setup || !bean) return null;
    const lastBrew = lastBrewFor(state, setup.id, bean.id);
    const lastWeather = lastBrew ? weatherSnapshotFor(state, lastBrew.weatherId) : undefined;
    const humidityDeltaPct =
      weatherSnapshot?.humidityPct != null && lastWeather?.humidityPct != null
        ? weatherSnapshot.humidityPct - lastWeather.humidityPct
        : undefined;
    return nextGrindSuggestion({
      method: setup.method,
      grindScale,
      lastBrew: lastBrew
        ? { grindSetting: lastBrew.grindSetting, timeTotalS: lastBrew.timeTotalS, balance: lastBrew.balance ?? 0 }
        : null,
      beanAgeDays: beanAgeDaysFor(bean.roastDate) ?? undefined,
      humidityDeltaPct,
    });
    // Only recompute when the underlying combination or the weather snapshot
    // changes, not on every render — this is a one-shot default, not live.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup?.id, bean?.id, weatherSnapshot?.id]);

  return { grindScale, suggestion };
}
```

Replace with:

```typescript
import { useMemo } from "react";
import { deriveBrewMethod, nextGrindSuggestion } from "@kvarn/core";
import type { Bean, WeatherSnapshot } from "@kvarn/db";
import { equipmentGrindScale, equipmentMethodHint, lastBrewFor, weatherSnapshotFor, type KvarnState } from "../state/store";
import { beanAgeDaysFor } from "../utils/beanAge";

/**
 * Shared with Bruehen (active weather capture), Heute (passive preview of
 * the latest known snapshot), and ManualBrewEntry (historical entry, no live
 * weather) — same Kompass reasoning, different weather sourcing per
 * docs/02_UX_KONZEPT.md's "weather never blocks/prompts unexpectedly" rule.
 * Method is no longer a stored field (see docs/superpowers/specs/
 * 2026-07-14-remove-setup-concept-design.md) — it's derived here from the
 * bean's type and the selected machine's method hint.
 */
export function useGrindSuggestion(
  state: KvarnState,
  grinderEquipmentId: string | null,
  machineEquipmentId: string | null,
  bean: Bean | undefined,
  weatherSnapshot: WeatherSnapshot | null | undefined,
) {
  const grindScale = equipmentGrindScale(state, grinderEquipmentId);
  const method = deriveBrewMethod(bean?.beanType, equipmentMethodHint(state, machineEquipmentId));

  const suggestion = useMemo(() => {
    if (!grinderEquipmentId || !bean) return null;
    const lastBrew = lastBrewFor(state, grinderEquipmentId, machineEquipmentId, bean.id);
    const lastWeather = lastBrew ? weatherSnapshotFor(state, lastBrew.weatherId) : undefined;
    const humidityDeltaPct =
      weatherSnapshot?.humidityPct != null && lastWeather?.humidityPct != null
        ? weatherSnapshot.humidityPct - lastWeather.humidityPct
        : undefined;
    return nextGrindSuggestion({
      method,
      grindScale,
      lastBrew: lastBrew
        ? { grindSetting: lastBrew.grindSetting, timeTotalS: lastBrew.timeTotalS, balance: lastBrew.balance ?? 0 }
        : null,
      beanAgeDays: beanAgeDaysFor(bean.roastDate) ?? undefined,
      humidityDeltaPct,
    });
    // Only recompute when the underlying combination or the weather snapshot
    // changes, not on every render — this is a one-shot default, not live.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grinderEquipmentId, machineEquipmentId, bean?.id, weatherSnapshot?.id]);

  return { grindScale, suggestion, method };
}
```

- [ ] **Step 3: Delete `SetupThumbnail.tsx`**

Run: `git rm apps/web/src/components/SetupThumbnail.tsx`

(This will leave dangling imports in `Bruehen.tsx`/`Heute.tsx`/`Setup.tsx` until Tasks 13/15/17 rewrite them — that's expected and fixed by those tasks.)

- [ ] **Step 4: Typecheck (still expect errors in files not yet updated)**

Run: `pnpm --filter @kvarn/web typecheck 2>&1 | grep -c "error TS"`
Expect the count to have CHANGED (not necessarily dropped — `useGrindSuggestion`'s new signature now also breaks its remaining call sites until Tasks 13-15 fix them, in addition to fixing the ones that were already broken). Read through the errors once to confirm they're all in `routes/Bruehen.tsx`, `routes/Heute.tsx`, `routes/Setup.tsx`, or `components/ManualBrewEntry.tsx` — the four files this plan hasn't rewritten yet.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/GrinderMachineBeanPicker.tsx apps/web/src/hooks/useGrindSuggestion.ts
git commit -m "Add shared GrinderMachineBeanPicker; update useGrindSuggestion to derive method"
```

(The `git rm` from Step 3 stages automatically; it'll be included in this same commit.)

---

### Task 13: Rewrite `apps/web/src/routes/Bruehen.tsx`

**Files:**
- Modify: `apps/web/src/routes/Bruehen.tsx`
- Modify: `apps/web/src/i18n/de.ts`
- Modify: `apps/web/src/i18n/en.ts`

- [ ] **Step 1: Update i18n**

In `apps/web/src/i18n/de.ts`, inside the `bruehen` namespace, current:

```typescript
    modeSetup: "Setup wählen",
    modeCombo: "Einzeln wählen",
    modeManual: "Nachtragen",
    manualSetupBeanTitle: "Welches Setup, welche Bohne?",
```

Replace with:

```typescript
    modeLive: "Live brühen",
    modeManual: "Nachtragen",
    manualPickTitle: "Welche Mühle, welche Maschine, welche Bohne?",
```

Current:

```typescript
    needsSetupAndBean: "Erst Setup und Bohne anlegen, dann geht's hier weiter.",
```

Replace with:

```typescript
    needsSetupAndBean: "Erst eine Mühle und eine Bohne anlegen, dann geht's hier weiter.",
```

Current:

```typescript
    pickMethod: "Zubereitungsart",
    pickGrinder: "Mühle",
```

Replace with (drop `pickMethod`, it's no longer chosen manually):

```typescript
    pickGrinder: "Mühle",
```

Current:

```typescript
    comboConfirm: "Übernehmen",
```

Delete this line entirely (no more separate "confirm combo" step — the picker writes directly to the active picks).

In `apps/web/src/i18n/en.ts`, same namespace, current:

```typescript
    modeSetup: "Choose setup",
    modeCombo: "Pick individually",
    modeManual: "Log past brew",
    manualSetupBeanTitle: "Which setup, which bean?",
```

Replace with:

```typescript
    modeLive: "Brew live",
    modeManual: "Log past brew",
    manualPickTitle: "Which grinder, which machine, which bean?",
```

Current:

```typescript
    needsSetupAndBean: "Add a setup and a bean first, then you can brew.",
```

Replace with:

```typescript
    needsSetupAndBean: "Add a grinder and a bean first, then you can brew.",
```

Current:

```typescript
    pickMethod: "Method",
    pickGrinder: "Grinder",
```

Replace with:

```typescript
    pickGrinder: "Grinder",
```

Current:

```typescript
    comboConfirm: "Use this combo",
```

Delete this line entirely.

- [ ] **Step 2: Replace the full file**

Replace the entire content of `apps/web/src/routes/Bruehen.tsx` with:

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button, Card, Chip, EntityImage, Hint, ParamStepper, RatingSlider, RatioViz, TimerRing, WeatherStrip } from "@kvarn/ui";
import { computeRatio, weatherConditionKey } from "@kvarn/core";
import type { WeatherSnapshot } from "@kvarn/db";
import { BarChart3, CheckCircle2, Home } from "lucide-react";
import { equipmentKind, equipmentProduct, formatGrindValue, useKvarnStore } from "../state/store";
import { GrindStepper } from "../components/GrindStepper";
import { GrinderMachineBeanPicker } from "../components/GrinderMachineBeanPicker";
import { ManualBrewEntry } from "../components/ManualBrewEntry";
import { useGrindSuggestion } from "../hooks/useGrindSuggestion";
import { useStopwatch } from "../hooks/useStopwatch";
import { beanAgeDaysFor } from "../utils/beanAge";
import { CONDITION_I18N_KEY } from "../utils/weatherLabels";
import { useLocale, useT, useTags } from "../i18n";

type Step = "params" | "timer" | "rating";
type PickMode = "live" | "manual";

export function Bruehen() {
  const state = useKvarnStore();
  const {
    equipment,
    beans,
    activeGrinderEquipmentId,
    activeMachineEquipmentId,
    activeBeanId,
    setActiveGrinder,
    setActiveMachine,
    setActiveBean,
  } = state;
  const grinder = equipment.find((e) => e.id === activeGrinderEquipmentId);
  const bean = beans.find((b) => b.id === activeBeanId);
  const commitBrew = useKvarnStore((s) => s.commitBrew);
  const captureWeatherSnapshot = useKvarnStore((s) => s.captureWeatherSnapshot);
  const navigate = useNavigate();
  const stopwatch = useStopwatch();
  const t = useT("bruehen");
  const tHeute = useT("heute");
  const { locale } = useLocale();
  const visualTagOptions = useTags("bruehen", "visualTags");
  const flavorTagOptions = useTags("bruehen", "flavorTags");

  const [pickMode, setPickMode] = useState<PickMode>("live");

  const [weatherSnapshot, setWeatherSnapshot] = useState<WeatherSnapshot | null>(null);

  useEffect(() => {
    captureWeatherSnapshot().then(setWeatherSnapshot);
    // Capture once per brew session, on entering the screen — not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { grindScale, suggestion } = useGrindSuggestion(
    state,
    activeGrinderEquipmentId,
    activeMachineEquipmentId,
    bean,
    weatherSnapshot,
  );

  const [step, setStep] = useState<Step>("params");
  const [grindSetting, setGrindSetting] = useState(
    () => suggestion?.grindSetting ?? Math.round(((grindScale.min + grindScale.max) / 2) / grindScale.step) * grindScale.step,
  );

  // Users can switch grinder/machine/bean via the picker below while still on
  // the params step — re-sync the grind default to match whatever is now
  // active instead of leaving it stuck on the first pick's suggestion.
  useEffect(() => {
    if (suggestion) setGrindSetting(suggestion.grindSetting);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGrinderEquipmentId, activeMachineEquipmentId, bean?.id]);
  const [doseG, setDoseG] = useState(18);
  const [targetYieldG, setTargetYieldG] = useState(36);
  const [preinfusion, setPreinfusion] = useState(false);
  const [preinfusionS, setPreinfusionS] = useState(5);
  const [actualYieldG, setActualYieldG] = useState(36);
  const [ratingTotal, setRatingTotal] = useState(7);
  const [balance, setBalance] = useState(0);
  const [visualTags, setVisualTags] = useState<string[]>([]);
  const [flavorTags, setFlavorTags] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  if (!activeGrinderEquipmentId || !bean) {
    return (
      <div>
        <h1 className="font-display text-[32px] mt-3.5 mb-0.5">{t("title")}</h1>
        <Card>
          <p className="text-base">{t("needsSetupAndBean")}</p>
        </Card>
      </div>
    );
  }

  function toggleTag(list: string[], setList: (v: string[]) => void, tag: string) {
    setList(list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]);
  }

  async function finish() {
    await commitBrew({
      grinderEquipmentId: activeGrinderEquipmentId!,
      machineEquipmentId: activeMachineEquipmentId,
      beanId: bean!.id,
      weatherId: weatherSnapshot?.id ?? null,
      brewedAt: new Date().toISOString(),
      grindSetting,
      doseG,
      targetYieldG,
      waterTempC: null,
      preinfusionS: preinfusion ? preinfusionS : null,
      puckPrep: null,
      beanAgeDays: beanAgeDaysFor(bean!.roastDate),
      timeTotalS: Math.round(stopwatch.elapsedS * 10) / 10,
      timeFirstDropS: null,
      pressureAvgBar: null,
      pressurePeakBar: null,
      actualYieldG,
      flowGs: stopwatch.elapsedS > 0 ? Math.round((actualYieldG / stopwatch.elapsedS) * 10) / 10 : null,
      ratingTotal,
      balance,
      sweetness: null,
      body: null,
      crema: null,
      visualTags,
      flavorTags,
      tdsPct: null,
      note: null,
      photoUrl: null,
      isDialIn: false,
      isManualEntry: false,
      recipeId: null,
    });
    setSaved(true);
  }

  if (saved) {
    return (
      <div>
        <h1 className="flex items-center gap-2 font-display text-[32px] mt-3.5 mb-0.5">
          <CheckCircle2 className="text-sage" size={28} strokeWidth={1.5} />
          {t("savedTitle")}
        </h1>
        <p className="text-base text-muted">{t("savedSubtitle")}</p>
        <Button onClick={() => navigate({ to: "/" })}>
          <Home size={18} strokeWidth={1.5} />
          {t("backToToday")}
        </Button>
        <Button variant="ghost" onClick={() => navigate({ to: "/kompass" })}>
          <BarChart3 size={18} strokeWidth={1.5} />
          {t("viewLog")}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-[32px] mt-3.5 mb-0.5">{t("title")}</h1>
      <p className="text-base text-muted">
        {grinder?.customName ?? equipmentProduct(state, grinder?.id ?? null)?.model ?? "—"} · {bean.roaster} — {bean.name}
      </p>
      {weatherSnapshot ? (
        <WeatherStrip
          className="mt-3"
          tempC={weatherSnapshot.tempC}
          humidityPct={weatherSnapshot.humidityPct}
          pressureHpa={weatherSnapshot.pressureHpa}
          condition={tHeute(CONDITION_I18N_KEY[weatherConditionKey(weatherSnapshot.weatherCode)] ?? "condUnknown")}
          humidityLabel={tHeute("weatherHumidity")}
          pressureLabel={tHeute("weatherPressure")}
        />
      ) : null}

      {step === "params" ? (
        <>
          <div className="flex gap-2 mt-5">
            <Chip active={pickMode === "live"} onClick={() => setPickMode("live")}>
              {t("modeLive")}
            </Chip>
            <Chip active={pickMode === "manual"} onClick={() => setPickMode("manual")}>
              {t("modeManual")}
            </Chip>
          </div>

          {pickMode === "live" ? (
            <GrinderMachineBeanPicker
              grinderEquipmentId={activeGrinderEquipmentId}
              machineEquipmentId={activeMachineEquipmentId}
              beanId={bean.id}
              onGrinderChange={setActiveGrinder}
              onMachineChange={setActiveMachine}
              onBeanChange={setActiveBean}
            />
          ) : null}

          {pickMode === "manual" ? <ManualBrewEntry /> : null}
        </>
      ) : null}

      {step === "params" && pickMode !== "manual" ? (
        <Card>
          <GrindStepper
            label={grindScale.label || t("grindLabel")}
            grindScale={grindScale}
            value={grindSetting}
            onChange={setGrindSetting}
            locale={locale}
          />
          <ParamStepper label={t("doseLabel")} unit={t("doseUnit")} value={doseG} step={0.5} min={1} onChange={setDoseG} />
          <ParamStepper
            label={t("targetYieldLabel")}
            unit={t("targetYieldUnit")}
            value={targetYieldG}
            step={1}
            min={1}
            onChange={setTargetYieldG}
          />
          <div className="flex items-center justify-between py-[13px] border-b border-linen last:border-b-0">
            <div className="text-base">{t("preinfusion")}</div>
            <button
              type="button"
              role="switch"
              aria-checked={preinfusion}
              onClick={() => setPreinfusion((v) => !v)}
              className={`w-11 h-6 rounded-full relative transition-colors ${preinfusion ? "bg-copper" : "bg-linen"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${preinfusion ? "translate-x-5" : ""}`}
              />
            </button>
          </div>
          {preinfusion ? (
            <ParamStepper
              label={t("preinfusionDuration")}
              unit={t("preinfusionUnit")}
              value={preinfusionS}
              step={1}
              min={1}
              onChange={setPreinfusionS}
            />
          ) : null}
          <div className="flex justify-between text-sm text-muted pt-3">
            <span>{t("ratio")}</span>
            <span className="num">1:{computeRatio({ doseG, yieldG: targetYieldG })}</span>
          </div>
          <RatioViz
            className="mt-2"
            doseG={doseG}
            yieldG={targetYieldG}
            doseLabel={`${t("doseLabel")} ${doseG}g`}
            yieldLabel={`${targetYieldG}g ${t("targetYieldLabel")}`}
          />
          {suggestion && suggestion.reasons.length > 0 ? (
            <Hint>
              <span>
                {t("compassSuggestion", {
                  grind: formatGrindValue(state, activeGrinderEquipmentId, suggestion.grindSetting, locale),
                  unit: grindScale.unit,
                  reasons: suggestion.reasons.map((r) => r.effect).join(" "),
                })}
              </span>
            </Hint>
          ) : null}
          <Button
            onClick={() => {
              setStep("timer");
              stopwatch.start();
            }}
          >
            {t("startTimer")}
          </Button>
        </Card>
      ) : null}

      {step === "timer" ? (
        <div className="flex flex-col items-center pt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex flex-col items-center gap-1">
              <EntityImage
                src={equipmentProduct(state, activeGrinderEquipmentId)?.imageUrl}
                kind={equipmentKind(state, activeGrinderEquipmentId)}
                className="w-14 h-14 rounded-control"
              />
              <span className="text-[11px] text-muted">{t("pickGrinder")}</span>
            </div>
            {activeMachineEquipmentId ? (
              <div className="flex flex-col items-center gap-1">
                <EntityImage
                  src={equipmentProduct(state, activeMachineEquipmentId)?.imageUrl}
                  kind="machine"
                  className="w-14 h-14 rounded-control"
                />
                <span className="text-[11px] text-muted">{t("pickMachine")}</span>
              </div>
            ) : null}
            <div className="flex flex-col items-center gap-1">
              <EntityImage src={bean.imageUrl ?? bean.photoUrl} kind="bean" className="w-14 h-14 rounded-control" />
              <span className="text-[11px] text-muted">{t("pickBean")}</span>
            </div>
          </div>
          <TimerRing elapsedS={stopwatch.elapsedS} lapLabel={stopwatch.running ? t("running") : t("stopped")} />
          <div className="w-full mt-6">
            {stopwatch.running ? (
              <Button
                onClick={() => {
                  stopwatch.stop();
                }}
              >
                {t("stop")}
              </Button>
            ) : (
              <>
                <ParamStepper
                  label={t("actualYieldLabel")}
                  unit={t("actualYieldUnit")}
                  value={actualYieldG}
                  step={0.5}
                  min={0}
                  onChange={setActualYieldG}
                />
                <Button onClick={() => setStep("rating")}>{t("continueToRating")}</Button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {step === "rating" ? (
        <Card>
          <RatingSlider label={t("overall")} value={ratingTotal} min={1} max={10} onChange={setRatingTotal} />
          <RatingSlider
            label={t("balance")}
            value={balance}
            min={-5}
            max={5}
            onChange={setBalance}
            bipolarLabels={[t("sour"), t("bitter")]}
          />
          <div className="mt-3">
            <div className="text-sm text-muted mb-2">{t("visual")}</div>
            <div className="flex flex-wrap gap-2">
              {visualTagOptions.map((tag) => (
                <Chip key={tag} active={visualTags.includes(tag)} onClick={() => toggleTag(visualTags, setVisualTags, tag)}>
                  {tag}
                </Chip>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <div className="text-sm text-muted mb-2">{t("aroma")}</div>
            <div className="flex flex-wrap gap-2">
              {flavorTagOptions.map((tag) => (
                <Chip key={tag} active={flavorTags.includes(tag)} onClick={() => toggleTag(flavorTags, setFlavorTags, tag)}>
                  {tag}
                </Chip>
              ))}
            </div>
          </div>
          <Button onClick={finish}>{t("save")}</Button>
        </Card>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `pnpm --filter @kvarn/web typecheck 2>&1 | grep -c "error TS"`
Should drop (Bruehen.tsx no longer references `setup`/`Setup`/`SetupThumbnail`).

Run: `pnpm --filter @kvarn/web lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/routes/Bruehen.tsx apps/web/src/i18n/de.ts apps/web/src/i18n/en.ts
git commit -m "Rewrite Bruehen: grinder/machine/bean picker replaces setup/combo modes"
```

Manual verification of the full brew flow is deferred to Task 19, after ManualBrewEntry (Task 14) is also updated — right now `pickMode === "manual"` would still render the OLD `ManualBrewEntry`, which itself still references `setups` until Task 14 lands, so this specific commit is not independently end-to-end testable in the browser yet.

---

### Task 14: Rewrite `apps/web/src/components/ManualBrewEntry.tsx`

**Files:**
- Modify: `apps/web/src/components/ManualBrewEntry.tsx`

- [ ] **Step 1: Replace the full file**

Replace the entire content with:

```tsx
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BarChart3, CheckCircle2, Home } from "lucide-react";
import { Button, Card, Chip, ParamStepper, RatingSlider, SectionLabel } from "@kvarn/ui";
import { equipmentGrindScale, sortedBeans, sortedGrinders, useKvarnStore } from "../state/store";
import { GrinderMachineBeanPicker } from "./GrinderMachineBeanPicker";
import { useGrindSuggestion } from "../hooks/useGrindSuggestion";
import { useLocale, useT, useTags } from "../i18n";
import { beanAgeDaysFor } from "../utils/beanAge";
import { GrindStepper } from "./GrindStepper";

type ManualStep = "pick" | "paramsTime" | "rating";

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Third mode on the Brühen screen ("Nachtragen"/"Log past brew") — logs a
 * brew that already happened, instead of running the live timer. See
 * docs/superpowers/specs/2026-07-05-manual-brew-entry-design.md and
 * docs/superpowers/specs/2026-07-14-remove-setup-concept-design.md. */
export function ManualBrewEntry() {
  const state = useKvarnStore();
  const { commitBrew } = state;
  const { locale } = useLocale();
  const t = useT("bruehen");
  const visualTagOptions = useTags("bruehen", "visualTags");
  const flavorTagOptions = useTags("bruehen", "flavorTags");
  const navigate = useNavigate();

  const grinders = sortedGrinders(state);
  const beans = sortedBeans(state);

  const [manualStep, setManualStep] = useState<ManualStep>("pick");
  const [grinderEquipmentId, setGrinderEquipmentId] = useState(grinders[0]?.id ?? "");
  const [machineEquipmentId, setMachineEquipmentId] = useState<string | null>(null);
  const [beanId, setBeanId] = useState(beans[0]?.id ?? "");
  const [brewedAt, setBrewedAt] = useState(() => new Date().toISOString());
  const [doseG, setDoseG] = useState(18);
  const [targetYieldG, setTargetYieldG] = useState(36);
  const [actualYieldG, setActualYieldG] = useState(36);
  const [timeTotalS, setTimeTotalS] = useState(25);
  const [preinfusion, setPreinfusion] = useState(false);
  const [preinfusionS, setPreinfusionS] = useState(5);
  const [ratingTotal, setRatingTotal] = useState(7);
  const [balance, setBalance] = useState(0);
  const [visualTags, setVisualTags] = useState<string[]>([]);
  const [flavorTags, setFlavorTags] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const bean = beans.find((b) => b.id === beanId);
  const { grindScale, suggestion } = useGrindSuggestion(state, grinderEquipmentId || null, machineEquipmentId, bean, null);
  const [grindSetting, setGrindSetting] = useState(() => suggestion?.grindSetting ?? equipmentGrindScale(state, grinderEquipmentId || null).min);

  function toggleTag(list: string[], setList: (v: string[]) => void, tag: string) {
    setList(list.includes(tag) ? list.filter((x) => x !== tag) : [...list, tag]);
  }

  async function finish() {
    if (!grinderEquipmentId || !bean) return;
    await commitBrew({
      grinderEquipmentId,
      machineEquipmentId,
      beanId: bean.id,
      weatherId: null,
      brewedAt,
      grindSetting,
      doseG,
      targetYieldG,
      waterTempC: null,
      preinfusionS: preinfusion ? preinfusionS : null,
      puckPrep: null,
      beanAgeDays: beanAgeDaysFor(bean.roastDate, brewedAt),
      timeTotalS,
      timeFirstDropS: null,
      pressureAvgBar: null,
      pressurePeakBar: null,
      actualYieldG,
      flowGs: timeTotalS > 0 ? Math.round((actualYieldG / timeTotalS) * 10) / 10 : null,
      ratingTotal,
      balance,
      sweetness: null,
      body: null,
      crema: null,
      visualTags,
      flavorTags,
      tdsPct: null,
      note: null,
      photoUrl: null,
      isDialIn: false,
      recipeId: null,
      isManualEntry: true,
    });
    setSaved(true);
  }

  if (saved) {
    return (
      <div>
        <h1 className="flex items-center gap-2 font-display text-[32px] mt-3.5 mb-0.5">
          <CheckCircle2 className="text-sage" size={28} strokeWidth={1.5} />
          {t("savedTitle")}
        </h1>
        <p className="text-base text-muted">{t("savedSubtitle")}</p>
        <Button onClick={() => navigate({ to: "/" })}>
          <Home size={18} strokeWidth={1.5} />
          {t("backToToday")}
        </Button>
        <Button variant="ghost" onClick={() => navigate({ to: "/kompass" })}>
          <BarChart3 size={18} strokeWidth={1.5} />
          {t("viewLog")}
        </Button>
      </div>
    );
  }

  if (manualStep === "pick") {
    return (
      <Card>
        <SectionLabel>{t("manualPickTitle")}</SectionLabel>
        <GrinderMachineBeanPicker
          grinderEquipmentId={grinderEquipmentId}
          machineEquipmentId={machineEquipmentId}
          beanId={beanId}
          onGrinderChange={setGrinderEquipmentId}
          onMachineChange={setMachineEquipmentId}
          onBeanChange={setBeanId}
        />
        <Button disabled={!grinderEquipmentId || !beanId} onClick={() => setManualStep("paramsTime")}>
          {t("next")}
        </Button>
      </Card>
    );
  }

  if (manualStep === "paramsTime") {
    return (
      <Card>
        <div className="flex flex-col gap-0.5 py-[13px] border-b border-linen">
          <label className="text-[13px] text-muted">{t("manualBrewedAt")}</label>
          <input
            type="datetime-local"
            value={toDatetimeLocalValue(brewedAt)}
            onChange={(e) => setBrewedAt(new Date(e.target.value).toISOString())}
            className="border border-linen rounded-control px-3 py-2 text-base bg-birch"
          />
        </div>
        <GrindStepper label={grindScale.label || t("grindLabel")} grindScale={grindScale} value={grindSetting} onChange={setGrindSetting} locale={locale} />
        <ParamStepper label={t("doseLabel")} unit={t("doseUnit")} value={doseG} step={0.5} min={1} onChange={setDoseG} />
        <ParamStepper label={t("targetYieldLabel")} unit={t("targetYieldUnit")} value={targetYieldG} step={1} min={1} onChange={setTargetYieldG} />
        <ParamStepper label={t("actualYieldLabel")} unit={t("actualYieldUnit")} value={actualYieldG} step={0.5} min={0} onChange={setActualYieldG} />
        <ParamStepper label={t("manualTimeTotal")} unit={t("manualTimeUnit")} value={timeTotalS} step={1} min={1} onChange={setTimeTotalS} />
        <div className="flex items-center justify-between py-[13px] border-b border-linen last:border-b-0">
          <div className="text-base">{t("preinfusion")}</div>
          <button
            type="button"
            role="switch"
            aria-checked={preinfusion}
            onClick={() => setPreinfusion((v) => !v)}
            className={`w-11 h-6 rounded-full relative transition-colors ${preinfusion ? "bg-copper" : "bg-linen"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${preinfusion ? "translate-x-5" : ""}`} />
          </button>
        </div>
        {preinfusion ? (
          <ParamStepper label={t("preinfusionDuration")} unit={t("preinfusionUnit")} value={preinfusionS} step={1} min={1} onChange={setPreinfusionS} />
        ) : null}
        <Button onClick={() => setManualStep("rating")}>{t("next")}</Button>
      </Card>
    );
  }

  return (
    <Card>
      <RatingSlider label={t("overall")} value={ratingTotal} min={1} max={10} onChange={setRatingTotal} />
      <RatingSlider label={t("balance")} value={balance} min={-5} max={5} onChange={setBalance} bipolarLabels={[t("sour"), t("bitter")]} />
      <div className="mt-3">
        <div className="text-sm text-muted mb-2">{t("visual")}</div>
        <div className="flex flex-wrap gap-2">
          {visualTagOptions.map((tag) => (
            <Chip key={tag} active={visualTags.includes(tag)} onClick={() => toggleTag(visualTags, setVisualTags, tag)}>
              {tag}
            </Chip>
          ))}
        </div>
      </div>
      <div className="mt-3">
        <div className="text-sm text-muted mb-2">{t("aroma")}</div>
        <div className="flex flex-wrap gap-2">
          {flavorTagOptions.map((tag) => (
            <Chip key={tag} active={flavorTags.includes(tag)} onClick={() => toggleTag(flavorTags, setFlavorTags, tag)}>
              {tag}
            </Chip>
          ))}
        </div>
      </div>
      <Button onClick={finish}>{t("save")}</Button>
    </Card>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `pnpm --filter @kvarn/web typecheck 2>&1 | grep -c "error TS"`
Should drop further.

Run: `pnpm --filter @kvarn/web lint`
Expected: PASS.

- [ ] **Step 3: Manual verification of the full brew flow**

Both Bruehen (Task 13) and ManualBrewEntry (this task) are now updated — this is the first point where the live-timer AND manual-entry brew flows are both fully functional end-to-end. Using this project's preview tooling:
1. Navigate to Brühen. Confirm the mode chips now read "Live brühen"/"Nachtragen" (no more "Setup"/"Einzeln" three-way split).
2. In "Live brühen" mode, confirm the grinder/machine/bean picker renders, pre-selected from whatever the last brew (or onboarding) set as active. Change a pick, confirm the grind suggestion updates. Start the timer, stop it, rate it, save — confirm it lands in the logbook (Kompass, once Task 16 updates it — for now just confirm no crash and the brew commits via a Dexie check if Kompass isn't ready yet).
3. Switch to "Nachtragen" mode, confirm the same 3-way picker appears (grinder/machine/bean, no more setup/bean dropdowns), fill in a past date, save, confirm it commits without error.
4. Check console/network logs for errors in both flows.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/ManualBrewEntry.tsx
git commit -m "Rewrite ManualBrewEntry: grinder/machine/bean picker replaces setup+bean selects"
```

---

### Task 15: Rewrite `apps/web/src/routes/Heute.tsx`

**Files:**
- Modify: `apps/web/src/routes/Heute.tsx`
- Modify: `apps/web/src/i18n/de.ts`
- Modify: `apps/web/src/i18n/en.ts`

- [ ] **Step 1: Update i18n**

In `apps/web/src/i18n/de.ts`, inside the `heute` namespace, current:

```typescript
    emptyBefore: "Leg zuerst ein ",
    emptyMid: " und eine ",
    emptyAfter: " an, dann kann's losgehen.",
    setupWord: "Setup",
```

Replace with (grammar fix: "Mühle" is feminine, "ein" → "eine"):

```typescript
    emptyBefore: "Leg zuerst eine ",
    emptyMid: " und eine ",
    emptyAfter: " an, dann kann's losgehen.",
    setupWord: "Mühle",
```

In `apps/web/src/i18n/en.ts`, same namespace, current:

```typescript
    setupWord: "setup",
```

Replace with:

```typescript
    setupWord: "grinder",
```

(`readyCard: "Bereit für den nächsten Bezug"` / `"Ready for the next brew"` already exists in both files and was previously unused — Step 2 below puts it to use.)

- [ ] **Step 2: Replace the full file**

Replace the entire content of `apps/web/src/routes/Heute.tsx` with:

```tsx
import { Link } from "@tanstack/react-router";
import { Button, Card, EntityImage, Hint, SectionLabel, WeatherStrip } from "@kvarn/ui";
import { Clock } from "lucide-react";
import { weatherConditionKey } from "@kvarn/core";
import { equipmentProduct, formatGrindValue, lastUsedCombo, latestWeatherSnapshot, useKvarnStore } from "../state/store";
import { useGrindSuggestion } from "../hooks/useGrindSuggestion";
import { useDisplayName } from "../hooks/useDisplayName";
import { greetingWord } from "../utils/greeting";
import { CONDITION_I18N_KEY } from "../utils/weatherLabels";
import { localeCode, useLocale, useT } from "../i18n";

export function Heute() {
  const state = useKvarnStore();
  const { equipment, beans } = state;
  const combo = lastUsedCombo(state);
  const grinder = equipment.find((e) => e.id === combo.grinderEquipmentId);
  const machine = equipment.find((e) => e.id === combo.machineEquipmentId);
  const bean = beans.find((b) => b.id === combo.beanId);
  const recentBrews = state.brews.slice(0, 3);
  const t = useT("heute");
  const { locale } = useLocale();
  const { displayName } = useDisplayName();
  const weatherSnapshot = latestWeatherSnapshot(state);
  const { suggestion } = useGrindSuggestion(state, combo.grinderEquipmentId, combo.machineEquipmentId, bean, weatherSnapshot);

  const dateLabel = new Date().toLocaleDateString(localeCode(locale), { weekday: "long", day: "numeric", month: "long" });
  const greeting = `${greetingWord()}, ${displayName || t("greetingFallbackName")}`;

  // RootLayout guarantees at least one grinder and one bean exist before this
  // screen is even reachable; this only covers the edge case where no brew
  // has ever happened yet (nothing to build a "ready for your next brew"
  // card from).
  if (!grinder || !bean) {
    return (
      <div>
        <p className="text-sm text-muted mt-3.5">{dateLabel}</p>
        <h1 className="font-display text-[32px] mb-0.5">{greeting}</h1>
        <p className="text-base text-muted">{t("emptyHint")}</p>
        <Card>
          <p className="text-base">
            {t("emptyBefore")}
            <Link to="/setup" className="text-copper underline">
              {t("setupWord")}
            </Link>
            {t("emptyMid")}
            <Link to="/regal" className="text-copper underline">
              {t("beanWord")}
            </Link>
            {t("emptyAfter")}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-muted mt-3.5">{dateLabel}</p>
      <h1 className="font-display text-[32px] mb-0.5">{greeting}</h1>

      {weatherSnapshot ? (
        <WeatherStrip
          className="mt-3"
          tempC={weatherSnapshot.tempC}
          humidityPct={weatherSnapshot.humidityPct}
          pressureHpa={weatherSnapshot.pressureHpa}
          condition={t(CONDITION_I18N_KEY[weatherConditionKey(weatherSnapshot.weatherCode)] ?? "condUnknown")}
          humidityLabel={t("weatherHumidity")}
          pressureLabel={t("weatherPressure")}
        />
      ) : null}

      <Card className="mt-3">
        <div className="flex items-center gap-3">
          <EntityImage src={equipmentProduct(state, grinder.id)?.imageUrl} kind="grinder" className="w-14 h-14 rounded-control flex-none" />
          {machine ? (
            <EntityImage src={equipmentProduct(state, machine.id)?.imageUrl} kind="machine" className="w-14 h-14 rounded-control flex-none" />
          ) : null}
          <EntityImage src={bean.imageUrl ?? bean.photoUrl} kind="bean" className="w-14 h-14 rounded-control flex-none" />
          <div className="flex-1 min-w-0">
            <div className="text-sm text-muted">{t("readyCard")}</div>
            <div className="text-base font-medium truncate">
              {grinder.customName ?? equipmentProduct(state, grinder.id)?.model ?? "—"}
              {machine ? ` · ${machine.customName ?? equipmentProduct(state, machine.id)?.model ?? "—"}` : ""}
              {" · "}
              {bean.roaster}
            </div>
          </div>
        </div>

        {suggestion && suggestion.reasons.length > 0 ? (
          <Hint className="mt-3">
            <span>
              <b>{t("compassPreview")}:</b> {suggestion.reasons.map((r) => r.effect).join(" ")}
            </span>
          </Hint>
        ) : null}

        <Link to="/bruehen">
          <Button>{t("brewStart")}</Button>
        </Link>
      </Card>

      {recentBrews.length > 0 ? (
        <Card>
          <SectionLabel icon={Clock}>{t("recentBrews")}</SectionLabel>
          {recentBrews.map((b) => (
            <div key={b.id} className="flex items-center gap-3 py-2 border-b border-linen last:border-b-0">
              <div className="w-9 h-9 rounded-xl bg-birch flex items-center justify-center font-display text-base">
                {b.ratingTotal}
              </div>
              <div className="flex-1">
                <div className="text-base font-medium">{new Date(b.brewedAt).toLocaleDateString(localeCode(locale))}</div>
                <div className="text-sm text-muted">
                  {formatGrindValue(state, b.grinderEquipmentId, b.grindSetting, locale)} · {b.doseG}g → {b.actualYieldG ?? b.targetYieldG}g
                </div>
              </div>
            </div>
          ))}
        </Card>
      ) : null}
    </div>
  );
}
```

Note: `WeatherStrip` import kept (`className` prop usage requires it to accept one — unchanged from before, no change needed there, just listed for completeness of the import line). `ProductCard`, `SlidersHorizontal`, `Package` and `SetupThumbnail` are all gone (no more setup/bean horizontal swiper — replaced by one combined "ready to brew" card).

- [ ] **Step 3: Typecheck and lint**

Run: `pnpm --filter @kvarn/web typecheck 2>&1 | grep -c "error TS"`
Should drop.

Run: `pnpm --filter @kvarn/web lint`
Expected: PASS.

- [ ] **Step 4: Manual verification**

Using the preview tooling: load the Today screen. Confirm the "ready for your next brew" card shows the grinder/machine/bean from your most recent brew (from Task 13/14's manual testing), with a working "Start brew" link. If no brew has ever happened in this test environment, confirm the empty-state card renders instead, with grammatically correct German ("Leg zuerst eine Mühle und eine Bohne an...").

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/Heute.tsx apps/web/src/i18n/de.ts apps/web/src/i18n/en.ts
git commit -m "Rewrite Heute: last-used-combo ready card replaces the setup swiper"
```

---

### Task 16: Rewrite `apps/web/src/routes/Kompass.tsx`

**Files:**
- Modify: `apps/web/src/routes/Kompass.tsx`
- Modify: `apps/web/src/i18n/de.ts`
- Modify: `apps/web/src/i18n/en.ts`

- [ ] **Step 1: Update i18n**

In `apps/web/src/i18n/de.ts`, inside the `kompass` namespace, current:

```typescript
    deletedSetup: "Setup gelöscht",
    deletedBean: "Bohne gelöscht",
```

Replace with:

```typescript
    deletedGrinder: "Mühle gelöscht",
    deletedBean: "Bohne gelöscht",
```

In `apps/web/src/i18n/en.ts`, same namespace, current:

```typescript
    deletedSetup: "Setup deleted",
    deletedBean: "Bean deleted",
```

Replace with:

```typescript
    deletedGrinder: "Grinder deleted",
    deletedBean: "Bean deleted",
```

- [ ] **Step 2: Replace the full file**

Replace the entire content of `apps/web/src/routes/Kompass.tsx` with:

```tsx
import { Card, Chart, SectionLabel } from "@kvarn/ui";
import { BookOpen, Star, TrendingUp } from "lucide-react";
import { equipmentProduct, formatGrindValue, useKvarnStore, weatherSnapshotFor } from "../state/store";
import { localeCode, useLocale, useT } from "../i18n";

export function Kompass() {
  const state = useKvarnStore();
  const { brews, equipment, beans, recipes } = state;
  const t = useT("kompass");
  const { locale } = useLocale();

  function equipmentLabel(equipmentId: string | null): string | undefined {
    const eq = equipment.find((e) => e.id === equipmentId);
    if (!eq) return undefined;
    return eq.customName ?? equipmentProduct(state, eq.id)?.model ?? undefined;
  }

  function comboLabel(grinderEquipmentId: string | null, machineEquipmentId: string | null, beanId: string | null): string {
    const parts = [
      equipmentLabel(grinderEquipmentId) ?? t("deletedGrinder"),
      equipmentLabel(machineEquipmentId),
      beans.find((b) => b.id === beanId)?.name ?? t("deletedBean"),
    ].filter((p): p is string => Boolean(p));
    return parts.join(" · ");
  }

  const humidityTimePoints = brews
    .map((b) => {
      const weather = weatherSnapshotFor(state, b.weatherId);
      return weather?.humidityPct != null ? { x: weather.humidityPct, y: b.timeTotalS } : null;
    })
    .filter((p): p is { x: number; y: number } => p !== null);

  const beanAgeRatingPoints = brews
    .filter((b) => b.beanAgeDays != null)
    .map((b) => ({ x: b.beanAgeDays as number, y: b.ratingTotal }));

  return (
    <div>
      <h1 className="font-display text-[32px] mt-3.5 mb-0.5">{t("title")}</h1>
      <p className="text-base text-muted">{t("subtitle")}</p>

      {recipes.length > 0 ? (
        <>
          <SectionLabel icon={Star} className="mt-5">{t("bestRecipes")}</SectionLabel>
          {recipes.map((recipe) => {
            const params = recipe.params as { grindSetting?: number; doseG?: number; targetYieldG?: number } | null;
            return (
              <Card key={recipe.id}>
                <div className="flex items-center justify-between">
                  <div className="text-base font-medium">
                    {comboLabel(recipe.grinderEquipmentId, recipe.machineEquipmentId, recipe.beanId)}
                  </div>
                  <div className="font-display text-xl num">{recipe.avgRating}</div>
                </div>
                <div className="text-sm text-muted mt-1">
                  {t("recipeMeta", {
                    grind:
                      params?.grindSetting !== undefined
                        ? formatGrindValue(state, recipe.grinderEquipmentId, params.grindSetting, locale)
                        : "—",
                    dose: params?.doseG ?? "—",
                    yield: params?.targetYieldG ?? "—",
                    count: recipe.brewCount,
                    confidence: Math.round((recipe.confidence ?? 0) * 100),
                  })}
                </div>
              </Card>
            );
          })}
        </>
      ) : null}

      <SectionLabel icon={TrendingUp} className="mt-5">{t("insights")}</SectionLabel>
      <Card>
        <div className="text-base font-medium mb-1">{t("humidityTime")}</div>
        {humidityTimePoints.length > 0 ? (
          <Chart points={humidityTimePoints} mode="scatter" xAxisLabel={(x) => `${x}%`} />
        ) : (
          <p className="text-sm text-muted">{t("humidityTimeEmpty")}</p>
        )}
      </Card>
      <Card>
        <div className="text-base font-medium mb-1">{t("beanAgeRating")}</div>
        {beanAgeRatingPoints.length > 0 ? (
          <Chart points={beanAgeRatingPoints} mode="scatter" yDomain={[1, 10]} xAxisLabel={(x) => `${x}`} />
        ) : (
          <p className="text-sm text-muted">{t("beanAgeRatingEmpty")}</p>
        )}
      </Card>

      <SectionLabel icon={BookOpen} className="mt-5">{t("logbook")}</SectionLabel>
      {brews.length === 0 ? (
        <Card>
          <p className="text-base">{t("logbookEmpty")}</p>
        </Card>
      ) : (
        <Card className="!p-0">
          {brews.map((b) => (
            <div key={b.id} className="flex items-center gap-3 px-4 py-3 border-b border-linen last:border-b-0">
              <div className="w-9 h-9 rounded-xl bg-birch flex items-center justify-center font-display text-base">
                {b.ratingTotal}
              </div>
              <div className="flex-1">
                <div className="text-base font-medium">
                  {comboLabel(b.grinderEquipmentId, b.machineEquipmentId, b.beanId)}
                </div>
                <div className="text-sm text-muted">
                  {new Date(b.brewedAt).toLocaleString(localeCode(locale))} ·{" "}
                  {t("logRowMeta", {
                    grind: formatGrindValue(state, b.grinderEquipmentId, b.grindSetting, locale),
                    dose: b.doseG,
                    yield: b.actualYieldG ?? b.targetYieldG,
                    time: b.timeTotalS,
                  })}
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `pnpm --filter @kvarn/web typecheck 2>&1 | grep -c "error TS"`
Should drop.

Run: `pnpm --filter @kvarn/web lint`
Expected: PASS.

- [ ] **Step 4: Manual verification**

Using the preview tooling: open Kompass. Confirm the logbook and "best recipes" rows now show "grinder · machine · bean" (e.g. "Niche Zero · Rancilio Silvia · Ethiopia Yirgacheffe") instead of a setup name, with the machine segment omitted entirely when there wasn't one.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/Kompass.tsx apps/web/src/i18n/de.ts apps/web/src/i18n/en.ts
git commit -m "Rewrite Kompass: show grinder/machine/bean directly instead of setup name"
```

---

### Task 17: Rewrite `apps/web/src/routes/Setup.tsx` — equipment management only

**Files:**
- Modify: `apps/web/src/routes/Setup.tsx`
- Modify: `apps/web/src/i18n/de.ts`
- Modify: `apps/web/src/i18n/en.ts`

The route path stays `/setup` and the file stays `Setup.tsx` (renaming either is unnecessary churn — only the visible nav label and page copy change to stop implying a "Setup" concept exists).

- [ ] **Step 1: Update i18n**

In `apps/web/src/i18n/de.ts`, inside the `nav` namespace, current:

```typescript
    setup: "Setup",
```

Replace with:

```typescript
    setup: "Ausrüstung",
```

Inside the `setup` namespace, current:

```typescript
    title: "Setup",
    subtitle: "Equipment & Zubereitungsarten.",
```

Replace with:

```typescript
    title: "Ausrüstung",
    subtitle: "Deine Mühlen und Maschinen.",
```

Delete these now-unused keys from the `setup` namespace (all were only used by the removed setup-creation form):

```typescript
    yourEquipment: "Dein Equipment",
    setups: "Setups",
    newSetup: "Neues Setup",
    setupNamePlaceholder: "Setup-Name, z. B. „Zuhause Espresso“",
    chooseGrinder: "Mühle wählen …",
    noMachine: "Keine Maschine",
    noBean: "Keine Bohne",
    saveSetup: "Setup speichern",
```

Keep `yourEquipment` (it's reused for the equipment grid's section label) — only delete `setups`/`newSetup`/`setupNamePlaceholder`/`chooseGrinder`/`noMachine`/`noBean`/`saveSetup`. Final state of that stretch of the `setup` namespace:

```typescript
    yourEquipment: "Dein Equipment",
    addPhotoOptional: "Foto hinzufügen (optional)",
```

Also delete the now-unreachable `deleteEquipmentBlocked` key (no longer possible to hit — `deleteEquipment` can't throw anymore, see Task 5):

```typescript
    deleteEquipmentBlocked: "Kann nicht gelöscht werden — wird noch in einem Setup als Mühle verwendet.",
```

In `apps/web/src/i18n/en.ts`, mirror all of the above: `nav.setup: "Setup"` → `"Equipment"`; `setup.title: "Setup"` → `"Equipment"`; `setup.subtitle: "Equipment & brew methods."` → `"Your grinders and machines."`; delete `setups`, `newSetup`, `setupNamePlaceholder`, `chooseGrinder`, `noMachine`, `noBean`, `saveSetup`, `deleteEquipmentBlocked` (keep `yourEquipment`).

- [ ] **Step 2: Replace the full file**

Replace the entire content of `apps/web/src/routes/Setup.tsx` with:

```tsx
import { useState } from "react";
import { Button, Card, EntityImage, Modal, ProductCard, SectionLabel } from "@kvarn/ui";
import type { LucideIcon } from "lucide-react";
import { Coffee, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { equipmentGrindScale, equipmentImage, equipmentKind, useKvarnStore, type GrindScaleValue } from "../state/store";
import { EquipmentSearchSection } from "../components/EquipmentSearchSection";
import { GrindScaleFields } from "../components/GrindScaleFields";
import { useT } from "../i18n";

/** Collapses the (fairly tall) equipment search behind a single tap target,
 * sliding it open via a CSS grid-rows trick rather than measuring heights. */
function CollapsibleEquipmentSection({
  kind,
  icon: Icon,
  label,
  placeholder,
}: {
  kind: "grinder" | "machine";
  icon: LucideIcon;
  label: string;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3.5">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-3 bg-card border border-linen rounded-card px-4 py-3.5"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2.5 text-base font-medium text-espresso">
          <Icon size={18} strokeWidth={1.5} />
          {label}
        </span>
        <Plus size={18} strokeWidth={1.5} className={`transition-transform ${open ? "rotate-45" : ""}`} />
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <EquipmentSearchSection kind={kind} icon={Icon} title={label} placeholder={placeholder} />
        </div>
      </div>
    </div>
  );
}

export function Setup() {
  const state = useKvarnStore();
  const { products, equipment, setEquipmentGrindScale, setEquipmentCustomName, deleteEquipment } = state;
  const t = useT("setup");
  const tCommon = useT("common");
  const [editingEquipmentId, setEditingEquipmentId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editScale, setEditScale] = useState<GrindScaleValue | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  function equipmentLabel(equipmentId: string): string {
    const eq = equipment.find((e) => e.id === equipmentId);
    if (!eq) return "—";
    if (eq.customName) return eq.customName;
    const product = products.find((p) => p.id === eq.productId);
    return product ? `${product.brand} ${product.model}` : "—";
  }

  function originalProductLabel(equipmentId: string): string | null {
    const eq = equipment.find((e) => e.id === equipmentId);
    if (!eq?.productId) return null;
    const product = products.find((p) => p.id === eq.productId);
    return product ? `${product.brand} ${product.model}` : null;
  }

  function openEquipmentEditor(equipmentId: string) {
    const eq = equipment.find((e) => e.id === equipmentId);
    setEditingEquipmentId(equipmentId);
    setEditName(eq?.customName ?? "");
    setEditScale(equipmentKind(state, equipmentId) === "grinder" ? equipmentGrindScale(state, equipmentId) : null);
    setDeleteConfirm(false);
  }

  function closeEquipmentEditor() {
    setEditingEquipmentId(null);
    setDeleteConfirm(false);
  }

  async function saveEquipmentEdits() {
    if (!editingEquipmentId) return;
    await setEquipmentCustomName(editingEquipmentId, editName.trim() || null);
    if (editScale) {
      await setEquipmentGrindScale(editingEquipmentId, editScale);
    }
    closeEquipmentEditor();
  }

  async function handleDeleteEquipment() {
    if (!editingEquipmentId) return;
    await deleteEquipment(editingEquipmentId);
    closeEquipmentEditor();
  }

  return (
    <div>
      <h1 className="font-display text-[32px] mt-3.5 mb-0.5">{t("title")}</h1>
      <p className="text-base text-muted">{t("subtitle")}</p>

      <CollapsibleEquipmentSection kind="grinder" icon={SlidersHorizontal} label={t("addGrinder")} placeholder={t("searchPlaceholder")} />
      <CollapsibleEquipmentSection kind="machine" icon={Coffee} label={t("addMachine")} placeholder={t("searchPlaceholderMachine")} />

      {equipment.length > 0 ? (
        <>
          <SectionLabel className="mt-5">{t("yourEquipment")}</SectionLabel>
          <div className="grid grid-cols-2 gap-3 mt-3">
            {equipment.map((eq) => (
              <ProductCard
                key={eq.id}
                onClick={() => openEquipmentEditor(eq.id)}
                image={<EntityImage src={equipmentImage(state, eq.id)} kind={equipmentKind(state, eq.id)} className="w-full h-full" />}
              >
                <div className="text-[15px] font-medium leading-tight">{equipmentLabel(eq.id)}</div>
                <div className="text-[12px] text-muted mt-0.5">{t("tapToEdit")}</div>
              </ProductCard>
            ))}
          </div>
        </>
      ) : null}

      {editingEquipmentId
        ? (() => {
            const originalName = originalProductLabel(editingEquipmentId);
            return (
              <Modal onClose={closeEquipmentEditor}>
                <SectionLabel icon={equipmentKind(state, editingEquipmentId) === "grinder" ? SlidersHorizontal : Coffee}>
                  {t("editEquipmentTitle", { name: equipmentLabel(editingEquipmentId) })}
                </SectionLabel>
                {originalName ? <p className="text-sm text-muted mb-2">{t("originalNameLabel", { name: originalName })}</p> : null}
                <input
                  className="border border-linen rounded-control px-3 py-2 text-base bg-birch w-full mb-3"
                  placeholder={t("customNamePlaceholder")}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
                {editScale ? <GrindScaleFields value={editScale} onChange={setEditScale} /> : null}
                <Button onClick={saveEquipmentEdits}>{t("saveChanges")}</Button>
                {!deleteConfirm ? (
                  <Button variant="ghost" onClick={() => setDeleteConfirm(true)}>
                    <Trash2 size={18} strokeWidth={1.5} />
                    {t("deleteEquipment")}
                  </Button>
                ) : (
                  <>
                    <p className="text-base text-clay mt-3">{t("deleteEquipmentConfirm")}</p>
                    <Button onClick={handleDeleteEquipment}>{t("deleteEquipmentConfirmButton")}</Button>
                    <Button variant="ghost" onClick={() => setDeleteConfirm(false)}>
                      {tCommon("cancel")}
                    </Button>
                  </>
                )}
              </Modal>
            );
          })()
        : null}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `pnpm --filter @kvarn/web typecheck 2>&1 | grep -c "error TS"`
Should drop substantially — this and Task 18 are the last two files referencing the old shape.

Run: `pnpm --filter @kvarn/web lint`
Expected: PASS.

- [ ] **Step 4: Manual verification**

Using the preview tooling: open the bottom nav — confirm the tab label now reads "Ausrüstung"/"Equipment" instead of "Setup". Open that screen, confirm the page title/subtitle match, confirm there's no setup-creation form or setup list anymore (just the two collapsible add sections + the equipment grid). Delete a grinder that has brew history — confirm it now succeeds (no more "still used in a setup" block).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/Setup.tsx apps/web/src/i18n/de.ts apps/web/src/i18n/en.ts
git commit -m "Setup screen: drop setup section, equipment management only, rename nav label"
```

---

### Task 18: Rewrite `apps/web/src/routes/Onboarding.tsx` — drop the method step

**Files:**
- Modify: `apps/web/src/routes/Onboarding.tsx`
- Modify: `apps/web/src/i18n/de.ts`
- Modify: `apps/web/src/i18n/en.ts`

Most of this 463-line file (welcome screen, location/account/install steps) is untouched — only the method step, `STEP_ORDER`, and `finishOnboarding`'s setup-building logic change. Targeted edits below.

- [ ] **Step 1: Update i18n**

In `apps/web/src/i18n/de.ts`, inside the `onboarding` namespace, delete these two now-unused keys:

```typescript
    stepMethod: "Zubereitungsart",
    methodQuestion: "Wie brühst du meistens?",
```

In `apps/web/src/i18n/en.ts`, same namespace, delete:

```typescript
    stepMethod: "Method",
    methodQuestion: "How do you usually brew?",
```

- [ ] **Step 2: Edit imports and remove the `METHODS`/`Setup` type usage**

Current (top of file):

```typescript
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button, Card, Chip, Logo, Modal, SectionLabel } from "@kvarn/ui";
import type { Setup as SetupType } from "@kvarn/db";
import { ChevronLeft, Coffee, Compass, Copy, Download, MapPin, Package, SlidersHorizontal, Sun, UserPlus } from "lucide-react";
import { equipmentGrindScale, useKvarnStore, type GrindScaleValue } from "../state/store";
import { EquipmentSearchSection } from "../components/EquipmentSearchSection";
import { BeanForm } from "../components/BeanForm";
import { GrindScaleFields } from "../components/GrindScaleFields";
import { useT } from "../i18n";
import { authClient } from "../auth/client";
```

Replace with (drop the `Setup as SetupType` import and the `Coffee` icon, which was only used by the method step's `SectionLabel` — `Coffee` is still needed for the machine step below, so actually keep it; only drop the type import):

```typescript
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button, Card, Chip, Logo, Modal, SectionLabel } from "@kvarn/ui";
import { ChevronLeft, Coffee, Compass, Copy, Download, MapPin, Package, SlidersHorizontal, Sun, UserPlus } from "lucide-react";
import { equipmentGrindScale, useKvarnStore, type GrindScaleValue } from "../state/store";
import { EquipmentSearchSection } from "../components/EquipmentSearchSection";
import { BeanForm } from "../components/BeanForm";
import { GrindScaleFields } from "../components/GrindScaleFields";
import { useT } from "../i18n";
import { authClient } from "../auth/client";
```

Current:

```typescript
const METHODS: SetupType["method"][] = ["espresso", "v60", "aeropress", "frenchpress", "moka", "auto"];
const ONBOARDING_SEEN_KEY = "kvarn:onboardingSeen";
```

Replace with (drop `METHODS`):

```typescript
const ONBOARDING_SEEN_KEY = "kvarn:onboardingSeen";
```

- [ ] **Step 3: Update `Step` type and `STEP_ORDER`**

Current:

```typescript
type Step = "welcome" | "method" | "grinder" | "machine" | "bean" | "location" | "account" | "install";

// Steps with a visual progress indicator — "welcome" is a splash screen, not
// really a "step", so it's excluded from the dots.
const STEP_ORDER: Step[] = ["method", "grinder", "machine", "bean", "location", "account", "install"];
```

Replace with:

```typescript
type Step = "welcome" | "grinder" | "machine" | "bean" | "location" | "account" | "install";

// Steps with a visual progress indicator — "welcome" is a splash screen, not
// really a "step", so it's excluded from the dots.
const STEP_ORDER: Step[] = ["grinder", "machine", "bean", "location", "account", "install"];
```

- [ ] **Step 4: Update destructured store actions and remove `method` state**

Current:

```typescript
  const {
    products,
    equipment,
    beans,
    addCustomEquipment,
    addSetup,
    addBean,
    captureWeatherSnapshot,
    setActiveSetup,
    setActiveBean,
    setEquipmentGrindScale,
  } = useKvarnStore();

  const [step, setStep] = useState<Step>("welcome");
  const [method, setMethod] = useState<SetupType["method"] | null>(null);
  const [addedGrinderIds, setAddedGrinderIds] = useState<string[]>([]);
```

Replace with:

```typescript
  const {
    products,
    equipment,
    beans,
    addCustomEquipment,
    addBean,
    captureWeatherSnapshot,
    setActiveGrinder,
    setActiveMachine,
    setActiveBean,
    setEquipmentGrindScale,
  } = useKvarnStore();

  const [step, setStep] = useState<Step>("welcome");
  const [addedGrinderIds, setAddedGrinderIds] = useState<string[]>([]);
```

- [ ] **Step 5: Replace `buildInitialSetupAndBean`/`finishOnboarding`**

Current:

```typescript
  // Bundles whatever was added along the way into the user's primary setup +
  // active bean. Grinders/machines/beans without a sensible generic fallback
  // (unlike equipment, which falls back to "custom gear") get one synthesized
  // here so the app never re-opens onboarding right after finishing it.
  async function buildInitialSetupAndBean() {
    let grinderId = addedGrinderIds[0];
    if (!grinderId) {
      const generic = await addCustomEquipment(t("genericGrinderName"), "grinder");
      grinderId = generic.id;
    }
    const resolvedMethod = method ?? "espresso";
    const setup = await addSetup({
      name: resolvedMethod,
      method: resolvedMethod,
      grinderEquipmentId: grinderId,
      machineEquipmentId: addedMachineIds[0] ?? null,
    });
    setActiveSetup(setup.id);

    let beanId = addedBeanIds[0];
    if (!beanId) {
      const generic = await addBean({ roaster: t("genericBeanRoaster"), name: t("genericBeanName") });
      beanId = generic.id;
    }
    setActiveBean(beanId);
  }

  async function finishOnboarding() {
    await buildInitialSetupAndBean();
    markOnboardingSeen();
    navigate({ to: "/bruehen" });
  }
```

Replace with:

```typescript
  // Bundles whatever was added along the way into the user's active picks.
  // Grinders/beans without a sensible generic fallback (unlike equipment,
  // which falls back to "custom gear") get one synthesized here so the app
  // never re-opens onboarding right after finishing it. Machine stays
  // optional — no synthesized fallback needed.
  async function finishOnboarding() {
    let grinderId = addedGrinderIds[0];
    if (!grinderId) {
      const generic = await addCustomEquipment(t("genericGrinderName"), "grinder");
      grinderId = generic.id;
    }
    setActiveGrinder(grinderId);
    setActiveMachine(addedMachineIds[0] ?? null);

    let beanId = addedBeanIds[0];
    if (!beanId) {
      const generic = await addBean({ roaster: t("genericBeanRoaster"), name: t("genericBeanName") });
      beanId = generic.id;
    }
    setActiveBean(beanId);

    markOnboardingSeen();
    navigate({ to: "/bruehen" });
  }
```

- [ ] **Step 6: Remove the method step's JSX and repoint the welcome screen / grinder step's back-navigation**

Current welcome screen's "let's go" button:

```tsx
          <Button className="w-full" onClick={() => setStep("method")}>
            {t("welcomeStart")}
          </Button>
```

Replace with (welcome now leads straight into the grinder step):

```tsx
          <Button className="w-full" onClick={() => setStep("grinder")}>
            {t("welcomeStart")}
          </Button>
```

Delete the entire method step block:

```tsx
      {step === "method" ? (
        <Card>
          <SectionLabel icon={Coffee}>{t("stepMethod")}</SectionLabel>
          <p className="text-base mb-3">{t("methodQuestion")}</p>
          <div className="flex flex-wrap gap-2">
            {METHODS.map((m) => (
              <Chip key={m} active={method === m} onClick={() => setMethod(m)}>
                {m}
              </Chip>
            ))}
          </div>
          <Button onClick={() => setStep("grinder")}>{method ? t("next") : t("skip")}</Button>
        </Card>
      ) : null}

      {step === "grinder" ? (
```

Replace with just:

```tsx
      {step === "grinder" ? (
```

(`Chip` is still used elsewhere in the file — the equipment/bean "added so far" chips further down — so its import stays even though the method step's usage is gone; `Coffee` is still used by the machine step's icon, so its import stays too.)

- [ ] **Step 7: Typecheck and lint**

Run: `pnpm --filter @kvarn/web typecheck`
Expected: PASS with ZERO errors — this is the last file in the workspace referencing the old shape, per this plan's design. If any errors remain, read them and fix (there should be none if every prior task's file was updated correctly).

Run: `pnpm --filter @kvarn/web lint`
Expected: PASS.

- [ ] **Step 8: Manual verification**

Using the preview tooling: delete all local data (Settings → "Alle lokalen Daten löschen") to trigger onboarding fresh, or use a private/incognito window. Walk through onboarding: confirm there's no "method" step between welcome and grinder. Add a grinder, optionally a machine, a bean, skip location, skip account, finish. Confirm you land on Brühen with the grinder/machine/bean you just added pre-selected in the picker (or Today, showing the ready-to-brew card).

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/routes/Onboarding.tsx apps/web/src/i18n/de.ts apps/web/src/i18n/en.ts
git commit -m "Onboarding: drop the method step, set active grinder/machine/bean directly"
```

---

### Task 19: Full verification pass, release note, and push

**Files:** none (verification + release note only)

- [ ] **Step 1: Full workspace check**

Run: `pnpm -w lint && pnpm -w typecheck && pnpm -w test`
Expected: PASS across all 6 packages, zero errors, zero skipped test files.

- [ ] **Step 2: Grep sweep for anything missed**

Run: `grep -rn "\bsetup\b\|\bsetups\b\|activeSetupId\|setActiveSetup\|addSetup\|findOrCreateSetup\|SetupThumbnail" apps/web/src apps/worker/src packages/db/src packages/core/src --include="*.ts" --include="*.tsx" -i | grep -vi "docs/\|equipmentsearchsection\|setup.tsx\|onboarding.tsx\|nav.setup\|/setup\|setupword\|t(\"setup\")\|useT(\"setup\")"`

This should return nothing meaningful beyond expected false positives (e.g. the route path string `"/setup"`, the `useT("setup")` i18n namespace name, or `EquipmentSearchSection.tsx`'s unrelated `setup` substring in unrelated words). Read through any hits carefully — a real hit here means a file was missed by Tasks 1-18.

- [ ] **Step 3: Full manual verification pass in the browser**

Using this project's preview tooling, with a signed-in-optional local session (delete all data first for a clean slate, or use a private window):

1. **Onboarding**: confirm no method step, grinder → machine (skippable) → bean → location → account → install, finish successfully.
2. **Equipment screen** (bottom nav, now labeled "Ausrüstung"/"Equipment"): add another grinder and another machine (including a catalog "brewer" item like an Aeropress, to confirm Task 10's widened search), edit one's custom name/grind scale, delete one, confirm deletion succeeds with no blocking error.
3. **Shelf**: add a bean with a beanType set (espresso or filter), confirm it saves.
4. **Home**: confirm the "ready for your next brew" card shows your latest combo and "Start brew" works.
5. **Brühen — live mode**: change grinder/machine/bean via the picker, confirm the grind suggestion updates (in particular, confirm picking a machine with a methodHint like the Aeropress changes the suggested target time band vs. an espresso machine — you can infer this from the Compass hint's reasoning text differing, or from the suggested grind position for a fresh no-history combo, which is `scaleMidpoint(grindScale, METHOD_DEFAULT_FRACTION[method])` — a different value per method). Run a full brew through the timer and rating steps, save it, confirm it appears in Kompass.
6. **Brühen — manual mode**: log a past brew with a different grinder/bean combo, confirm it saves with the entered date.
7. **Kompass**: confirm the logbook and best-recipes list show grinder/machine/bean combos correctly, confirm the two distinct combos from steps 5-6 appear as separate recipes.
8. **Account sync** (if a real signed-in account and a reachable worker are available in this environment): sign in, trigger a sync, confirm no errors — the sync payload no longer includes `setups`, and the worker's merge no longer references the `setup` table. If the worker/D1 aren't reachable in this environment (as prior sessions have hit), note that as an environment limitation, not a defect, same as previous plans in this project.

Check console/network logs at each step for errors.

- [ ] **Step 4: Verify the D1 migration one more time, end-to-end, against a realistic local dataset**

This migration is higher-stakes than any prior one in this project (it drops a table with real backfill logic). Before touching production:

Run: `cd apps/worker && pnpm db:migrate:local` (if not already applied from Task 2)

Then manually create a setup + a few brews against the LOCAL D1 via the app pointed at a local `wrangler dev` instance (or, if local dev data already has pre-migration setup/brew rows from earlier testing sessions, use those) — confirm after migration that `SELECT grinder_equipment_id, machine_equipment_id FROM brew` returns real, non-null values matching what each brew's original setup had, and that `SELECT name FROM sqlite_master WHERE type='table' AND name='setup'` returns nothing (table is gone).

- [ ] **Step 5: Add a release note entry**

Check the current commit count with `git rev-list --count HEAD`, add 1, and add an entry to `apps/web/src/releaseNotes.ts` at that version, briefly describing this feature in both `de` and `en`. Example shape (adjust the version number to whatever `git rev-list --count HEAD` + 1 actually is at this point):

```typescript
  { version: <N>, de: "Setups sind weg: Mühle, Maschine und Bohne wählst du jetzt für jeden Bezug einzeln — die Zubereitungsart wird automatisch erkannt.", en: "Setups are gone: pick grinder, machine, and bean individually for each brew — the brew method is now detected automatically." },
```

- [ ] **Step 6: Commit and push**

```bash
git add apps/web/src/releaseNotes.ts
git commit -m "Add release note for setup removal"
git push origin main
```

- [ ] **Step 7: Apply the migration to production**

This step requires an authenticated `wrangler` CLI (a prior session in this project found the sandbox's wrangler unauthenticated — if that's still the case here, stop and tell the user explicitly rather than skipping silently):

Run: `cd apps/worker && pnpm db:migrate:remote`

Confirm success, then spot-check with `npx wrangler d1 execute kvarn --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name='setup'"` — expect zero rows (table dropped in production). This is the single most important verification step in this entire plan: if it's skipped or fails silently, every signed-in user's next sync will hit a worker trying to read/write a `setup` table (or `setup_id` columns) that production D1 no longer has to match the just-deployed code, or — if this step is skipped entirely and the OLD production schema is still in place — the newly-deployed worker code will fail immediately on its first `brew`/`recipe` query, since those columns don't exist yet in production. **Do not consider this plan done until this step has actually succeeded against production, not just been mentioned.**
