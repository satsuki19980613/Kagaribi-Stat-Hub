import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base は相対: ローカル配信（npm start）でもサブパス配信でも同じビルドが動く。
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      // 更新は prompt 方式: 新しい版は待機させ、アプリ側（App.tsx）が入れ替える時機を決める。
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'Kagaribi Stat Hub',
        short_name: 'Kagaribi Stat',
        description: 'クラブ「燎」のクラブマッチ戦績を記録・集計（端末内で完結）',
        lang: 'ja',
        theme_color: '#E9EAED',
        background_color: '#E9EAED',
        display: 'standalone',
        orientation: 'any',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  server: { port: 5181 },
  preview: { port: 4181 },
});
