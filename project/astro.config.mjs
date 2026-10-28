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

  // The app privacy policy and account-deletion pages are built so the app
  // and the store listings can link them, but they are drafts for counsel
  // review: noindex, and kept out of the sitemap until they are final. The
  // beta thank-you and confirmed pages are only reached from the form.
  integrations: [
    sitemap({
      filter: (page) =>
        !/\/(app-privacy|delete-account|beta\/(?:thanks|confirmed))\/$/.test(
          page,
        ),
    }),
  ],
});
