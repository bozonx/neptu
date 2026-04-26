<script setup lang="ts">
import { PanelGroup, Panel, PanelResizeHandle } from 'vue-resizable-panels'
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

function handleLayout(sizes: number[]) {
  // We only care about the top-level layout which has exactly 3 panels: [left, center, right]
  if (sizes.length === 3) {
    tabsStore.updateSidebarSizes(sizes[0], sizes[2])
  }
}
</script>

<template>
  <div class="h-screen overflow-hidden bg-default text-default">
    <PanelGroup
      id="main-layout"
      direction="horizontal"
      @layout="handleLayout"
    >
      <!-- Left Sidebar -->
      <Panel
        id="left-sidebar"
        :default-size="tabsStore.leftSidebarSize"
        :min-size="15"
        :max-size="40"
        :order="1"
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
      </Panel>

      <PanelResizeHandle
        id="left-sidebar-handle"
        class="w-1 hover:bg-primary/30 transition-colors cursor-col-resize z-50 border-r border-default"
      />

      <!-- Central Content -->
      <Panel
        id="central-content"
        :order="2"
        class="flex flex-col min-w-0 bg-default relative"
      >
        <main class="flex-1 flex flex-col min-w-0 bg-default relative">
          <slot />
        </main>
      </Panel>

      <PanelResizeHandle
        id="right-sidebar-handle"
        class="w-1 hover:bg-primary/30 transition-colors cursor-col-resize z-50 border-l border-default"
      />

      <!-- Right Sidebar -->
      <Panel
        id="right-sidebar"
        :default-size="tabsStore.rightSidebarSize"
        :min-size="10"
        :max-size="30"
        :order="3"
        class="flex flex-col bg-default"
      >
        <FileSidebar />
      </Panel>
    </PanelGroup>
  </div>
</template>
