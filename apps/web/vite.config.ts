import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
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
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
