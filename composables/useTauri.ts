/**
 * Detects whether the app is currently running inside a Tauri WebView.
 * Useful for conditionally rendering features that depend on native APIs.
 */
export function useTauri() {
  const isTauri = computed(() => {
    if (import.meta.server) return false
    return typeof window !== 'undefined'
      && '__TAURI_INTERNALS__' in window
  })

  return { isTauri }
}
