import { Hono } from "hono";
import { and, eq, isNull } from "drizzle-orm";
import { product, type Product } from "@kvarn/db";
import type { Env } from "./env";
import { getDb } from "./db";

/**
 * Community equipment submissions + moderation queue.
 * See docs/03_TECH_KONZEPT.md §4 step 2: users add missing gear, it lands in
 * D1 with status "community" (pending), and only becomes visible to other
 * clients once a moderator approves it (status -> "verified").
 *
 * Auth/access-control is intentionally NOT implemented yet — better-auth
 * hasn't landed (see docs/04_DEV_PLAN.md M0/M4). The moderation queue is
 * reachable at /moderation in the web app but is not actually protected;
 * treat this as a functional stub for the review workflow, not a secured
 * admin surface, until auth exists.
 */

export const products = new Hono<{ Bindings: Env }>();

const PRODUCT_KINDS = ["grinder", "machine", "brewer", "accessory"] as const;
type ProductKind = (typeof PRODUCT_KINDS)[number];

function isProductKind(value: unknown): value is ProductKind {
  return typeof value === "string" && (PRODUCT_KINDS as readonly string[]).includes(value);
}

// Server-approved community products not already in the static seed catalog.
products.get("/", async (c) => {
  const db = getDb(c.env);
  const rows = await db
    .select()
    .from(product)
    .where(and(eq(product.status, "verified"), isNull(product.deletedAt)));
  return c.json(rows satisfies Product[]);
});

products.post("/submissions", async (c) => {
  const body = await c.req.json<{ kind?: string; brand?: string; model?: string; notes?: string }>();
  if (!isProductKind(body.kind) || !body.brand || !body.model) {
    return c.json({ error: "kind (grinder|machine|brewer|accessory), brand, and model are required" }, 400);
  }

  const db = getDb(c.env);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const row = {
    id,
    kind: body.kind,
    brand: body.brand,
    model: body.model,
    imageUrl: null,
    grindScale: null,
    specs: body.notes ? { notes: body.notes } : null,
    status: "community" as const,
    updatedAt: now,
    deletedAt: null,
    clientId: id,
  };
  await db.insert(product).values(row);
  return c.json(row, 201);
});

products.get("/submissions", async (c) => {
  const db = getDb(c.env);
  const rows = await db
    .select()
    .from(product)
    .where(and(eq(product.status, "community"), isNull(product.deletedAt)));
  return c.json(rows satisfies Product[]);
});

products.post("/submissions/:id/approve", async (c) => {
  const id = c.req.param("id");
  const db = getDb(c.env);
  await db.update(product).set({ status: "verified", updatedAt: new Date().toISOString() }).where(eq(product.id, id));
  return c.json({ ok: true });
});

products.post("/submissions/:id/reject", async (c) => {
  const id = c.req.param("id");
  const db = getDb(c.env);
  await db.update(product).set({ deletedAt: new Date().toISOString() }).where(eq(product.id, id));
  return c.json({ ok: true });
});
