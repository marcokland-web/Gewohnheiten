import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

// GitHub Pages liefert die App unter https://marcokland-web.github.io/Gewohnheiten/ aus
const base = process.env.VITE_BASE ?? '/Gewohnheiten/'

/**
 * Content-Security-Policy (wie in BASE): Verbindungen nur zur eigenen Seite und zum Supabase-Projekt
 * aus VITE_SUPABASE_URL (live: https://asfwbuptsfcrgmmgdgim.supabase.co, Daten, Anmeldung, Edge Function).
 * Bilder zusätzlich vom Google-Profilfoto-Server. Realtime wird nicht genutzt, daher kein wss.
 * 'unsafe-inline' für Skripte wegen des Thema-Skripts im <head>; die Google-Anmeldung ist eine
 * normale Weiterleitung und braucht keine Freigabe.
 */
function csp(mode: string, command: 'build' | 'serve'): Plugin {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL
  const supabase = supabaseUrl ? new URL(supabaseUrl).origin : ''
  const dev = command === 'serve' ? ' ws: wss:' : '' // Vite-Neuladen im Dev-Server
  const policy = [
    "default-src 'none'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://lh3.googleusercontent.com",
    `connect-src 'self' ${supabase}${dev}`.trim(),
    "manifest-src 'self'",
    "worker-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
  ].join('; ')
  return {
    name: 'gewohnheiten-csp',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' }],
  }
}

export default defineConfig(({ mode, command }) => ({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(`${pkg.version} (${new Date().toISOString().slice(0, 10)})`),
  },
  plugins: [
    csp(mode, command),
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
}))
