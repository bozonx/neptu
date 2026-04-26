<script setup lang="ts">
import AppSidebar from '~/components/AppSidebar.vue'
import FileSidebar from '~/components/FileSidebar.vue'
import FileSidebarToolbar from '~/components/FileSidebarToolbar.vue'

const editor = useEditorStore()
const git = useGitStore()
const toast = useToast()

const leftDrawerOpen = ref(false)
const rightDrawerOpen = ref(false)

// Global save error notification
watch(() => editor.saveError, (error) => {
  if (error) {
    toast.add({
      title: 'Save failed',
      description: error,
      color: 'error',
    })
  }
})

const showCommitButton = computed(() => {
  const v = editor.currentVault
  if (!v || v.type !== 'git') return false
  if (v.git?.commitMode !== 'manual') return false
  return git.status[v.id]?.dirty ?? false
})

const committing = computed(() => {
  const v = editor.currentVault
  return !!v && git.commitStatus[v.id] === 'committing'
})

async function handleCommit() {
  const v = editor.currentVault
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
  <div class="flex flex-col h-screen overflow-hidden bg-default text-default">
    <!-- Mobile Top Bar -->
    <header class="h-12 border-b border-default flex items-center px-3 gap-2 shrink-0 bg-default z-10">
      <UButton
        icon="i-lucide-menu"
        variant="ghost"
        color="neutral"
        size="sm"
        @click="leftDrawerOpen = true"
      />

      <div class="flex items-center gap-2 flex-1 min-w-0">
        <UIcon
          name="i-lucide-book-marked"
          class="size-5 text-primary shrink-0"
        />
        <span class="font-semibold text-sm truncate">Neptu</span>
      </div>

      <div class="flex items-center gap-1">
        <UButton
          v-if="showCommitButton"
          icon="i-lucide-git-commit"
          size="sm"
          variant="ghost"
          color="neutral"
          :loading="committing"
          @click="handleCommit"
        />

        <!-- Right Sidebar Toolbar moved to Top Bar -->
        <FileSidebarToolbar
          class="bg-elevated/50 rounded-lg px-1 py-0.5"
          @click.capture="rightDrawerOpen = true"
        />
      </div>
    </header>

    <!-- Central Content -->
    <main class="flex-1 overflow-hidden relative">
      <slot />
    </main>

    <!-- Left Drawer (Mobile Navigation) -->
    <USlideover
      v-model:open="leftDrawerOpen"
      side="left"
      title="Navigation"
    >
      <template #content>
        <div class="flex-1 overflow-hidden">
          <AppSidebar />
        </div>
      </template>
    </USlideover>

    <!-- Right Drawer (Mobile File Info/Outline) -->
    <USlideover
      v-model:open="rightDrawerOpen"
      side="right"
      title="File Details"
    >
      <template #content>
        <div class="flex-1 overflow-hidden">
          <!-- We hide the toolbar inside FileSidebar when in mobile drawer because it's already in the Top Bar -->
          <FileSidebar class="hide-toolbar" />
        </div>
      </template>
    </USlideover>
  </div>
</template>

<style scoped>
/* Hide the internal toolbar when FileSidebar is used in the mobile drawer */
:deep(.hide-toolbar) > div:first-child {
  display: none;
}
</style>
