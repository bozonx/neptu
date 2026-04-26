<script setup lang="ts">
const editor = useEditorStore()
const git = useGitStore()
const toast = useToast()

// Surface autosave errors as toasts. The store owns the actual debounce.
watch(() => editor.saveError, (err) => {
  if (!err) return
  toast.add({
    title: 'Autosave failed',
    description: err,
    color: 'error',
  })
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

const statusLabel = computed(() => {
  switch (editor.saveStatus) {
    case 'saving': return 'Saving…'
    case 'saved': return 'Saved'
    case 'error': return 'Error'
    default: return ''
  }
})

const statusColor = computed(() => {
  switch (editor.saveStatus) {
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

function onInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  editor.setContent(target.value)
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="fileNameFromPath(editor.currentFilePath) || 'Neptu'">
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
            <span
              v-if="statusLabel"
              class="text-xs"
              :class="statusColor"
            >{{ statusLabel }}</span>
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div
        v-if="!editor.currentFilePath"
        class="flex h-full items-center justify-center text-muted"
      >
        <div class="text-center space-y-2">
          <UIcon
            name="i-lucide-file-text"
            class="size-10 mx-auto"
          />
          <p class="text-sm">
            Select or create a markdown file to start editing
          </p>
        </div>
      </div>

      <textarea
        v-else
        :value="editor.currentContent"
        class="w-full h-full resize-none bg-transparent outline-none p-4 font-mono text-sm leading-relaxed"
        spellcheck="false"
        placeholder="Start writing markdown…"
        @input="onInput"
      />
    </template>
  </UDashboardPanel>
</template>
