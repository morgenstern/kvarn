import { describe, expect, it } from "vitest";
import app from "./index";
import type { Env } from "./env";

/**
 * Same convention as products.test.ts: validation/auth-rejection only. The
 * real D1-backed merge behavior (upsert, last-write-wins, the weatherSnapshot
 * derived-pull special case) is verified live against `wrangler dev`, not
 * mocked here — see Task 2 Step 6 of the account-data-sync plan.
 */
describe("POST /api/sync — auth", () => {
  it("rejects when there's no session at all", async () => {
    const res = await app.request(
      "/api/sync",
      {
        method: "POST",
        body: JSON.stringify({ since: null, equipment: [], beans: [], brews: [], recipes: [], weatherSnapshots: [] }),
        headers: { "content-type": "application/json" },
      },
      {} as Env,
    );
    expect(res.status).toBe(401);
  });
});
