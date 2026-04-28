<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '~/stores/editor'
import { useTabsStore } from '~/stores/tabs'

const editorStore = useEditorStore()
const tabsStore = useTabsStore()

const stats = computed(() => {
  const text = editorStore.activeSelectionText || editorStore.currentContent
  const chars = text.length
  const words = text.trim() ? text.trim().split(/\s+/).length : 0

  if (editorStore.activeSelectionText) {
    return `${words} words, ${chars} chars (selected)`
  }
  return `${words} words, ${chars} chars`
})
</script>

<template>
  <div
    v-if="editorStore.currentFilePath"
    class="fixed bottom-0 right-0 h-7 pl-3 pr-1 bg-elevated border-t border-l border-default text-xs text-muted flex items-center whitespace-nowrap z-40 gap-2"
  >
    <span class="pointer-events-none">{{ stats }}</span>
    <UButton
      :icon="tabsStore.rightSidebarCollapsed ? 'i-lucide-panel-right-close' : 'i-lucide-panel-right'"
      size="xs"
      color="neutral"
      variant="ghost"
      class="w-5 h-5 justify-center px-0"
      :title="tabsStore.rightSidebarCollapsed ? $t('sidebar.showRightSidebar') : $t('sidebar.hideRightSidebar')"
      @click="tabsStore.rightSidebarCollapsed = !tabsStore.rightSidebarCollapsed"
    />
  </div>
</template>
