import { describe, expect, it, vi } from "vitest";
import { fetchWeatherSnapshot } from "./weather";

describe("fetchWeatherSnapshot", () => {
  it("requests the weather proxy with lat/lon query params", async () => {
    const fakeFetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            tempC: 18,
            humidityPct: 60,
            pressureHpa: 1015,
            source: "open_meteo",
            geoCell: "52.5,13.4",
            takenAt: "2026-07-03T09:00:00.000Z",
          }),
        ),
    );

    const result = await fetchWeatherSnapshot(52.52, 13.405, fakeFetch as unknown as typeof fetch);

    expect(fakeFetch).toHaveBeenCalledWith("/api/weather?lat=52.52&lon=13.405");
    expect(result.tempC).toBe(18);
  });

  it("throws on a non-ok response", async () => {
    const fakeFetch = vi.fn(async () => new Response("", { status: 500 }));
    await expect(fetchWeatherSnapshot(0, 0, fakeFetch as unknown as typeof fetch)).rejects.toThrow();
  });
});
