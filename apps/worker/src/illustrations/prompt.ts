/**
 * Master image-generation prompt, verbatim from docs/07_ILLUSTRATION_STYLE.md §2,
 * with its {product_name}/{product_type}/{key_features}/{reference_note}
 * placeholders substituted per call.
 */
const MASTER_PROMPT_TEMPLATE = `Vintage hand-drawn illustration of {product_name}, a {product_type},
in the "Kvarn Sketch" style: loose ink linework with soft watercolor washes.
{reference_note}

STYLE — follow exactly:
Hand-drawn ink outline in deep espresso brown (#3B2E28) — confident but
imperfect: variable line weight, small gaps, slight overshoots at corners,
like a quick artist's sketchbook drawing. Never clean vector lines.

Fills are translucent watercolor washes that bleed slightly past the ink
lines: warm caramel/copper (#C0754D and its tints toward #8a5a3b) as the
dominant wash, warm linen beige (#E7E0D5) for light panels, muted sage
green (#96A694) as one sparse secondary accent, diluted espresso brown
for shading. Leave generous unpainted paper areas — paint at most ~60%
of the object so it feels airy and sketch-like.

Background: warm off-white paper (#F7F4EF) with a very subtle pale-caramel
watercolor stain or coffee-ring wash behind the object. A few deliberate
watercolor splatter dots and specks in caramel around the object — sparse,
not chaotic. A soft diluted wash hints at a shadow under the base.

MOOD: warm, nostalgic, charming, slightly whimsical — vintage café poster
meets sketchbook page. The product must remain clearly recognizable
through its signature features: {key_features}.

COMPOSITION: three-quarter front view (coffee bags: frontal), object
centered, filling ~70% of a square canvas, fully isolated — no scenery,
no tabletop, no props.

STRICTLY FORBIDDEN: any text, letters, numbers, logos, brand marks,
watermarks; humans or hands; flowers or kitsch decoration; photorealism;
3D rendering; clean flat vector style; heavy solid black fills; cool or
saturated colors outside the palette; busy backgrounds.`;

const REFERENCE_NOTE =
  "Use the attached photo only as a shape reference for proportions and signature details; do not reproduce its colors, materials, background or any visible branding.";

export function buildIllustrationPrompt(params: { productName: string; productType: string; keyFeatures: string }): string {
  return MASTER_PROMPT_TEMPLATE.replace("{product_name}", params.productName)
    .replace("{product_type}", params.productType)
    .replace("{reference_note}", REFERENCE_NOTE)
    .replace("{key_features}", params.keyFeatures);
}
