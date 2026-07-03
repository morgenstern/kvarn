# KVARN — Dial it in.

Kaffee-Companion für Web, iOS & Android. Siehe `docs/` für Markenkern, UX-Konzept, Tech-Konzept und Dev-Plan.

## Status

**M0–M4 aus `docs/04_DEV_PLAN.md` sind gebaut** — lokal lauffähig als Vite-Dev-Server bzw. installierbare PWA,
DE/EN-Sprachumschaltung, Onboarding, Konto (E-Mail/Passwort + anonym), Datenexport/-löschung, Feedback-Formular.
Für den vollen Funktionsumfang (Wetter, Fotos, Community-Vorschläge, Konten) muss zusätzlich der Worker lokal
laufen — alles funktioniert komplett ohne Cloudflare-Account (Miniflare simuliert D1/R2/KV lokal).

M4 ergänzt: geführtes Onboarding (Methode → Equipment → Bohne → Standort-Opt-in) beim ersten Start;
vollständige DE/EN-Übersetzung mit Sprachumschalter (**Einstellungen**); Konto-Verwaltung über better-auth
(E-Mail/Passwort + anonyme Geräte-Sessions, siehe unten für Apple/Google); Datenexport (JSON) und
-löschung; Feedback-Formular (landet in D1). Die Moderations-Queue (`/moderation`, seit M3) ist jetzt an
eine echte, nicht-anonyme Anmeldung gebunden statt offen zu sein.

## Struktur

```
apps/
  web/      React + Vite PWA — die eigentliche App
  worker/   Cloudflare Worker (Hono) — API (Wetter, Moderation, Fotos, Feedback, better-auth) + Static-Assets
packages/
  core/     Domänen-Logik (Ratio-Mathe, Kompass-Regelwerk mit "Warum", Frische-Kurve) — framework-frei, Golden-Tests
  db/       Ein Drizzle-SQLite-Schema (App-Daten + better-auth-Tabellen) für lokale DB und D1, Migrationen
  ui/       Design-Tokens (Tailwind-Theme) + geteilte Komponenten (inkl. Chart)
  api-client/  Wetter-, Produkt-Moderation-, Foto-Upload- und Feedback-Clients; BLE-Scale-Client folgt in Phase 2
apps/web/src/i18n/   DE/EN-Wörterbücher + React-Context (useT, useLocale)
apps/web/src/auth/   better-auth React-Client + Session-Bootstrap (useEnsureSession)
```

## Setup

Voraussetzung: Node ≥ 20, pnpm (`corepack enable` oder `npm i -g pnpm`).

```bash
pnpm install
pnpm dev:web       # startet die Web-App auf http://localhost:5173
```

Für Wetter, Konten, Foto-Upload, Community-Vorschläge und Feedback zusätzlich den Worker lokal starten (in
einem zweiten Terminal, kein Cloudflare-Account nötig — Miniflare simuliert die Bindings). Beim allerersten
Mal die D1-Migration anwenden und ein lokales Auth-Secret anlegen:

```bash
cp apps/worker/.dev.vars.example apps/worker/.dev.vars
# BETTER_AUTH_SECRET in apps/worker/.dev.vars eintragen, z. B.:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

pnpm --filter @kvarn/worker db:migrate:local   # einmalig, legt alle Tabellen in der lokalen D1 an
pnpm dev:worker                                # startet den Worker auf http://localhost:8787
```

Vite proxied `/api/*` im Dev-Modus automatisch an `localhost:8787` (siehe `apps/web/vite.config.ts`). Ohne
laufenden Worker funktioniert die App weiterhin lokal — Wetter, Konten, Foto-Upload, Community-Vorschläge
und Feedback werden dann einfach übersprungen (nie ein Blocker fürs Brühen).

Der erste Start zeigt automatisch das **Onboarding** (Methode → Equipment-Suche in ~390 Geräten oder eigenes
Gerät → erste Bohne → Standort-Opt-in), danach ist **Brühen** nutzbar: Parameter (mit Kompass-Vorschlag +
"Warum") → Timer → Bewertung → Logbuch & beste Rezepte (**Kompass**). Sprache, Konto, Datenexport/-löschung
und Feedback liegen unter **Einstellungen** (oben rechts in der App).

## Tests, Typecheck, Lint

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## Bekannte Lücken

- **Apple/Google-Sign-in**: better-auth ist vorbereitet, aber es sind keine OAuth-Client-Credentials von
  Apple/Google hinterlegt (die kann nur der Kontoinhaber der jeweiligen Developer-Programme anlegen). E-Mail/
  Passwort und anonyme Sessions funktionieren bereits vollständig. Sobald Credentials vorliegen, in
  `apps/worker/src/auth.ts` als `socialProviders` ergänzen.
- **Kompass-Begründungen sind noch nicht übersetzt**: `packages/core`s Regelwerk (`nextGrindSuggestion`) baut
  seine "Warum"-Sätze fest auf Deutsch zusammen. Bei englischer UI-Sprache erscheint der Kompass-Hinweis auf
  dem Brühen-Screen daher gemischtsprachig. Sauberer Fix: `nextGrindSuggestion` auf strukturierte
  Begründungscodes umstellen und die Sätze in `apps/web` per i18n formatieren.
- **Lokale Daten sind nicht an Konten gebunden**: Setups/Bohnen/Bezüge bleiben geräte-lokal in IndexedDB,
  auch nach Anmeldung. Ein echtes Sync/Merge zwischen Geräten ist ein eigenes Vorhaben (Backlog-Epic E6),
  bewusst nicht Teil von M4.
- **AI-Illustrations-Pipeline ohne Credentials**: `/api/illustrations/*/generate` (Moderation-Screen →
  Abschnitt "Illustrationen", für Community-Geräte ohne Bild) braucht `GOOGLE_CSE_API_KEY`,
  `GOOGLE_CSE_CX` und `GEMINI_API_KEY` (siehe `apps/worker/.dev.vars.example`). Ohne diese drei Keys
  antwortet der Endpunkt mit 501 statt zu generieren — Code und Tests sind vollständig, nur die
  Drittanbieter-Keys fehlen, weil sie nur der Kontoinhaber anlegen kann.

## Deploy (später, sobald gewünscht)

1. Cloudflare-Account anlegen: https://dash.cloudflare.com/sign-up
2. `pnpm dlx wrangler login` im `kvarn/`-Ordner ausführen (Browser-Login).
3. `pnpm wrangler d1 create kvarn`, `pnpm wrangler r2 bucket create kvarn-photos`,
   `pnpm wrangler kv namespace create WEATHER_CACHE` — jeweils die zurückgegebene ID in
   `apps/worker/wrangler.toml` eintragen.
4. `pnpm wrangler secret put BETTER_AUTH_SECRET` — eigenen Zufallswert setzen (siehe oben). Optional für die
   AI-Illustrations-Pipeline zusätzlich `pnpm wrangler secret put GOOGLE_CSE_API_KEY`,
   `GOOGLE_CSE_CX` und `GEMINI_API_KEY` setzen (siehe `apps/worker/.dev.vars.example`).
5. `pnpm --filter @kvarn/worker db:migrate:remote` — Migrationen auf die echte D1 anwenden.
6. In Cloudflare: **Workers & Pages → Create → Import a repository**, das GitHub-Repo `kvarn` verbinden
   (Workers Builds deployt danach bei jedem Push auf `main`).
7. Sobald eine öffentliche URL/Domain feststeht: in `apps/worker/src/auth.ts` zu `trustedOrigins` hinzufügen
   (aktuell nur die lokalen Dev-Origins für den Vite-Proxy).

Details siehe `docs/03_TECH_KONZEPT.md` und `docs/04_DEV_PLAN.md`.
