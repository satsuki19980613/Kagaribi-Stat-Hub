/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/vanillajs" />

interface ImportMetaEnv {
  /** '1' ならデモ版（サンプルデータ入り・PWA なし）。 */
  readonly VITE_DEMO?: string;
}
