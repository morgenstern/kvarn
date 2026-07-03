import { describe, expect, it } from "vitest";
import app from "./index";
import type { Env } from "./env";

describe("worker", () => {
  it("responds to /api/health without needing bindings", async () => {
    const res = await app.request("/api/health", {}, {} as Env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
