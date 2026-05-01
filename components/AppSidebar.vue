<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const settings = useSettingsStore()
const vaults = useVaultsStore()
const tabs = useTabsStore()
const plugins = usePluginsStore()
const { t } = useI18n()

const dialogs = useSidebarDialogs()

useAutoReveal()

function toggleLeftSidebarMode() {
  tabs.updateLeftSidebarMode(tabs.leftSidebarMode === 'single' ? 'dual' : 'single')
}

const contextMenuItems = computed<DropdownMenuItem[][]>(() => [
  [
    { label: t('sidebar.addLocalVault'), icon: 'i-lucide-folder-plus', onSelect: () => { dialogs.addLocalVaultOpen.value = true } },
    { label: t('sidebar.addGitVault'), icon: 'i-lucide-git-branch', onSelect: () => { dialogs.addGitVaultOpen.value = true } },
    { label: t('sidebar.createGroup'), icon: 'i-lucide-folder-plus', onSelect: () => dialogs.openCreateGroup() },
  ],
  [
    {
      label: settings.settings.showHiddenFiles ? t('sidebar.hideHiddenFiles') : t('sidebar.showHiddenFiles'),
      icon: settings.settings.showHiddenFiles ? 'i-lucide-eye-off' : 'i-lucide-eye',
      onSelect: async () => {
        settings.settings.showHiddenFiles = !settings.settings.showHiddenFiles
        await settings.persist()
        await vaults.refreshAllTrees()
      },
    },
  ],
])
</script>

<template>
  <div class="flex flex-col h-full bg-default">
    <SettingsDialog v-model:open="settings.settingsDialogOpen" />

    <!-- Panel switcher toolbar -->
    <div class="flex items-center gap-0.5 px-1 h-9 border-b border-default shrink-0">
      <UButton
        icon="i-lucide-files"
        size="xs"
        color="neutral"
        variant="ghost"
        :class="{ 'bg-primary/10 text-primary': tabs.leftSidebarTab === 'files' && !plugins.resolvedActiveLeftSidebarView }"
        :title="$t('sidebar.files')"
        @click="tabs.leftSidebarTab = 'files'; plugins.setActiveLeftSidebarView(null)"
      />
      <UButton
        icon="i-lucide-search"
        size="xs"
        color="neutral"
        variant="ghost"
        :class="{ 'bg-primary/10 text-primary': tabs.leftSidebarTab === 'search' && !plugins.resolvedActiveLeftSidebarView }"
        :title="$t('sidebar.search')"
        @click="tabs.leftSidebarTab = 'search'; plugins.setActiveLeftSidebarView(null)"
      />
      <UButton
        v-if="settings.settings.useTrash && vaults.list.some((v) => v.type === 'local')"
        icon="i-lucide-trash-2"
        size="xs"
        color="neutral"
        variant="ghost"
        :class="{ 'bg-primary/10 text-primary': tabs.leftSidebarTab === 'trash' && !plugins.resolvedActiveLeftSidebarView }"
        :title="$t('sidebar.trash')"
        @click="tabs.leftSidebarTab = 'trash'; plugins.setActiveLeftSidebarView(null)"
      />
      <UButton
        icon="i-lucide-calendar-days"
        size="xs"
        color="neutral"
        variant="ghost"
        :class="{ 'bg-primary/10 text-primary': tabs.leftSidebarTab === 'dailyNotes' && !plugins.resolvedActiveLeftSidebarView }"
        :title="$t('sidebar.dailyNotes')"
        @click="tabs.leftSidebarTab = 'dailyNotes'; plugins.setActiveLeftSidebarView(null)"
      />
      <UButton
        v-for="view in plugins.sortedLeftSidebarViews"
        :key="view.fqid"
        :icon="view.icon"
        size="xs"
        color="neutral"
        variant="ghost"
        :class="{ 'bg-primary/10 text-primary': plugins.activeLeftSidebarView === view.fqid }"
        :title="view.title"
        @click="plugins.setActiveLeftSidebarView(view.fqid)"
      />
    </div>

    <!-- Content area -->
    <div class="flex-1 overflow-hidden flex flex-col min-h-0">
      <template v-if="!plugins.resolvedActiveLeftSidebarView">
        <template v-if="tabs.leftSidebarTab === 'search'">
          <SearchPanel class="flex-1 overflow-hidden" />
        </template>
        <template v-else-if="tabs.leftSidebarTab === 'trash'">
          <TrashPanel class="flex-1 overflow-hidden" />
        </template>
        <template v-else-if="tabs.leftSidebarTab === 'dailyNotes'">
          <DailyNotesTree class="flex-1 overflow-hidden" />
        </template>
        <template v-else>
          <UContextMenu
            :items="contextMenuItems"
            :modal="false"
            class="flex-1 overflow-hidden flex flex-col min-h-0"
          >
            <div class="flex-1 flex flex-col min-h-0 w-full relative">
              <SidebarSingleColumn
                v-if="tabs.leftSidebarMode === 'single'"
                @create-note="dialogs.openCreateNote"
                @create-folder="dialogs.openCreateFolder"
                @rename-node="dialogs.openRenameNode"
                @edit-vault="dialogs.openEditVault"
                @remove-vault="dialogs.openRemoveVaultConfirm"
                @create-group="dialogs.openCreateGroup"
                @rename-group="dialogs.openRenameGroup"
                @remove-group="dialogs.openRemoveGroupConfirm"
              />

              <SidebarDualColumn
                v-else
                @create-note="dialogs.openCreateNote"
                @create-folder="dialogs.openCreateFolder"
                @rename-node="dialogs.openRenameNode"
                @edit-vault="dialogs.openEditVault"
                @remove-vault="dialogs.openRemoveVaultConfirm"
              />

              <SidebarFooter
                @add-local-vault="dialogs.addLocalVaultOpen.value = true"
                @add-git-vault="dialogs.addGitVaultOpen.value = true"
                @create-group="dialogs.openCreateGroup"
                @toggle-mode="toggleLeftSidebarMode"
              />
            </div>
          </UContextMenu>
        </template>
      </template>
      <component
        :is="plugins.resolvedActiveLeftSidebarView.component"
        v-else
        class="flex-1 overflow-hidden"
      />
    </div>

    <!-- All dialogs -->
    <SidebarDialogs :ctx="dialogs" />
  </div>
</template>
