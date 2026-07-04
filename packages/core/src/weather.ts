export type WeatherConditionKey =
  | "clear"
  | "partly_cloudy"
  | "overcast"
  | "fog"
  | "drizzle"
  | "rain"
  | "freezing_rain"
  | "snow"
  | "showers"
  | "thunderstorm"
  | "unknown";

/**
 * Maps an Open-Meteo WMO weather code (https://open-meteo.com/en/docs, "WMO
 * Weather interpretation codes") to a compact, translatable condition key.
 * apps/web supplies the display text per locale for each key.
 */
export function weatherConditionKey(code: number | null | undefined): WeatherConditionKey {
  if (code == null) return "unknown";
  if (code === 0) return "clear";
  if (code === 1 || code === 2) return "partly_cloudy";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code === 66 || code === 67) return "freezing_rain";
  if (code >= 61 && code <= 65) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "showers";
  if (code >= 85 && code <= 86) return "snow";
  if (code >= 95 && code <= 99) return "thunderstorm";
  return "unknown";
}
