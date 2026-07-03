import { afterEach, describe, expect, it, vi } from "vitest";
import { sendFeedback } from "./feedback";

describe("sendFeedback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the message to the feedback endpoint", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendFeedback("hello", "a@b.com");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/feedback",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ message: "hello", email: "a@b.com" }) }),
    );
  });

  it("throws when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 400 })));
    await expect(sendFeedback("hi")).rejects.toThrow();
  });
});
