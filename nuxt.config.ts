// https://nuxt.com/docs/api/configuration/nuxt-config
/// <reference types="node" />
export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },

  // Keep a flat project layout instead of the Nuxt 4 default `app/` srcDir
  srcDir: '.',
  serverDir: 'server',

  // SPA mode required for Tauri
  ssr: false,

  modules: ['@nuxt/ui', '@pinia/nuxt', '@vueuse/nuxt'],

  css: ['~/assets/css/main.css'],

  // Make development server reachable from physical mobile devices
  devServer: {
    host: '0',
    port: Number(process.env.NUXT_PORT || process.env.PORT || 3000),
  },

  vite: {
    // Better support for Tauri CLI output
    clearScreen: false,
    // Forward Tauri-specific environment variables to the client
    envPrefix: ['VITE_', 'TAURI_'],
    server: {
      // Tauri requires a consistent port
      strictPort: true,
    },
  },

  // Avoid file-watcher issues caused by the Rust target dir
  ignore: ['**/src-tauri/**'],

  typescript: {
    strict: true,
  },
})
