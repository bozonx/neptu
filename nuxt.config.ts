// https://nuxt.com/docs/api/configuration/nuxt-config
/// <reference types="node" />
export default defineNuxtConfig({

  modules: ['@nuxt/eslint', '@nuxt/ui', '@pinia/nuxt', '@vueuse/nuxt', '@nuxtjs/i18n'],

  // SPA mode required for Tauri
  ssr: false,
  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  // Keep a flat project layout instead of the Nuxt 4 default `app/` srcDir
  srcDir: '.',

  // Avoid file-watcher issues caused by the Rust target dir
  ignore: ['**/src-tauri/**'],

  // Make development server reachable from physical mobile devices
  devServer: {
    host: '0',
    port: Number(process.env.NUXT_PORT || process.env.PORT || 3000),
  },
  compatibilityDate: '2025-05-15',

  vite: {
    // Better support for Tauri CLI output
    clearScreen: false,
    // Forward Tauri-specific environment variables to the client
    envPrefix: ['VITE_', 'TAURI_'],
    server: {
      // Tauri requires a consistent port
      strictPort: true,
    },
    optimizeDeps: {
      include: [
        '@tauri-apps/api/path',
        '@tauri-apps/plugin-fs',
        '@tauri-apps/plugin-dialog',
        '@tauri-apps/api/core',
      ],
    },
  },

  typescript: {
    strict: true,
  },

  eslint: {
    config: {
      stylistic: {
        indent: 2,
        semi: false,
        quotes: 'single',
        commaDangle: 'always-multiline',
      },
    },
  },

  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'en-US',
    locales: [
      { code: 'en-US', name: 'English', file: 'en-US.json' },
      { code: 'ru-RU', name: 'Русский', file: 'ru-RU.json' },
    ],
    langDir: 'locales/',
    detectBrowserLanguage: false,
    bundle: {
      optimizeTranslationDirective: false,
    },
  },
})
