import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/minisearch')) return 'vendor-minisearch';
          if (id.includes('src/data/tecnica_profunda.generated.json')) return 'data-tecnica';
          if (id.includes('src/data/protocols.generated.json')) return 'data-protocols';
          if (id.includes('src/data/formacao_teorica_data')) return 'data-teoria';
          return undefined;
        }
      }
    }
  },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['icon.svg'],
      manifest: {
        id: './',
        name: 'Cockpit Clínico — Protocolos & PEP',
        short_name: 'Cockpit PEP',
        lang: 'pt-BR',
        description: 'Protocolos clínicos, habilidades pré-porta, REMUME e calculadoras UBS/UPA offline.',
        theme_color: '#0c1220',
        background_color: '#0c1220',
        display: 'standalone',
        scope: './',
        start_url: './',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,svg,png,json,webmanifest}'],
        globIgnores: ['data/hsl-guia.json'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /data\/hsl-guia\.json$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'hsl-guia-catalog',
              expiration: {
                maxEntries: 2,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              cacheableResponse: {
                statuses: [0, 200]
              },
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: false,
    allowedHosts: true
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true
  }
});
