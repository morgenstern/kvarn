# KVARN — UX-Konzept & Parameter-Modell

## 1. Informationsarchitektur

5 Bereiche (Tab-Bar mobil, Sidebar web), „Brühen" als hervorgehobene Center-Action:

1. **Heute** — Wetter-Kontext, Kompass-Vorschlag für aktives Setup + aktive Bohne, Quick-Start.
2. **Regal** — Bohnenverwaltung: Röster, Sorte, Röstdatum, Frische-Indikator, Foto/Barcode.
3. **Brühen** — geführter Bezug: vorausgefüllte Parameter → Timer → Messwerte → Bewertung.
4. **Setup** — Equipment: Mühlen, Maschinen, Zubereitungsarten, Zubehör (aus Produktdatenbank mit Bildern).
5. **Kompass** — Logbuch + Insights: beste Einstellungen je Kombination, Trends, Wetter-Korrelationen.

## 2. Parameter-Modell (vollständig)

### Eingangsgrößen (vor dem Bezug)

| Gruppe | Parameter | Quelle |
|---|---|---|
| Bohne | Röster, Name, Herkunft, Varietät, Aufbereitung (washed/natural/honey), Röstgrad, **Röstdatum → Bohnenalter**, Paket offen seit | manuell / Barcode / Foto-OCR |
| Mühle | Modell, **Mahlgrad** (modell-eigene Skala), ggf. RPM | Setup + manuell |
| Dosis | **Menge in g** (In), Ziel-Ausbeute in g (Out), → **Brew-Ratio** | manuell / Bluetooth-Waage |
| Wasser | Temperatur, Härte/Profil (KH/GH, TDS des Wassers) | Maschine / Profil einmalig |
| Puck-Prep (Espresso) | Sieb (Größe/Typ, präzision), WDT ja/nein, Tamper/Druck, Verteiler, Papierfilter im Sieb | Setup + Toggle |
| Methode (Filter) | Filterpapier, Gießmuster/Agitation, Blooming-Zeit/-Menge | Toggle |
| **Umgebung (auto)** | **Temperatur, Luftfeuchte**, Luftdruck via Geolocation + Wetter-API; Raumklima optional via HomeKit/Sensor | automatisch |

### Prozess-Messwerte (während des Bezugs)

| Parameter | Erfassung |
|---|---|
| **Brühzeit** (gesamt) | In-App-Timer |
| Zeit bis erster Tropfen | Timer-Lap |
| Pre-Infusion (Dauer/Druck) | manuell / Maschine |
| **Ø Druck + Peak-Druck** | manuell (Manometer ablesen) / smarte Maschine |
| Durchflussrate (g/s) | berechnet aus Out/Zeit; live mit BT-Waage |
| Tatsächliche Ausbeute (g) | Waage |
| Wassertemperatur ist | Maschine/manuell |

### Ergebnis-Bewertung (nach dem Bezug)

| Dimension | Skala |
|---|---|
| Gesamt | 1–10 (Slider) |
| Balance | sauer ↔ ausgewogen ↔ bitter (bipolar) — wichtigster Dial-in-Input |
| Süße, Körper, Crema | je 1–5 |
| Visuell | Chips: Channeling, Spritzer, zu schnell, zu langsam, tot/tropfend |
| Extraktionsbild | optionales Foto (später CV-Analyse) |
| Notiz | Freitext + Aroma-Tags (Beere, Nuss, Schoko, floral …) |
| Optional (Pro) | TDS/Extraktionsausbeute per Refraktometer |

### Weitere ggf. relevante Parameter (Antwort auf die offene Frage)

- **Bohnenalter** — neben Wetter der stärkste Drift-Faktor (Entgasung; Woche 1–6 nach Röstung).
- **Zeit seit Paketöffnung** und Lagerung (Vakuum, Kühlschrank/Froster).
- **Maschinen-Aufwärmzeit** (kalter Siebträger = andere Extraktion).
- **Wasserprofil** (Härte beeinflusst Extraktion & Geschmack massiv) — einmalig je Standort.
- **Mühlen-Zustand**: Mahlgut-Alter der Scheiben (kg-Zähler), statische Aufladung/RDT-Tropfen.
- **Tageszeit** (Netzspannung/Maschinentemperatur, aber auch Geschmackswahrnehmung).
- **Single Dosing vs. Hopper** (Bohnendruck ändert Mahlverhalten).

## 2b. Starter- & Advanced-Modus

Umschaltbar in den Einstellungen (Default: Starter; Vorschlag im Onboarding anhand Selbsteinschätzung). Der Modus steuert nur die **Sichtbarkeit**, nie das Datenmodell — ein Wechsel verliert keine Daten, und einzelne Advanced-Felder lassen sich in Starter per „Mehr anzeigen" punktuell einblenden.

| | Starter | Advanced |
|---|---|---|
| Bezug-Parameter | Mahlgrad, Dosis, Ziel-Yield | + Wassertemperatur, Pre-Infusion (Dauer/Druck), Puck-Prep (WDT, RDT, Papierfilter, Sieb), Maschinen-Warmup, „frisch geöffnet" |
| Prozess | Zeit (Timer) | + erster Tropfen, Ø/Peak-Druck, Flow-Rate, Ist-Temperatur |
| Bewertung | Gesamt + Balance | + Süße, Körper, Crema, TDS/Extraktionsausbeute, Extraktionsfoto |
| Kontext | Wetter (auto) | + Wasserprofil, Bohnenlagerung, Mahlscheiben-Zähler |
| Kompass | Vorschlag + kurzes „Warum" | + volle Begründungskette, Konfidenz-Details, Parameter-Sensitivität |

Prinzip unverändert: alles außer Gesamt-Rating optional; fehlende Advanced-Daten senken nur die Konfidenz.

## 3. Kern-Flows

### Flow A — Onboarding (≤ 3 min)
1. Zubereitungsart(en) wählen (Siebträger, V60, Aeropress, French Press, Mokka, Vollautomat).
2. Equipment aus Produkt-DB suchen (mit Bildern, Autocomplete: „Niche…"), Fallback „Eigenes Gerät anlegen".
3. Erste Bohne ins Regal (Foto vom Etikett → OCR-Vorschlag, oder manuell).
4. Standort-Freigabe für Wetter (optional, erklärt warum).
5. Erster Bezug — App schlägt Community-Startwerte für die Kombination vor.

### Flow B — Bezug (der tägliche Weg, ≤ 30 s Interaktion)
1. Start von „Heute": Karte zeigt Setup + Bohne + Kompass-Vorschlag (Mahlgrad, Dosis, Ratio, Temp) inkl. Wetter-Delta-Hinweis.
2. Anpassen falls gewünscht (Stepper) → **großer Timer-Ring** startet; Lap-Button „erster Tropfen".
3. Stopp → Ausbeute eingeben (oder BT-Waage) → Druck ablesen.
4. Bewertung: 1 Pflicht-Slider (Gesamt) + bipolarer Balance-Slider; Rest optional aufklappbar.
5. Kompass-Feedback: „Nächstes Mal: Mahlgrad 0,3 feiner." Fertig.

Prinzip: **Progressive Disclosure** — Einsteiger tracken 4 Werte, Nerds 20. Alles außer Gesamt-Rating ist optional.

### Flow C — Dial-in-Assistent (neue Bohne)
Geführte Serie: App schlägt Startpunkt vor → nach jedem Bezug gezielte Ein-Parameter-Änderung (wissenschaftlich: nur 1 Variable) → konvergiert in typ. 3–5 Bezügen → speichert als **Rezept** für die Kombination.

### Flow D — Kompass/Insights
- „Dein bestes Rezept" je Kombination (Setup × Bohne), mit Konfidenz-Angabe.
- Wetter-Korrelation: Scatter Luftfeuchte × Brühzeit, verständlich übersetzt.
- Bohnenalter-Kurve: Rating über Wochen seit Röstung.
- Community-Vergleich (anonym, opt-in): Startwerte anderer Nutzer mit gleicher Mühle + Bohne.

## 4. Screen-Liste (MVP)

| # | Screen | Kern-Elemente |
|---|---|---|
| 1 | Onboarding (4 Steps) | Methoden-Grid, Produkt-Suche, Bohnen-Add, Location-Permission |
| 2 | Heute | Wetter-Leiste, Vorschlag-Karte, Start-CTA, letzte Bezüge |
| 3 | Brühen: Parameter | Vorbelegte Stepper (Mahlgrad, Dosis, Ratio, Temp) |
| 4 | Brühen: Timer | Ring-Timer, Lap, Live-Flow (mit Waage) |
| 5 | Brühen: Bewertung | Gesamt-Slider, Balance-Bipolar, optionale Details |
| 6 | Regal | Bohnen-Karten mit Frische-Balken, Add-Flow |
| 7 | Bohnen-Detail | Stammdaten, Rezepte, Rating-Verlauf |
| 8 | Setup | Equipment-Karten mit Produktbild, Add via Suche |
| 9 | Kompass | Beste Rezepte, Logbuch-Liste, Insight-Karten |
| 10 | Bezug-Detail | Alle Parameter eines Bezugs, Duplizieren-Action |

## 5. UX-Prinzipien

1. **30-Sekunden-Regel**: Der tägliche Bezug darf nie mehr als 30 s App-Interaktion kosten.
2. **Vorausfüllen statt abfragen**: Letzter Bezug der Kombination = Default. Wetter fließt automatisch ein.
3. **Eine Variable pro Schritt** beim Dial-in — die App erzwingt Methodik sanft.
4. **Keine Strafe fürs Weglassen**: Jeder Parameter außer Rating optional; Datenlücken degradieren nur die Vorschlags-Konfidenz.
5. **Erklärbarkeit**: Jeder Kompass-Vorschlag hat ein „Warum?" (z. B. „Bohne ist 5 Tage älter, Luftfeuchte +18 %").
