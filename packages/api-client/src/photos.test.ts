import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadPhoto } from "./photos";

describe("uploadPhoto", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uploads the blob and returns the served URL", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ url: "/api/photos/bean-photos/x.jpg" }), { status: 201 })));
    const blob = new Blob(["fake image bytes"], { type: "image/jpeg" });

    const url = await uploadPhoto(blob);

    expect(url).toBe("/api/photos/bean-photos/x.jpg");
  });

  it("throws on a failed upload", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 400 })));
    await expect(uploadPhoto(new Blob(["x"], { type: "image/jpeg" }))).rejects.toThrow();
  });
});
