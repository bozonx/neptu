<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'

const vaults = useVaultsStore()
const toast = useToast()

const localContent = ref(vaults.currentContent)

// Keep local copy in sync when a different file is opened
watch(() => vaults.currentFilePath, () => {
  localContent.value = vaults.currentContent
})

watch(localContent, (value) => {
  if (value !== vaults.currentContent) {
    vaults.setContent(value)
  }
})

// Autosave debounce is configurable in Settings; reactive ref keeps it live.
const autosaveDebounce = computed(() => Math.max(100, vaults.settings.autosaveDebounceMs))

watchDebounced(
  () => vaults.currentContent,
  async (value, prev) => {
    if (!vaults.currentFilePath) return
    if (prev === undefined) return
    if (value === prev) return
    try {
      await vaults.saveCurrentFile()
    }
    catch (error) {
      toast.add({
        title: 'Autosave failed',
        description: error instanceof Error ? error.message : String(error),
        color: 'error',
      })
    }
  },
  { debounce: autosaveDebounce, maxWait: 8000 },
)

const currentVault = computed(() => vaults.currentVault)
const showCommitButton = computed(() => {
  const v = currentVault.value
  if (!v || v.type !== 'git') return false
  if (v.git?.commitMode !== 'manual') return false
  return vaults.gitStatus[v.id]?.dirty ?? false
})
const committing = computed(() => {
  const v = currentVault.value
  return !!v && vaults.commitStatus[v.id] === 'committing'
})

async function handleCommit() {
  const v = currentVault.value
  if (!v) return
  try {
    await vaults.commitVault(v.id)
  }
  catch (error) {
    toast.add({
      title: 'Commit failed',
      description: error instanceof Error ? error.message : String(error),
      color: 'error',
    })
  }
}

const statusLabel = computed(() => {
  switch (vaults.saveStatus) {
    case 'saving': return 'Saving…'
    case 'saved': return 'Saved'
    case 'error': return 'Error'
    default: return 'Idle'
  }
})

const statusColor = computed(() => {
  switch (vaults.saveStatus) {
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
      <UDashboardNavbar :title="fileNameFromPath(vaults.currentFilePath) || 'Neptu'">
        <template #leading>
          <UDashboardSidebarToggle />
        </template>
        <template #right>
          <div class="flex items-center gap-3">
            <UButton
              v-if="showCommitButton"
              icon="i-lucide-git-commit"
              label="Commit"
              size="xs"
              :loading="committing"
              @click="handleCommit"
            />
            <span class="text-xs" :class="statusColor">{{ statusLabel }}</span>
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="!vaults.currentFilePath" class="flex h-full items-center justify-center text-muted">
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
