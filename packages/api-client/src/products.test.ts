import { afterEach, describe, expect, it, vi } from "vitest";
import { approveSubmission, fetchPendingSubmissions, rejectSubmission, submitProduct } from "./products";

describe("products client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("submitProduct posts to the submissions endpoint", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ id: "1", kind: "grinder", brand: "B", model: "M", status: "community" }), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitProduct({ kind: "grinder", brand: "B", model: "M" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/products/submissions",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.status).toBe("community");
  });

  it("throws when submission fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 400 })));
    await expect(submitProduct({ kind: "grinder", brand: "B", model: "M" })).rejects.toThrow();
  });

  it("fetchPendingSubmissions returns the parsed list", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([{ id: "1" }]))));
    const result = await fetchPendingSubmissions();
    expect(result).toHaveLength(1);
  });

  it("approve and reject call the right endpoints", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);

    await approveSubmission("abc");
    expect(fetchMock).toHaveBeenCalledWith("/api/products/submissions/abc/approve", { method: "POST" });

    await rejectSubmission("abc");
    expect(fetchMock).toHaveBeenCalledWith("/api/products/submissions/abc/reject", { method: "POST" });
  });
});
