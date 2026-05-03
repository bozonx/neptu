<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { FileSortMode } from '~/types'

const emit = defineEmits<{
  addLocalVault: []
  addGitVault: []
  createGroup: []
  toggleMode: []
}>()

const settings = useSettingsStore()
const vaults = useVaultsStore()
const tabs = useTabsStore()
const { t } = useI18n()

const sortModes: { label: string, value: FileSortMode, icon: string }[] = [
  { label: t('sidebar.sortNameAsc'), value: 'nameAsc', icon: 'i-lucide-arrow-up-a-z' },
  { label: t('sidebar.sortNameDesc'), value: 'nameDesc', icon: 'i-lucide-arrow-down-z-a' },
  { label: t('sidebar.sortMtimeDesc'), value: 'mtimeDesc', icon: 'i-lucide-arrow-down-narrow-wide' },
  { label: t('sidebar.sortMtimeAsc'), value: 'mtimeAsc', icon: 'i-lucide-arrow-up-narrow-wide' },
  { label: t('sidebar.sortBirthtimeDesc'), value: 'birthtimeDesc', icon: 'i-lucide-calendar-arrow-down' },
  { label: t('sidebar.sortBirthtimeAsc'), value: 'birthtimeAsc', icon: 'i-lucide-calendar-arrow-up' },
]

const sortMenuItems = computed<DropdownMenuItem[][]>(() => [
  sortModes.map((m) => ({
    label: m.label,
    icon: settings.settings.fileSortMode === m.value ? 'i-lucide-check' : m.icon,
    onSelect: () => changeSortMode(m.value),
  })),
])

async function changeSortMode(mode: FileSortMode) {
  settings.settings.fileSortMode = mode
  await settings.persist()
  await vaults.refreshAllTrees()
}

const addMenuItems = [
  [
    { label: t('sidebar.addLocalVault'), icon: 'i-lucide-folder-plus', onSelect: () => emit('addLocalVault') },
    { label: t('sidebar.addGitVault'), icon: 'i-lucide-git-branch', onSelect: () => emit('addGitVault') },
    { label: t('sidebar.createGroup'), icon: 'i-lucide-folder-plus', onSelect: () => emit('createGroup') },
  ],
] satisfies DropdownMenuItem[][]
</script>

<template>
  <div class="flex items-center gap-1 p-2 border-t border-default shrink-0 z-10 bg-default">
    <div class="flex-1 flex items-center gap-1">
      <UDropdownMenu
        :items="addMenuItems"
        :modal="false"
        :content="{ side: 'top' }"
      >
        <UButton
          icon="i-lucide-plus"
          size="xs"
          color="success"
          variant="ghost"
          :title="$t('sidebar.addVaultBtn')"
        />
      </UDropdownMenu>
      <UDropdownMenu
        :items="sortMenuItems"
        :modal="false"
        :content="{ side: 'top' }"
      >
        <UButton
          icon="i-lucide-arrow-up-down"
          size="xs"
          color="neutral"
          variant="ghost"
          :title="$t('sidebar.sortBy')"
        />
      </UDropdownMenu>
      <UButton
        :icon="tabs.expandAllActive ? 'i-lucide-folder-closed' : 'i-lucide-folder-open'"
        size="xs"
        color="neutral"
        variant="ghost"
        :title="tabs.expandAllActive ? $t('sidebar.collapseAll') : $t('sidebar.expandAll')"
        @click="tabs.toggleExpandAll()"
      />
      <UButton
        :icon="tabs.autoRevealFile ? 'i-lucide-eye' : 'i-lucide-eye-off'"
        size="xs"
        :color="tabs.autoRevealFile ? 'primary' : 'neutral'"
        variant="ghost"
        :title="$t('sidebar.autoRevealFile')"
        @click="tabs.toggleAutoReveal()"
      />
      <PluginButtons location="left-sidebar-footer" />
    </div>
    <UButton
      :icon="tabs.leftSidebarMode === 'single' ? 'i-lucide-columns-2' : 'i-lucide-panel-left'"
      size="xs"
      color="neutral"
      variant="ghost"
      :title="tabs.leftSidebarMode === 'single' ? $t('sidebar.enableDualColumn') : $t('sidebar.disableDualColumn')"
      @click="emit('toggleMode')"
    />
  </div>
</template>
