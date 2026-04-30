<script setup lang="ts">
import type { AppSettings, GitAuthor } from '~/types'

const open = defineModel<boolean>('open', { required: true })

const settingsStore = useSettingsStore()
const toast = useToast()
const { t } = useI18n()

const plugins = usePluginsStore()
const activeTab = computed({
  get: () => settingsStore.settingsDialogTab,
  set: (val) => { settingsStore.settingsDialogTab = val },
})

const builtInTabs = [
  { label: t('settings.general'), value: 'general', icon: 'i-lucide-settings' },
  { label: t('settings.appearance'), value: 'appearance', icon: 'i-lucide-palette' },
  { label: t('settings.git'), value: 'git', icon: 'i-lucide-git-branch' },
  { label: t('settings.plugins'), value: 'plugins', icon: 'i-lucide-plug' },
]

const allTabs = computed(() => [
  ...builtInTabs,
  ...plugins.sortedSettingsTabs.map((t) => ({
    label: t.label,
    value: t.fqid,
    icon: t.icon,
    component: t.component,
  })),
])

const activePluginTab = computed(() =>
  plugins.sortedSettingsTabs.find((t) => t.fqid === activeTab.value),
)

const { builtinPlugins } = await import('~/app-plugins')

function isPluginEnabled(pluginId: string) {
  return (settingsStore.settings.enabledPlugins ?? []).includes(pluginId)
}

async function togglePlugin(pluginId: string, enabled: boolean) {
  const list = new Set(settingsStore.settings.enabledPlugins ?? [])
  if (enabled) {
    list.add(pluginId)
    const plugin = builtinPlugins.find((p) => p.manifest.id === pluginId)
    if (plugin) await plugins.load(plugin)
  }
  else {
    list.delete(pluginId)
    await plugins.unload(pluginId)
  }
  await settingsStore.updateSettings({ enabledPlugins: Array.from(list) })
}

const autosaveSec = ref(0)
const commitSec = ref(0)
const authorName = ref('')
const authorEmail = ref('')
const layoutMode = ref<AppSettings['layoutMode']>('desktop')
const theme = ref<AppSettings['theme']>('system')
const locale = ref<AppSettings['locale']>('auto')
const tabDisplayMode = ref<AppSettings['tabDisplayMode']>('single_line')
const defaultCommitMode = ref<AppSettings['defaultCommitMode']>('auto')
const confirmDeleteLocal = ref(true)
const confirmDeleteGit = ref(true)
const gitAutoMessage = ref(true)
const gitAutoMessageTemplate = ref('')
const detectedAuthor = ref<GitAuthor | null>(null)
const configPath = ref('')
const newMainPath = ref('')

const localeItems = [
  { label: t('settings.auto'), value: 'auto' },
  { label: 'English', value: 'en-US' },
  { label: 'Русский', value: 'ru-RU' },
]

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
  tabDisplayMode.value = s.tabDisplayMode
  defaultCommitMode.value = s.defaultCommitMode
  confirmDeleteLocal.value = s.confirmDeleteLocal
  confirmDeleteGit.value = s.confirmDeleteGit
  gitAutoMessage.value = s.gitAutoMessage ?? true
  gitAutoMessageTemplate.value = s.gitAutoMessageTemplate ?? 'Update notes ({files} {fileWord})'
  newMainPath.value = ''
  try {
    const git = useGit()
    detectedAuthor.value = await git.globalAuthor()
    const config = useConfig()
    configPath.value = await config.getInstanceConfigPath()
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
    await settingsStore.setMainRepo(newMainPath.value)
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

async function toggleLayoutMode() {
  layoutMode.value = layoutMode.value === 'desktop' ? 'mobile' : 'desktop'
  await save()
  open.value = false
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
      defaultCommitDebounceMs: Math.max(1000, Math.round(commitSec.value * 1000)),
      gitAuthorName: authorName.value.trim(),
      gitAuthorEmail: authorEmail.value.trim(),
      layoutMode: layoutMode.value,
      theme: theme.value,
      locale: locale.value,
      tabDisplayMode: tabDisplayMode.value,
      defaultCommitMode: defaultCommitMode.value,
      confirmDeleteLocal: confirmDeleteLocal.value,
      confirmDeleteGit: confirmDeleteGit.value,
      gitAutoMessage: gitAutoMessage.value,
      gitAutoMessageTemplate: gitAutoMessageTemplate.value,
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
  [autosaveSec, commitSec, authorName, authorEmail, theme, locale, tabDisplayMode, defaultCommitMode, confirmDeleteLocal, confirmDeleteGit, gitAutoMessage, gitAutoMessageTemplate],
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
    :title="$t('settings.title')"
    :description="$t('settings.description')"
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
            v-for="tab in allTabs"
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
                {{ $t('settings.interface') }}
              </h3>
              <UFormField :label="$t('settings.language')">
                <USelect
                  v-model="locale"
                  :items="localeItems"
                  class="w-48"
                />
              </UFormField>
            </section>

            <section class="space-y-4">
              <h3 class="text-sm font-bold text-muted uppercase tracking-wider">
                {{ $t('settings.safety') }}
              </h3>
              <UFormField :hint="$t('settings.confirmDeleteHint')">
                <div class="flex flex-col gap-2">
                  <label class="flex items-center gap-2">
                    <USwitch v-model="confirmDeleteLocal" />
                    <span class="text-sm">{{ $t('settings.confirmDeleteLocal') }}</span>
                  </label>
                  <label class="flex items-center gap-2">
                    <USwitch v-model="confirmDeleteGit" />
                    <span class="text-sm">{{ $t('settings.confirmDeleteGit') }}</span>
                  </label>
                </div>
              </UFormField>
            </section>

            <section class="space-y-4">
              <h3 class="text-sm font-bold text-muted uppercase tracking-wider">
                {{ $t('settings.editor') }}
              </h3>
              <UFormField :label="$t('settings.autosaveDebounce')">
                <UInput
                  v-model="autosaveSec"
                  type="number"
                  :min="0.1"
                  :step="0.1"
                  class="w-32"
                  :title="$t('settings.autosaveDebounceHint')"
                />
              </UFormField>
            </section>

            <section class="space-y-4">
              <h3 class="text-sm font-bold text-muted uppercase tracking-wider">
                {{ $t('settings.mainVault') }}
              </h3>
              <UFormField :label="$t('settings.currentFolder')">
                <div class="flex items-center gap-2">
                  <UInput
                    :model-value="newMainPath || settingsStore.mainRepoPath || ''"
                    readonly
                    class="flex-1 text-xs"
                  />
                  <UButton
                    icon="i-lucide-folder-search"
                    :label="$t('vault.browse')"
                    size="sm"
                    @click="browseMainFolder"
                  />
                  <UButton
                    :label="$t('settings.change')"
                    size="sm"
                    :disabled="!newMainPath"
                    @click="submitChangeMainRepo"
                  />
                </div>
              </UFormField>
              <p class="text-xs text-muted mt-1">
                {{ $t('settings.currentFolderHint') }}
              </p>
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
              <div class="text-xs text-muted space-y-1">
                <p>{{ $t('settings.storageInfo1') }}</p>
                <p>{{ $t('settings.storageInfo2') }}</p>
              </div>
            </section>
          </div>

          <!-- Appearance Tab -->
          <div
            v-else-if="activeTab === 'appearance'"
            class="space-y-8"
          >
            <section class="space-y-4">
              <h3 class="text-sm font-bold text-muted uppercase tracking-wider">
                {{ $t('settings.appearance') }}
              </h3>
              <UFormField :label="$t('settings.theme')">
                <URadioGroup
                  v-model="theme"
                  orientation="horizontal"
                  :items="[
                    { label: $t('settings.system'), value: 'system' },
                    { label: $t('settings.light'), value: 'light' },
                    { label: $t('settings.dark'), value: 'dark' },
                  ]"
                />
                <p class="text-xs text-muted mt-1">
                  {{ $t('settings.themeHint') }}
                </p>
              </UFormField>

              <UFormField :label="$t('settings.layoutMode')">
                <UButton
                  size="sm"
                  :label="layoutMode === 'desktop' ? $t('settings.switchToMobile') : $t('settings.switchToDesktop')"
                  @click="toggleLayoutMode"
                />
              </UFormField>

              <UFormField :label="$t('settings.tabDisplayMode')">
                <URadioGroup
                  v-model="tabDisplayMode"
                  orientation="horizontal"
                  :items="[
                    { label: $t('settings.tabDisplaySingleLine'), value: 'single_line' },
                    { label: $t('settings.tabDisplayMultiLine'), value: 'multi_line' },
                    { label: $t('settings.tabDisplayLeftVertical'), value: 'left_vertical' },
                  ]"
                />
                <p class="text-xs text-muted mt-1">
                  {{ $t('settings.tabDisplayModeHint') }}
                </p>
              </UFormField>
            </section>
          </div>

          <!-- Git Tab -->
          <div
            v-else-if="activeTab === 'git'"
            class="space-y-8"
          >
            <section class="space-y-4">
              <h3 class="text-sm font-bold text-muted uppercase tracking-wider">
                {{ $t('settings.git') }}
              </h3>
              <UFormField :label="$t('settings.defaultCommitMode')">
                <ButtonGroupToggle
                  v-model="defaultCommitMode"
                  :items="[
                    { label: $t('vault.autoCommit'), value: 'auto' },
                    { label: $t('vault.manualCommit'), value: 'manual' },
                  ]"
                />
                <p class="text-xs text-muted mt-1">
                  {{ $t('settings.defaultCommitModeHint') }}
                </p>
              </UFormField>

              <UFormField :label="$t('settings.defaultCommitDebounce')">
                <UInput
                  v-model="commitSec"
                  type="number"
                  :min="1"
                  :step="0.5"
                  class="w-32"
                />
                <p class="text-xs text-muted mt-1">
                  {{ $t('settings.defaultCommitDebounceHint') }}
                </p>
              </UFormField>

              <UFormField :label="$t('settings.authorName')">
                <UInput
                  v-model="authorName"
                  :placeholder="$t('settings.authorHint')"
                  class="w-full"
                />
                <p class="text-xs text-muted mt-1">
                  {{ detectedHint }}
                </p>
              </UFormField>

              <UFormField :label="$t('settings.authorEmail')">
                <UInput
                  v-model="authorEmail"
                  type="email"
                  :placeholder="$t('settings.authorHint')"
                  class="w-full"
                />
                <p class="text-xs text-muted mt-1">
                  {{ $t('settings.authorHint') }}
                </p>
              </UFormField>

              <UFormField :label="$t('settings.gitAutoMessage')">
                <USwitch v-model="gitAutoMessage" />
                <p class="text-xs text-muted mt-1">
                  {{ $t('settings.gitAutoMessageHint') }}
                </p>
              </UFormField>

              <UFormField :label="$t('git.gitAutoMessageTemplate')">
                <UInput
                  v-model="gitAutoMessageTemplate"
                  :placeholder="'Update notes ({files} {fileWord})'"
                  class="w-full"
                />
                <p class="text-xs text-muted mt-1">
                  {{ $t('git.gitAutoMessageTemplateHint') }}
                </p>
              </UFormField>
            </section>
          </div>

          <!-- Plugins Tab -->
          <div
            v-else-if="activeTab === 'plugins'"
            class="space-y-6"
          >
            <section>
              <h3 class="text-sm font-bold text-muted uppercase tracking-wider mb-4">
                {{ $t('settings.systemPlugins') }}
              </h3>
              <div class="space-y-3">
                <div
                  v-for="plugin in builtinPlugins"
                  :key="plugin.manifest.id"
                  class="flex items-center justify-between p-3 rounded-lg border border-default bg-elevated/30"
                >
                  <div>
                    <div class="font-medium text-sm">
                      {{ plugin.manifest.name }}
                    </div>
                    <div class="text-xs text-muted">
                      {{ plugin.manifest.description }}
                    </div>
                  </div>
                  <USwitch
                    :model-value="isPluginEnabled(plugin.manifest.id)"
                    @update:model-value="(v) => togglePlugin(plugin.manifest.id, v)"
                  />
                </div>
              </div>
            </section>
          </div>

          <!-- Plugin Tab -->
          <component
            :is="activePluginTab?.component"
            v-else-if="activePluginTab"
          />
        </main>
      </div>
    </template>
  </UModal>
</template>
