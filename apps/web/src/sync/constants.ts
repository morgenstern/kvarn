// Deliberately its own file with zero other imports: runSync.ts pulls in
// auth/client.ts (which calls window.location.origin at module top level),
// so store.ts must NOT import anything from runSync.ts — even just this
// constant — or it would transitively crash in the Node test environment
// (apps/web/vitest.config.ts sets environment: "node", no `window` global).
export const LAST_SYNCED_KEY = "kvarn:lastSyncedAt";
