<script setup lang="ts">
import { Splitpanes, Pane } from 'splitpanes'

const editor = useEditorStore()
const tabsStore = useTabsStore()
const toast = useToast()
const { t } = useI18n()
const { isTauri } = useTauri()
const plugins = usePluginsStore()

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
  if (event.length < 2 || event[0] === undefined) return

  const left = event[0].size
  /* When right sidebar is visible, Splitpanes has 3 panes and event[2]
     carries the right sidebar size. When collapsed, only 2 panes exist. */
  const right = event.length === 3 && event[2] !== undefined
    ? event[2].size
    : tabsStore.rightSidebarSize
  tabsStore.updateSidebarSizes(left, right)
}
</script>

<template>
  <div class="h-screen relative overflow-hidden bg-default text-default">
    <!-- Loading spinner -->
    <div
      v-if="!layoutReady"
      class="flex-1 h-full flex items-center justify-center bg-default"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="size-8 animate-spin text-primary"
      />
    </div>

    <!-- Main content area -->
    <Splitpanes
      v-if="layoutReady"
      id="main-layout"
      class="h-full"
      @resized="handleResize"
    >
      <!-- Left Sidebar -->
      <Pane
        :size="tabsStore.leftSidebarSize"
        min-size="15"
        max-size="40"
        class="flex flex-col bg-default"
      >
        <!-- Plugin toolbar row -->
        <div class="border-b border-default flex items-center gap-1 px-2 h-9 shrink-0 bg-elevated/30 overflow-x-auto overflow-y-hidden">
          <template v-if="leftHeaderButtons.length === 0">
            <UIcon
              name="i-lucide-book-marked"
              class="size-5 text-primary shrink-0"
            />
            <span class="font-semibold text-sm truncate">Neptu</span>
          </template>
          <PluginButtons
            v-else
            location="left-sidebar-header"
            size="xs"
          />
        </div>
        <div class="flex-1 overflow-hidden">
          <AppSidebar />
        </div>
      </Pane>

      <!-- Central Content (auto-sized by Splitpanes) -->
      <Pane class="flex flex-col min-w-0 min-h-0 bg-default relative">
        <main class="flex-1 flex flex-col min-w-0 min-h-0 bg-default relative">
          <slot />
        </main>
      </Pane>

      <!-- Right Sidebar (conditionally rendered) -->
      <Pane
        v-if="!tabsStore.rightSidebarCollapsed"
        :size="tabsStore.rightSidebarSize"
        min-size="10"
        max-size="30"
        class="flex flex-col bg-default pb-7"
      >
        <AppPanel class="shrink-0" />
        <FileSidebar class="flex-1 min-h-0" />
      </Pane>
    </Splitpanes>

    <!-- Status Bar (fixed, not flow-based) -->
    <AppStatusBar v-if="layoutReady" />
  </div>
</template>
