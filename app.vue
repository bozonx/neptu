<script setup lang="ts">
import * as uiLocales from '@nuxt/ui/locale'
import { flushPendingWrites } from '~/composables/useConfig'

const settings = useSettingsStore()
const editor = useEditorStore()
const tabsStore = useTabsStore()
const colorMode = useColorMode()
const { locale, setLocale } = useI18n()
const { isTauri, isMobile } = useTauri()
const dnd = useDnd()
const importPrompt = useEditorImport()
const palette = useCommandPalette()
const confirm = useConfirm()
useBuiltinCommands()

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
const initError = ref<string | null>(null)

const ready = computed(() => !isTauri.value || (settings.initialized && editor.hydrated))

function handleBeforeUnload() {
  // Best-effort flush of debounced writes before the window unloads.
  void flushPendingWrites()
}

function handleGlobalKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  const isPaletteKey = (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'p'
  if (isPaletteKey && !isTyping) {
    event.preventDefault()
    palette.toggle()
  }
}

onMounted(async () => {
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('keydown', handleGlobalKeydown)
  }

  if (isTauri.value) {
    try {
      await settings.init()
      await editor.loadUiState()
      const { initBuiltinPlugins } = await import('~/app-plugins')
      await initBuiltinPlugins()
      const plugins = usePluginsStore()
      if (!plugins.resolvedActiveRightSidebarView) {
        const first = plugins.sortedRightSidebarViews[0]
        if (first) plugins.setActiveRightSidebarView(first.fqid)
      }
    }
    catch (error) {
      console.error('Failed to initialize app:', error)
      initError.value = error instanceof Error ? error.message : String(error)
    }
  }
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('beforeunload', handleBeforeUnload)
    window.removeEventListener('keydown', handleGlobalKeydown)
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
      <div class="contents">
        <template v-if="ready">
          <Editor
            v-if="isMobile"
            is-mobile
          />
          <PanelContainer
            v-else
            :panel="tabsStore.desktopLayout"
          />
        </template>

        <FirstRunDialog v-if="ready && settings.needsMainRepo" />

        <UModal
          v-if="!isTauri && ready"
          :open="true"
          :dismissible="false"
          :title="$t('error.tauriRequired')"
          :description="$t('error.tauriRequiredDesc')"
        />
      </div>
    </NuxtLayout>

    <UModal
      v-if="initError"
      :open="true"
      :title="$t('error.initialization')"
      :description="initError"
    />

    <PluginModalHost />

    <CommandPalette />

    <DialogsOverwriteFileDialog
      :open="!!importPrompt.pending.value"
      :file-name="importPrompt.pending.value?.fileName ?? ''"
      :show-remember-option="importPrompt.showRemember.value"
      @resolve="importPrompt.resolvePrompt"
      @cancel="importPrompt.cancelPrompt"
    />

    <UModal
      v-model:open="confirm.open.value"
      :title="confirm.title.value"
      :dismissible="true"
    >
      <template #body>
        <p>{{ confirm.message.value }}</p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            :label="$t('vault.cancel')"
            @click="confirm.resolve(false)"
          />
          <UButton
            :label="$t('vault.overwrite')"
            @click="confirm.resolve(true)"
          />
        </div>
      </template>
    </UModal>

    <div
      v-if="dnd.isOsDragging.value"
      class="fixed inset-0 z-50 pointer-events-none bg-primary/5 border-4 border-dashed border-primary/50 flex items-center justify-center transition-all"
    >
      <div class="bg-elevated px-6 py-4 rounded-xl shadow-2xl border border-default flex flex-col items-center gap-3">
        <div class="p-3 bg-primary/10 rounded-full">
          <UIcon
            name="i-lucide-download"
            class="size-8 text-primary"
          />
        </div>
        <span class="text-lg font-medium">{{ $t('dnd.dropFilesHere', 'Drop files to upload') }}</span>
      </div>
    </div>
  </UApp>
</template>
