export interface WeatherSnapshotResponse {
  tempC: number | null;
  humidityPct: number | null;
  pressureHpa: number | null;
  weatherCode: number | null;
  source: "open_meteo";
  geoCell: string;
  takenAt: string;
}

/**
 * Calls the Worker's weather proxy (see apps/worker/src/weather.ts). Coordinates
 * are only ever sent over the wire to fetch a snapshot — the caller decides
 * whether/how to persist the (already-rounded) result. Same-origin in dev via
 * the vite proxy, same-origin in prod since the Worker serves the SPA too.
 */
export async function fetchWeatherSnapshot(
  lat: number,
  lon: number,
  fetchImpl: typeof fetch = fetch,
): Promise<WeatherSnapshotResponse> {
  const url = `/api/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`weather request failed: ${res.status}`);
  return (await res.json()) as WeatherSnapshotResponse;
}

/**
 * Wraps the browser Geolocation API in a promise. Resolves to null if the
 * user denies permission or geolocation is unavailable — callers should treat
 * that as "no weather this time", never as an error to surface loudly (per
 * docs/02_UX_KONZEPT.md: weather is optional context, not a blocker).
 */
export function getRoughLocation(): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 10 * 60 * 1000 },
    );
  });
}
