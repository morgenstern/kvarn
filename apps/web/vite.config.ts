import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// Version = total commit count, so it climbs by exactly 1 per commit and a
// user-reported version number maps straight back to `git log` for support.
// Falls back to "0" if the build environment has no git history available
// (e.g. a shallow clone) rather than failing the build over a cosmetic label.
function getCommitCount() {
  try {
    return execSync("git rev-list --count HEAD").toString().trim();
  } catch {
    return "0";
  }
}
const commitCount = getCommitCount();

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(commitCount),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon.svg"],
      manifest: {
        name: "Kvarn — Dial it in.",
        short_name: "Kvarn",
        description: "Kaffee-Companion: Setup, Bohnen, Wetter und jeder Bezug — Kvarn lernt daraus.",
        theme_color: "#c0754d",
        background_color: "#f7f4ef",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
        ],
      },
      workbox: {
        // Includes the seed product catalog (public/data/seed-products.json)
        // so Setup search works offline on first load too, not just after
        // ensureSeeded() has already populated IndexedDB once.
        globPatterns: ["**/*.{js,css,html,svg,woff2,json}"],
      },
    }),
  ],
  server: {
    port: 5173,
    // Proxies to a locally running `wrangler dev` (apps/worker), same-origin so
    // no CORS setup is needed. Start it with `pnpm dev:worker` in another terminal.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
});
