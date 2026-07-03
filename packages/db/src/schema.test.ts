import { describe, expect, it } from "vitest";
import { bean, brew, equipment, product, recipe, setup, weatherSnapshot } from "./schema";

describe("schema", () => {
  it("exports all core tables", () => {
    expect(product).toBeDefined();
    expect(equipment).toBeDefined();
    expect(setup).toBeDefined();
    expect(bean).toBeDefined();
    expect(weatherSnapshot).toBeDefined();
    expect(brew).toBeDefined();
    expect(recipe).toBeDefined();
  });
});
