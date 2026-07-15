import { describe, expect, it, vi, beforeEach } from "vitest";

const getSession = vi.fn();
vi.mock("../auth/client", () => ({ authClient: { getSession } }));

const { runSync, isSyncOptedOut, setSyncOptedOut } = await import("./runSync");

describe("runSync", () => {
  beforeEach(() => {
    getSession.mockReset();
    setSyncOptedOut(false);
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

  it("defaults to opted in, and setSyncOptedOut toggles it", () => {
    expect(isSyncOptedOut()).toBe(false);
    setSyncOptedOut(true);
    expect(isSyncOptedOut()).toBe(true);
    setSyncOptedOut(false);
    expect(isSyncOptedOut()).toBe(false);
  });

  it("does not sync when opted out, even with a session (anonymous or named)", async () => {
    getSession.mockResolvedValue({ data: { user: { id: "u1", isAnonymous: true } } });
    setSyncOptedOut(true);

    const result = await runSync();

    expect(result).toBe(false);
  });
});
