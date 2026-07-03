import { describe, expect, it } from "vitest";
import app from "../index";
import type { Env } from "../env";

/**
 * The pipeline's D1/R2/external-API happy path needs a real local worker
 * (`wrangler dev`) with GOOGLE_CSE_API_KEY/GOOGLE_CSE_CX/GEMINI_API_KEY set —
 * not mocked here, same rationale as products.test.ts. This only covers the
 * "not configured" guard, which is the state every fresh checkout starts in.
 */
describe("illustrations — not configured", () => {
  it("returns 501 when the pipeline secrets are missing", async () => {
    const res = await app.request("/api/illustrations/some-product-id/generate", { method: "POST" }, {} as Env);
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body).toMatchObject({ error: expect.stringContaining("not configured") });
  });
});
