# KVARN — Recherche: Produkt-APIs mit Bildern (Stand Juli 2026)

Frage: Wie können wir Produkte (Mühlen, Maschinen) mit Bildern als durchsuchbare Auswahl anbieten — Amazon, Google Shopping o. Ä.?

## Bewertungsmatrix

| Option | Zugang | Kosten | Bilder erlaubt | Eignung |
|---|---|---|---|---|
| Amazon Creators API (Nachfolger der PA-API 5.0, seit 05/2026) | Affiliate-Programm + **10 qualifizierte Sales / 30 Tage**, sonst Pause | 0 € | ja, mit Auflagen (nur aus API, Affiliate-Kontext, Cache max 24 h) | 2/5 |
| Google Shopping | **keine öffentliche Such-API** (Merchant API nur für Händler) | — | — | — |
| SERP-Scraper (SerpApi, Serper, Oxylabs) | Self-Service | ab ~25 $/Monat | rechtlich ungeklärt; **Google klagt seit 12/2025 gegen SerpApi** | 1–2/5 |
| eBay Browse API | Bewerbung übers eBay Partner Network (Sandbox frei) | 0 € | ja, aber nur im eBay-Kaufkontext | 3/5 |
| idealo / Geizhals | keine öffentliche API, nur individuelle Partner-Deals | individuell | vertragsabhängig | 2/5 |
| Icecat Open | freie Registrierung | 0 € (Open), Full kostenpflichtig | ja (Open Content License); gut für Mainstream (DeLonghi, Philips), Specialty-Marken kaum | 3/5 |
| Barcode-APIs (UPCitemdb, Go-UPC, Barcode Lookup) | Self-Service | free-Tier bis ~99 $/Monat | Bilder aggregiert, **Rechtekette ungeklärt** | 2–3/5 |
| Open Products Facts | frei, ohne Key | 0 € | ja (CC-BY-SA) | 2/5 (Abdeckung minimal, aber gutes Beitrags-Ziel) |

## Benchmark: Wie machen es andere?

**Beanconqueror** (Open Source, größte Tracking-App der Szene) hat **keine zentrale Produkt-DB** — Nutzer legen Equipment als Freitext an und fotografieren selbst. Eine öffentliche Community-Datenbank für Kaffee-Equipment mit Bildern **existiert nicht**. Heißt: Unsere kuratierte Seed-DB (siehe `05_PRODUKT_DB_SEED.xlsx`, 194 Mühlen + 191 Maschinen) ist nicht nur Workaround, sondern potenzieller USP.

## Rechtliches (DE, Kurzfassung)

Produktfotos sind geschützt (§ 72 UrhG gilt auch für simple Produktfotos). Hersteller-Pressebereiche erlauben i. d. R. nur redaktionelle Nutzung — eine App-DB fällt **nicht** darunter. Sicher sind: eigene Fotos/Illustrationen, CC-Bilder mit Attribution, Icecat Open Content, explizite Hersteller-Freigaben (bei Specialty-Brands oft per Mail zu bekommen).

## Empfehlung

**MVP:** Eigene kuratierte Liste (Namen/Specs sind nicht schutzfähig) + **„Kvarn Sketch"-Illustrationen statt Fotos** (siehe `07_ILLUSTRATION_STYLE.md`) + User-Fotos privat am eigenen Equipment. Kosten 0 €, kein Rechtsrisiko, starke Markenidentität als Bonus.

**Skalierung:**
1. eBay-Partner-Network-Bewerbung → Browse API (Bilder + Affiliate-Umsatz).
2. Amazon Creators API, sobald 10 Sales/30 Tage über „Bei X kaufen"-Links realistisch sind.
3. Icecat Open für Mainstream-Geräte einbinden.
4. Community-Upload mit CC-Lizenz-Einräumung → langfristig entsteht die Equipment-DB, die dem Markt fehlt.
5. SERP-Scraper meiden (laufende Google-Klage).

## Quellen

- https://webservices.amazon.com/paapi5/documentation/register-for-pa-api.html
- https://velantio.com/blog/amazon-creators-api-replacing-pa-api-5
- https://www.keywordrush.com/blog/amazon-creator-api-what-changed-and-how-to-switch/
- https://serpapi.com/pricing · https://scrapfly.io/blog/posts/google-serp-api-and-alternatives
- https://developer.ebay.com/api-docs/buy/static/buy-requirements.html
- https://developer.ebay.com/api-docs/buy/browse/overview.html
- https://partner.idealo.com/de/verkaufen-mit-idealo/technische-anbindung
- https://www.affiliate-toolkit.com/kb/set-up-geizhals-interface/
- https://icecat.com/pricing-content-users/ · https://iceclog.com/content-license-icecat/
- https://devs.upcitemdb.com/ · https://go-upc.com/plans/api · https://www.barcodelookup.com/api
- https://world.openproductsfacts.org/data
- https://github.com/graphefruit/Beanconqueror
- https://easyrechtssicher.de/produktfotos-urheberrecht-markenrecht-designschutz/
- https://www.it-recht-kanzlei.de/verwendung-produktbilder-abfotografiert.html
