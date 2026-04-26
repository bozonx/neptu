import { useBreakpoints, breakpointsTailwind } from '@vueuse/core'

/**
 * Detects whether the app is currently running inside a Tauri WebView.
 * Useful for conditionally rendering features that depend on native APIs.
 *
 * The app is configured with `ssr: false`, so we only need a window check.
 */
export function useTauri() {
  const isTauri = computed(
    () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window,
  )

  const settings = useSettingsStore()
  const breakpoints = useBreakpoints(breakpointsTailwind)
  const isDesktop = breakpoints.greaterOrEqual('lg')

  const isMobile = computed(() => {
    const mode = settings.settings.layoutMode
    if (mode === 'desktop') return false
    if (mode === 'mobile') return true
    return !isDesktop.value
  })

  return { isTauri, isMobile }
}
