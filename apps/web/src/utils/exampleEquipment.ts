import type { Product } from "@kvarn/db";

// Curated picks for "quick add" suggestions — products with a real hand-drawn
// "Kvarn Sketch" illustration rather than the AI-generated or placeholder
// art, so a first-time picker actually shows off the nicest artwork available.
const EXAMPLE_PRODUCT_IDS: Record<"grinder" | "machine", string[]> = {
  grinder: ["grinder-kingrinder-k6", "grinder-eureka-mci-mg50e-mignon-istantaneo"],
  machine: ["machine-quick-mill-orione-3000", "machine-cafelat-robot"],
};

export function exampleEquipment(products: Product[], kind: "grinder" | "machine"): Product[] {
  return EXAMPLE_PRODUCT_IDS[kind]
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is Product => p !== undefined);
}
