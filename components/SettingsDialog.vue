<script setup lang="ts">
import type { AppSettings, GitAuthor } from '~/types'

const open = defineModel<boolean>('open', { required: true })

const settingsStore = useSettingsStore()
const toast = useToast()

const activeTab = ref('general')
const tabs = [
  { label: 'Главное', value: 'general', icon: 'i-lucide-settings' },
  { label: 'Git', value: 'git', icon: 'i-lucide-git-branch' },
]

const autosaveSec = ref(0)
const commitSec = ref(0)
const authorName = ref('')
const authorEmail = ref('')
const layoutMode = ref<AppSettings['layoutMode']>('auto')
const theme = ref<AppSettings['theme']>('system')
const detectedAuthor = ref<GitAuthor | null>(null)
const configPath = ref('')
const newMainPath = ref('')

const colorMode = useColorMode()

let skipNextWatch = false

watch(open, async (value) => {
  if (!value) return
  // Snapshot current settings every time the dialog opens
  const s = settingsStore.settings
  skipNextWatch = true
  autosaveSec.value = +(s.autosaveDebounceMs / 1000).toFixed(2)
  commitSec.value = +(s.defaultCommitDebounceMs / 1000).toFixed(2)
  authorName.value = s.gitAuthorName
  authorEmail.value = s.gitAuthorEmail
  layoutMode.value = s.layoutMode
  theme.value = s.theme
  newMainPath.value = ''
  try {
    const git = useGit()
    detectedAuthor.value = await git.globalAuthor()
    const config = useConfig()
    configPath.value = await config.getConfigPath()
  }
  catch {
    detectedAuthor.value = null
    configPath.value = ''
  }
  nextTick(() => {
    skipNextWatch = false
  })
}, { immediate: true })

async function browseMainFolder() {
  try {
    const path = await useFs().pickDirectory({ title: 'Select new main vault folder' })
    if (path) newMainPath.value = path
  }
  catch (error) {
    toast.add({ title: 'Cannot open dialog', description: String(error), color: 'error' })
  }
}

async function submitChangeMainRepo() {
  if (!newMainPath.value) return
  try {
    await settingsStore.changeMainRepo(newMainPath.value)
    newMainPath.value = ''
    toast.add({ title: 'Main vault updated', color: 'success' })
  }
  catch (error) {
    toast.add({
      title: 'Failed to change main vault',
      description: error instanceof Error ? error.message : String(error),
      color: 'error',
    })
  }
}

async function copyConfigPath() {
  if (!configPath.value) return
  try {
    await navigator.clipboard.writeText(configPath.value)
    toast.add({ title: 'Copied to clipboard', color: 'success' })
  }
  catch {
    toast.add({ title: 'Failed to copy', color: 'error' })
  }
}

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
      layoutMode: layoutMode.value,
      theme: theme.value,
    })
    colorMode.preference = theme.value
  }
  catch (error) {
    toast.add({
      title: 'Failed to auto-save settings',
      description: error instanceof Error ? error.message : String(error),
      color: 'error',
    })
  }
}

const debouncedSave = useDebounceFn(save, 500)

watch(
  [autosaveSec, commitSec, authorName, authorEmail, layoutMode, theme],
  () => {
    if (skipNextWatch || !open.value) return
    debouncedSave()
  },
  { deep: true },
)
</script>

<template>
  <UModal
    v-model:open="open"
    title="Settings"
    description="Application-wide preferences"
    :ui="{
      content: 'sm:max-w-3xl',
      body: 'p-0',
    }"
  >
    <template #body>
      <div class="flex h-[500px]">
        <!-- Sidebar Navigation -->
        <aside class="w-56 border-r border-default p-4 space-y-1">
          <UButton
            v-for="tab in tabs"
            :key="tab.value"
            :icon="tab.icon"
            :label="tab.label"
            :color="activeTab === tab.value ? 'primary' : 'neutral'"
            :variant="activeTab === tab.value ? 'soft' : 'ghost'"
            block
            class="justify-start"
            @click="activeTab = tab.value"
          />
        </aside>

        <!-- Content Area -->
        <main class="flex-1 overflow-y-auto p-6">
          <!-- General Tab -->
          <div
            v-if="activeTab === 'general'"
            class="space-y-8"
          >
            <section class="space-y-4">
              <h3 class="text-sm font-bold text-muted uppercase tracking-wider">
                Interface
              </h3>
              <UFormField
                label="Theme"
                hint="Switch between light and dark modes."
              >
                <URadioGroup
                  v-model="theme"
                  :items="[
                    { label: 'System', value: 'system' },
                    { label: 'Light', value: 'light' },
                    { label: 'Dark', value: 'dark' },
                  ]"
                />
              </UFormField>

              <UFormField
                label="Layout Mode"
                hint="Switch between desktop and mobile interfaces."
              >
                <URadioGroup
                  v-model="layoutMode"
                  :items="[
                    { label: 'Automatic (Screen size)', value: 'auto' },
                    { label: 'Force Desktop', value: 'desktop' },
                    { label: 'Force Mobile', value: 'mobile' },
                  ]"
                />
              </UFormField>
            </section>

            <section class="space-y-4">
              <h3 class="text-sm font-bold text-muted uppercase tracking-wider">
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
                  class="w-32"
                />
              </UFormField>
            </section>

            <section class="space-y-4">
              <h3 class="text-sm font-bold text-muted uppercase tracking-wider">
                Main vault
              </h3>
              <UFormField
                label="Current folder"
                hint="Changing this moves the .neptu folder to the new location."
              >
                <div class="flex items-center gap-2">
                  <UInput
                    :model-value="newMainPath || settingsStore.mainRepoPath || ''"
                    readonly
                    class="flex-1 text-xs"
                  />
                  <UButton
                    icon="i-lucide-folder-search"
                    label="Browse"
                    size="sm"
                    @click="browseMainFolder"
                  />
                  <UButton
                    label="Change"
                    size="sm"
                    :disabled="!newMainPath"
                    @click="submitChangeMainRepo"
                  />
                </div>
              </UFormField>
            </section>

            <section class="space-y-4">
              <h3 class="text-sm font-bold text-muted uppercase tracking-wider">
                Storage
              </h3>
              <UFormField label="Config path">
                <div class="flex items-center gap-2">
                  <UInput
                    :model-value="configPath"
                    readonly
                    class="flex-1 text-xs"
                  />
                  <UButton
                    icon="i-lucide-copy"
                    size="xs"
                    variant="ghost"
                    :disabled="!configPath"
                    @click="copyConfigPath"
                  />
                </div>
              </UFormField>
            </section>
          </div>

          <!-- Git Tab -->
          <div
            v-if="activeTab === 'git'"
            class="space-y-8"
          >
            <section class="space-y-4">
              <h3 class="text-sm font-bold text-muted uppercase tracking-wider">
                Git Settings
              </h3>
              <UFormField
                label="Default commit debounce (seconds)"
                hint="Used as the default for new git vaults in auto-commit mode. The timer starts after each autosave."
              >
                <UInput
                  v-model="commitSec"
                  type="number"
                  :min="0"
                  :step="0.5"
                  class="w-32"
                />
              </UFormField>

              <UFormField
                label="Author name"
                :hint="detectedHint"
              >
                <UInput
                  v-model="authorName"
                  placeholder="Leave empty to use git's global config"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Author email">
                <UInput
                  v-model="authorEmail"
                  type="email"
                  placeholder="Leave empty to use git's global config"
                  class="w-full"
                />
              </UFormField>
            </section>
          </div>
        </main>
      </div>
    </template>

    <template #footer>
      <UButton
        color="neutral"
        variant="ghost"
        label="Close"
        @click="open = false"
      />
    </template>
  </UModal>
</template>

