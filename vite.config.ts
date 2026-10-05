import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        id: '/',
        name: 'Prisma Detailing — CRM (демо)',
        short_name: 'Prisma',
        description: 'Демо CRM детейлинг-центра Prisma Detailing: записи, клиенты, услуги и архив',
        lang: 'ru',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0b0f0c',
        background_color: '#0b0f0c',
        categories: ['business', 'productivity'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Новая запись', short_name: 'Запись', url: '/new', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Справочник', url: '/clients', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        // Интерфейс (JS/CSS/шрифты/иконки) кешируется целиком. Данные
        // в демо живут в localStorage браузера.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        // Splash-картинки iOS нужны только при установке — не тащим их в precache.
        // Excel-библиотека (~500 КБ) нужна только админу для «Скачать базу» — грузится по требованию.
        globIgnores: ['splash/**', 'assets/xlsx-*.js'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 900 },
  server: { host: true, port: 5173 },
})
