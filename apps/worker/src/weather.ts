import { Hono } from "hono";
import type { Env } from "./env";

/**
 * Weather proxy + cache. See docs/03_TECH_KONZEPT.md §3:
 * - Coordinates are rounded to ~10km (1 decimal degree) before use as a cache
 *   key or upstream request — never persisted at full precision.
 * - One snapshot per geo-cell per 30 minutes, cached in KV to stay well
 *   inside the free-tier write budget (1k KV writes/day).
 */

export const weather = new Hono<{ Bindings: Env }>();

const CACHE_TTL_S = 30 * 60;

interface WeatherSnapshotPayload {
  tempC: number | null;
  humidityPct: number | null;
  pressureHpa: number | null;
  source: "open_meteo";
  geoCell: string;
  takenAt: string;
}

function roundToGeoCell(lat: number, lon: number): string {
  // ~0.1 degree ≈ 11km at the equator — matches the tech concept's ~10km cache cell.
  return `${lat.toFixed(1)},${lon.toFixed(1)}`;
}

weather.get("/", async (c) => {
  const lat = Number(c.req.query("lat"));
  const lon = Number(c.req.query("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return c.json({ error: "lat and lon query params are required" }, 400);
  }

  const geoCell = roundToGeoCell(lat, lon);
  const cacheKey = `weather:${geoCell}`;

  const cached = await c.env.WEATHER_CACHE.get<WeatherSnapshotPayload>(cacheKey, "json");
  if (cached) {
    return c.json(cached);
  }

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", geoCell.split(",")[0] ?? String(lat));
  url.searchParams.set("longitude", geoCell.split(",")[1] ?? String(lon));
  url.searchParams.set("current", "temperature_2m,relative_humidity_2m,surface_pressure");

  const upstream = await fetch(url.toString());
  if (!upstream.ok) {
    return c.json({ error: "weather upstream unavailable" }, 502);
  }
  const data = (await upstream.json()) as {
    current?: { temperature_2m?: number; relative_humidity_2m?: number; surface_pressure?: number };
  };

  const payload: WeatherSnapshotPayload = {
    tempC: data.current?.temperature_2m ?? null,
    humidityPct: data.current?.relative_humidity_2m ?? null,
    pressureHpa: data.current?.surface_pressure ?? null,
    source: "open_meteo",
    geoCell,
    takenAt: new Date().toISOString(),
  };

  await c.env.WEATHER_CACHE.put(cacheKey, JSON.stringify(payload), { expirationTtl: CACHE_TTL_S });

  return c.json(payload);
});
