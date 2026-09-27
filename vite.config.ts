import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative Pfade, damit die App unter https://<name>.github.io/<repo>/ läuft
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      disable: !!process.env.VITEST,
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Mealprep-Planer',
        short_name: 'Mealprep',
        description: 'Wochenplan, Rezepte und Einkaufsliste für Mealprep',
        lang: 'de',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#fafaf9',
        theme_color: '#15803d',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json}'],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts', 'tools/**/*.test.ts'],
  },
});
