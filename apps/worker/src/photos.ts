import { Hono } from "hono";
import type { Env } from "./env";

/**
 * Bean/equipment photo storage in R2. Client uploads the raw image bytes
 * with a Content-Type header; no multipart parsing needed for a single file.
 * See docs/03_TECH_KONZEPT.md §2 (R2) and §4 (bean photos).
 */

export const photos = new Hono<{ Bindings: Env }>();

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

photos.post("/", async (c) => {
  const contentType = c.req.header("content-type") ?? "";
  const ext = EXT_BY_CONTENT_TYPE[contentType];
  if (!ext) {
    return c.json({ error: "unsupported content-type, use image/jpeg, image/png, or image/webp" }, 400);
  }

  const body = await c.req.arrayBuffer();
  if (body.byteLength === 0 || body.byteLength > 5 * 1024 * 1024) {
    return c.json({ error: "photo must be between 1 byte and 5MB" }, 400);
  }

  const key = `bean-photos/${crypto.randomUUID()}.${ext}`;
  await c.env.PHOTOS.put(key, body, { httpMetadata: { contentType } });

  return c.json({ url: `/api/photos/${key}` }, 201);
});

photos.get("/*", async (c) => {
  const key = c.req.path.replace("/api/photos/", "");
  const object = await c.env.PHOTOS.get(key);
  if (!object) return c.notFound();

  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
});
