import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { illustrationCandidate, illustrationDraft, product } from "@kvarn/db";
import type { Env } from "../env";
import { getDb } from "../db";
import { runIllustrationFromPhoto, runIllustrationPipeline } from "./pipeline";

/**
 * AI illustration-generation pipeline for products without a "Kvarn Sketch"
 * illustration yet. See docs/07_ILLUSTRATION_STYLE.md §3 and pipeline.ts for
 * the step-by-step flow. Like the community moderation queue in products.ts,
 * this is not server-side auth-gated yet — the moderation UI hides it behind
 * a signed-in, non-anonymous session, but the endpoints themselves trust the
 * caller until a real admin role exists.
 */
export const illustrations = new Hono<{ Bindings: Env }>();

function isConfigured(env: Env): boolean {
  return Boolean(env.GOOGLE_CSE_API_KEY && env.GOOGLE_CSE_CX && env.GEMINI_API_KEY);
}

illustrations.post("/:productId/generate", async (c) => {
  if (!isConfigured(c.env)) {
    return c.json(
      { error: "illustration pipeline not configured — set GOOGLE_CSE_API_KEY, GOOGLE_CSE_CX, and GEMINI_API_KEY" },
      501,
    );
  }

  const productId = c.req.param("productId");
  try {
    const result = await runIllustrationPipeline(c.env, productId);
    return c.json(result, 201);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "illustration pipeline failed" }, 502);
  }
});

const PHOTO_KINDS = ["grinder", "machine", "brewer", "accessory", "bean"] as const;
type PhotoKind = (typeof PHOTO_KINDS)[number];
function isPhotoKind(value: unknown): value is PhotoKind {
  return typeof value === "string" && (PHOTO_KINDS as readonly string[]).includes(value);
}

illustrations.post("/from-photo", async (c) => {
  if (!c.env.GEMINI_API_KEY) {
    return c.json({ error: "illustration pipeline not configured — set GEMINI_API_KEY" }, 501);
  }

  const body = await c.req.json<{ photoUrl?: string; label?: string; kind?: string }>();
  if (!body.photoUrl || !body.label || !isPhotoKind(body.kind)) {
    return c.json({ error: "photoUrl, label, and kind (grinder|machine|brewer|accessory|bean) are required" }, 400);
  }

  try {
    // photoUrl is typically the relative path returned by POST /api/photos —
    // Workers' fetch() (used inside the pipeline to read the image back)
    // needs an absolute URL, unlike browser fetch which resolves relative
    // paths against document.location.
    const absolutePhotoUrl = new URL(body.photoUrl, c.req.url).toString();
    const result = await runIllustrationFromPhoto(c.env, { photoUrl: absolutePhotoUrl, label: body.label, kind: body.kind });
    return c.json(result, 201);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "illustration generation failed" }, 502);
  }
});

illustrations.get("/:productId", async (c) => {
  const productId = c.req.param("productId");
  const db = getDb(c.env);
  const [candidates, drafts] = await Promise.all([
    db.select().from(illustrationCandidate).where(eq(illustrationCandidate.productId, productId)),
    db.select().from(illustrationDraft).where(eq(illustrationDraft.productId, productId)),
  ]);
  return c.json({ candidates, drafts });
});

illustrations.post("/drafts/:draftId/set-default", async (c) => {
  const draftId = c.req.param("draftId");
  const db = getDb(c.env);
  const [draft] = await db.select().from(illustrationDraft).where(eq(illustrationDraft.id, draftId)).limit(1);
  if (!draft) return c.json({ error: "draft not found" }, 404);

  await db
    .update(illustrationDraft)
    .set({ isDefault: false })
    .where(eq(illustrationDraft.productId, draft.productId));
  await db.update(illustrationDraft).set({ isDefault: true }).where(eq(illustrationDraft.id, draftId));
  await db.update(product).set({ imageUrl: draft.imageUrl, updatedAt: new Date().toISOString() }).where(eq(product.id, draft.productId));

  return c.json({ ok: true });
});
