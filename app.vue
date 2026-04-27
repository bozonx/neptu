<script setup lang="ts">
import * as uiLocales from '@nuxt/ui/locale'

const settings = useSettingsStore()
const colorMode = useColorMode()
const { locale, setLocale } = useI18n()

const availableLocales = ['en-US', 'ru-RU'] as const
type AppLocale = typeof availableLocales[number]

function resolveLocale(setting: string): AppLocale {
  if (setting !== 'auto') {
    return availableLocales.includes(setting as AppLocale) ? setting as AppLocale : 'en-US'
  }
  if (typeof navigator === 'undefined') return 'en-US'
  const sys = navigator.language ?? 'en-US'
  if (availableLocales.includes(sys as AppLocale)) return sys as AppLocale
  const prefix = (sys.split('-')[0] ?? 'en').toLowerCase()
  const matched = availableLocales.find((l) => (l.split('-')[0] ?? '').toLowerCase() === prefix)
  return matched || 'en-US'
}

const resolvedLocale = computed(() => resolveLocale(settings.settings.locale))

// Map application locale codes to Nuxt UI locale keys
const uiLocaleMap: Record<AppLocale, keyof typeof uiLocales> = {
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
watch(
  () => settings.settings.locale,
  () => {
    const resolved = resolvedLocale.value
    if (resolved !== locale.value) {
      setLocale(resolved)
    }
  },
  { immediate: true },
)

const uiLocaleKey = computed(() => uiLocaleMap[resolvedLocale.value] ?? 'en')

const lang = computed(() => uiLocales[uiLocaleKey.value]?.code ?? 'en')
const dir = computed(() => uiLocales[uiLocaleKey.value]?.dir ?? 'ltr')

useHead({
  title: 'Neptu',
  htmlAttrs: { lang, dir },
})

const layoutName = computed(() => settings.settings.layoutMode)

const editor = useEditorStore()
const { isTauri } = useTauri()
const initError = ref<string | null>(null)

onMounted(async () => {
  if (isTauri.value) {
    try {
      await settings.init()
      await editor.loadUiState()
      const { initBuiltinPlugins } = await import('~/app-plugins')
      await initBuiltinPlugins()
    }
    catch (error) {
      console.error('Failed to initialize app:', error)
      initError.value = error instanceof Error ? error.message : String(error)
    }
  }
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

    <UModal
      v-if="initError"
      :open="true"
      :title="$t('error.initialization')"
      :description="initError"
    />

    <PluginModalHost />
  </UApp>
</template>
