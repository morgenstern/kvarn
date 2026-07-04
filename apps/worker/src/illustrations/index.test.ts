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

  it("from-photo returns 501 when GEMINI_API_KEY is missing", async () => {
    const res = await app.request(
      "/api/illustrations/from-photo",
      { method: "POST", body: JSON.stringify({ photoUrl: "/api/photos/x.jpg", label: "My rig", kind: "grinder" }), headers: { "content-type": "application/json" } },
      {} as Env,
    );
    expect(res.status).toBe(501);
  });

  it("from-photo rejects a request missing required fields", async () => {
    const res = await app.request(
      "/api/illustrations/from-photo",
      { method: "POST", body: JSON.stringify({ label: "My rig" }), headers: { "content-type": "application/json" } },
      { GEMINI_API_KEY: "test-key" } as Env,
    );
    expect(res.status).toBe(400);
  });

  it("from-photo rejects an invalid kind", async () => {
    const res = await app.request(
      "/api/illustrations/from-photo",
      {
        method: "POST",
        body: JSON.stringify({ photoUrl: "/api/photos/x.jpg", label: "My rig", kind: "spaceship" }),
        headers: { "content-type": "application/json" },
      },
      { GEMINI_API_KEY: "test-key" } as Env,
    );
    expect(res.status).toBe(400);
  });
});
