<script setup lang="ts">
import { Splitpanes, Pane } from 'splitpanes'
import AppSidebar from '~/components/AppSidebar.vue'
import FileSidebar from '~/components/FileSidebar.vue'

const editor = useEditorStore()
const tabsStore = useTabsStore()
const toast = useToast()
const { t } = useI18n()
const { isTauri } = useTauri()
const plugins = usePluginsStore()
const settingsStore = useSettingsStore()

const leftHeaderButtons = plugins.buttonsFor('left-sidebar-header')
// In Tauri we wait for ui-state.json to be loaded so Splitpanes mounts with
// the persisted sizes; outside Tauri there's no persisted state and a blocking
// modal is shown over the layout anyway.
const layoutReady = computed(() => !isTauri.value || editor.hydrated)

const activeFilePath = computed(() => {
  const leaf = tabsStore.allLeaves(tabsStore.desktopLayout).find((l) => l.id === tabsStore.activeDesktopPanelId)
  if (!leaf) return null
  const tab = leaf.tabs.find((t) => t.id === leaf.activeId)
  return tab?.filePath ?? null
})

// Global save error notification
watch(() => {
  const path = activeFilePath.value
  return path ? editor.buffers[path]?.saveError : null
}, (error) => {
  if (error) {
    toast.add({
      title: t('toast.saveFailed'),
      description: error,
      color: 'error',
    })
  }
})

function handleResize(event: Array<{ pane: number, size: number }>) {
  // We only care about the top-level layout which has exactly 3 panes: [left, center, right]
  if (event.length === 3 && event[0] !== undefined && event[2] !== undefined) {
    tabsStore.updateSidebarSizes(event[0].size, event[2].size)
  }
}
</script>

<template>
  <div class="h-screen overflow-hidden bg-default text-default">
    <div
      v-if="!layoutReady"
      class="h-full flex items-center justify-center bg-default"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="size-8 animate-spin text-primary"
      />
    </div>

    <Splitpanes
      v-if="layoutReady"
      id="main-layout"
      @resized="handleResize"
    >
      <!-- Left Sidebar -->
      <Pane
        :size="tabsStore.leftSidebarSize"
        min-size="15"
        max-size="40"
        class="flex flex-col bg-default"
      >
        <div class="h-10 border-b border-default flex items-center px-3 gap-2 shrink-0">
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <UIcon
              name="i-lucide-book-marked"
              class="size-5 text-primary shrink-0"
            />
            <span class="font-semibold text-sm truncate">Neptu</span>
          </div>
        </div>
        <!-- Plugin toolbar row -->
        <div class="h-9 border-b border-default flex items-center gap-1 px-2 shrink-0 bg-elevated/30">
          <PluginButtons
            location="left-sidebar-header"
            size="xs"
          />
          <UButton
            v-if="leftHeaderButtons.length === 0"
            size="xs"
            variant="link"
            :label="$t('plugins.addPlugins')"
            @click="settingsStore.openSettingsDialog('plugins')"
          />
        </div>
        <div class="flex-1 overflow-hidden">
          <AppSidebar />
        </div>
      </Pane>

      <!-- Central Content -->
      <Pane class="flex flex-col min-w-0 bg-default relative">
        <main class="flex-1 flex flex-col min-w-0 bg-default relative">
          <slot />
        </main>
      </Pane>

      <!-- Right Sidebar -->
      <Pane
        :size="tabsStore.rightSidebarSize"
        min-size="10"
        max-size="30"
        class="flex flex-col bg-default"
      >
        <FileSidebar />
      </Pane>
    </Splitpanes>
  </div>
</template>
