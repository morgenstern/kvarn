import type { WeatherConditionKey } from "@kvarn/core";

/** Maps packages/core's condition key to the i18n key in the "heute" dictionary section. */
export const CONDITION_I18N_KEY: Record<WeatherConditionKey, string> = {
  clear: "condClear",
  partly_cloudy: "condPartlyCloudy",
  overcast: "condOvercast",
  fog: "condFog",
  drizzle: "condDrizzle",
  rain: "condRain",
  freezing_rain: "condFreezingRain",
  snow: "condSnow",
  showers: "condShowers",
  thunderstorm: "condThunderstorm",
  unknown: "condUnknown",
};
