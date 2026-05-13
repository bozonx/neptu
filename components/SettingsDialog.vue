<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })

const settingsStore = useSettingsStore()
const { t } = useI18n()

const plugins = usePluginsStore()
const draft = useSettingsDialogDraft(open)
const activeTab = computed({
  get: () => settingsStore.settingsDialogTab,
  set: (val) => { settingsStore.settingsDialogTab = val },
})

const builtInTabs = computed(() => [
  { label: t('settings.general'), value: 'general', icon: 'i-lucide-settings' },
  { label: t('settings.appearance'), value: 'appearance', icon: 'i-lucide-palette' },
  { label: t('settings.git'), value: 'git', icon: 'i-lucide-git-branch' },
  { label: t('settings.plugins'), value: 'plugins', icon: 'i-lucide-plug' },
])

const allTabs = computed(() => [
  ...builtInTabs.value,
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
          <SettingsGeneralPanel
            v-if="activeTab === 'general'"
            v-model:locale="draft.locale.value"
            v-model:confirm-delete-local="draft.confirmDeleteLocal.value"
            v-model:confirm-delete-git="draft.confirmDeleteGit.value"
            v-model:use-trash="draft.useTrash.value"
            v-model:autosave-sec="draft.autosaveSec.value"
            v-model:new-main-path="draft.newMainPath.value"
            v-model:daily-notes-path="draft.dailyNotesPath.value"
            :main-repo-path="settingsStore.mainRepoPath"
            :config-path="draft.configPath.value"
            @browse-main-folder="draft.browseMainFolder"
            @submit-change-main-repo="draft.submitChangeMainRepo"
            @copy-config-path="draft.copyConfigPath"
          />

          <SettingsAppearancePanel
            v-else-if="activeTab === 'appearance'"
            v-model:layout-mode="draft.layoutMode.value"
            v-model:theme="draft.theme.value"
            v-model:tab-display-mode="draft.tabDisplayMode.value"
            @toggle-layout-mode="draft.toggleLayoutMode"
          />

          <SettingsGitPanel
            v-else-if="activeTab === 'git'"
            v-model:default-commit-mode="draft.defaultCommitMode.value"
            v-model:commit-sec="draft.commitSec.value"
            v-model:author-name="draft.authorName.value"
            v-model:author-email="draft.authorEmail.value"
            v-model:git-auto-message="draft.gitAutoMessage.value"
            v-model:git-auto-message-template="draft.gitAutoMessageTemplate.value"
            :detected-hint="draft.detectedHint.value"
          />

          <SettingsPluginsPanel
            v-else-if="activeTab === 'plugins'"
          />

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
