# KVARN — Dial it in.

Kaffee-Companion für Web, iOS & Android. Siehe `docs/` für Markenkern, UX-Konzept, Tech-Konzept und Dev-Plan.

## Status

**M0 (Fundament) + M1 (Brüh-Loop) + M2 (Wetter + Kompass P1) + M3 (Regal & Insights)** — lokal lauffähig als
Vite-Dev-Server bzw. installierbare PWA. Für den vollen Funktionsumfang (Wetter, Fotos, Community-Vorschläge)
muss zusätzlich der Worker lokal laufen — beides funktioniert komplett ohne Cloudflare-Account (Miniflare
simuliert D1/R2/KV lokal). Setups, Bohnen und Bezüge werden lokal in IndexedDB gehalten.

M3 ergänzt: Bohnen-Detail-Screen (Frische-Kurve, Rating-Verlauf, Rezepte), Bohnen-Fotos (R2-Upload),
vollständiger ~390-Geräte-Katalog, Community-Gerätevorschläge mit Moderations-Queue (`/moderation`, aktuell
**ohne Zugriffsschutz** — better-auth fehlt noch, siehe unten), sowie Insight-Charts auf dem Kompass-Screen
(Luftfeuchte×Brühzeit, Bohnenalter×Rating).

## Struktur

```
apps/
  web/      React + Vite PWA — die eigentliche App
  worker/   Cloudflare Worker (Hono) — API (Wetter-Proxy, Produkt-Moderation, Foto-Upload) + Static-Assets-Hosting
packages/
  core/     Domänen-Logik (Ratio-Mathe, Kompass-Regelwerk mit "Warum", Frische-Kurve) — framework-frei, Golden-Tests
  db/       Ein Drizzle-SQLite-Schema für lokale DB und D1, Migrationen in packages/db/migrations
  ui/       Design-Tokens (Tailwind-Theme) + geteilte Komponenten (inkl. Chart)
  api-client/  Wetter-, Produkt-Moderation- und Foto-Upload-Clients; BLE-Scale-Client folgt ab M2/Phase 2
```

## Setup

Voraussetzung: Node ≥ 20, pnpm (`corepack enable` oder `npm i -g pnpm`).

```bash
pnpm install
pnpm dev:web       # startet die Web-App auf http://localhost:5173
```

Für Wetter, Foto-Upload und Community-Vorschläge zusätzlich den Worker lokal starten (in einem zweiten
Terminal, kein Cloudflare-Account nötig — Miniflare simuliert die Bindings). Beim allerersten Mal die
D1-Migration auf die lokale Datenbank anwenden:

```bash
pnpm --filter @kvarn/worker db:migrate:local   # einmalig, legt die Tabellen in der lokalen D1 an
pnpm dev:worker                                # startet den Worker auf http://localhost:8787
```

Vite proxied `/api/*` im Dev-Modus automatisch an `localhost:8787` (siehe `apps/web/vite.config.ts`). Ohne
laufenden Worker funktioniert die App weiterhin — Wetter wird dann einfach übersprungen (nie ein Blocker).

Erststart legt automatisch eine Setup- und Bohnen-Anleitung nahe: unter **Setup** eine Mühle suchen (~390 Geräte
aus der Seed-DB) oder ein eigenes Gerät anlegen, dann ein Setup speichern; unter **Regal** eine Bohne
anlegen. Danach ist **Brühen** nutzbar: Parameter (mit Kompass-Vorschlag + "Warum") → Timer → Bewertung →
Logbuch & beste Rezepte (**Kompass**).

## Tests, Typecheck, Lint

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## Deploy (später, sobald gewünscht)

1. Cloudflare-Account anlegen: https://dash.cloudflare.com/sign-up
2. `pnpm dlx wrangler login` im `kvarn/`-Ordner ausführen (Browser-Login).
3. `pnpm wrangler d1 create kvarn`, `pnpm wrangler r2 bucket create kvarn-photos`,
   `pnpm wrangler kv namespace create WEATHER_CACHE` — jeweils die zurückgegebene ID in
   `apps/worker/wrangler.toml` eintragen.
4. In Cloudflare: **Workers & Pages → Create → Import a repository**, das GitHub-Repo `kvarn` verbinden
   (Workers Builds deployt danach bei jedem Push auf `main`).

Details siehe `docs/03_TECH_KONZEPT.md` und `docs/04_DEV_PLAN.md`.
