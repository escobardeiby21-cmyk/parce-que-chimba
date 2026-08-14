import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        navigateFallbackDenylist: [/^\/api\//, /^\/cloud_orders\.json/],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/cloud_orders\.json/,
            handler: 'NetworkOnly'
          },
          {
            urlPattern: /^https?:\/\/.*\/api\/.*/,
            handler: 'NetworkOnly'
          }
        ]
      },
      manifest: {
        name: 'Que Chimba Parce',
        short_name: 'Que Chimba Parce',
        description: 'Menú digital y pedidos rápidos por WhatsApp',
        theme_color: '#ff6b00',
        background_color: '#0a0a0a',
        display: 'standalone',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})
