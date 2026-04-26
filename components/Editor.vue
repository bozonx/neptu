<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'

const projects = useProjectsStore()
const toast = useToast()

const localContent = ref(projects.currentContent)

// Keep local copy in sync when a different file is opened
watch(() => projects.currentFilePath, () => {
  localContent.value = projects.currentContent
})

watch(localContent, (value) => {
  if (value !== projects.currentContent) {
    projects.setContent(value)
  }
})

watchDebounced(
  () => projects.currentContent,
  async (value, prev) => {
    if (!projects.currentFilePath) return
    if (prev === undefined) return
    if (value === prev) return
    try {
      await projects.saveCurrentFile()
    }
    catch (error) {
      toast.add({
        title: 'Autosave failed',
        description: error instanceof Error ? error.message : String(error),
        color: 'error',
      })
    }
  },
  { debounce: 800, maxWait: 4000 },
)

const statusLabel = computed(() => {
  switch (projects.saveStatus) {
    case 'saving': return 'Saving…'
    case 'saved': return 'Saved'
    case 'error': return 'Error'
    default: return 'Idle'
  }
})

const statusColor = computed(() => {
  switch (projects.saveStatus) {
    case 'saving': return 'text-warning'
    case 'saved': return 'text-success'
    case 'error': return 'text-error'
    default: return 'text-muted'
  }
})

function fileNameFromPath(path: string | null): string {
  if (!path) return ''
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] ?? ''
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="fileNameFromPath(projects.currentFilePath) || 'Neptu'">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <span class="text-xs" :class="statusColor">{{ statusLabel }}</span>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="!projects.currentFilePath" class="flex h-full items-center justify-center text-muted">
        <div class="text-center space-y-2">
          <UIcon name="i-lucide-file-text" class="size-10 mx-auto" />
          <p class="text-sm">
            Select or create a markdown file to start editing
          </p>
        </div>
      </div>

      <textarea
        v-else
        v-model="localContent"
        class="w-full h-full resize-none bg-transparent outline-none p-4 font-mono text-sm leading-relaxed"
        spellcheck="false"
        placeholder="Start writing markdown…"
      />
    </template>
  </UDashboardPanel>
</template>
