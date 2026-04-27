<script setup lang="ts">
import Editor from '~/components/Editor.vue'
import PanelContainer from '~/components/PanelContainer.vue'
import FirstRunDialog from '~/components/FirstRunDialog.vue'
import { flushPendingWrites } from '~/composables/useConfig'

const settings = useSettingsStore()
const editor = useEditorStore()
const tabsStore = useTabsStore()
const { isTauri, isMobile } = useTauri()

const ready = computed(() => !isTauri.value || (settings.initialized && editor.hydrated))

function handleBeforeUnload() {
  // Best-effort flush of debounced writes before the window unloads.
  void flushPendingWrites()
}

onMounted(() => {
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
  </div>
</template>
