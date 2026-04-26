<script setup lang="ts">
import type { GitAuthor } from '~/types'

const open = defineModel<boolean>('open', { required: true })

const settingsStore = useSettingsStore()
const toast = useToast()

const autosaveSec = ref(0)
const commitSec = ref(0)
const authorName = ref('')
const authorEmail = ref('')
const detectedAuthor = ref<GitAuthor | null>(null)

watch(open, async (value) => {
  if (!value) return
  // Snapshot current settings every time the dialog opens
  const s = settingsStore.settings
  autosaveSec.value = +(s.autosaveDebounceMs / 1000).toFixed(2)
  commitSec.value = +(s.defaultCommitDebounceMs / 1000).toFixed(2)
  authorName.value = s.gitAuthorName
  authorEmail.value = s.gitAuthorEmail
  try {
    const git = useGit()
    detectedAuthor.value = await git.globalAuthor()
  }
  catch {
    detectedAuthor.value = null
  }
}, { immediate: true })

const detectedHint = computed(() => {
  if (!detectedAuthor.value) return ''
  const { name, email } = detectedAuthor.value
  if (!name && !email) return 'Not configured in git'
  return `Detected from git: ${name ?? '—'} <${email ?? '—'}>`
})

async function save() {
  try {
    await settingsStore.updateSettings({
      autosaveDebounceMs: Math.max(100, Math.round(autosaveSec.value * 1000)),
      defaultCommitDebounceMs: Math.max(0, Math.round(commitSec.value * 1000)),
      gitAuthorName: authorName.value.trim(),
      gitAuthorEmail: authorEmail.value.trim(),
    })
    open.value = false
    toast.add({ title: 'Settings saved', color: 'success' })
  }
  catch (error) {
    toast.add({
      title: 'Failed to save settings',
      description: error instanceof Error ? error.message : String(error),
      color: 'error',
    })
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Settings"
    description="Application-wide preferences (stored inside the main repository's `.neptu/`)"
  >
    <template #body>
      <div class="space-y-6">
        <section class="space-y-3">
          <h3 class="text-sm font-semibold text-muted uppercase tracking-wide">
            Editor
          </h3>
          <UFormField
            label="Autosave debounce (seconds)"
            hint="Applies to every vault — how long to wait after the last keystroke before writing the file to disk."
          >
            <UInput
              v-model="autosaveSec"
              type="number"
              :min="0.1"
              :step="0.1"
            />
          </UFormField>
        </section>

        <section class="space-y-3">
          <h3 class="text-sm font-semibold text-muted uppercase tracking-wide">
            Git
          </h3>
          <UFormField
            label="Default commit debounce (seconds)"
            hint="Used as the default for new git vaults in auto-commit mode. The timer starts after each autosave and resets on new edits."
          >
            <UInput
              v-model="commitSec"
              type="number"
              :min="0"
              :step="0.5"
            />
          </UFormField>

          <UFormField
            label="Author name"
            :hint="detectedHint"
          >
            <UInput
              v-model="authorName"
              placeholder="Leave empty to use git's global config"
            />
          </UFormField>

          <UFormField label="Author email">
            <UInput
              v-model="authorEmail"
              type="email"
              placeholder="Leave empty to use git's global config"
            />
          </UFormField>
        </section>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          color="neutral"
          variant="ghost"
          label="Cancel"
          @click="open = false"
        />
        <UButton
          label="Save"
          @click="save"
        />
      </div>
    </template>
  </UModal>
</template>
