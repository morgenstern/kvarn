import { describe, expect, it } from "vitest";
import { bean, brew, equipment, product, recipe, weatherSnapshot } from "./schema";

describe("schema", () => {
  it("exports all core tables", () => {
    expect(product).toBeDefined();
    expect(equipment).toBeDefined();
    expect(bean).toBeDefined();
    expect(weatherSnapshot).toBeDefined();
    expect(brew).toBeDefined();
    expect(recipe).toBeDefined();
  });
});
