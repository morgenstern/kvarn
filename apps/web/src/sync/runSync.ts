import type { Bean, Brew, Equipment, Recipe, Setup, WeatherSnapshot } from "@kvarn/db";
import { db } from "../data/db";
import { authClient } from "../auth/client";
import { LAST_SYNCED_KEY } from "./constants";

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

export async function runSync(): Promise<boolean> {
  const session = await authClient.getSession();
  if (!session.data?.user || session.data?.user.isAnonymous) return false;

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
    localStorage.setItem(LAST_SYNCED_KEY, body.syncedAt);
    return true;
  } catch {
    // Offline, worker unreachable, or a write failed partway through —
    // caller retries later; `since` stays put so the retry is a safe no-op replay.
    return false;
  }
}
