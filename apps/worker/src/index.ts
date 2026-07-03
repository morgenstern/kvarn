import { Hono } from "hono";
import type { Env } from "./env";
import { weather } from "./weather";
import { products } from "./products";
import { photos } from "./photos";
import { feedbackRoute } from "./feedback";
import { createAuth } from "./auth";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ status: "ok" }));
app.route("/api/weather", weather);
app.route("/api/products", products);
app.route("/api/photos", photos);
app.route("/api/feedback", feedbackRoute);
app.on(["GET", "POST"], "/api/auth/*", (c) => createAuth(c.env).handler(c.req.raw));

// Everything else falls through to the static SPA build (apps/web/dist),
// which Cloudflare's assets binding serves with SPA fallback.
app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
