# Sync by default for anonymous users, with opt-out

Status: Approved, ready for implementation plan.

## Problem

Account data sync (see `2026-07-05-account-data-sync-design.md`) only runs for signed-in, non-anonymous accounts today. Every device gets an anonymous session automatically (`useEnsureSession.ts`), but that anonymous data never leaves the device — so switching devices, reinstalling, or just losing a phone loses all logged equipment/beans/brews unless the user has deliberately created a named account. Default behavior should flip: sync to the backend by default under the same anonymous profile, with an explicit opt-out for anyone who doesn't want their data leaving the device.

## What already exists (research findings)

- Sync infrastructure (`POST /api/sync`, client `runSync()`, LWW merge by `(userId, clientId)`, `syncColumns` on every table) is fully built per the account-data-sync spec — it currently just refuses to run for anonymous sessions. No new tables or migrations needed.
- Anonymous sessions already have a real row in the `user` table (`isAnonymous: true`) with a real `id` — sync's per-row `userId` attribution works identically for anonymous and named accounts, no special-casing needed there.
- GPS/weather capture (`getRoughLocation()`, `captureWeatherSnapshot()`) is already its own independent opt-in, offered during onboarding's "location" step. This feature does not touch that consent flow — captured weather snapshots just ride along in the same sync payload as everything else, gated only by the new sync toggle.
- **Gotcha found during research**: `apps/worker/src/auth.ts` configures `anonymous()` with no `onLinkAccount` callback. Better-auth's default behavior on an anonymous session signing up/in is to discard the anonymous user row without transferring its data. Today that's harmless (anonymous data never reached the backend). Once anonymous sessions sync by default, this becomes a real data-loss bug: a user's synced equipment/beans/brews would be orphaned under a deleted anonymous user id the moment they create a named account. Fixing this is part of this feature, not optional.

## Behavior

- Sync now runs for **any** authenticated session (anonymous or named), gated only by a new local opt-out flag — not by account type.
- Default is **on**, for both fresh installs and existing installs updating to this version (no flag present in localStorage → treated as opted in).
- The opt-out is a durable per-device setting. It does not silently flip back on by itself, **except**: signing up or signing into a named account from an anonymous session clears the opt-out (creating/using a named account is treated as an explicit, more deliberate re-consent).
- Opting out stops **future** uploads only. It does not retroactively delete data already synced to the backend — that's covered by the separate (already backlogged) full account deletion feature.

## Client changes (apps/web)

**`src/sync/constants.ts`**: add `SYNC_OPT_OUT_KEY = "kvarn:syncOptOut"` alongside the existing `LAST_SYNCED_KEY`.

**`src/sync/runSync.ts`**:
- Add exported `isSyncOptedOut()` / `setSyncOptedOut(value: boolean)`, localStorage-backed (same shape as the existing `getLastSyncedAt()`).
- `doRunSync()`'s early return changes from `if (!session.data?.user || session.data?.user.isAnonymous) return false;` to `if (!session.data?.user || isSyncOptedOut()) return false;` — still requires some session (anonymous or named), no longer restricted to named accounts.

**`RootLayout.tsx`**: no changes needed. Its debounced "sync on startup, then ~4s after any local change" effect already just calls `runSync()`, which now internally no-ops when opted out — the opt-out is respected everywhere `runSync()` is called, with no extra plumbing.

**`src/routes/Settings.tsx`**:
- Remove the `isRealAccount` gate around the whole Sync card — it's shown to everyone now (anonymous and named).
- Add a toggle inside the Sync card ("Share data with server" / equivalent), backed by local `useState` initialized from `isSyncOptedOut()`, calling `setSyncOptedOut()` on change. No Zustand store changes needed — nothing else needs to react to this flag live.
- After a successful `signIn`/`signUp` in `handleAuthSubmit` (i.e. the anonymous → named transition), call `setSyncOptedOut(false)` to clear any prior opt-out per the re-consent rule above.
- Update the stale `anonymousAccount` copy string (currently "Anonymous device account — data stays local.") since that's no longer accurate by default.

**`src/routes/Onboarding.tsx`**:
- The "account" step's sign-up handler gets the same one-line `setSyncOptedOut(false)` call as Settings, for consistency (a user could sign up during onboarding, before ever visiting Settings).
- The last step ("install") gets one small, muted, inconspicuous line of text — not a toggle — noting that equipment/beans/brews sync anonymously to avoid data loss, and that it can be turned off in Settings.

**i18n (`en.ts` / `de.ts`)**: new strings for the Settings toggle label + hint, the updated `anonymousAccount` copy, and the onboarding install-step note.

## Backend changes (apps/worker)

**`src/sync.ts`**:
- Change the guard from `if (!session || session.user.isAnonymous) { return c.json({ error: "Sync requires a real account" }, 401); }` to `if (!session) { ... }` — any authenticated session can push/pull. `userId = session.user.id` is unchanged.
- Update the stale doc-comment above the route that currently says sync is restricted to non-anonymous accounts.
- No changes to the LWW merge functions themselves.

**`src/auth.ts`**:
- Configure `anonymous({ onLinkAccount })`: on link, reassign all rows in `equipment`, `bean`, `brew`, `recipe` from `anonymousUser.id` to `newUser.id` via direct Drizzle updates, using the `db` instance already constructed in `createAuth()`. `weatherSnapshot` has no `userId` column, so nothing to reassign there.

## Out of scope

- No new backend tables or schema/migration changes.
- No change to the location/weather onboarding step's own consent copy or behavior — it remains independently opt-in, unaffected by the sync toggle.
- No retroactive deletion of data already uploaded when a user opts out — that belongs to the separate, already-backlogged full account deletion feature.
- No change to the LWW conflict-resolution logic.
