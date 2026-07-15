# Sync by default for anonymous users, with opt-out — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make account data sync run for anonymous sessions by default (not just named accounts), gated by a new local opt-out flag instead of account type, and fix the data-loss gap where an anonymous→named upgrade would otherwise orphan already-synced backend data.

**Architecture:** A new localStorage-backed opt-out flag (`kvarn:syncOptOut`) replaces the `isAnonymous` check in the client's `runSync()` and the worker's `POST /api/sync` guard. Better-auth's `anonymous()` plugin gets an `onLinkAccount` hook that reassigns D1 rows from the anonymous user id to the new named user id on signup/signin. Settings and onboarding get UI/copy updates; no schema or migration changes.

**Tech Stack:** React 18 + Vite (apps/web), Zustand (unused for this feature — plain localStorage + component state), Hono + Drizzle + D1 (apps/worker), better-auth 1.6 (`anonymous` plugin), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-15-anonymous-data-sync-design.md`

**Testing note:** Following this repo's existing convention (see `apps/worker/src/sync.test.ts`'s own comment, and Task 2 of the account-data-sync plan): worker route tests cover auth-rejection/validation only, not real D1 merge behavior. The `onLinkAccount` data-reassignment logic and the "anonymous session can now sync" behavior are verified manually against a local `wrangler dev` + D1, not mocked.

---

## Task 1: Client — sync opt-out flag, gate `runSync()`

**Files:**
- Modify: `apps/web/src/sync/constants.ts`
- Modify: `apps/web/src/sync/runSync.ts`
- Test: `apps/web/src/sync/runSync.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace the top of `apps/web/src/sync/runSync.test.ts` (the `beforeEach` and the destructured import) and add two new tests, so the file reads:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const getSession = vi.fn();
vi.mock("../auth/client", () => ({ authClient: { getSession } }));

const { runSync, isSyncOptedOut, setSyncOptedOut } = await import("./runSync");

describe("runSync", () => {
  beforeEach(() => {
    getSession.mockReset();
    setSyncOptedOut(false);
  });

  it("dedupes overlapping calls into a single in-flight sync", async () => {
    getSession.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ data: null }), 10)),
    );

    const first = runSync();
    const second = runSync();

    expect(second).toBe(first);
    await Promise.all([first, second]);
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it("starts a fresh sync once the previous call has settled", async () => {
    getSession.mockResolvedValue({ data: null });

    await runSync();
    await runSync();

    expect(getSession).toHaveBeenCalledTimes(2);
  });

  it("defaults to opted in, and setSyncOptedOut toggles it", () => {
    expect(isSyncOptedOut()).toBe(false);
    setSyncOptedOut(true);
    expect(isSyncOptedOut()).toBe(true);
    setSyncOptedOut(false);
    expect(isSyncOptedOut()).toBe(false);
  });

  it("does not sync when opted out, even with a session (anonymous or named)", async () => {
    getSession.mockResolvedValue({ data: { user: { id: "u1", isAnonymous: true } } });
    setSyncOptedOut(true);

    const result = await runSync();

    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `pnpm --filter @kvarn/web test -- runSync`
Expected: FAIL — `isSyncOptedOut`/`setSyncOptedOut` are not exported from `./runSync` yet.

- [ ] **Step 3: Add the opt-out constant**

In `apps/web/src/sync/constants.ts`, add a second export below the existing one:

```ts
// Deliberately its own file with zero other imports: runSync.ts pulls in
// auth/client.ts (which calls window.location.origin at module top level),
// so store.ts must NOT import anything from runSync.ts — even just this
// constant — or it would transitively crash in the Node test environment
// (apps/web/vitest.config.ts sets environment: "node", no `window` global).
export const LAST_SYNCED_KEY = "kvarn:lastSyncedAt";
export const SYNC_OPT_OUT_KEY = "kvarn:syncOptOut";
```

- [ ] **Step 4: Add the opt-out helpers and update the sync gate**

In `apps/web/src/sync/runSync.ts`, change the import line and add two exported functions right after `getLastSyncedAt`:

```ts
import { LAST_SYNCED_KEY, SYNC_OPT_OUT_KEY } from "./constants";

export function getLastSyncedAt(): string | null {
  return localStorage.getItem(LAST_SYNCED_KEY);
}

export function isSyncOptedOut(): boolean {
  return localStorage.getItem(SYNC_OPT_OUT_KEY) === "1";
}

export function setSyncOptedOut(value: boolean): void {
  if (value) localStorage.setItem(SYNC_OPT_OUT_KEY, "1");
  else localStorage.removeItem(SYNC_OPT_OUT_KEY);
}
```

Then change `doRunSync()`'s early return from restricting to named accounts to respecting the opt-out flag instead:

```ts
async function doRunSync(): Promise<boolean> {
  const session = await authClient.getSession();
  if (!session.data?.user || isSyncOptedOut()) return false;
```

(This is the only change in `doRunSync` — everything below it, the push/pull/merge body, stays as-is.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @kvarn/web test -- runSync`
Expected: PASS (all 4 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/sync/constants.ts apps/web/src/sync/runSync.ts apps/web/src/sync/runSync.test.ts
git commit -m "Sync: gate on an opt-out flag instead of account type"
```

---

## Task 2: Worker — allow anonymous sessions to sync

**Files:**
- Modify: `apps/worker/src/sync.ts`

- [ ] **Step 1: Update the route guard and doc comment**

In `apps/worker/src/sync.ts`, replace the doc comment above `export const sync = new Hono<{ Bindings: Env }>();`:

```ts
/**
 * Account data sync: any authenticated device — anonymous or a named
 * account — pushes its local Dexie changes since the last sync, and pulls
 * back everything newer server-side (including rows written by other
 * devices). See docs/03_TECH_KONZEPT.md, the account-data-sync plan (Task
 * 2), and docs/superpowers/specs/2026-07-15-anonymous-data-sync-design.md.
 *
 * An anonymous session is still a real session with a real user id — only
 * a request with no session at all is rejected. The client-side opt-out
 * (see apps/web/src/sync/runSync.ts) is what actually decides whether an
 * anonymous device's data reaches this endpoint at all.
 */
export const sync = new Hono<{ Bindings: Env }>();
```

Then change the guard inside `sync.post("/", ...)`:

```ts
sync.post("/", async (c) => {
  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: "Sync requires a session" }, 401);
  }
  const userId = session.user.id;
```

(Everything below `const userId = session.user.id;` — the merge calls, the response — is unchanged.)

- [ ] **Step 2: Run the existing test to confirm it still passes**

Run: `pnpm --filter @kvarn/worker test -- sync`
Expected: PASS — `sync.test.ts`'s "rejects when there's no session at all" test still holds (an anonymous session is still `!session === false`, so that case is untouched; there was never a test for the anonymous-rejection case since it required a live session, so nothing needs to be removed).

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @kvarn/worker typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/sync.ts
git commit -m "Worker: allow anonymous sessions to use /api/sync"
```

---

## Task 3: Worker — migrate anonymous data to the named account on signup

**Files:**
- Modify: `apps/worker/src/auth.ts`

- [ ] **Step 1: Add the `onLinkAccount` hook**

In `apps/worker/src/auth.ts`, update the imports and the `anonymous()` plugin config:

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { account, session, user, verification, equipment, bean, brew, recipe } from "@kvarn/db";
import type { Env } from "./env";
```

```ts
    plugins: [
      anonymous({
        onLinkAccount: async ({ anonymousUser, newUser }) => {
          // Anonymous sessions now sync by default (see
          // docs/superpowers/specs/2026-07-15-anonymous-data-sync-design.md),
          // so an anonymous user's D1 rows are real data, not scratch state.
          // better-auth's default onLinkAccount behavior deletes the
          // anonymous user row without moving anything — without this hook,
          // that data would be orphaned under a deleted user id the moment
          // someone signs up. weatherSnapshot has no userId column, so
          // there's nothing to reassign there.
          const fromId = anonymousUser.user.id;
          const toId = newUser.user.id;
          await db.update(equipment).set({ userId: toId }).where(eq(equipment.userId, fromId));
          await db.update(bean).set({ userId: toId }).where(eq(bean.userId, fromId));
          await db.update(brew).set({ userId: toId }).where(eq(brew.userId, fromId));
          await db.update(recipe).set({ userId: toId }).where(eq(recipe.userId, fromId));
        },
      }),
    ],
```

(This replaces the existing `plugins: [anonymous()],` line. `db` is the same Drizzle instance already constructed at the top of `createAuth()` — no new binding needed.)

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @kvarn/worker typecheck`
Expected: PASS. (No unit test added here — per this file's existing convention of not mocking D1/better-auth internals; verified live in Task 6's manual smoke test instead.)

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/auth.ts
git commit -m "Worker: reassign anonymous user's synced data on account link"
```

---

## Task 4: Settings UI — sync toggle and copy

**Files:**
- Modify: `apps/web/src/routes/Settings.tsx`
- Modify: `apps/web/src/i18n/en.ts`
- Modify: `apps/web/src/i18n/de.ts`

- [ ] **Step 1: Add i18n strings**

In `apps/web/src/i18n/en.ts`, inside the `settings` block, change `anonymousAccount` and add two new keys right after `accountDeletionComingSoon`:

```ts
    anonymousAccount: "Anonymous device account — your data still syncs to our server so it's not lost, without a name or email attached.",
```

```ts
    accountDeletionComingSoon: "Full account deletion is coming soon.",
    syncToggleLabel: "Share data with our server",
    syncToggleHint: "On by default, so your gear, beans, and brews aren't lost if you switch devices or reinstall. Turn off to keep everything on this device only.",
```

In `apps/web/src/i18n/de.ts`, the matching changes:

```ts
    anonymousAccount: "Anonymes Gerätekonto — deine Daten werden trotzdem mit unserem Server synchronisiert, ganz ohne Namen oder E-Mail.",
```

```ts
    accountDeletionComingSoon: "Vollständiges Löschen des Kontos folgt bald.",
    syncToggleLabel: "Daten mit unserem Server teilen",
    syncToggleHint: "Standardmäßig an, damit Mühlen, Bohnen und Bezüge nicht verloren gehen, wenn du das Gerät wechselst. Zum Deaktivieren ausschalten — dann bleibt alles nur auf diesem Gerät.",
```

- [ ] **Step 2: Show the Sync card to everyone, add the toggle**

In `apps/web/src/routes/Settings.tsx`, update the import line to pull in the new helpers:

```ts
import { getLastSyncedAt, isSyncOptedOut, runSync, setSyncOptedOut } from "../sync/runSync";
```

Add local state near the other `useState` calls (right after the `syncState` line):

```ts
  const [syncOptedOut, setSyncOptedOutState] = useState(() => isSyncOptedOut());
```

Remove the `isRealAccount ? ... : null` wrapper around the Sync card entirely, and add the toggle inside it:

```tsx
      <Card>
        <SectionLabel icon={RefreshCw}>{t("sync")}</SectionLabel>
        <p className="text-sm text-muted mb-2">
          {lastSyncedAt ? t("lastSyncedAt", { time: new Date(lastSyncedAt).toLocaleString(locale) }) : t("neverSynced")}
        </p>
        <Button variant="ghost" onClick={handleSyncNow} disabled={syncState === "syncing"}>
          <RefreshCw size={18} strokeWidth={1.5} />
          {t("syncNow")}
        </Button>
        {syncState === "synced" ? <p className="text-sm text-sage">{t("syncSuccess")}</p> : null}
        {syncState === "error" ? <p className="text-sm text-clay">{t("syncError")}</p> : null}
        <label className="flex items-center gap-2 mt-3 text-base">
          <input
            type="checkbox"
            checked={!syncOptedOut}
            onChange={(e) => {
              const optedOut = !e.target.checked;
              setSyncOptedOut(optedOut);
              setSyncOptedOutState(optedOut);
            }}
          />
          {t("syncToggleLabel")}
        </label>
        <p className="text-sm text-muted mt-1">{t("syncToggleHint")}</p>
      </Card>
```

- [ ] **Step 3: Clear the opt-out flag when an anonymous session becomes a named account**

In `handleAuthSubmit`, clear the flag on success (this form only renders for `!isRealAccount`, so any successful submit here is exactly the anonymous → named transition):

```ts
  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(false);
    const result =
      authMode === "signIn" ? await signIn.email({ email, password }) : await signUp.email({ email, password, name: email });
    if (result.error) {
      setAuthError(true);
    } else {
      setEmail("");
      setPassword("");
      setSyncOptedOut(false);
      setSyncOptedOutState(false);
    }
  }
```

- [ ] **Step 4: Typecheck and lint**

Run: `pnpm --filter @kvarn/web typecheck && pnpm --filter @kvarn/web lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/Settings.tsx apps/web/src/i18n/en.ts apps/web/src/i18n/de.ts
git commit -m "Settings: show sync controls to everyone, add opt-out toggle"
```

---

## Task 5: Onboarding — reset opt-out on signup, add the sync note

**Files:**
- Modify: `apps/web/src/routes/Onboarding.tsx`
- Modify: `apps/web/src/i18n/en.ts`
- Modify: `apps/web/src/i18n/de.ts`

- [ ] **Step 1: Add the `installSyncNote` i18n string**

In `apps/web/src/i18n/en.ts`, inside the `onboarding` block, add a new key right after `installButton`:

```ts
    installButton: "Install now",
    installSyncNote: "Your gear, beans, and brews sync anonymously so nothing's lost if you switch devices — no name or email needed. Turn this off anytime in Settings.",
```

In `apps/web/src/i18n/de.ts`, the matching addition:

```ts
    installButton: "Jetzt installieren",
    installSyncNote: "Mühlen, Bohnen und Bezüge werden anonym synchronisiert, damit nichts verloren geht, wenn du das Gerät wechselst — ganz ohne Namen oder E-Mail. In den Einstellungen jederzeit abschaltbar.",
```

- [ ] **Step 2: Clear the opt-out flag on onboarding signup**

In `apps/web/src/routes/Onboarding.tsx`, add the import:

```ts
import { setSyncOptedOut } from "../sync/runSync";
```

Update `handleAccountSubmit`:

```ts
  async function handleAccountSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAccountError(false);
    setAccountBusy(true);
    try {
      const result = await signUp.email({ email, password, name: firstName || email });
      if (result.error) {
        setAccountError(true);
      } else {
        setSyncOptedOut(false);
        setStep("install");
      }
    } finally {
      setAccountBusy(false);
    }
  }
```

- [ ] **Step 3: Add the note to the install step**

In the `step === "install"` block, add one line after the finish button:

```tsx
      {step === "install" ? (
        <Card>
          <SectionLabel icon={Download}>{t("stepInstall")}</SectionLabel>
          <p className="text-base mb-3">{t("installQuestion")}</p>
          {isStandaloneDisplay() ? (
            <p className="text-sm text-muted mb-3">{t("installAlready")}</p>
          ) : platform === "ios" ? (
            <p className="text-sm text-muted mb-3">{t("installIosHint")}</p>
          ) : deferredPrompt ? (
            <Button variant="ghost" onClick={triggerInstall}>
              <Download size={18} strokeWidth={1.5} />
              {t("installButton")}
            </Button>
          ) : (
            <p className="text-sm text-muted mb-3">
              {platform === "android" ? t("installAndroidHint") : t("installDesktopHint")}
            </p>
          )}
          <Button onClick={finishOnboarding}>{t("finish")}</Button>
          <p className="text-[13px] text-muted mt-3">{t("installSyncNote")}</p>
        </Card>
      ) : null}
```

- [ ] **Step 4: Typecheck and lint**

Run: `pnpm --filter @kvarn/web typecheck && pnpm --filter @kvarn/web lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/Onboarding.tsx apps/web/src/i18n/en.ts apps/web/src/i18n/de.ts
git commit -m "Onboarding: note that data syncs anonymously by default"
```

---

## Task 6: Full verification, release notes, and deploy

**Files:**
- Modify: `apps/web/src/releaseNotes.ts`

- [ ] **Step 1: Run the full test/typecheck/lint suite**

Run: `pnpm build && pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS across every package.

- [ ] **Step 2: Manual smoke test — anonymous sync actually reaches the backend**

Start both dev servers (web on 5173, worker on 8787 — use the `Preview` tool's `preview_start` with the `kvarn-web` and `kvarn-worker` configs from `.claude/launch.json`, or `pnpm dev` from the repo root).

In the browser: go through onboarding as a fresh anonymous session (add a grinder and a bean), land on `/`. Open the network tab (or `preview_network`) and confirm a `POST /api/sync` request fires within ~4s and returns **200** (not 401) — this is the "anonymous sessions can now sync" behavior from Task 2.

- [ ] **Step 3: Manual smoke test — signup migrates the anonymous data**

Still in that same session, go to Settings and sign up for a real account (email/password). After it succeeds, confirm via the network tab that a subsequent sync still returns 200. Then, from `apps/worker`, inspect the local D1 database directly:

```bash
cd apps/worker && wrangler d1 execute kvarn --local --command "select id, userId from equipment"
```

Expected: the `userId` column for the equipment added earlier now matches the **new named account's** user id, not the original anonymous session's id (confirms Task 3's `onLinkAccount` reassignment actually ran).

- [ ] **Step 4: Manual smoke test — the opt-out toggle actually stops sync**

In Settings, turn the new toggle off. Add another piece of equipment. Confirm (network tab / `preview_network`) that no further `POST /api/sync` request fires for ~10s. Turn the toggle back on and confirm syncing resumes.

- [ ] **Step 5: Add the release notes entry**

Run `git rev-list --count HEAD` to get the current commit count `N`. In `apps/web/src/releaseNotes.ts`, add a new entry at the end of the array with `version: N + 1`:

```ts
  { version: N_PLUS_1, de: "Deine Daten werden jetzt standardmäßig anonym mit dem Server synchronisiert, mit einer Abschalt-Option in den Einstellungen.", en: "Your data now syncs anonymously to the server by default, with an opt-out in Settings." },
```

(Replace `N_PLUS_1` with the actual computed integer — this is the version number, not a variable name.)

- [ ] **Step 6: Commit, push to main, and note the deploy**

```bash
git add apps/web/src/releaseNotes.ts
git commit -m "Add release note for default anonymous data sync"
git push origin main
```

Cloudflare Workers Builds picks up the push and deploys automatically (per this project's standing deploy workflow — no migration step needed here since this feature adds no new `packages/db/migrations/*.sql` file).
