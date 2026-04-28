<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '~/stores/editor'

const editorStore = useEditorStore()

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
    class="fixed bottom-0 right-0 h-7 px-3 bg-elevated border-t border-l border-default text-xs text-muted flex items-center whitespace-nowrap z-40 pointer-events-none"
  >
    {{ stats }}
  </div>
</template>
