import { describe, expect, it } from "vitest";
import { weatherConditionKey } from "./weather";

describe("weatherConditionKey", () => {
  it("maps known WMO codes to their condition key", () => {
    expect(weatherConditionKey(0)).toBe("clear");
    expect(weatherConditionKey(2)).toBe("partly_cloudy");
    expect(weatherConditionKey(3)).toBe("overcast");
    expect(weatherConditionKey(45)).toBe("fog");
    expect(weatherConditionKey(55)).toBe("drizzle");
    expect(weatherConditionKey(63)).toBe("rain");
    expect(weatherConditionKey(67)).toBe("freezing_rain");
    expect(weatherConditionKey(73)).toBe("snow");
    expect(weatherConditionKey(81)).toBe("showers");
    expect(weatherConditionKey(95)).toBe("thunderstorm");
  });

  it("falls back to unknown for null/undefined/unrecognized codes", () => {
    expect(weatherConditionKey(null)).toBe("unknown");
    expect(weatherConditionKey(undefined)).toBe("unknown");
    expect(weatherConditionKey(999)).toBe("unknown");
  });
});
