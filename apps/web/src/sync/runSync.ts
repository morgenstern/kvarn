import type { Bean, Brew, Equipment, Recipe, WeatherSnapshot } from "@kvarn/db";
import { db } from "../data/db";
import { authClient } from "../auth/client";
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

interface SyncResponseBody {
  syncedAt: string;
  equipment: Equipment[];
  beans: Bean[];
  brews: Brew[];
  recipes: Recipe[];
  weatherSnapshots: WeatherSnapshot[];
}

let inFlight: Promise<boolean> | null = null;

export function runSync(): Promise<boolean> {
  if (inFlight) return inFlight;
  inFlight = doRunSync().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doRunSync(): Promise<boolean> {
  const session = await authClient.getSession();
  if (!session.data?.user || isSyncOptedOut()) return false;

  try {
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
    if (!res.ok) return false;

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
    localStorage.setItem(LAST_SYNCED_KEY, body.syncedAt);
    return true;
  } catch {
    // Offline, worker unreachable, or a write failed partway through —
    // caller retries later; `since` stays put so the retry is a safe no-op replay.
    return false;
  }
}
