<script setup lang="ts">
import type { AppSettings, GitAuthor } from '~/types'

const open = defineModel<boolean>('open', { required: true })

const settingsStore = useSettingsStore()
const toast = useToast()
const { t } = useI18n()

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
const locale = ref<AppSettings['locale']>('en-US')
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
  locale.value = s.locale
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
    toast.add({ title: t('toast.copied'), color: 'success' })
  }
  catch {
    toast.add({ title: t('toast.copyFailed'), color: 'error' })
  }
}

const detectedHint = computed(() => {
  if (!detectedAuthor.value) return ''
  const { name, email } = detectedAuthor.value
  if (!name && !email) return t('settings.notConfigured')
  return t('settings.detectedFromGit', { name: name ?? '—', email: email ?? '—' })
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
      locale: locale.value,
    })
    colorMode.preference = theme.value
  }
  catch (error) {
    toast.add({
      title: t('toast.autoSaveFailed'),
      description: error instanceof Error ? error.message : String(error),
      color: 'error',
    })
  }
}

const debouncedSave = useDebounceFn(save, 500)

watch(
  [autosaveSec, commitSec, authorName, authorEmail, layoutMode, theme, locale],
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
                :label="$t('settings.language')"
              >
                <URadioGroup
                  v-model="locale"
                  :items="[
                    { label: 'English', value: 'en-US' },
                    { label: 'Русский', value: 'ru-RU' },
                  ]"
                />
              </UFormField>

              <UFormField
                :label="$t('settings.theme')"
                :hint="$t('settings.themeHint')"
              >
                <URadioGroup
                  v-model="theme"
                  :items="[
                    { label: $t('settings.system'), value: 'system' },
                    { label: $t('settings.light'), value: 'light' },
                    { label: $t('settings.dark'), value: 'dark' },
                  ]"
                />
              </UFormField>

              <UFormField
                :label="$t('settings.layoutMode')"
                :hint="$t('settings.layoutModeHint')"
              >
                <URadioGroup
                  v-model="layoutMode"
                  :items="[
                    { label: $t('settings.auto'), value: 'auto' },
                    { label: $t('settings.desktop'), value: 'desktop' },
                    { label: $t('settings.mobile'), value: 'mobile' },
                  ]"
                />
              </UFormField>
            </section>

            <section class="space-y-4">
              <h3 class="text-sm font-bold text-muted uppercase tracking-wider">
                {{ $t('settings.editor') }}
              </h3>
              <UFormField
                :label="$t('settings.autosaveDebounce')"
                :hint="$t('settings.autosaveDebounceHint')"
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
                {{ $t('settings.storage') }}
              </h3>
              <UFormField :label="$t('settings.configPath')">
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
                {{ $t('settings.git') }}
              </h3>
              <UFormField
                :label="$t('settings.defaultCommitDebounce')"
                :hint="$t('settings.defaultCommitDebounceHint')"
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
                :label="$t('settings.authorName')"
                :hint="detectedHint"
              >
                <UInput
                  v-model="authorName"
                  :placeholder="$t('settings.authorHint')"
                  class="w-full"
                />
              </UFormField>

              <UFormField :label="$t('settings.authorEmail')">
                <UInput
                  v-model="authorEmail"
                  type="email"
                  :placeholder="$t('settings.authorHint')"
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
        :label="$t('settings.close')"
        @click="open = false"
      />
    </template>
  </UModal>
</template>
