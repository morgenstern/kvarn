import { Hono } from "hono";
import { and, eq, gt, inArray } from "drizzle-orm";
import {
  equipment,
  bean,
  brew,
  recipe,
  weatherSnapshot,
  type Equipment,
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
  beans: Bean[];
  brews: Brew[];
  recipes: Recipe[];
  weatherSnapshots: WeatherSnapshot[];
}

const EPOCH = "1970-01-01T00:00:00.000Z";

// Per-row last-write-wins, keyed by (userId, clientId). The incoming
// row's own userId is never trusted — every write is attributed to the
// authenticated session regardless of what the client sent.
//
// One concrete (non-generic) function per table: fighting Drizzle's
// generic table typing to unify these isn't worth it for 5 tables, but
// naming each one keeps the handler body a readable list of one-liners
// and removes the copy-paste risk of forgetting the `userId` override.

async function mergeEquipment(db: ReturnType<typeof getDb>, userId: string, rows: Equipment[]) {
  for (const row of rows) {
    const existing = await db.select().from(equipment).where(and(eq(equipment.userId, userId), eq(equipment.clientId, row.clientId))).get();
    if (existing && existing.updatedAt >= row.updatedAt) continue;
    if (existing) await db.update(equipment).set({ ...row, userId }).where(and(eq(equipment.userId, userId), eq(equipment.clientId, row.clientId)));
    else await db.insert(equipment).values({ ...row, userId });
  }
}

async function mergeBeans(db: ReturnType<typeof getDb>, userId: string, rows: Bean[]) {
  for (const row of rows) {
    const existing = await db.select().from(bean).where(and(eq(bean.userId, userId), eq(bean.clientId, row.clientId))).get();
    if (existing && existing.updatedAt >= row.updatedAt) continue;
    if (existing) await db.update(bean).set({ ...row, userId }).where(and(eq(bean.userId, userId), eq(bean.clientId, row.clientId)));
    else await db.insert(bean).values({ ...row, userId });
  }
}

async function mergeBrews(db: ReturnType<typeof getDb>, userId: string, rows: Brew[]) {
  for (const row of rows) {
    const existing = await db.select().from(brew).where(and(eq(brew.userId, userId), eq(brew.clientId, row.clientId))).get();
    if (existing && existing.updatedAt >= row.updatedAt) continue;
    if (existing) await db.update(brew).set({ ...row, userId }).where(and(eq(brew.userId, userId), eq(brew.clientId, row.clientId)));
    else await db.insert(brew).values({ ...row, userId });
  }
}

async function mergeRecipes(db: ReturnType<typeof getDb>, userId: string, rows: Recipe[]) {
  for (const row of rows) {
    const existing = await db.select().from(recipe).where(and(eq(recipe.userId, userId), eq(recipe.clientId, row.clientId))).get();
    if (existing && existing.updatedAt >= row.updatedAt) continue;
    if (existing) await db.update(recipe).set({ ...row, userId }).where(and(eq(recipe.userId, userId), eq(recipe.clientId, row.clientId)));
    else await db.insert(recipe).values({ ...row, userId });
  }
}

sync.post("/", async (c) => {
  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!session || session.user.isAnonymous) {
    return c.json({ error: "Sync requires a real account" }, 401);
  }
  const userId = session.user.id;
  const body = await c.req.json<SyncPushBody>();
  const db = getDb(c.env);

  await mergeEquipment(db, userId, body.equipment);
  await mergeBeans(db, userId, body.beans);
  await mergeBrews(db, userId, body.brews);
  await mergeRecipes(db, userId, body.recipes);

  // weatherSnapshot has no userId column (shared cache table, not
  // per-owner) — push is a plain "insert if this id doesn't exist yet"
  // (these rows are never updated after creation, only created).
  for (const row of body.weatherSnapshots) {
    const existing = await db.select().from(weatherSnapshot).where(eq(weatherSnapshot.id, row.id)).get();
    if (!existing) await db.insert(weatherSnapshot).values(row);
  }

  const since = body.since ?? EPOCH;
  const [equipmentOut, beansOut, brewsOut, recipesOut] = await Promise.all([
    db.select().from(equipment).where(and(eq(equipment.userId, userId), gt(equipment.updatedAt, since))),
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
    beans: beansOut,
    brews: brewsOut,
    recipes: recipesOut,
    weatherSnapshots: weatherSnapshotsOut,
  });
});
