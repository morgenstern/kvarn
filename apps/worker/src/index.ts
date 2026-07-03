import { Hono } from "hono";
import type { Env } from "./env";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ status: "ok" }));

// Everything else falls through to the static SPA build (apps/web/dist),
// which Cloudflare's assets binding serves with SPA fallback.
app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
