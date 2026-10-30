import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

// GitHub Pages liefert die App unter https://marcokland-web.github.io/Gewohnheiten/ aus
const base = process.env.VITE_BASE ?? '/Gewohnheiten/'

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(`${pkg.version} (${new Date().toISOString().slice(0, 10)})`),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'push-sw.js'],
      manifest: {
        id: './',
        name: 'Gewohnheiten',
        short_name: 'Gewohnheiten',
        description: 'Gewohnheiten tracken – mit Erinnerungen nur, wenn noch etwas offen ist.',
        lang: 'de',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#FAF7F2',
        theme_color: '#5A1028',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        // Push-Empfang und Klick auf Benachrichtigungen
        importScripts: ['push-sw.js'],
      },
    }),
  ],
})
