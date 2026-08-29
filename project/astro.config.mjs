// @ts-check
import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  // Required for canonical URLs and for @astrojs/sitemap to emit absolute URLs.
  site: "https://www.tetherhealthgroup.com",

  // Directory-style URLs (/about/) so links stay stable across hosts that do
  // and do not rewrite extensionless paths.
  trailingSlash: "always",
  build: { format: "directory" },

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [sitemap()],
});
