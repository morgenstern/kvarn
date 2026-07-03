# KVARN — Vorbereitung für die Programmierung

> **Rev. 07/2026:** Cloudflare + GitHub, Web zuerst → iOS → Android (siehe 03_TECH_KONZEPT.md).

## 1. Repo-Struktur (GitHub-Monorepo, pnpm + Turborepo)

```
kvarn/
├── apps/
│   ├── web/               # React + Vite PWA: routes/ heute, regal, bruehen, setup, kompass
│   │   ├── src/features/  # brew/, beans/, gear/, insights/, onboarding/
│   │   ├── ios/           # Capacitor-Shell (ab M5)
│   │   └── android/       # Capacitor-Shell (ab M6)
│   └── worker/            # Ein Cloudflare Worker: Hono-API + Static Assets (dist von web)
│       │                  #   + better-auth, Sync-Endpoint, Wetter-Proxy, Cron (Kompass P2)
│       └── wrangler.toml  # D1-, R2-, KV-Bindings
├── packages/
│   ├── core/              # Domänen-Logik: Kompass-Regelwerk, Einheiten, Ratio-Mathe
│   │                      #   → pure TS, 100 % testbar, läuft identisch in Browser & Worker
│   ├── db/                # EIN Drizzle-Schema (SQLite) für lokale DB UND D1, Migrationen, Sync
│   ├── ui/                # Design-System: Tokens aus 01_BRAND_DESIGN.md als Tailwind-Theme
│   └── api-client/        # Typisierte Clients (Hono RPC, Open-Meteo, ScaleDriver-Interface)
├── .github/workflows/     # CI: Lint, Typecheck, Vitest, Build (auf jedem PR)
└── docs/                  # diese Konzeptdateien
```

Prinzip: **`packages/core` enthält alles, was Kvarn besonders macht** (Kompass, Mahlgrad-Normalisierung) — framework-frei, damit Web/Native/Worker identisch rechnen. Admin/Moderation zunächst nicht als eigene App, sondern als geschützte Route in `apps/web` (spart einen Build + Free-Tier-Budget).

## 2. Milestones

| # | Milestone | Inhalt | Schätzung |
|---|---|---|---|
| M0 | Fundament | Monorepo, GitHub-Repo + Actions-CI, Workers-Builds-Deploy (Push → live), D1 + Drizzle, better-auth (E-Mail + anonym), lokale SQLite + Sync-Skelett, PWA-Shell mit Design-Tokens | 2 Wo |
| M1 | **Brüh-Loop (Web)** | Setup anlegen (Seed-DB ~50 Geräte), Bohne anlegen, Bezug mit Timer, Bewertung, Logbuch. *Ende M1: täglich selbst nutzbar (Dogfooding) — im Browser & als installierte PWA.* | 3 Wo |
| M2 | Wetter + Kompass P1 | Geolocation-Snapshot (Worker-Proxy + KV-Cache), Regelwerk mit „Warum", Dial-in-Assistent, Rezepte | 2–3 Wo |
| M3 | Regal & Insights | Frische-Kurve, Insight-Charts, Bohnen-Foto (R2)/OCR, Produkt-DB auf ~200 Geräte, Community-Einreichung + Moderations-Route | 2–3 Wo |
| M4 | **Web-Beta** | Onboarding-Polish, i18n (DE/EN), Datenexport/-löschung, Apple/Google-Sign-in, öffentliche URL (Domain oder workers.dev), Feedback-Loop | 2 Wo |
| M5 | **iOS** | Capacitor-Shell, native Plugins (Geolocation, SQLite, Kamera), App-Icon/Splash, Apple-Account (99 $/J), TestFlight-Beta | 2–3 Wo |
| M6 | **Android** | Capacitor-Android, Play Console (25 $), interne Beta → Produktion | 1–2 Wo |
| M7 | v1.1+ | BLE-Waagen (Web Bluetooth + Capacitor-BLE), Kompass P2 (Cron-Worker), Community-Startwerte, Barcode | laufend |

## 3. Backlog — Epics mit ersten Stories

**E1 Onboarding:** Methoden-Wahl → Equipment-Suche (Autocomplete, Illustrationen) → erste Bohne → Location-Opt-in → erster geführter Bezug.
**E2 Bezug:** Parameter-Screen mit Kompass-Defaults · Timer (Ring, Lap, Vibration via Web-API/Capacitor-Haptics) · Messwerte · Bewertung (Pflicht nur Gesamt) · Duplizieren.
**E3 Regal:** CRUD Bohne · Röstdatum + Frische-Indikator · Foto (R2)/OCR · Archiv.
**E4 Setup:** CRUD Equipment · Produkt-DB-Suche · eigenes Gerät · Mahlgrad-Skala erfassen · Zubehör-Chips.
**E5 Kompass:** Regelwerk (core) · Begründungen · Rezept-Persistenz · Konfidenz · Insight-Karten (Luftfeuchte×Zeit, Bohnenalter×Rating).
**E6 Plattform:** Offline-Sync (lokale SQLite ↔ D1) · better-auth + anonymer Modus mit Merge · Datenexport/-löschung · i18n · Telemetrie (Analytics Engine, opt-in) · PWA-Install-Prompt.

## 4. Erste konkrete Coding-Schritte (Sprint 1)

1. GitHub-Repo `kvarn` + `pnpm create turbo`; `apps/web` (Vite + React + TanStack Router, Tabs gemäß Prototyp) und `apps/worker` (Hono, Static-Assets-Binding auf den Web-Build).
2. Cloudflare verbinden: Workers Builds aufs Repo → jeder Push auf `main` deployt, PRs bekommen Preview-URLs. D1/R2/KV mit Location Hint Westeuropa anlegen, Bindings in `wrangler.toml`.
3. `packages/ui`: Tokens (Farben/Typo/Radius aus 01_BRAND_DESIGN.md) als Tailwind-Theme; Komponenten `Card`, `ParamStepper`, `TimerRing`, `RatingSlider` — 1:1 aus `kvarn-prototype.html` übertragbar.
4. `packages/db`: Drizzle-SQLite-Schema aus 03_TECH_KONZEPT.md §5 (+ Sync-Spalten), Migrationen für lokal & D1, Repository-Layer.
5. `packages/core`: `computeRatio`, `nextGrindSuggestion(brew, history, weatherDelta)` mit Vitest-Golden-Tests; CI-Workflow (Lint/Typecheck/Test) als PR-Gate.
6. Seed-Import: Script `05_PRODUKT_DB_SEED.xlsx` → D1 (erste 50 Geräte) + Illustrations-SVGs als Static Assets.

## 5. Offene Entscheidungen (bewusst vertagt)

- Monetarisierung: Freemium (Pro: unbegrenzte Setups, TDS, Waagen, Community-Vergleich) vs. Einmalkauf — nach Beta-Feedback. Achtung ab M5: In-App-Kauf-Pflicht der Stores mitdenken.
- Kompass P3 (Community-Priors): erst ab kritischer Nutzermasse sinnvoll.
- Workers Paid ($5/Monat) erst bei realem Bedarf (Limits siehe 03 §2) — Free Tier trägt Beta locker.
- Lokale DB im Web: sqlite-wasm/OPFS (Schema-Parität) vs. Dexie/IndexedDB (Reife) — in M0 per Spike entscheiden.
