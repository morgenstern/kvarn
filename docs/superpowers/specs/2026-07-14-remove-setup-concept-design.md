# Remove the "Setup" concept — design spec

## Goal

Today, brewing requires first saving a "Setup" (a named bundle of grinder + machine + brew method + optional bean + optional accessories), then picking one at brew time. This adds friction and an extra concept users have to manage. This feature removes Setup entirely: grinder, machine, and bean are managed independently (grinders/machines in the Equipment screen, beans in the Shelf screen) and picked independently for each brew session. Brew method (espresso/v60/aeropress/frenchpress/moka) is no longer chosen explicitly — it's derived from the bean's type and the machine's own method hint.

## 1. Data model changes

**`bean` table** gains:
```
beanType: text enum ("espresso" | "filter") | null   -- nullable, default null (unknown)
```

**`equipment` table** gains:
```
methodHint: text enum ("espresso" | "v60" | "aeropress" | "frenchpress" | "moka") | null
```
Only meaningful for `kind: "machine"` or `"brewer"` equipment; left `null` on grinders/accessories. Catalog products of kind `machine`/`brewer` in `apps/web/public/data/seed-products.json` get `methodHint` pre-populated (e.g. an Aeropress product → `"aeropress"`, a Rancilio → `"espresso"`). Custom/hand-typed gear leaves it `null` unless the user sets it via an optional field on the custom-gear form.

**`brew` table**: drops `setupId`. Gains:
```
grinderEquipmentId: text (required, FK → equipment.id)
machineEquipmentId: text | null (FK → equipment.id)
```
`beanId` is unchanged (it already exists directly on `brew`, independent of any setup).

**`recipe` table**: drops `setupId`. Gains the same `grinderEquipmentId` (required) + `machineEquipmentId` (nullable) pair. `beanId` is unchanged. A recipe's identity becomes the triple `(grinderEquipmentId, machineEquipmentId, beanId)`, replacing the old `(setupId, beanId)` pair.

**`setup` table**: dropped entirely. `accessoryEquipmentIds` is not carried forward anywhere — accessories are out of scope for this feature (equipment records of kind `accessory` still exist and remain manageable, they're just no longer attached to a brew session).

## 2. Derivation logic (replaces the method dropdown)

A new pure function in `packages/core` (e.g. `brewMethod.ts`):

```typescript
type Method = "espresso" | "v60" | "aeropress" | "frenchpress" | "moka";

function deriveBrewMethod(bean: Bean | undefined, machine: Equipment | undefined): Method {
  if (machine?.methodHint) return machine.methodHint;
  if (bean?.beanType === "espresso") return "espresso";
  if (bean?.beanType === "filter") return "v60"; // generic filter-family default
  return "espresso"; // nothing known → espresso
}
```

The old `"auto"` placeholder value is dropped — method is always derived, never left unset. `Compass`'s `nextGrindSuggestion` (in `packages/core/src/compass.ts`) keeps its existing per-method target-time/ratio logic unchanged; it now receives a derived method instead of a stored one. Every call site that read `setup.method` (Bruehen's Compass hint, `useGrindSuggestion`, recipe/logbook display) switches to `deriveBrewMethod(bean, machine)` using the live-selected bean/machine.

## 3. Store & state changes (`apps/web/src/state/store.ts`)

**Removed:** `setups: Setup[]`, `activeSetupId`, `addSetup`, `findOrCreateSetup`, `setActiveSetup`, `activeSetup()` selector, and the `Setup` type import throughout the app.

**Added/changed:**
- `activeGrinderEquipmentId: string | null`, `activeMachineEquipmentId: string | null` — new global state fields, symmetric with the existing `activeBeanId`. Each has a setter (`setActiveGrinder`, `setActiveMachine`, reusing the existing `setActiveBean`). Initialized on `hydrate()` from `lastUsedCombo()`; updated in place whenever the user changes a picker during the session. A fresh app load re-derives from the latest brew history again rather than persisting picks beyond the running session — matching how `activeSetupId`/`activeBeanId` behaved before.
- `sortedGrinders(state)`, `sortedMachines(state)`, `sortedBeans(state)` — each returns its list sorted "most recent brew using this item first," falling back to the item's own `createdAt` for anything never brewed with (so a freshly-added item outranks something last brewed with days ago).
- `lastUsedCombo(state)` — returns `{ grinderEquipmentId, machineEquipmentId, beanId }` from the single most recent brew (all fields `null` if there's no brew history yet). Used by Home's prefilled "Start brew" card and to initialize the active-picks state on hydrate.
- `recipeFor(state, grinderEquipmentId, machineEquipmentId, beanId)` replaces the old `(setupId, beanId)`-keyed lookup.
- `commitBrew` takes `grinderEquipmentId`/`machineEquipmentId` directly instead of `setupId`; its recipe upsert matches on the new triple.
- `hydrate()` drops loading/filtering `setups`; equipment/beans/brews/recipes hydration is otherwise unchanged.

## 4. UI changes per screen

- **Setup.tsx → Equipment screen** (nav label "Setup"/"Einstellungen" → "Equipment"/"Ausrüstung" — i18n keys updated accordingly): drops the setup-creation form entirely; keeps grinder/machine add/edit/archive/rename exactly as today.
- **Regal.tsx (Shelf/beans)**: bean form gains an optional "Espresso or filter?" field (`beanType`), same treatment/placement as other bean fields (roast level, process, etc.).
- **Bruehen.tsx**: `PickMode` collapses from `"setup" | "combo" | "manual"` to `"live" | "manual"`. Both modes show the same 3-way picker (grinder → machine (optional, "None") → bean), each list pre-sorted by last-used and pre-selected from the active picks. "live" starts the timer; "manual" opens the historical-entry form (unchanged otherwise). The Compass hint calls `deriveBrewMethod(bean, machine)`.
- **Heute.tsx (Home)**: shows a "ready for your next brew" card built from `lastUsedCombo()`, naming the grinder/machine/bean, with a one-tap "Start brew" that jumps straight into the live timer with those pre-selected. No more setup-swiper.
- **Kompass.tsx**: recipe rows and logbook rows display grinder + machine + bean names directly (e.g. "Niche Zero · Rancilio Silvia · Ethiopia Yirgacheffe") instead of a setup name.
- **Onboarding.tsx**: replaces the single "create your setup" step (name + method + grinder + machine) with three independent steps — pick/add grinder, pick/add machine (skippable), pick/add bean — dropping the method question entirely. Still requires at least 1 grinder + 1 bean to finish (machine stays optional, matching today's `grinderEquipmentId` being required on setup).
- **ManualBrewEntry.tsx**: reuses the same 3-way picker component as Bruehen's live flow.

## 5. Migration & data flow

**Local Dexie (client-side IndexedDB):** one more schema version bump (this app's 3rd, after the grind-subclicks v2 migration). On upgrade:
1. For every `brew` row, look up its linked `setup` by `setupId`, backfill `grinderEquipmentId`/`machineEquipmentId` from it, then drop `setupId`.
2. Same backfill for every `recipe` row.
3. Drop the `setups` Dexie table entirely.
4. `bean.beanType`/`equipment.methodHint` need no backfill — genuinely unknown for existing data, handled by the derivation function's fallback at read time.

**Remote D1 (server-side, Drizzle):** a single forward SQL migration, generated the same way as past migrations in `packages/db/migrations/`:
1. Add `grinder_equipment_id`, `machine_equipment_id` to `brew`.
2. Backfill both from each brew's linked `setup` row.
3. Same add + backfill for `recipe`.
4. Drop `setup_id` from `brew` and `recipe` (following whatever create-copy-rename pattern SQLite/Drizzle requires for column drops, matching this project's existing generated-migration style).
5. Add nullable `bean_type` to `bean`, nullable `method_hint` to `equipment`.
6. Drop the `setup` table.

**Sync route (`apps/worker/src/sync.ts`):** the `setups` push/pull and `mergeSetups` disappear entirely from the request/response shape. `mergeBrews`/`mergeRecipes` carry the two new columns through unchanged (they already spread `{...row, userId}` generically). Client's `runSync.ts` drops `setups`/`db.setups` from its push/pull payload and from `SyncResponseBody`.

**Production data safety:** D1 migrations don't apply automatically on deploy (see the deploy-notes gotcha from the account-sync feature) — this migration is materially higher-stakes than any prior one, since it drops a table with real backfill logic behind it. The plan's final task must explicitly verify the migration against a local D1 copy before it's run against production, and call out running `pnpm --filter @kvarn/worker db:migrate:remote` (authenticated wrangler required) as a required manual step.

## 6. Testing approach

- **`packages/core`**: unit tests for `deriveBrewMethod` covering all combinations (machine hint set / bean type only, both values / neither known).
- **`packages/db`**: schema test confirming the new columns exist, following the existing `schema.test.ts` convention.
- **`apps/web`**:
  - `store.test.ts` — tests for `sortedGrinders`/`sortedMachines`/`sortedBeans` (including the never-used-sorts-by-createdAt rule), `lastUsedCombo`, and updated `commitBrew`/recipe-matching tests replacing the old setup-keyed ones.
  - `db.test.ts` — a new Dexie migration test (setup→brew/recipe backfill, setup table dropped), following the same pattern as the existing v2 grind-subclicks migration test.
- **`apps/worker`**: `sync.test.ts`'s existing auth-only test needs no new case (one less table in the payload isn't new behavior to unit test); a manual verification pass confirms a real sync round-trip works with the new shape.
- **Manual/live verification**: full brew flow (live + manual) with real grinder/machine/bean picks, onboarding through the new 3-step flow, Kompass showing recipes correctly grouped by the new triple, and the D1 migration verified against a local D1 copy before being run against production.
