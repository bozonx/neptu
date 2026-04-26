<script setup lang="ts">
import AppSidebar from '~/components/AppSidebar.vue'
import FileSidebar from '~/components/FileSidebar.vue'
import PanelContainer from '~/components/PanelContainer.vue'

const editor = useEditorStore()
const tabsStore = useTabsStore()
const git = useGitStore()
const toast = useToast()

const activeFilePath = computed(() => {
  const leaf = tabsStore.allLeaves(tabsStore.desktopLayout).find((l) => l.id === tabsStore.activeDesktopPanelId)
  if (!leaf) return null
  const tab = leaf.tabs.find((t) => t.id === leaf.activeId)
  return tab?.filePath ?? null
})

const currentVault = computed(() => {
  const path = activeFilePath.value
  if (!path) return null
  return useVaultsStore().findVaultForPath(path)
})

// Global save error notification
watch(() => {
  const path = activeFilePath.value
  return path ? editor.buffers[path]?.saveError : null
}, (error) => {
  if (error) {
    toast.add({
      title: 'Save failed',
      description: error,
      color: 'error',
    })
  }
})

const showCommitButton = computed(() => {
  const v = currentVault.value
  if (!v || v.type !== 'git') return false
  if (v.git?.commitMode !== 'manual') return false
  return git.status[v.id]?.dirty ?? false
})

const committing = computed(() => {
  const v = currentVault.value
  return !!v && git.commitStatus[v.id] === 'committing'
})

async function handleCommit() {
  const v = currentVault.value
  if (!v) return
  try {
    await git.commit(v.id)
  }
  catch (error) {
    toast.add({
      title: 'Commit failed',
      description: error instanceof Error ? error.message : String(error),
      color: 'error',
    })
  }
}
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-default text-default">
    <!-- Left Sidebar -->
    <aside class="flex flex-col w-72 border-r border-default shrink-0 bg-default">
      <div class="h-10 border-b border-default flex items-center px-3 gap-2 shrink-0">
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <UIcon
            name="i-lucide-book-marked"
            class="size-5 text-primary shrink-0"
          />
          <span class="font-semibold text-sm truncate">Neptu</span>
        </div>
        <UButton
          v-if="showCommitButton"
          icon="i-lucide-git-commit"
          label="Commit"
          size="xs"
          :loading="committing"
          @click="handleCommit"
        />
      </div>
      <div class="flex-1 overflow-hidden">
        <AppSidebar />
      </div>
    </aside>

    <!-- Central Content -->
    <main class="flex-1 flex flex-col min-w-0 bg-default relative">
      <slot />
    </main>

    <!-- Right Sidebar -->
    <aside class="flex flex-col w-64 border-l border-default shrink-0 bg-default">
      <FileSidebar />
    </aside>
  </div>
</template>
