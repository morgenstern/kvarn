# KVARN — Technisches Konzept

> **Rev. 07/2026:** Umgestellt auf **Cloudflare** (Free Tier) + **GitHub** für Hosting & Deployment. Reihenfolge: **Web zuerst, iOS danach, Android später.** Ersetzt die frühere Expo/Supabase-Variante.

## 1. Plattform-Strategie

**Web-first: React + Vite als PWA, später mit Capacitor nativ verpackt** — eine Codebasis für Web, iOS und Android.

| Kriterium | Begründung |
|---|---|
| Web zuerst | Vollwertige Web-App ab Tag 1, keine Kompromisse durch react-native-web; `kvarn-prototype.html` ist direkt übertragbar |
| iOS/Android später | Capacitor verpackt dieselbe Web-App nativ; Plugins für Geolocation, SQLite, BLE (`@capacitor-community/bluetooth-le`) vorhanden |
| BLE (Waagen) | Web: Web Bluetooth (Chrome/Edge); nativ: Capacitor-BLE-Plugin — `ScaleDriver`-Abstraktion deckt beides |
| Updates | Web deployt sofort (kein Store-Review); native Shells ändern sich selten |
| Alternative | Expo/RN verworfen: Web-Output zweitklassig, widerspricht Web-first-Priorität |

**Stack:** TypeScript · React + Vite · TanStack Router + Query · Zustand · Tailwind (Design-Tokens aus 01_BRAND_DESIGN.md) · Timer-Ring mit CSS/`requestAnimationFrame` (statt Reanimated) · PWA (Service Worker, installierbar, offline).

## 2. Backend & Sync (Cloudflare)

**Ein Cloudflare Worker** serviert Frontend (Static Assets) und API (Hono) aus einem Deployment — seit 2026 Cloudflares empfohlener Weg für neue Projekte (statt Pages).

| Baustein | Cloudflare-Dienst | Free-Tier-Limit (Stand 07/2026, vor Start prüfen) |
|---|---|---|
| API + Hosting | Workers + Static Assets | 100k Requests/Tag, 10 ms CPU/Aufruf |
| Datenbank | **D1** (SQLite) | 5 GB, 5M Reads/Tag, 100k Writes/Tag |
| Auth | **better-auth** auf Worker + D1 | Open Source, ab v1.5 native D1-Unterstützung |
| Dateien | **R2** (Fotos) | 10 GB, 1M Class-A-/10M Class-B-Ops/Monat, kein Egress |
| Cache | **KV** (Wetter-Snapshots) | 100k Reads/Tag, **1k Writes/Tag** (reicht: 1 Write/30 min/Geo-Zelle) |
| Jobs | Cron Triggers (Kompass P2, Moderation) | im Free Plan enthalten |
| Realtime (später) | Durable Objects (SQLite-Backend) | 100k Requests/Tag; für MVP nicht nötig |

Nicht nutzen: Cloudflare Queues und Cloudflare Images (kein Free Tier). Bilder = SVG-Illustrationen als Static Assets + User-Fotos in R2 (WebP, max 1600 px, clientseitig verkleinert).

- **Offline-first ist Pflicht** — Küche hat nicht immer Netz. Großer Vorteil des Stacks: **SQLite überall** — lokal (sqlite-wasm/OPFS im Web, `@capacitor-community/sqlite` nativ) und in D1, **ein Drizzle-Schema für beide**. Lokale DB als Source of Truth, Sync-Queue gegen Worker-Endpoint (Last-Write-Wins pro Feld; Bezüge append-only → konfliktarm). Kein Realtime nötig: Pull bei App-Start/Fokus, Push aus der Queue.
- **Auth:** better-auth mit Apple/Google-Sign-in + E-Mail sowie **Anonymous-Plugin** (lokal only, späteres Upgrade auf Account mit Merge — wie im Konzept vorgesehen).
- **Free-Tier-Budget:** Engpass sind D1-Writes (100k/Tag) und Worker-Requests (100k/Tag). Ein aktiver Nutzer erzeugt < 100 Requests/Tag → reicht für tausende Nutzer; Sync gebatcht (1 Request = n Bezüge). Bei Wachstum: Workers Paid ($5/Monat) hebt alle Limits deutlich.

## 3. Wetter & Geolocation

- **Open-Meteo API**: kostenlos, ohne Key, liefert Temperatur, **relative Luftfeuchte**, Luftdruck stundengenau. (Zum Implementierungszeitpunkt Konditionen prüfen.)
- Ablauf: Bei „Bezug starten" → Browser-/Capacitor-Geolocation (grobe Genauigkeit reicht) → Wetter-Fetch über Worker-Proxy → Snapshot am Bezug gespeichert. Kein Standort-Tracking, nur Momentaufnahme; Koordinaten werden **nicht** persistiert (nur gerundet auf ~10 km für Cache-Key). DSGVO: Opt-in mit Klartext-Erklärung, Fallback = manuelle Stadt oder ohne Wetter.
- Cache: 1 Snapshot / 30 min / Standort-Zelle in **KV** → minimale API-Last und KV-Write-Budget geschont; offline gilt der letzte lokale Wert.
- Erweiterung: Raumklima via Bluetooth-Sensor (z. B. Aranet/SwitchBot) — Innenraumwerte sind dem Außenwetter überlegen; API dafür von Tag 1 im Datenmodell (`source: 'open-meteo' | 'sensor' | 'manual'`).

## 4. Produktdatenbank (Equipment mit Bildern) — Machbarkeit

Direkte Antwort: **Es gibt keine öffentliche, vollständige API für Kaffee-Equipment.** Machbar ist es trotzdem — dreistufig:

1. **Kuratierte Seed-DB (MVP):** ~150–250 relevante Produkte (Mühlen, Maschinen, Brewer, Zubehör) redaktionell erfasst: Name, Hersteller, Typ, Mahlwerk-Daten, Mahlgrad-Skala (wichtig für den Kompass!), Bild. **Bildrechte:** durchgängig eigene Illustrationen im Kvarn-Look (skalierbar, rechtssicher, markenprägend).
2. **Community-Einreichungen:** Nutzer legen fehlende Geräte an (Formular + eigenes Foto → R2) → Moderations-Queue → nach Freigabe global verfügbar. User-Fotos mit Rechte-Einräumung in den AGB.
3. **Kommerzielle Quellen (später):** Amazon PA-API / idealo / Affiliate-Feeds liefern Produktbilder legal im Rahmen des Partnerprogramms + Monetarisierung („Bei Röster X kaufen"). Barcode-Scan für Bohnen: Open Food Facts als Teilquelle, sonst OCR vom Etikett (On-Device: VisionKit/ML Kit via Capacitor, Web: Tesseract.js oder später Workers AI).

**Update 07/2026:** Detail-Recherche zu allen API-Optionen in `06_API_RECHERCHE.md`; Seed-DB mit 194 Mühlen + 191 Maschinen liegt als `05_PRODUKT_DB_SEED.xlsx` vor. Bilder-Strategie: generierte Illustrationen im „Kvarn Sketch"-Stil (`07_ILLUSTRATION_STYLE.md`) — als SVG-Static-Assets deployt, kostenlos und schnell.

Der eigentliche Wert der DB sind nicht die Bilder, sondern die **Mahlgrad-Skalen-Normalisierung** (Niche 0–50, Eureka stufenlos, Comandante Klicks …) — sie macht Community-Vergleiche erst möglich. Das kann niemand zukaufen; das ist der Moat.

## 5. Datenmodell (Kern, SQLite/D1)

Ehemals PostgreSQL — jetzt **SQLite-Dialekt** (identisch lokal und in D1). Mapping: `ENUM` → `TEXT` + `CHECK`, `JSONB` → `TEXT` (JSON), `UUID[]` → JSON-Array, `NUMERIC` → `REAL`, generierte Spalten unterstützt SQLite nativ. Source of Truth ist das **Drizzle-Schema** in `packages/db`; unten weiterhin die konzeptionelle Sicht:

```sql
-- Produkte (global, kuratiert + community)
product(id, kind ENUM(grinder,machine,brewer,accessory), brand, model,
        image_url, grind_scale JSONB,          -- {min,max,step,unit,label}
        specs JSONB, status ENUM(seed,community,verified))

-- Nutzer-Equipment & Setups
equipment(id, user_id, product_id NULL, custom_name NULL, notes, burr_kg NUMERIC)
setup(id, user_id, name, method ENUM(espresso,v60,aeropress,frenchpress,moka,auto),
      grinder_equipment_id, machine_equipment_id NULL, accessories UUID[])

-- Bohnen
bean(id, user_id, roaster, name, origin, variety,
     process ENUM(washed,natural,honey,anaerobic,other),
     roast_level SMALLINT, roast_date DATE, opened_at DATE NULL,
     photo_url, barcode NULL, archived BOOL)

-- Wetter-Snapshot (immutable)
weather_snapshot(id, taken_at, temp_c, humidity_pct, pressure_hpa,
                 source ENUM(open_meteo,sensor,manual), geo_cell TEXT)

-- Der Bezug: Herzstück, append-only
brew(id, user_id, setup_id, bean_id, weather_id NULL, brewed_at,
  -- Eingang
  grind_setting NUMERIC, dose_g NUMERIC, target_yield_g NUMERIC,
  water_temp_c NUMERIC, preinfusion_s NUMERIC NULL, puck_prep JSONB,
  bean_age_days INT GENERATED,               -- brewed_at - roast_date
  -- Prozess
  time_total_s NUMERIC, time_first_drop_s NUMERIC NULL,
  pressure_avg_bar NUMERIC NULL, pressure_peak_bar NUMERIC NULL,
  actual_yield_g NUMERIC NULL, flow_gs NUMERIC GENERATED,
  -- Ergebnis
  rating_total NUMERIC,                      -- 1..10, Pflicht
  balance SMALLINT NULL,                     -- -5 sauer .. +5 bitter
  sweetness SMALLINT NULL, body SMALLINT NULL, crema SMALLINT NULL,
  visual_tags TEXT[], flavor_tags TEXT[], tds_pct NUMERIC NULL,
  note TEXT, photo_url NULL,
  is_dial_in BOOL, recipe_id NULL)

-- Gelerntes Rezept je Kombination
recipe(id, user_id, setup_id, bean_id NULL, bean_profile JSONB NULL, -- generalisiert auf ähnliche Bohnen
       params JSONB, confidence NUMERIC, brew_count INT, avg_rating NUMERIC, updated_at)
```

Sync-Zusätze pro Tabelle: `updated_at`, `deleted_at NULL` (Soft-Delete), `client_id` für Idempotenz der Sync-Queue.

## 6. Kompass — Empfehlungs-Engine (3 Phasen)

**Phase 1 — Regelwerk (MVP, deterministisch & erklärbar):**
- Startwerte neue Bohne: Community-Median gleicher Mühle + Röstgrad, sonst Methoden-Default.
- Nach jedem Bezug: klassische Dial-in-Matrix — zu schnell/sauer → feiner; zu langsam/bitter → gröber; Balance-Slider gewichtet die Richtung. Schrittweite aus `grind_scale` des Geräts.
- Drift-Korrekturen: Δ Luftfeuchte > 15 % → Mahlgrad-Offset (per Nutzer kalibriert, sobald Daten da sind); Bohnenalter-Kurve (Standard-Prior: Tag 4–8 schnell entgasend → täglich minimal feiner).
- Jede Empfehlung trägt ihr „Warum" als strukturierte Begründung (`reasons: [{factor, delta, effect}]`).
- Läuft komplett **on-device** (`packages/core`, pure TS) — offline-fähig, kein Server nötig.

**Phase 2 — Personalisierte Regression (ab ~30 Bezügen/Kombination):**
- Pro Nutzer×Setup×Bohnenprofil: Ridge-Regression `time_total ~ grind + dose + humidity + bean_age + temp` und `rating ~ …` → invertieren für Zielzeit/Zielrating. Läuft als **Cron-Trigger-Worker** (pure TS, winzige Datenmengen — 10-ms-CPU-Limit unkritisch), Koeffizienten in D1 → aufs Gerät gesynct (offline-fähig).

**Phase 3 — Community-Priors (Bayesian):**
- Hierarchisches Modell: globale Priors je Mühlen-Modell × Röstgrad, individuell nachgeschärft. Opt-in-Datenspende, anonymisiert. Kaltstart-Problem für neue Nutzer praktisch gelöst.

Konfidenz = f(Anzahl Bezüge, Varianz, Datenvollständigkeit) — ehrlich anzeigen („Konfidenz 87 %").

## 7. Bluetooth-Waagen (Phase 2)

BLE-Integration für live Flow-Rate & Auto-Stopp: Acaia (Lunar/Pearl), Bookoo Themis, Timemore Black Mirror. Protokolle sind community-dokumentiert (jeweils zum Implementierungszeitpunkt verifizieren). Abstraktion: `ScaleDriver`-Interface, Geräte als Plugins — Transport austauschbar: **Web Bluetooth** (Chrome/Edge; Safari unterstützt es nicht → Hinweis in-App) bzw. **`@capacitor-community/bluetooth-le`** auf iOS/Android.

## 8. GitHub — Code, CI & Deployment

- **Repo:** GitHub (privat, Free Plan), Monorepo (siehe 04_DEV_PLAN.md). Branch-Schutz auf `main`, PR-Flow auch solo (Review-Disziplin + CI-Gate).
- **CI (GitHub Actions,** 2.000 Min/Monat für private Repos**):** Lint, Typecheck, Vitest (inkl. Kompass-Golden-Tests), Build. Läuft auf jedem PR.
- **Deployment:** **Workers Builds** (Cloudflares Git-Integration, kostenlos) verbindet das GitHub-Repo direkt: Push auf `main` → Build → Deploy; PRs bekommen **Preview-URLs**. Alternative bei Bedarf: `wrangler-action` aus GitHub Actions.
- **Umgebungen:** `kvarn` (Prod, `main`) + Preview-Deployments je PR; D1 lokal via Miniflare/`wrangler dev` — komplette Offline-Entwicklung möglich.
- **Secrets:** Wrangler-Secrets (Cloudflare) + GitHub-Actions-Secrets; nie im Repo.
- **iOS später (M5):** Capacitor-iOS-Shell im selben Repo; Build lokal in Xcode. Apple Developer Program **99 $/Jahr** (einziger echter Fixkostenpunkt, erst bei TestFlight fällig). Android danach: Play Console 25 $ einmalig.

## 9. Nichtfunktionales

- **DSGVO:** Cloudflare-DPA abschließen (Standardvertragsklauseln inklusive). D1 & R2 mit **Location Hint Westeuropa** anlegen (Daten liegen in der EU; strikte EU-only-Verarbeitung à la Regional Services ist Enterprise-Feature — ehrlich in der Datenschutzerklärung ausweisen). Datenexport (JSON/CSV) & Löschung in-App, Geodaten nie persistiert, Community-Sharing strikt opt-in, keine Tracking-SDKs.
- **Performance-Budget:** App-Start → „Bezug starten" < 2 s (Vite-Code-Splitting, Service-Worker-Precache); Timer via `requestAnimationFrame` + Web Worker als Tick-Quelle (weiterlaufend bei Tab-Wechsel), Anzeige stets aus `performance.now()`-Differenz — nie aus Tick-Zählung.
- **Telemetrie:** **Workers Analytics Engine** (im Free Plan) statt selbst gehostetem PostHog — keine Serverkosten, keine Cookies, aggregiert, opt-in.
- **Testbarkeit:** Kompass-Regelwerk als pure functions mit Golden-Tests („bei X kam Y raus und bleibt so"); Worker-API mit Vitest + Miniflare integrationsgetestet.
- **Kostenübersicht:** Cloudflare 0 €, GitHub 0 €, Domain optional (~10 €/Jahr, sonst `*.workers.dev`), Apple 99 $/Jahr ab M5, Google Play 25 $ einmalig ab M6.
