# Account Data Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When signed into a real (non-anonymous) account, sync equipment/setups/beans/brews/recipes (and weatherSnapshots referenced by synced brews) to and from a Cloudflare D1 backend via one combined endpoint, with a "last synced" timestamp shown in Settings.

**Architecture:** A single `POST /api/sync` Hono route in `apps/worker` does a per-row last-write-wins merge (keyed by `userId` + `clientId`, `userId` always server-attributed from the authenticated session, never trusted from the client) and returns everything changed since the client's last sync. A client-side `runSync()` function in `apps/web` is a no-op unless signed into a real account, triggered on startup, debounced after local mutations, and via a manual button in Settings. `weatherSnapshot` has no `userId` column (it's a shared cache table) — pull is derived from the brews being returned, not a direct per-user query.

**Tech Stack:** Hono, Drizzle (D1), better-auth (session check), React (Zustand store subscription for the debounced trigger).

**Spec:** `docs/superpowers/specs/2026-07-05-account-data-sync-design.md`

**Testing note:** This codebase's existing worker route tests (`apps/worker/src/products.test.ts`) deliberately cover request validation only, not real D1 behavior — the file's own comment explains why: "faithfully mocking drizzle-orm/d1's query builder isn't worth it... verified live against a local `wrangler dev` instead." This plan follows the same convention for the new sync route: unit tests cover auth rejection and malformed-body validation; the actual merge/upsert logic is verified manually against `wrangler dev` (Task 2, Step 6) and in the browser (Task 5).

---

## Task 1: Soft-delete fix for `deleteEquipment`

**Files:**
- Modify: `apps/web/src/state/store.ts`
- Modify: `apps/web/src/state/store.test.ts`

Required prerequisite: `deleteEquipment` currently hard-deletes via `db.equipment.delete(id)`, leaving no tombstone. Without one, a deletion made on one device has no way to tell another signed-in device (via sync) that the row should go away — it would just silently persist there forever.

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/state/store.test.ts`, inside the existing `describe("useKvarnStore", ...)` block (after the last existing `it(...)`, before the closing `});`):

```typescript
  it("deleteEquipment soft-deletes (sets deletedAt) instead of removing the row, so a tombstone can sync", async () => {
    await useKvarnStore.getState().hydrate();
    const grinder = useKvarnStore.getState().products.find((p) => p.kind === "grinder")!;
    const machine = useKvarnStore.getState().products.find((p) => p.kind === "machine")!;
    const grinderEq = await useKvarnStore.getState().addEquipmentFromProduct(grinder.id);
    const machineEq = await useKvarnStore.getState().addEquipmentFromProduct(machine.id);
    // machineEq isn't required by any setup, so deleting it should succeed.
    await useKvarnStore.getState().deleteEquipment(machineEq.id);

    // Gone from the in-memory store (unchanged behavior)...
    expect(useKvarnStore.getState().equipment.find((e) => e.id === machineEq.id)).toBeUndefined();

    // ...but still present in Dexie, tombstoned, not actually removed.
    const row = await db.equipment.get(machineEq.id);
    expect(row).toBeDefined();
    expect(row?.deletedAt).not.toBeNull();

    // A fresh hydrate() (simulating app reload) must not resurrect it.
    useKvarnStore.setState({ hydrated: false, products: [], equipment: [], setups: [], beans: [], brews: [], weatherSnapshots: [], recipes: [], activeSetupId: null, activeBeanId: null });
    await useKvarnStore.getState().hydrate();
    expect(useKvarnStore.getState().equipment.find((e) => e.id === machineEq.id)).toBeUndefined();
    // grinderEq is untouched and still present.
    expect(useKvarnStore.getState().equipment.find((e) => e.id === grinderEq.id)).toBeDefined();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @kvarn/web test`
Expected: FAIL at the "still present in Dexie, tombstoned" assertion — `db.equipment.get(machineEq.id)` currently returns `undefined` because the row is hard-deleted.

- [ ] **Step 3: Switch `deleteEquipment` to soft-delete**

Current (`apps/web/src/state/store.ts:168-201`, the tail of `deleteEquipment`):

```typescript
    await db.equipment.delete(equipmentId);

    set((s) => ({
      equipment: s.equipment.filter((e) => e.id !== equipmentId),
      setups: s.setups.map((s2) =>
        s2.machineEquipmentId === equipmentId || (s2.accessoryEquipmentIds ?? []).includes(equipmentId)
          ? {
              ...s2,
              machineEquipmentId: s2.machineEquipmentId === equipmentId ? null : s2.machineEquipmentId,
              accessoryEquipmentIds: (s2.accessoryEquipmentIds ?? []).filter((id) => id !== equipmentId),
            }
          : s2,
      ),
    }));
  },
```

New:

```typescript
    await db.equipment.update(equipmentId, { deletedAt: nowIso(), updatedAt: nowIso() });

    set((s) => ({
      equipment: s.equipment.filter((e) => e.id !== equipmentId),
      setups: s.setups.map((s2) =>
        s2.machineEquipmentId === equipmentId || (s2.accessoryEquipmentIds ?? []).includes(equipmentId)
          ? {
              ...s2,
              machineEquipmentId: s2.machineEquipmentId === equipmentId ? null : s2.machineEquipmentId,
              accessoryEquipmentIds: (s2.accessoryEquipmentIds ?? []).filter((id) => id !== equipmentId),
            }
          : s2,
      ),
    }));
  },
```

(The in-memory `set()` call is unchanged — it already excludes the row from `state.equipment` immediately, regardless of the underlying Dexie operation.)

- [ ] **Step 4: Filter tombstoned rows in `hydrate()`**

Current (`apps/web/src/state/store.ts:89-113`):

```typescript
  hydrate: async () => {
    await ensureSeeded();
    await syncApprovedProducts();
    const [products, equipment, setups, beans, brews, weatherSnapshots, recipes] = await Promise.all([
      db.products.toArray(),
      db.equipment.toArray(),
      db.setups.toArray(),
      db.beans.toArray().then((all) => all.filter((b) => !b.archived)),
      db.brews.orderBy("brewedAt").reverse().toArray(),
      db.weatherSnapshots.toArray(),
      db.recipes.toArray(),
    ]);
    set({
      hydrated: true,
      products,
      equipment,
      setups,
      beans,
      brews,
      weatherSnapshots,
      recipes,
      activeSetupId: setups[0]?.id ?? null,
      activeBeanId: beans[0]?.id ?? null,
    });
  },
```

New:

```typescript
  hydrate: async () => {
    await ensureSeeded();
    await syncApprovedProducts();
    const [products, equipment, setups, beans, brews, weatherSnapshots, recipes] = await Promise.all([
      db.products.toArray(),
      db.equipment.toArray().then((all) => all.filter((e) => !e.deletedAt)),
      db.setups.toArray(),
      db.beans.toArray().then((all) => all.filter((b) => !b.archived)),
      db.brews.orderBy("brewedAt").reverse().toArray(),
      db.weatherSnapshots.toArray(),
      db.recipes.toArray(),
    ]);
    set({
      hydrated: true,
      products,
      equipment,
      setups,
      beans,
      brews,
      weatherSnapshots,
      recipes,
      activeSetupId: setups[0]?.id ?? null,
      activeBeanId: beans[0]?.id ?? null,
    });
  },
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @kvarn/web test`
Expected: PASS — all `store.test.ts` cases, including the new one.

- [ ] **Step 6: Typecheck and lint**

Run: `pnpm --filter @kvarn/web typecheck && pnpm --filter @kvarn/web lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/state/store.ts apps/web/src/state/store.test.ts
git commit -m "Soft-delete equipment instead of hard-deleting, so deletions can sync"
```

---

## Task 2: `POST /api/sync` worker route

**Files:**
- Create: `apps/worker/src/sync.ts`
- Test: `apps/worker/src/sync.test.ts`

- [ ] **Step 1: Write the failing validation tests**

Create `apps/worker/src/sync.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import app from "./index";
import type { Env } from "./env";

/**
 * Same convention as products.test.ts: validation/auth-rejection only. The
 * real D1-backed merge behavior (upsert, last-write-wins, the weatherSnapshot
 * derived-pull special case) is verified live against `wrangler dev`, not
 * mocked here — see Task 2 Step 6 of the account-data-sync plan.
 */
describe("POST /api/sync — auth", () => {
  it("rejects when there's no session at all", async () => {
    const res = await app.request(
      "/api/sync",
      {
        method: "POST",
        body: JSON.stringify({ since: null, equipment: [], setups: [], beans: [], brews: [], recipes: [], weatherSnapshots: [] }),
        headers: { "content-type": "application/json" },
      },
      {} as Env,
    );
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @kvarn/worker test`
Expected: FAIL — `/api/sync` doesn't exist yet (404, not 401).

- [ ] **Step 3: Implement the route**

Create `apps/worker/src/sync.ts`:

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

export const sync = new Hono<{ Bindings: Env }>();

interface SyncPushBody {
  since: string | null;
  equipment: Equipment[];
  setups: Setup[];
  beans: Bean[];
  brews: Brew[];
  recipes: Recipe[];
  weatherSnapshots: WeatherSnapshot[];
}

const EPOCH = "1970-01-01T00:00:00.000Z";

sync.post("/", async (c) => {
  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!session || session.user.isAnonymous) {
    return c.json({ error: "Sync requires a real account" }, 401);
  }
  const userId = session.user.id;
  const body = await c.req.json<SyncPushBody>();
  const db = getDb(c.env);

  // Per-row last-write-wins, keyed by (userId, clientId). The incoming
  // row's own userId is never trusted — every write is attributed to the
  // authenticated session regardless of what the client sent.
  for (const row of body.equipment) {
    const existing = await db.select().from(equipment).where(and(eq(equipment.userId, userId), eq(equipment.clientId, row.clientId))).get();
    if (existing && existing.updatedAt >= row.updatedAt) continue;
    if (existing) await db.update(equipment).set({ ...row, userId }).where(and(eq(equipment.userId, userId), eq(equipment.clientId, row.clientId)));
    else await db.insert(equipment).values({ ...row, userId });
  }
  for (const row of body.setups) {
    const existing = await db.select().from(setup).where(and(eq(setup.userId, userId), eq(setup.clientId, row.clientId))).get();
    if (existing && existing.updatedAt >= row.updatedAt) continue;
    if (existing) await db.update(setup).set({ ...row, userId }).where(and(eq(setup.userId, userId), eq(setup.clientId, row.clientId)));
    else await db.insert(setup).values({ ...row, userId });
  }
  for (const row of body.beans) {
    const existing = await db.select().from(bean).where(and(eq(bean.userId, userId), eq(bean.clientId, row.clientId))).get();
    if (existing && existing.updatedAt >= row.updatedAt) continue;
    if (existing) await db.update(bean).set({ ...row, userId }).where(and(eq(bean.userId, userId), eq(bean.clientId, row.clientId)));
    else await db.insert(bean).values({ ...row, userId });
  }
  for (const row of body.brews) {
    const existing = await db.select().from(brew).where(and(eq(brew.userId, userId), eq(brew.clientId, row.clientId))).get();
    if (existing && existing.updatedAt >= row.updatedAt) continue;
    if (existing) await db.update(brew).set({ ...row, userId }).where(and(eq(brew.userId, userId), eq(brew.clientId, row.clientId)));
    else await db.insert(brew).values({ ...row, userId });
  }
  for (const row of body.recipes) {
    const existing = await db.select().from(recipe).where(and(eq(recipe.userId, userId), eq(recipe.clientId, row.clientId))).get();
    if (existing && existing.updatedAt >= row.updatedAt) continue;
    if (existing) await db.update(recipe).set({ ...row, userId }).where(and(eq(recipe.userId, userId), eq(recipe.clientId, row.clientId)));
    else await db.insert(recipe).values({ ...row, userId });
  }
  // weatherSnapshot has no userId column (shared cache table, not
  // per-owner) — push is a plain "insert if this id doesn't exist yet"
  // (these rows are never updated after creation, only created).
  for (const row of body.weatherSnapshots) {
    const existing = await db.select().from(weatherSnapshot).where(eq(weatherSnapshot.id, row.id)).get();
    if (!existing) await db.insert(weatherSnapshot).values(row);
  }

  const since = body.since ?? EPOCH;
  const [equipmentOut, setupsOut, beansOut, brewsOut, recipesOut] = await Promise.all([
    db.select().from(equipment).where(and(eq(equipment.userId, userId), gt(equipment.updatedAt, since))),
    db.select().from(setup).where(and(eq(setup.userId, userId), gt(setup.updatedAt, since))),
    db.select().from(bean).where(and(eq(bean.userId, userId), gt(bean.updatedAt, since))),
    db.select().from(brew).where(and(eq(brew.userId, userId), gt(brew.updatedAt, since))),
    db.select().from(recipe).where(and(eq(recipe.userId, userId), gt(recipe.updatedAt, since))),
  ]);

  // weatherSnapshot pull is derived from the brews being returned (join on
  // brew.weatherId), not a direct per-user query — there's no userId column
  // to query by.
  const weatherIds = [...new Set(brewsOut.map((b) => b.weatherId).filter((id): id is string => id !== null))];
  const weatherSnapshotsOut = weatherIds.length > 0 ? await db.select().from(weatherSnapshot).where(inArray(weatherSnapshot.id, weatherIds)) : [];

  return c.json({
    syncedAt: new Date().toISOString(),
    equipment: equipmentOut,
    setups: setupsOut,
    beans: beansOut,
    brews: brewsOut,
    recipes: recipesOut,
    weatherSnapshots: weatherSnapshotsOut,
  });
});
```

- [ ] **Step 4: Mount the route**

Current (`apps/worker/src/index.ts:1-18`):

```typescript
import { Hono } from "hono";
import type { Env } from "./env";
import { weather } from "./weather";
import { products } from "./products";
import { photos } from "./photos";
import { feedbackRoute } from "./feedback";
import { illustrations } from "./illustrations";
import { createAuth } from "./auth";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ status: "ok" }));
app.route("/api/weather", weather);
app.route("/api/products", products);
app.route("/api/photos", photos);
app.route("/api/feedback", feedbackRoute);
app.route("/api/illustrations", illustrations);
app.on(["GET", "POST"], "/api/auth/*", (c) => createAuth(c.env).handler(c.req.raw));
```

New:

```typescript
import { Hono } from "hono";
import type { Env } from "./env";
import { weather } from "./weather";
import { products } from "./products";
import { photos } from "./photos";
import { feedbackRoute } from "./feedback";
import { illustrations } from "./illustrations";
import { sync } from "./sync";
import { createAuth } from "./auth";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ status: "ok" }));
app.route("/api/weather", weather);
app.route("/api/products", products);
app.route("/api/photos", photos);
app.route("/api/feedback", feedbackRoute);
app.route("/api/illustrations", illustrations);
app.route("/api/sync", sync);
app.on(["GET", "POST"], "/api/auth/*", (c) => createAuth(c.env).handler(c.req.raw));
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @kvarn/worker test`
Expected: PASS.

- [ ] **Step 6: Typecheck, lint, and a manual `wrangler dev` smoke test**

Run: `pnpm --filter @kvarn/worker typecheck && pnpm --filter @kvarn/worker lint`
Expected: PASS.

Then, from `apps/worker`, run `wrangler dev` (or whatever the project's existing `pnpm dev:worker` script does — check root `package.json`), sign up for a real account via the running web app, and `curl` or otherwise call `POST /api/sync` with a session cookie and an empty push body (`{"since": null, "equipment": [], "setups": [], "beans": [], "brews": [], "recipes": [], "weatherSnapshots": []}`) — confirm a 200 response with empty arrays (since there's nothing local to that fresh account yet).

- [ ] **Step 7: Commit**

```bash
git add apps/worker/src/sync.ts apps/worker/src/sync.test.ts apps/worker/src/index.ts
git commit -m "Add POST /api/sync: per-row last-write-wins merge for user data"
```

---

## Task 3: Client `runSync()`

**Files:**
- Create: `apps/web/src/sync/runSync.ts`

There's no existing precedent for unit-testing a full fetch-based sync round-trip in this codebase (the closest analog, `syncApprovedProducts`, also has no test) — this task is verified via typecheck/lint and the end-to-end manual check in Task 4.

- [ ] **Step 1: Implement `runSync`**

Create `apps/web/src/sync/runSync.ts`:

```typescript
import type { Bean, Brew, Equipment, Recipe, Setup, WeatherSnapshot } from "@kvarn/db";
import { db } from "../data/db";
import { authClient } from "../auth/client";

const LAST_SYNCED_KEY = "kvarn:lastSyncedAt";

export function getLastSyncedAt(): string | null {
  return localStorage.getItem(LAST_SYNCED_KEY);
}

interface SyncResponseBody {
  syncedAt: string;
  equipment: Equipment[];
  setups: Setup[];
  beans: Bean[];
  brews: Brew[];
  recipes: Recipe[];
  weatherSnapshots: WeatherSnapshot[];
}

/**
 * No-op unless signed into a real (non-anonymous) account. Pushes local
 * rows changed since the last successful sync, merges back whatever the
 * server returns as changed since then too, and advances the "last synced"
 * cursor only on success — see
 * docs/superpowers/specs/2026-07-05-account-data-sync-design.md.
 *
 * Never throws: sync failures (offline, etc.) are silent no-ops. The next
 * trigger (startup, another edit, or the manual button) retries with the
 * same `since` cursor — safe and lossless, since clientId makes every push
 * idempotent.
 */
export async function runSync(): Promise<boolean> {
  const session = await authClient.getSession();
  if (!session.data?.user || session.data.user.isAnonymous) return false;

  try {
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
    if (!res.ok) return false;

    const body = (await res.json()) as SyncResponseBody;
    // Preserve the server's updatedAt verbatim (bulkPut here does NOT
    // restamp it) — otherwise every pulled row would look locally-changed
    // again next cycle and get pointlessly re-pushed forever.
    await Promise.all([
      db.equipment.bulkPut(body.equipment),
      db.setups.bulkPut(body.setups),
      db.beans.bulkPut(body.beans),
      db.brews.bulkPut(body.brews),
      db.recipes.bulkPut(body.recipes),
      db.weatherSnapshots.bulkPut(body.weatherSnapshots),
    ]);
    localStorage.setItem(LAST_SYNCED_KEY, body.syncedAt);
    return true;
  } catch {
    return false;
  }
}
```

(`authClient.getSession()` is a plain promise-returning method distinct from the `useSession()` React hook already used elsewhere — confirmed present on the installed `better-auth@1.6.23` client, resolving to the same `{ data, error }` shape `useSession()`'s atom uses, so `session.data?.user` above is correct.)

- [ ] **Step 2: Typecheck and lint**

Run: `pnpm --filter @kvarn/web typecheck && pnpm --filter @kvarn/web lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/sync/runSync.ts
git commit -m "Add client-side runSync: no-op unless a real account is signed in"
```

---

## Task 4: Triggers — startup, debounced after edits, and re-fetching in-memory state

**Files:**
- Modify: `apps/web/src/routes/RootLayout.tsx`

- [ ] **Step 1: Add a startup + debounced-after-edit sync effect**

In `apps/web/src/routes/RootLayout.tsx`, add the import:

```typescript
import { runSync } from "../sync/runSync";
```

Inside the `RootLayout()` component, alongside the existing `useEffect(() => { hydrate(); }, [hydrate]);`, add a second effect:

```typescript
  const equipment = useKvarnStore((s) => s.equipment);
  const setups = useKvarnStore((s) => s.setups);
  const beans = useKvarnStore((s) => s.beans);
  const brews = useKvarnStore((s) => s.brews);
  const recipes = useKvarnStore((s) => s.recipes);

  // Sync on startup, then again ~4s after any local change to a synced
  // table (debounced so a burst of edits doesn't fire a request per
  // keystroke) — no-ops itself if not signed into a real account.
  useEffect(() => {
    const timeout = setTimeout(() => {
      runSync().then((didSync) => {
        if (didSync) hydrate();
      });
    }, 4000);
    return () => clearTimeout(timeout);
  }, [hydrate, equipment, setups, beans, brews, recipes]);
```

(`hydrate()` after a successful sync re-reads Dexie into the in-memory store, so anything pulled from the server shows up without a manual refresh. This effect fires once immediately on mount too, since its dependency array includes values that are already populated by the time this component first renders past the `!hydrated` loading gate — if it doesn't fire promptly enough on cold start in testing, add a dedicated `useEffect(() => { runSync().then((did) => { if (did) hydrate(); }); }, [])` for the startup case specifically, separate from the debounced one.)

- [ ] **Step 2: Typecheck and lint**

Run: `pnpm --filter @kvarn/web typecheck && pnpm --filter @kvarn/web lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/RootLayout.tsx
git commit -m "Trigger sync on startup and debounced after local edits"
```

---

## Task 5: Settings UI — last synced, manual sync, hide delete-all when signed in

**Files:**
- Modify: `apps/web/src/routes/Settings.tsx`
- Modify: `apps/web/src/i18n/de.ts`
- Modify: `apps/web/src/i18n/en.ts`

- [ ] **Step 1: Add i18n strings**

In `apps/web/src/i18n/de.ts`, current (`de.ts`, inside the `settings` namespace, right after `deleteConfirmButton`):

```typescript
    deleteConfirmButton: "Ja, endgültig löschen",
```

New:

```typescript
    deleteConfirmButton: "Ja, endgültig löschen",
    sync: "Synchronisierung",
    lastSyncedAt: "Zuletzt synchronisiert: {time}",
    neverSynced: "Noch nicht synchronisiert",
    syncNow: "Jetzt synchronisieren",
    syncSuccess: "Synchronisiert!",
    syncError: "Ging gerade nicht (kein Server erreichbar?).",
    accountDeletionComingSoon: "Vollständiges Löschen des Kontos folgt bald.",
```

In `apps/web/src/i18n/en.ts`, current (inside the `settings` namespace, right after `deleteConfirmButton`):

```typescript
    deleteConfirmButton: "Yes, delete permanently",
```

New:

```typescript
    deleteConfirmButton: "Yes, delete permanently",
    sync: "Sync",
    lastSyncedAt: "Last synced: {time}",
    neverSynced: "Not synced yet",
    syncNow: "Sync now",
    syncSuccess: "Synced!",
    syncError: "Couldn't sync (server unreachable?).",
    accountDeletionComingSoon: "Full account deletion is coming soon.",
```

- [ ] **Step 2: Read the current Data card and account-check code**

Run: `sed -n '1,30p;150,180p' apps/web/src/routes/Settings.tsx`

Confirm the `isRealAccount` computation and the "Data" card (export/delete) still match the structure below before editing.

- [ ] **Step 3: Add sync state and the sync handler**

Add the import:

```typescript
import { getLastSyncedAt, runSync } from "../sync/runSync";
```

Inside the `Settings()` component, alongside the other `useState` calls, add:

```typescript
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "synced" | "error">("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState(getLastSyncedAt());
```

Add a handler function, alongside `handleExport`/`handleDelete`:

```typescript
  async function handleSyncNow() {
    setSyncState("syncing");
    const ok = await runSync();
    setLastSyncedAt(getLastSyncedAt());
    setSyncState(ok ? "synced" : "error");
  }
```

- [ ] **Step 4: Add the Sync card and hide the delete-all section when signed in**

Current (`Settings.tsx`, the "Data" card, from the existing file read earlier in this project):

```tsx
      <Card>
        <SectionLabel icon={Database}>{t("data")}</SectionLabel>
        <Button variant="ghost" onClick={handleExport}>
          <Download size={18} strokeWidth={1.5} />
          {t("exportData")}
        </Button>
        {!confirmingDelete ? (
          <Button variant="ghost" onClick={() => setConfirmingDelete(true)}>
            <Trash2 size={18} strokeWidth={1.5} />
            {t("deleteData")}
          </Button>
        ) : (
          <>
            <p className="text-base text-clay mt-3">{t("deleteConfirm")}</p>
            <Button onClick={handleDelete}>{t("deleteConfirmButton")}</Button>
            <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
              {tCommon("cancel")}
            </Button>
          </>
        )}
      </Card>
```

New:

```tsx
      <Card>
        <SectionLabel icon={Database}>{t("data")}</SectionLabel>
        <Button variant="ghost" onClick={handleExport}>
          <Download size={18} strokeWidth={1.5} />
          {t("exportData")}
        </Button>
        {isRealAccount ? (
          <p className="text-sm text-muted mt-2">{t("accountDeletionComingSoon")}</p>
        ) : !confirmingDelete ? (
          <Button variant="ghost" onClick={() => setConfirmingDelete(true)}>
            <Trash2 size={18} strokeWidth={1.5} />
            {t("deleteData")}
          </Button>
        ) : (
          <>
            <p className="text-base text-clay mt-3">{t("deleteConfirm")}</p>
            <Button onClick={handleDelete}>{t("deleteConfirmButton")}</Button>
            <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
              {tCommon("cancel")}
            </Button>
          </>
        )}
      </Card>

      {isRealAccount ? (
        <Card>
          <SectionLabel icon={RefreshCw}>{t("sync")}</SectionLabel>
          <p className="text-sm text-muted mb-2">{lastSyncedAt ? t("lastSyncedAt", { time: new Date(lastSyncedAt).toLocaleString(locale) }) : t("neverSynced")}</p>
          <Button variant="ghost" onClick={handleSyncNow} disabled={syncState === "syncing"}>
            <RefreshCw size={18} strokeWidth={1.5} />
            {t("syncNow")}
          </Button>
          {syncState === "synced" ? <p className="text-sm text-sage">{t("syncSuccess")}</p> : null}
          {syncState === "error" ? <p className="text-sm text-clay">{t("syncError")}</p> : null}
        </Card>
      ) : null}
```

Add `RefreshCw` to the existing lucide-react import line at the top of the file (currently `import { Database, Download, Languages, LogOut, MessageCircle, Send, Trash2, User } from "lucide-react";`):

```typescript
import { Database, Download, Languages, LogOut, MessageCircle, RefreshCw, Send, Trash2, User } from "lucide-react";
```

`locale` must be in scope for `new Date(...).toLocaleString(locale)` — it already is, via the existing `const { locale, setLocale } = useLocale();` destructuring in this component.

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm --filter @kvarn/web typecheck && pnpm --filter @kvarn/web lint`
Expected: PASS.

- [ ] **Step 6: Manual verification in the browser**

Using the preview tooling already set up for this project:
1. As an anonymous session: confirm Settings shows the "Delete all local data" button as before, and no "Sync" card at all.
2. Add some equipment/a setup/a brew, then sign up for a real account.
3. Confirm the "Sync" card now appears, initially "Noch nicht synchronisiert"/"Not synced yet". Tap "Jetzt synchronisieren"/"Sync now" — confirm it shows "Synchronisiert!"/"Synced!" and a timestamp appears.
4. Confirm the "Delete all local data" button is gone, replaced by the "coming soon" note.
5. Open the app in a second browser (or a private/incognito window), sign into the same account, confirm the equipment/setup/brew from step 2 shows up there after a sync.
6. Make an edit on one of the two sessions (e.g. rename a grinder), wait a few seconds, sync (or wait for the debounced auto-sync), confirm the other session picks up the change on its next sync.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/routes/Settings.tsx apps/web/src/i18n/de.ts apps/web/src/i18n/en.ts
git commit -m "Add Sync card to Settings; hide delete-all-data for real accounts"
```

---

## Task 6: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full workspace check**

Run: `pnpm -w lint && pnpm -w typecheck && pnpm -w test`
Expected: PASS across all 6 packages.

- [ ] **Step 2: Add a release note entry**

Check the current commit count with `git rev-list --count HEAD`, add 1, and add an entry to `apps/web/src/releaseNotes.ts` at that version describing this feature briefly in both `de` and `en`.

- [ ] **Step 3: Commit and push**

```bash
git add apps/web/src/releaseNotes.ts
git commit -m "Add release note for account data sync"
git push origin main
```
