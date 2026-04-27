<script setup lang="ts">
import Editor from '~/components/Editor.vue'
import PanelContainer from '~/components/PanelContainer.vue'
import FirstRunDialog from '~/components/FirstRunDialog.vue'
import { flushPendingWrites } from '~/composables/useConfig'

const settings = useSettingsStore()
const editor = useEditorStore()
const tabsStore = useTabsStore()
const { isTauri, isMobile } = useTauri()

const ready = ref(false)
const initError = ref<string | null>(null)

function handleBeforeUnload() {
  // Best-effort flush of debounced writes before the window unloads.
  void flushPendingWrites()
}

onMounted(async () => {
  if (!isTauri.value) {
    ready.value = true
    return
  }
  try {
    await settings.init()
    await editor.loadUiState()
  }
  catch (error) {
    initError.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    ready.value = true
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', handleBeforeUnload)
  }
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('beforeunload', handleBeforeUnload)
  }
})
</script>

<template>
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

    <UModal
      v-if="initError"
      :open="true"
      :title="$t('error.initialization')"
      :description="initError"
    />
  </div>
</template>
