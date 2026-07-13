# Account data sync

Status: Approved, ready for implementation plan.

## Problem

The app is local-first — all user data (equipment, setups, beans, brews, recipes, weatherSnapshots) lives only in the browser's IndexedDB (Dexie), regardless of auth state. Signing into a real account currently doesn't sync anything anywhere. Users need their data to follow them across devices when signed in, plus visibility into when that last happened.

## What already exists (research findings)

- The D1 tables for `equipment`, `setup`, `bean`, `brew`, `recipe`, `weatherSnapshot` already exist (migration 0000) — never touched by any server-side endpoint since.
- Every one of those tables already has `updatedAt`, `deletedAt` (soft-delete), and `clientId` (idempotency key) via the shared `syncColumns` — the schema was clearly designed with sync in mind from day one, just never wired up.
- Local Dexie rows are always tagged `userId: "local"` (a hardcoded constant), regardless of whether an anonymous or real session is active, and regardless of which real account. **This stays unchanged** — it's a device-local implementation detail with no bearing on server-side partitioning.
- No anonymous→real-account merge exists or is needed: because local rows are never tagged with a real user id, a fresh signup's first sync is just "push everything, attributed to the new real account" — no special-case merge logic.
- No existing bidirectional sync of anything user-owned. The closest precedent, `syncApprovedProducts` (`apps/web/src/data/db.ts`), is one-way (worker → client only) and stamps a fresh `updatedAt` on merge — **this repo's sync must NOT copy that specific behavior** (see "Preserving timestamps" below).

## Scope

Sync covers: `equipment`, `setups`, `beans`, `brews`, `recipes`, and `weatherSnapshots` referenced by synced brews. The shared product catalog is excluded — it's not user-owned and already has its own one-way sync mechanism.

Only runs when signed into a real (non-anonymous) account. Anonymous sessions never sync; their data stays local-only, same as today.

## Endpoint: `POST /api/sync` (apps/worker)

**Request body**: `{ since: string | null, equipment: [], setups: [], beans: [], brews: [], recipes: [], weatherSnapshots: [] }` — the client's locally-changed rows (by `updatedAt`) since its last successful sync. Always sends all six keys, empty arrays where nothing changed locally.

**Auth**: same pattern as `feedback.ts` — `createAuth(c.env).api.getSession(...)`. Reject (401) if there's no session or `session.user.isAnonymous`. The server **never trusts a client-supplied `userId`** — every write is attributed to `session.user.id`, regardless of what the client sends.

**Merge**: per-row last-write-wins, keyed by `(userId, clientId)`. If the server's existing row (if any) has `updatedAt >=` the incoming row's, skip it (server wins, no-op); otherwise upsert.

**`weatherSnapshots` special case**: this table has no `userId` column (it's a shared/global cache, not user-owned). Push is straightforward (client sends the ones it created). Pull is derived, not queried directly: the server includes the weatherSnapshot rows referenced by the brews it's returning (join on `brew.weatherId`), not a per-user weatherSnapshot query.

**Response**: `{ syncedAt: <server's now>, equipment: [], setups: [], beans: [], brews: [], recipes: [], weatherSnapshots: [] }` — every row for this `userId`, across all six tables, with `updatedAt > since` (post-merge, so it includes anything just written by this same request too — harmless, since the client already has those exact values and `bulkPut` is idempotent).

## Client (apps/web)

A `runSync()` function, no-op unless signed into a real account:

1. Read `lastSyncedAt` from localStorage (`null` if never synced).
2. Gather local rows across the six tables with `updatedAt > lastSyncedAt` (plain in-memory filter after `.toArray()` — no new Dexie indexes needed at this data scale; YAGNI).
3. `POST /api/sync` with `{ since: lastSyncedAt, ...localChanges }`.
4. On success: merge the response's rows into local Dexie via `bulkPut`, update the in-memory store, then set `lastSyncedAt = response.syncedAt` in localStorage.
5. On any failure (offline, etc.): silently no-op. The next trigger retries with the same `since` cursor — safe and lossless, since `clientId` makes every push idempotent.

**Preserving timestamps**: unlike `syncApprovedProducts`, merged-in rows must keep the server's original `updatedAt` verbatim, not get stamped with a fresh "now". Otherwise every pulled row would look locally-changed again on the very next cycle and get pointlessly re-pushed forever (harmless to correctness, but wastes D1 write ops indefinitely).

**Triggers**: on app startup (once a real session is confirmed), debounced ~4s after any local mutation to the six covered tables (subscribe to the relevant store slices), and a manual "Sync now" button in Settings.

**No Dexie schema/version change needed** — sync only reads/writes existing columns. (Unrelated: the grind main/sub-click feature has its own separate Dexie version bump; the two are independent.)

## Settings UI

- Shows "Zuletzt synchronisiert: {time}" / "Last synced: {time}", or a "not yet synced" state.
- A "Sync now" button, with a brief inline success/error message (same inline-message style already used for feedback send/error).
- When signed into a real account, the "Delete all local data" section is **hidden** (not just disabled), replaced with a one-line "Full account deletion is coming soon" note.

## Soft-delete fix (required prerequisite, touches earlier work)

`deleteEquipment` (added earlier this session) currently hard-deletes via `db.equipment.delete(id)`, leaving no tombstone. Without one, a deletion on device A has no way to tell device B (via sync) that the row should be removed — it would just silently persist on B forever. Fix:

- Change `deleteEquipment` to set `deletedAt: nowIso()` (and `updatedAt`) instead of deleting the row.
- `hydrate()` (Dexie → Zustand state load) filters out rows with a non-null `deletedAt` when populating `state.equipment`. This is the only touch point needed — the delete action's own optimistic in-memory `set()` call already excludes the row immediately via its existing `.filter()`, independent of the underlying Dexie operation.

## Out of scope

- No real-time push (WebSockets/SSE) — trigger-based sync only (startup / debounced-after-edit / manual).
- No per-field merge — per-row last-write-wins only, matching the schema's evident design intent.
- No offline retry queue beyond "the next trigger retries automatically."
- **Full account deletion** (local + server wipe + a tombstone so other signed-in devices learn about it and clear their own local copy on next sync/login) — explicitly backlogged as its own future feature, not built now. The "Delete all local data" Settings section is hidden rather than repurposed for this, to avoid half-building it.
