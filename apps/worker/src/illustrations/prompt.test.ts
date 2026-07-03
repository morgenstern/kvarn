import { describe, expect, it } from "vitest";
import { buildIllustrationPrompt } from "./prompt";

describe("buildIllustrationPrompt", () => {
  it("substitutes all placeholders", () => {
    const prompt = buildIllustrationPrompt({
      productName: "Niche Zero",
      productType: "single-dosing conical burr coffee grinder",
      keyFeatures: "tall cylindrical body, domed wooden-look lid",
    });

    expect(prompt).toContain("Vintage hand-drawn illustration of Niche Zero, a single-dosing conical burr coffee grinder");
    expect(prompt).toContain("tall cylindrical body, domed wooden-look lid");
    expect(prompt).toContain("Use the attached photo only as a shape reference");
    expect(prompt).not.toContain("{product_name}");
    expect(prompt).not.toContain("{product_type}");
    expect(prompt).not.toContain("{key_features}");
    expect(prompt).not.toContain("{reference_note}");
  });
});
