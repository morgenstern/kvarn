# KVARN — Brand & Designsprache

> Kaffee-Companion für Web, iOS & Android. Ziel: die perfekten Einstellungen für jede Kombination aus Equipment, Bohne und Umgebung.

## 1. Naming

**KVARN** — schwedisch für „Mühle". Die Mühle ist das Herz jedes Dial-ins; der Name ist kurz, markenfähig, international aussprechbar und trägt die nordische DNA im Wort selbst.

- Tagline: **„Dial it in."**
- Domain-Kandidaten: kvarn.app, kvarn.coffee, getkvarn.com
- Aussprache: [kvaːn] — im Onboarding einmal augenzwinkernd erklärt.

## 2. Markenkern

| | |
|---|---|
| Vision | Jeder Bezug ein guter Bezug — ohne Ratespiel. |
| Positionierung | Das präzise, ruhige Werkzeug zwischen Nerd-Spreadsheet und Lifestyle-App. |
| Persönlichkeit | Ruhig, präzise, warm. Wie ein guter Röster: kundig, gelassen, auf Augenhöhe. |
| Anti-Werte | Kein Gatekeeping, kein Jargon-Overload, keine Gamification-Konfetti, keine Ausrufezeichen. |

## 3. Wording-System (DE/EN-Mix)

Bewusster DE/EN-Mix — passt zur Third-Wave-Szene, die ohnehin von „Flat White" bis „Single Origin" englisch spricht. Regel: **Deutsch für Wärme und Sätze, Englisch für Szene-Fachbegriffe und knackige CTAs.** Kein Zwangs-Denglisch in ganzen Sätzen.

| Begriff | Bedeutung | Anmerkung |
|---|---|---|
| **Brew / Shot** | Ein getrackter Brühvorgang | „Brew" generisch, „Shot" bei Espresso; „Bezug" ok in längeren Sätzen |
| **Regal** | Bohnenverwaltung | bewusst deutsch — wärmer als „Inventory" |
| **Setup / Gear** | Equipment-Kombination (Mühle + Maschine + Methode) | EN |
| **Rezept** | Ziel-Parameter-Satz für eine Kombination | DE |
| **Kompass** | Empfehlungs-Engine („Kvarn-Kompass") | DE, markenprägend |
| **Logbuch** | Historie aller Brews | DE |
| **Dial-in, Yield, Ratio, Flow, Puck-Prep, Sweet Spot** | Szene-Fachbegriffe | bleiben EN |
| **Starter / Advanced** | UI-Modi (siehe UX-Konzept 2b) | EN |

Beispiel-Microcopy (der Mix in Aktion):

- Empty State Regal: „Noch keine Beans im Regal. Zeit für einen Röster-Besuch."
- Nach gutem Shot: „Notiert. Dein Kompass wird schärfer."
- Wetter-Hinweis: „72 % Luftfeuchte heute — dein letzter Shot bei diesem Wetter lief 3 s schneller. Mahlgrad ggf. 0,2 feiner."
- CTA: „Brew starten" · „Dial it in" · „Nice, saved."
- Fehlertoleranz: nie „falsch", sondern „daneben gelaufen — passiert. Was war anders?"

Sprachen: DE + EN zum Start (i18n von Tag 1).

## 4. Farbwelt — Nordic Chic

| Token | Hex | Rolle |
|---|---|---|
| `birch` | `#F7F4EF` | App-Hintergrund (Light) |
| `linen` | `#E7E0D5` | Karten-Flächen, Divider |
| `copper` | `#C0754D` | Primär-Akzent: CTAs, aktive Zustände, Highlights |
| `sage` | `#96A694` | Sekundär: Erfolg, positive Trends |
| `espresso` | `#3B2E28` | Dunkle Flächen, Dark-Mode-Karten |
| `charcoal` | `#22201C` | Text, Dark-Mode-Hintergrund |
| `clay` | `#B85C48` | Warnung/negativ (gedeckt, kein Alarmrot) |

Regeln: max. 1 Kupfer-Akzent pro Screen-Abschnitt. Viel Weißraum. Dark Mode ist Erstklasse-Bürger (Espresso/Charcoal-Basis, Kupfer bleibt Akzent).

## 5. Typografie

- **Fraunces** (Variable, Serif) — Display: Screen-Titel, große Messwerte (Brühzeit, Ratio), Bohnennamen. Optische Größe nutzen (opsz).
- **Inter** — UI: Labels, Buttons, Tabellen, Fließtext. Tabular figures (`tnum`) für alle Messwerte.
- Skala: 34/28/22 Display · 17 Body · 15 Secondary · 13 Caption · 11 Micro. Gewichte nur 400/500.

## 6. Form & Komponenten

- Radius: 16 px Karten, 12 px Controls, Pill für Chips/Tags.
- Borders: hairline (0.5–1 px), Farbe `linen`; Schatten fast keine (nur 1 Ebene für Sheets).
- Ikonografie: Outline, 1.5 px Stroke, geometrisch (Basis: Lucide/Tabler-Stil). Eigenes Icon-Set für Brühmethoden (Siebträger, V60, Aeropress, French Press, Mokka).
- Kern-Visual: der **Dial** — kreisförmiges Mahlgrad-/Parameter-Element, gleichzeitig Logo-Bildmarke (stilisiertes Mahlwerk: Kreis mit Kerbe).
- Datenvisualisierung: dünne Linien, Punkte statt Balken wo möglich, Kupfer für „dein Wert", Salbei für „Ziel-Korridor".
- Motion: dezent, 150–250 ms, ease-out. Ein einziger „Genuss-Moment": der Timer-Ring beim Bezug.

## 7. Logo

- Wortmarke: KVARN in Fraunces 500, Letterspacing +18 %.
- Bildmarke: Mahlwerk-Kreis — äußerer Ring mit einer Kerbe bei 12 Uhr (Einstell-Marke), innen 7 radiale Kerben (Mahlscheibe). Funktioniert als App-Icon auf Birke- oder Espresso-Grund.
