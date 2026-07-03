import { describe, expect, it } from "vitest";
import app from "./index";
import type { Env } from "./env";

/**
 * These cover request validation only. The D1-backed happy paths (insert,
 * approve, reject) are verified live against a local `wrangler dev` (real
 * Miniflare D1), not mocked here — faithfully mocking drizzle-orm/d1's
 * query builder isn't worth it. @cloudflare/vitest-pool-workers would be the
 * right tool for real integration tests here if this grows further.
 */
describe("products submissions — validation", () => {
  it("rejects a submission missing required fields", async () => {
    const res = await app.request(
      "/api/products/submissions",
      { method: "POST", body: JSON.stringify({ brand: "Only Brand" }), headers: { "content-type": "application/json" } },
      {} as Env,
    );
    expect(res.status).toBe(400);
  });

  it("rejects an invalid kind", async () => {
    const res = await app.request(
      "/api/products/submissions",
      {
        method: "POST",
        body: JSON.stringify({ kind: "spaceship", brand: "Brand", model: "Model" }),
        headers: { "content-type": "application/json" },
      },
      {} as Env,
    );
    expect(res.status).toBe(400);
  });
});
