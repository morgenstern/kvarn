# KVARN Sketch — Illustrationsstil & Bild-Agent (v2)

> v2, abgeleitet aus dem Moodboard (07/2026): Ink-Sketch + Aquarell statt des ursprünglichen flachen Riso-Looks.

Alle Produkte (Mühlen, Maschinen, Zubehör, Bohnen/Brands) werden in der App **nicht als Foto**, sondern als handgezeichnet wirkende Illustration gezeigt. Fotos aus Nutzer-Uploads oder externen Quellen dienen nur als **Formvorlage** und werden durch eine generierte „Kvarn Sketch"-Version ersetzt. Das löst Bildrechte (siehe `06_API_RECHERCHE.md`), visuelle Konsistenz und Markenidentität in einem.

## 1. Stil-DNA (aus dem Moodboard abgeleitet)

**Übernommen:**

| Element | Regel |
|---|---|
| Linie | Lockere, handgezeichnete Tusche-Outline in Espresso `#3B2E28` — selbstbewusst aber unperfekt: variable Strichstärke, kleine Lücken, Überstände an Ecken. Wie eine schnelle Skizze aus dem Sketchbook, nicht wie Vektor-Clipart. |
| Fläche | Transparente **Aquarell-Washes**, die leicht über die Linien bluten. Dominanter Wash: Caramel/Kupfer (`#C0754D` + Tinten bis `#8a5a3b`). Sekundär: Leinen `#E7E0D5`, sparsam Salbei `#96A694`, verdünntes Espresso für Schattierung. **Max. ~60 % des Objekts bemalt** — viel Papier bleibt frei, das Bild wirkt luftig. |
| Hintergrund | Warmes Papier `#F7F4EF` mit sehr dezentem Aquarell-/Kaffeefleck-Wash in blassem Caramel hinter oder unter dem Objekt. Kein reines Weiß, keine Szenerie. |
| Akzente | Wenige Aquarell-Splatter und Sprenkel in Caramel um das Objekt — bewusst gesetzt, nicht chaotisch. Unter der Basis ein angedeuteter Schatten-Wash statt echtem Schatten. |
| Stimmung | Warm, nostalgisch, charmant, leicht verspielt — Vintage-Café-Poster trifft Skizzenbuchseite. |
| Komposition | 3/4-Frontansicht (Beutel: frontal), Objekt zentriert, ~70 % des quadratischen Canvas, isoliert. |

**Bewusst nicht übernommen** (im Moodboard vorhanden, aber off-brand): Blumen-/Kitsch-Deko, Text auf Verpackungen, bunte Patchwork-Farbigkeit, Graffiti-/Collage-Elemente, komplett schwarze Tuschefüllungen, kühle gesättigte Farben.

**Unverändert Tabu:** Kein Text, keine Logos/Markenzeichen (Markenrecht — Erkennbarkeit über Form, nie übers Logo), keine Menschen, kein Foto-/3D-Look.

Formate: 1024×1024 Quelle → App-Renderings 512/256/96 px, WebP. Hintergrund immer Papierton (nicht transparent — der Papier-Look ist Teil des Stils).

## 2. Master-Prompt für den Bild-Agenten (EN)

```text
Vintage hand-drawn illustration of {product_name}, a {product_type},
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
saturated colors outside the palette; busy backgrounds.
```

Platzhalter:
- `{product_name}` — z. B. "Niche Zero"
- `{product_type}` — z. B. "single-dosing conical burr coffee grinder"
- `{key_features}` — 3–5 Formmerkmale, z. B. "tall cylindrical body, domed wooden-look lid, front grind-size dial, small spout with cup"
- `{reference_note}` — bei User-Foto: "Use the attached photo only as a shape reference for proportions and signature details; do not reproduce its colors, materials, background or any visible branding."

## 3. Pipeline im Produkt

1. **Quelle:** Seed-DB-Eintrag (Name/Specs → `{key_features}` redaktionell oder LLM-generiert) oder User-Foto (Vision-Modell extrahiert Typ + Formmerkmale, nie das Logo).
2. **Generierung:** Ein Bild pro Produkt, global gecacht (`product.image_url`) — nicht pro Nutzer. Fester Style-Anchor: 3–5 kuratierte Referenz-Illustrationen als Style-Reference bei jedem Call mitgeben, damit der Stil über Jahre stabil bleibt. Die Referenz-Serie wird einmalig von Hand ausgewählt (beste Ergebnisse aus einer Kalibrier-Session mit ~20 Generierungen).
3. **QA-Gate:** Automatischer Check (Warmton-Palette, Text-/Logo-Detektor) + Moderations-Queue wie bei Community-Produkten. Erst nach Freigabe global sichtbar.
4. **User-Fotos:** bleiben privat am Equipment-Eintrag erhalten („Original anzeigen"), öffentlich sichtbar ist nur die Illustration.
5. **Fallback:** Solange keine Generierung vorliegt → generisches Kategorie-Icon (Mühle/Maschine/Brewer/Zubehör) im selben Stil, als statisches Asset im Design-System.

## 4. Konsistenz-Checkliste (QA, pro Bild)

- [ ] Papiergrund warm, dezenter Fleck-Wash vorhanden
- [ ] Ink-Linie handgezeichnet (keine cleane Vektor-Anmutung), eine Espresso-Tinte
- [ ] Washes transparent, bluten leicht, ≤ ~60 % Deckung des Objekts
- [ ] Caramel dominiert, Salbei max. 1 Akzent, keine kühlen/gesättigten Farben
- [ ] Splatter sparsam (≤ ~6 sichtbare Spritzer)
- [ ] Kein Text/Logo erkennbar, keine Deko-Requisiten
- [ ] Produkt in 3/4-Ansicht, zentriert, ~70 % Füllung
- [ ] Auf 96 px noch erkennbar (Thumbnail-Test)

## 5. Abgrenzung zur UI

Die App-Oberfläche selbst bleibt clean und nordisch (Flat, viel Weißraum, Fraunces/Inter) — **nur Produkt- und Bohnen-Visuals** nutzen Kvarn Sketch. Der Kontrast zwischen präziser UI und handgemachter Illustration ist gewollt und erzeugt die Wärme im Produkt.
