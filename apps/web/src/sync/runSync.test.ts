import { describe, expect, it, vi, beforeEach } from "vitest";

const getSession = vi.fn();
vi.mock("../auth/client", () => ({ authClient: { getSession } }));

const { runSync } = await import("./runSync");

describe("runSync", () => {
  beforeEach(() => {
    getSession.mockReset();
  });

  it("dedupes overlapping calls into a single in-flight sync", async () => {
    getSession.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ data: null }), 10)),
    );

    const first = runSync();
    const second = runSync();

    expect(second).toBe(first);
    await Promise.all([first, second]);
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it("starts a fresh sync once the previous call has settled", async () => {
    getSession.mockResolvedValue({ data: null });

    await runSync();
    await runSync();

    expect(getSession).toHaveBeenCalledTimes(2);
  });
});
