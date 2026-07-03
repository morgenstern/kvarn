import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "./index";
import type { Env } from "./env";

function fakeKv() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string, type?: string) => {
      const v = store.get(key);
      if (v === undefined) return null;
      return type === "json" ? JSON.parse(v) : v;
    }),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
  } as unknown as KVNamespace;
}

describe("weather proxy", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects missing coordinates", async () => {
    const env = { WEATHER_CACHE: fakeKv() } as Env;
    const res = await app.request("/api/weather?lat=notanumber", {}, env);
    expect(res.status).toBe(400);
  });

  it("fetches from Open-Meteo and caches the result", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          current: { temperature_2m: 21.5, relative_humidity_2m: 72, surface_pressure: 1013 },
        }),
      ),
    );
    const kv = fakeKv();
    const env = { WEATHER_CACHE: kv } as Env;

    const res = await app.request("/api/weather?lat=52.52&lon=13.405", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ tempC: 21.5, humidityPct: 72, pressureHpa: 1013, source: "open_meteo" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(kv.put).toHaveBeenCalledTimes(1);
  });

  it("serves from cache without calling upstream on a second request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ current: { temperature_2m: 10, relative_humidity_2m: 50, surface_pressure: 1000 } })),
    );
    const kv = fakeKv();
    const env = { WEATHER_CACHE: kv } as Env;

    await app.request("/api/weather?lat=48.1&lon=11.5", {}, env);
    await app.request("/api/weather?lat=48.1&lon=11.5", {}, env);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
