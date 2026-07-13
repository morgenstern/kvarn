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

/**
 * Account data sync: a signed-in (non-anonymous) user's device pushes its
 * local Dexie changes since the last sync, and pulls back everything newer
 * server-side (including rows written by other devices). See
 * docs/03_TECH_KONZEPT.md and the account-data-sync plan, Task 2.
 *
 * Anonymous (device-local) sessions are rejected — sync is an account
 * feature, not something anonymous sessions get.
 */
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
