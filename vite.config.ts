import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

// public/_headers の「/*」の分（セキュリティヘッダー）を読み、`npm start`（vite preview）でも同じ値を返す。
function siteHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  let inAll = false;
  for (const line of readFileSync(new URL('./public/_headers', import.meta.url), 'utf8').split(/\r?\n/)) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      inAll = line.trim() === '/*';
      continue;
    }
    const i = line.indexOf(':');
    if (inAll && i > 0) headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return headers;
}

// base は相対: ローカル配信（npm start）でもサブパス配信でも同じビルドが動く。
export default defineConfig({
  base: './',
  // フォントは必ず別ファイルにする（CSS に埋め込まれた data: のフォントは font-src 'self' で止まるため。public/_headers）
  build: { assetsInlineLimit: (file: string) => (/\.woff2?$/.test(file) ? false : undefined) },
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
        theme_color: '#FDF1F4',
        background_color: '#FDF1F4',
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
        // フォント（src/fonts.css）は日本語が文字の範囲ごとに数百ファイルに分かれるので、先読みせず、使った分だけ残す（オフラインでも同じ文字は出る）。
        // ファイル名にハッシュが付くので、残したものは書き換わらない。
        runtimeCaching: [
          {
            urlPattern: ({ sameOrigin, url }) => sameOrigin && /\.woff2?$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 300 }, cacheableResponse: { statuses: [200] } },
          },
        ],
      },
    }),
  ],
  server: { port: 5181 },
  preview: { port: 4181, headers: siteHeaders() },
});
