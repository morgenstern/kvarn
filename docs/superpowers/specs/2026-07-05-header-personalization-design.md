# Personalized header when signed in

Status: Approved, ready for implementation plan.

## Problem

The header always shows a gear icon + "Settings"/"Einstellungen" link, regardless of account state. When a user has a real (non-anonymous) account, it should show who they are instead.

## Design

In `apps/web/src/routes/RootLayout.tsx`, both header instances (the onboarding header and the main app header) currently duplicate the same `<Link to="/settings">` fragment. Extract a small shared piece that:

- Calls `useSession()` (already used the same way in `Settings.tsx`) and computes `isRealAccount = !!session?.user && !session.user.isAnonymous` — same check `Settings.tsx` already uses.
- Calls `useDisplayName()` (existing hook, same one backing the "Dein Name" field and the Heute greeting).
- When `isRealAccount` is true: renders `<User size={16} strokeWidth={1.5} />` + `displayName || session.user.email`.
- Otherwise: renders today's `<SettingsIcon />` + `tSettings("title")`, unchanged.
- Both cases stay a `<Link to="/settings">`.

## Out of scope

- No change to how `displayName` or `session.user.name` are set or synced — this only changes what's *displayed* in the header.
- Anonymous/local-only sessions are unaffected.
