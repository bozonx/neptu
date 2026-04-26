<script setup lang="ts">
import { useBreakpoints, breakpointsTailwind } from '@vueuse/core'
import * as uiLocales from '@nuxt/ui/locale'

const settings = useSettingsStore()
const colorMode = useColorMode()
const breakpoints = useBreakpoints(breakpointsTailwind)
const isDesktop = breakpoints.greaterOrEqual('lg')
const { locale, setLocale } = useI18n()

// Map application locale codes to Nuxt UI locale keys
const uiLocaleMap: Record<string, keyof typeof uiLocales> = {
  'en-US': 'en',
  'ru-RU': 'ru',
}

// Sync color mode with settings
watchEffect(() => {
  if (settings.initialized) {
    colorMode.preference = settings.settings.theme
  }
})

// Sync locale with settings
watch(() => settings.settings.locale, (newLocale) => {
  if (newLocale && newLocale !== locale.value) {
    setLocale(newLocale as 'en-US' | 'ru-RU')
  }
}, { immediate: true })

const uiLocaleKey = computed(() => uiLocaleMap[locale.value] ?? 'en')

const lang = computed(() => uiLocales[uiLocaleKey.value]?.code ?? 'en')
const dir = computed(() => uiLocales[uiLocaleKey.value]?.dir ?? 'ltr')

useHead({
  title: 'Neptu',
  htmlAttrs: { lang, dir },
})

const layoutName = computed(() => {
  const mode = settings.settings.layoutMode
  if (mode === 'desktop') return 'desktop'
  if (mode === 'mobile') return 'mobile'

  // 'auto' mode
  return isDesktop.value ? 'desktop' : 'mobile'
})
</script>

<template>
  <UApp
    :locale="uiLocales[uiLocaleKey]"
    class="h-full"
  >
    <NuxtLayout
      :name="layoutName"
      class="h-full"
    >
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
