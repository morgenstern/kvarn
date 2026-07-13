# Personalized Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When signed into a real (non-anonymous) account, both header instances in `RootLayout.tsx` show the user's name and a user icon instead of the gear icon + "Settings" text — still linking to `/settings`.

**Architecture:** Extract the duplicated header-link JSX (currently identical in the onboarding header and the main app header) into one small shared component that branches on `isRealAccount`, reusing the exact same auth-state check `Settings.tsx` already uses.

**Tech Stack:** React, better-auth client (`authClient.useSession`), existing `useDisplayName` hook.

**Spec:** `docs/superpowers/specs/2026-07-05-header-personalization-design.md`

---

## Task 1: Extract a shared `HeaderAccountLink` component

**Files:**
- Modify: `apps/web/src/routes/RootLayout.tsx`

There's no existing component test infrastructure in this codebase (verified: only `packages/core`'s pure-function tests and `apps/web/src/state/store.test.ts`'s store-logic tests exist — no React Testing Library setup). This task is verified by typecheck/lint plus a manual browser check, matching how every other JSX-only change in this project has been verified.

- [ ] **Step 1: Read the current file in full**

Run: `cat apps/web/src/routes/RootLayout.tsx`

Confirm it still matches the structure below before editing — in particular the two `<Link to="/settings">...</Link>` blocks (one in the onboarding-header branch, one in the main-header branch) and the existing imports.

Current relevant imports (top of file):

```typescript
import { useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Coffee, Compass, Settings as SettingsIcon, SlidersHorizontal, Sun } from "lucide-react";
import { Logo, LogoLockup } from "@kvarn/ui";
import { useKvarnStore } from "../state/store";
import { useT } from "../i18n";
import { useEnsureSession } from "../auth/useEnsureSession";
```

Current onboarding header block (inside the `if (location.pathname === "/onboarding")` branch):

```tsx
        <div className="max-w-md mx-auto w-full px-5 pt-3 flex justify-end">
          <Link to="/settings" className="flex items-center gap-1.5 text-base text-muted">
            <SettingsIcon size={16} strokeWidth={1.5} />
            {tSettings("title")}
          </Link>
        </div>
```

Current main header block (further down, in the default return):

```tsx
      <div className="max-w-md mx-auto w-full px-5 pt-3 flex items-center justify-between">
        <LogoLockup />
        <Link to="/settings" className="flex items-center gap-1.5 text-base text-muted">
          <SettingsIcon size={16} strokeWidth={1.5} />
          {tSettings("title")}
        </Link>
      </div>
```

- [ ] **Step 2: Add the new imports**

Change the import block to:

```typescript
import { useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Coffee, Compass, Settings as SettingsIcon, SlidersHorizontal, Sun, User } from "lucide-react";
import { Logo, LogoLockup } from "@kvarn/ui";
import { useKvarnStore } from "../state/store";
import { useT } from "../i18n";
import { useEnsureSession } from "../auth/useEnsureSession";
import { useDisplayName } from "../hooks/useDisplayName";
import { authClient } from "../auth/client";

const { useSession } = authClient;
```

- [ ] **Step 3: Add the `HeaderAccountLink` component**

Add this above the `RootLayout` function (i.e. after the imports, before `export function RootLayout()`):

```tsx
/** The header's settings entry point — personalized to the user's name +
 * a user icon when signed into a real account, otherwise today's plain
 * gear icon + "Settings" link. Same auth check Settings.tsx uses. */
function HeaderAccountLink({ settingsLabel }: { settingsLabel: string }) {
  const { data: session } = useSession();
  const { displayName } = useDisplayName();
  const isRealAccount = !!session?.user && !session.user.isAnonymous;

  if (isRealAccount) {
    return (
      <Link to="/settings" className="flex items-center gap-1.5 text-base text-muted">
        <User size={16} strokeWidth={1.5} />
        {displayName || session.user.email}
      </Link>
    );
  }

  return (
    <Link to="/settings" className="flex items-center gap-1.5 text-base text-muted">
      <SettingsIcon size={16} strokeWidth={1.5} />
      {settingsLabel}
    </Link>
  );
}
```

- [ ] **Step 4: Use it in the onboarding header**

Replace:

```tsx
        <div className="max-w-md mx-auto w-full px-5 pt-3 flex justify-end">
          <Link to="/settings" className="flex items-center gap-1.5 text-base text-muted">
            <SettingsIcon size={16} strokeWidth={1.5} />
            {tSettings("title")}
          </Link>
        </div>
```

with:

```tsx
        <div className="max-w-md mx-auto w-full px-5 pt-3 flex justify-end">
          <HeaderAccountLink settingsLabel={tSettings("title")} />
        </div>
```

- [ ] **Step 5: Use it in the main header**

Replace:

```tsx
      <div className="max-w-md mx-auto w-full px-5 pt-3 flex items-center justify-between">
        <LogoLockup />
        <Link to="/settings" className="flex items-center gap-1.5 text-base text-muted">
          <SettingsIcon size={16} strokeWidth={1.5} />
          {tSettings("title")}
        </Link>
      </div>
```

with:

```tsx
      <div className="max-w-md mx-auto w-full px-5 pt-3 flex items-center justify-between">
        <LogoLockup />
        <HeaderAccountLink settingsLabel={tSettings("title")} />
      </div>
```

- [ ] **Step 6: Typecheck and lint**

Run: `pnpm --filter @kvarn/web typecheck && pnpm --filter @kvarn/web lint`
Expected: PASS.

- [ ] **Step 7: Manual verification in the browser**

Using the preview tooling already set up for this project:
1. As an anonymous session (the default, fresh install): confirm both header instances (onboarding and main) still show the gear icon + "Settings"/"Einstellungen", unchanged.
2. Sign up for a real account via Settings (email/password). Confirm the header now shows a `User` icon + your display name (if you've set one in "Dein Name"/"Your name") or your email otherwise, on every screen — not just Settings.
3. Set a display name in Settings ("Dein Name"), navigate away and back to a different tab, confirm the header updates to show that name instead of the email.
4. Sign out. Confirm the header reverts to the plain gear icon + "Settings" link.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/routes/RootLayout.tsx
git commit -m "Show user's name in the header when signed into a real account"
```

---

## Task 2: Verification and release note

**Files:** none (verification + `apps/web/src/releaseNotes.ts`)

- [ ] **Step 1: Full workspace check**

Run: `pnpm -w lint && pnpm -w typecheck && pnpm -w test`
Expected: PASS across all 6 packages.

- [ ] **Step 2: Add a release note entry**

Check the current commit count with `git rev-list --count HEAD`, add 1, and add an entry to `apps/web/src/releaseNotes.ts` at that version describing this feature briefly in both `de` and `en`.

- [ ] **Step 3: Commit and push**

```bash
git add apps/web/src/releaseNotes.ts
git commit -m "Add release note for personalized header"
git push origin main
```
