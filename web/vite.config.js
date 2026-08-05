import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/ntac-platform/',

  plugins: [
    react(),

    VitePWA({
      registerType: 'autoUpdate',

      injectRegister: 'auto',

      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },

      manifest: {
        name: 'NTAC Platform',
        short_name: 'NTAC',
        description: 'NTAC Athlete Training Platform',

        theme_color: '#0f3d2e',
        background_color: '#f5f6f4',

        display: 'standalone',
        start_url: '/ntac-platform/',
        scope: '/ntac-platform/',

        icons: [
          {
            src: '/ntac-platform/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/ntac-platform/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/ntac-platform/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
})