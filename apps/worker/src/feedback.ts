import { Hono } from "hono";
import { feedback } from "@kvarn/db";
import type { Env } from "./env";
import { getDb } from "./db";
import { createAuth } from "./auth";

export const feedbackRoute = new Hono<{ Bindings: Env }>();

feedbackRoute.post("/", async (c) => {
  const body = await c.req.json<{ message?: string; email?: string }>();
  if (!body.message || body.message.trim().length === 0) {
    return c.json({ error: "message is required" }, 400);
  }

  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });

  const db = getDb(c.env);
  await db.insert(feedback).values({
    id: crypto.randomUUID(),
    userId: session?.user.id ?? null,
    message: body.message.slice(0, 4000),
    email: body.email || null,
  });

  return c.json({ ok: true }, 201);
});
