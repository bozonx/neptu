<script setup lang="ts">
const editor = useEditorStore()
const git = useGitStore()
const toast = useToast()

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
</script>

<template>
  <div class="flex items-center h-10 border-b border-default bg-default px-3 shrink-0">
    <div class="flex items-center gap-2 flex-1 min-w-0">
      <UIcon
        name="i-lucide-book-marked"
        class="size-5 text-primary shrink-0"
      />
      <span class="font-semibold text-sm">Neptu</span>
    </div>

    <div class="flex justify-center flex-1 min-w-0">
      <EditorTabs />
    </div>

    <div class="flex items-center justify-end gap-3 flex-1 min-w-0">
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
  </div>
</template>
