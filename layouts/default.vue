<script setup lang="ts">
import AppSidebar from '~/components/AppSidebar.vue'
import FileSidebar from '~/components/FileSidebar.vue'

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
    <div class="lg:hidden h-12 border-b border-default flex items-center px-3 gap-2 shrink-0">
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
        <UButton
          icon="i-lucide-info"
          variant="ghost"
          color="neutral"
          size="sm"
          @click="rightDrawerOpen = true"
        />
      </div>
    </div>

    <div class="flex flex-1 overflow-hidden">
      <!-- Left Sidebar (Desktop) -->
      <aside class="hidden lg:flex flex-col w-72 border-r border-default shrink-0 bg-default">
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
      <main class="flex-1 flex flex-col min-w-0 bg-default">
        <slot />
      </main>

      <!-- Right Sidebar (Desktop) -->
      <aside class="hidden lg:flex flex-col w-64 border-l border-default shrink-0 bg-default">
        <FileSidebar />
      </aside>
    </div>

    <!-- Left Drawer (Mobile) -->
    <USlideover
      v-model:open="leftDrawerOpen"
      side="left"
    >
      <template #content>
        <div class="h-full flex flex-col bg-default">
          <div class="h-12 border-b border-default flex items-center px-4 shrink-0">
            <span class="font-bold">Navigation</span>
          </div>
          <div class="flex-1 overflow-hidden">
            <AppSidebar />
          </div>
        </div>
      </template>
    </USlideover>

    <!-- Right Drawer (Mobile) -->
    <USlideover
      v-model:open="rightDrawerOpen"
      side="right"
    >
      <template #content>
        <div class="h-full flex flex-col bg-default">
          <div class="h-12 border-b border-default flex items-center px-4 shrink-0">
            <span class="font-bold">File Information</span>
          </div>
          <div class="flex-1 overflow-hidden">
            <FileSidebar />
          </div>
        </div>
      </template>
    </USlideover>
  </div>
</template>
