# KVARN — Dial it in.

Kaffee-Companion für Web, iOS & Android. Siehe `docs/` für Markenkern, UX-Konzept, Tech-Konzept und Dev-Plan.

## Status

**M0 (Fundament) + M1 (Brüh-Loop, Web)** — lokal lauffähig als Vite-Dev-Server bzw. installierbare PWA. Kein
Cloudflare-Deploy nötig, um die App zu benutzen: Setups, Bohnen und Bezüge werden lokal in IndexedDB gehalten.

## Struktur

```
apps/
  web/      React + Vite PWA — die eigentliche App
  worker/   Cloudflare Worker (Hono) — API + Static-Assets-Hosting, für späteres Deploy
packages/
  core/     Domänen-Logik (Ratio-Mathe, Kompass-Regelwerk) — framework-frei, mit Golden-Tests
  db/       Ein Drizzle-SQLite-Schema für lokale DB und D1
  ui/       Design-Tokens (Tailwind-Theme) + geteilte Komponenten
  api-client/  Platzhalter für Worker-/Wetter-/BLE-Clients (ab M2)
```

## Setup

Voraussetzung: Node ≥ 20, pnpm (`corepack enable` oder `npm i -g pnpm`).

```bash
pnpm install
pnpm dev:web       # startet die Web-App auf http://localhost:5173
```

Erststart legt automatisch eine Setup- und Bohnen-Anleitung nahe: unter **Setup** eine Mühle suchen (56 Geräte
kuratiert aus der Seed-DB) oder ein eigenes Gerät anlegen, dann ein Setup speichern; unter **Regal** eine Bohne
anlegen. Danach ist **Brühen** nutzbar: Parameter → Timer → Bewertung → Logbuch (**Kompass**).

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
