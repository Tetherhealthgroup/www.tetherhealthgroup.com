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

  // /delete-account/ (WEB-009) and /app-privacy/ (WEB-014) are drafts awaiting
  // counsel: kept out of the sitemap until the owner publishes them, then each
  // entry is removed from this filter.
  integrations: [
    sitemap({
      filter: (page) =>
        !page.includes("/delete-account/") && !page.includes("/app-privacy/"),
    }),
  ],
});
