<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { ContentType, FileSortMode, GitCommitMode, SiteLangMode, Vault, VaultType, VaultGroup } from '~/types'
import { Splitpanes, Pane } from 'splitpanes'

const settings = useSettingsStore()
const vaults = useVaultsStore()
const editor = useEditorStore()
const git = useGitStore()
const tabs = useTabsStore()
const plugins = usePluginsStore()
const dnd = useDnd()
const toast = useToast()
const { t } = useI18n()

watchEffect(() => {
  const selectedVaultId = tabs.leftSidebarDualSelectedVaultId
  const selectedVaultExists = selectedVaultId ? Boolean(vaults.findById(selectedVaultId)) : false

  if (tabs.leftSidebarDualShowFavorites) return

  if (selectedVaultExists) return

  if (vaults.list.length === 0) {
    if (selectedVaultId !== null) {
      void tabs.updateLeftSidebarDualState(null, false)
    }
    return
  }

  const main = vaults.list.find((v) => v.path === settings.mainRepoPath)
  const fallbackVaultId = main?.id ?? vaults.list[0]?.id ?? null
  if (selectedVaultId !== fallbackVaultId) {
    void tabs.updateLeftSidebarDualState(fallbackVaultId, false)
  }
})

function handleDualResize(event: Array<{ pane: number, size: number }>) {
  if (event.length === 2 && event[0] !== undefined) {
    tabs.updateLeftSidebarDualFirstColumnSize(event[0].size)
  }
}

function toggleLeftSidebarMode() {
  tabs.updateLeftSidebarMode(tabs.leftSidebarMode === 'single' ? 'dual' : 'single')
}

const addLocalVaultOpen = ref(false)
const addGitVaultOpen = ref(false)
const newVaultName = ref('')
const newVaultType = ref<VaultType>('local')
const newVaultPath = ref<string | null>(null)
const newGitMode = ref<'connect' | 'init'>('connect')
const newCommitMode = ref<GitCommitMode>('respect_config')
const newCommitDebounceSec = ref(5)
const newContentType = ref<ContentType>('vault')
const newContentFolder = ref('src')
const newSiteLangMode = ref<SiteLangMode>('monolingual')

const newNoteOpen = ref(false)
const newNoteName = ref('')
const newNoteCtx = ref<{ vault: Vault, dir: string } | null>(null)

const newFolderOpen = ref(false)
const newFolderName = ref('')
const newFolderCtx = ref<{ vault: Vault, dir: string } | null>(null)

const editVaultOpen = ref(false)
const editingVault = ref<Vault | null>(null)

const removeVaultConfirmOpen = ref(false)
const removeVaultConfirmTarget = ref<Vault | null>(null)
const removeVaultClearSettings = ref(false)

const createGroupOpen = ref(false)
const newGroupName = ref('')
const renameGroupOpen = ref(false)
const renameGroupTarget = ref<VaultGroup | null>(null)
const renameGroupName = ref('')
const removeGroupConfirmOpen = ref(false)
const removeGroupConfirmTarget = ref<VaultGroup | null>(null)

const mainVault = computed(() => vaults.list.find((v) => v.path === settings.mainRepoPath))
const otherUngroupedVaults = computed(() =>
  vaults.list.filter((v) => !v.groupId && v.path !== settings.mainRepoPath),
)
function vaultsInGroup(groupId: string) {
  return vaults.list.filter((v) => v.groupId === groupId)
}

const gitModeItems = [
  { label: t('vault.connectExisting'), value: 'connect' as const },
  { label: t('vault.initNew'), value: 'init' as const },
]

const commitModeItems = [
  { label: t('vault.respectConfigCommit'), value: 'respect_config' as const },
  { label: t('vault.autoCommit'), value: 'auto' as const },
  { label: t('vault.manualCommit'), value: 'manual' as const },
]

const showCommitDebounce = computed(() =>
  newCommitMode.value === 'auto'
  || (newCommitMode.value === 'respect_config' && settings.settings.defaultCommitMode === 'auto'),
)

const contentTypeItems = [
  { label: t('vault.contentTypeVault'), value: 'vault' as const },
  { label: t('vault.contentTypeBlog'), value: 'blog' as const },
  { label: t('vault.contentTypeSiteLanding'), value: 'site' as const },
  { label: t('vault.contentTypeCustom'), value: 'custom' as const },
]

const siteLangModeItems = [
  { label: t('vault.siteLangMonolingual'), value: 'monolingual' as const },
  { label: t('vault.siteLangMultilingual'), value: 'multilingual' as const },
]

const addMenuItems = [
  [
    { label: t('sidebar.addLocalVault'), icon: 'i-lucide-folder-plus', onSelect: () => { addLocalVaultOpen.value = true } },
    { label: t('sidebar.addGitVault'), icon: 'i-lucide-git-branch', onSelect: () => { addGitVaultOpen.value = true } },
    { label: t('sidebar.createGroup'), icon: 'i-lucide-folder-plus', onSelect: () => openCreateGroup() },
  ],
] satisfies DropdownMenuItem[][]

const contextMenuItems = computed<DropdownMenuItem[][]>(() => [
  [
    { label: t('sidebar.addLocalVault'), icon: 'i-lucide-folder-plus', onSelect: () => { addLocalVaultOpen.value = true } },
    { label: t('sidebar.addGitVault'), icon: 'i-lucide-git-branch', onSelect: () => { addGitVaultOpen.value = true } },
    { label: t('sidebar.createGroup'), icon: 'i-lucide-folder-plus', onSelect: () => openCreateGroup() },
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

function resetAddForm(type: VaultType = 'local') {
  newVaultName.value = ''
  newVaultPath.value = null
  newVaultType.value = type
  newGitMode.value = 'connect'
  newCommitMode.value = 'respect_config'
  newCommitDebounceSec.value = settings.settings.defaultCommitDebounceMs / 1000
  newContentType.value = 'vault'
  newContentFolder.value = 'src'
  newSiteLangMode.value = 'monolingual'
}

watch(addLocalVaultOpen, (value) => {
  if (value) resetAddForm('local')
})

watch(addGitVaultOpen, (value) => {
  if (value) resetAddForm('git')
})

async function browseFolder() {
  try {
    const path = await useFs().pickDirectory({ title: 'Select vault folder' })
    if (path) newVaultPath.value = path
  }
  catch (error) {
    toast.add({ title: t('toast.cannotOpenDialog'), description: String(error), color: 'error' })
  }
}

async function submitNewVault() {
  if (!newVaultPath.value) return

  // Block git vault creation until an author is configured (in app settings or git's global config)
  if (newVaultType.value === 'git') {
    const author = await git.resolveAuthor()
    if (!author) {
      toast.add({
        title: t('toast.configureGitAuthor'),
        description: t('toast.gitAuthorHint'),
        color: 'warning',
      })
      settings.openSettingsDialog()
      return
    }
  }

  try {
    await vaults.addVault({
      name: newVaultName.value,
      type: newVaultType.value,
      path: newVaultPath.value,
      gitMode: newVaultType.value === 'git' ? newGitMode.value : undefined,
      git: newVaultType.value === 'git'
        ? {
            commitMode: newCommitMode.value,
            ...(newCommitMode.value !== 'respect_config' ? { commitDebounceMs: Math.max(0, Math.round(newCommitDebounceSec.value * 1000)) } : {}),
          }
        : undefined,
      contentType: newContentType.value,
      contentFolder: newContentType.value !== 'vault' ? newContentFolder.value : undefined,
      siteLangMode: newContentType.value === 'custom' ? newSiteLangMode.value : undefined,
    })
    addLocalVaultOpen.value = false
    addGitVaultOpen.value = false
    resetAddForm()
  }
  catch (error) {
    const isNotGitRepo = error instanceof Error && 'code' in error && (error as { code?: unknown }).code === 'NOT_GIT_REPO'
    toast.add({
      title: t('toast.addVaultFailed'),
      description: isNotGitRepo ? t('error.notGitRepo') : (error instanceof Error ? error.message : String(error)),
      color: 'error',
    })
  }
}

function openCreateNote(vault: Vault, dir?: string) {
  newNoteCtx.value = { vault, dir: dir ?? vaults.getEffectiveContentRoot(vault) }
  newNoteName.value = ''
  newNoteOpen.value = true
}

function openEditVault(vault: Vault) {
  editingVault.value = vault
  editVaultOpen.value = true
}

async function submitCreateNote() {
  if (!newNoteCtx.value || !newNoteName.value.trim()) return
  try {
    await editor.createNote({
      vault: newNoteCtx.value.vault,
      fileName: newNoteName.value.trim(),
      parentDir: newNoteCtx.value.dir,
    })
    newNoteOpen.value = false
  }
  catch (error) {
    toast.add({ title: t('toast.createNoteFailed'), description: String(error), color: 'error' })
  }
}

function openRemoveVaultConfirm(vault: Vault) {
  removeVaultConfirmTarget.value = vault
  removeVaultConfirmOpen.value = true
}

async function submitRemoveVault() {
  if (!removeVaultConfirmTarget.value) return
  try {
    await vaults.removeVault(removeVaultConfirmTarget.value.id, removeVaultClearSettings.value)
    removeVaultConfirmOpen.value = false
    removeVaultConfirmTarget.value = null
    removeVaultClearSettings.value = false
    // If the edit modal is open for the same vault, close it
    if (editingVault.value && !vaults.findById(editingVault.value.id)) {
      editVaultOpen.value = false
      editingVault.value = null
    }
  }
  catch (error) {
    toast.add({ title: t('toast.removeVaultFailed'), description: String(error), color: 'error' })
  }
}

function toggleGroup(group: VaultGroup) {
  tabs.expandedGroups[group.id] = !tabs.expandedGroups[group.id]
  void editor.saveUiState()
}

function openCreateGroup() {
  newGroupName.value = ''
  createGroupOpen.value = true
}

async function submitCreateGroup() {
  if (!newGroupName.value.trim()) return
  await vaults.addGroup(newGroupName.value.trim())
  createGroupOpen.value = false
}

function openRenameGroup(group: VaultGroup) {
  renameGroupTarget.value = group
  renameGroupName.value = group.name
  renameGroupOpen.value = true
}

async function submitRenameGroup() {
  if (!renameGroupTarget.value || !renameGroupName.value.trim()) return
  await vaults.renameGroup(renameGroupTarget.value.id, renameGroupName.value.trim())
  renameGroupOpen.value = false
  renameGroupTarget.value = null
}

function openRemoveGroupConfirm(group: VaultGroup) {
  removeGroupConfirmTarget.value = group
  removeGroupConfirmOpen.value = true
}

async function submitRemoveGroup() {
  if (!removeGroupConfirmTarget.value) return
  await vaults.removeGroup(removeGroupConfirmTarget.value.id)
  removeGroupConfirmOpen.value = false
  removeGroupConfirmTarget.value = null
}

function openCreateFolder(vault: Vault, dir?: string) {
  newFolderCtx.value = { vault, dir: dir ?? vaults.getEffectiveContentRoot(vault) }
  newFolderName.value = ''
  newFolderOpen.value = true
}

async function submitCreateFolder() {
  if (!newFolderCtx.value || !newFolderName.value.trim()) return
  try {
    await vaults.createVaultFolder(newFolderCtx.value.vault, newFolderCtx.value.dir, newFolderName.value.trim())
    newFolderOpen.value = false
  }
  catch (error) {
    toast.add({ title: t('toast.createFolderFailed'), description: String(error), color: 'error' })
  }
}

const singleUngroupedDropTarget = ref(false)
const singleGroupDropTargetId = ref<string | null>(null)
const dualFavoritesDropTarget = ref(false)
const dualVaultDropTargetId = ref<string | null>(null)

function toggleVault(vault: Vault) {
  tabs.expandedVaults[vault.id] = !tabs.expandedVaults[vault.id]
  void editor.saveUiState()
}

function toggleFolder(path: string) {
  tabs.expandedFolders[path] = !tabs.expandedFolders[path]
  void editor.saveUiState()
}

function isFileDrag() {
  return Boolean(dnd.draggedPath.value)
}

function isFavoriteCandidate() {
  return isFileDrag() && !dnd.draggedIsDir.value
}

function isVaultCardDraggable(vault: Vault) {
  return vault.path !== settings.mainRepoPath
}

function openDualFavoritesDrop(event: DragEvent) {
  if (!isFavoriteCandidate()) return
  event.preventDefault()
  void tabs.updateLeftSidebarDualState(null, true)
  dualFavoritesDropTarget.value = true
  dualVaultDropTargetId.value = null
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

function clearDualFavoritesDrop() {
  dualFavoritesDropTarget.value = false
}

async function dropToFavorites() {
  if (!isFavoriteCandidate() || !dnd.draggedPath.value) return

  dualFavoritesDropTarget.value = false

  try {
    await vaults.addFavorite(dnd.draggedPath.value)
  }
  catch (error) {
    toast.add({ title: t('toast.addFavoriteFailed', 'Failed to add favorite'), description: String(error), color: 'error' })
  }
  finally {
    dnd.onDragEnd()
  }
}

function openDualVaultDrop(event: DragEvent, vault: Vault) {
  if (!isFileDrag()) return
  event.preventDefault()
  dnd.updateCopyMode(event)
  dnd.handleAutoScroll(event)
  void tabs.updateLeftSidebarDualState(vault.id, false)
  dualVaultDropTargetId.value = vault.id
  dualFavoritesDropTarget.value = false
}

function clearDualVaultDrop(vaultId?: string) {
  if (!vaultId || dualVaultDropTargetId.value === vaultId) {
    dualVaultDropTargetId.value = null
  }
}

async function dropToVaultRoot(event: DragEvent, vault: Vault) {
  if (!isFileDrag() || !dnd.draggedPath.value) return

  dualVaultDropTargetId.value = null

  try {
    if (event.shiftKey) {
      await vaults.copyNode(dnd.draggedPath.value, vault.path)
    }
    else {
      await vaults.moveNode(dnd.draggedPath.value, vault.path)
    }
  }
  catch (error) {
    toast.add({ title: t('toast.moveFailed', 'Move failed'), description: String(error), color: 'error' })
  }
  finally {
    dnd.onDragEnd()
  }
}

function onUngroupedDragOver(event: DragEvent) {
  if (!dnd.draggedVaultId.value) return
  event.preventDefault()
  singleUngroupedDropTarget.value = true
  singleGroupDropTargetId.value = null
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function onUngroupedDragLeave() {
  singleUngroupedDropTarget.value = false
}

async function onUngroupedDrop() {
  if (!dnd.draggedVaultId.value) return

  singleUngroupedDropTarget.value = false

  try {
    await vaults.setVaultGroup(dnd.draggedVaultId.value, null)
  }
  catch (error) {
    toast.add({ title: t('toast.moveFailed', 'Move failed'), description: String(error), color: 'error' })
  }
  finally {
    dnd.onDragEnd()
  }
}

function onGroupDragOver(event: DragEvent, group: VaultGroup) {
  if (!dnd.draggedVaultId.value) return
  event.preventDefault()
  singleGroupDropTargetId.value = group.id
  singleUngroupedDropTarget.value = false
  tabs.expandedGroups[group.id] = true
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function onGroupDragLeave(groupId: string) {
  if (singleGroupDropTargetId.value === groupId) {
    singleGroupDropTargetId.value = null
  }
}

async function onGroupDrop(group: VaultGroup) {
  if (!dnd.draggedVaultId.value) return

  singleGroupDropTargetId.value = null

  try {
    await vaults.setVaultGroup(dnd.draggedVaultId.value, group.id)
  }
  catch (error) {
    toast.add({ title: t('toast.moveFailed', 'Move failed'), description: String(error), color: 'error' })
  }
  finally {
    dnd.onDragEnd()
  }
}
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

    <div class="flex-1 overflow-hidden flex flex-col min-h-0">
      <template v-if="!plugins.resolvedActiveLeftSidebarView">
        <template v-if="tabs.leftSidebarTab === 'search'">
          <SearchPanel class="flex-1 overflow-hidden" />
        </template>
        <template v-else>
          <UContextMenu
            :items="contextMenuItems"
            :modal="false"
            class="flex-1 overflow-hidden flex flex-col min-h-0"
          >
            <div class="flex-1 flex flex-col min-h-0 w-full relative">
              <div
                v-if="tabs.leftSidebarMode === 'single'"
                class="flex-1 overflow-auto p-2 min-h-0"
              >
                <div
                  v-if="vaults.favorites.length > 0"
                  class="mb-2"
                >
                  <div class="flex items-center gap-1.5 px-2 py-1 mb-1">
                    <UIcon
                      name="i-lucide-star"
                      class="size-3.5 text-primary shrink-0"
                    />
                    <span class="text-[10px] font-semibold text-muted uppercase tracking-wider">{{ $t('sidebar.favorites') }}</span>
                  </div>
                  <FavoritesList />
                </div>

                <div
                  class="rounded-lg transition-colors"
                  :class="singleUngroupedDropTarget ? 'bg-primary/10 ring-1 ring-inset ring-primary/40 p-1' : ''"
                  @dragover="onUngroupedDragOver"
                  @dragleave="onUngroupedDragLeave"
                  @drop="onUngroupedDrop"
                >
                  <div
                    v-if="vaults.list.length === 0"
                    class="text-sm text-muted px-2 py-4"
                  >
                    {{ $t('sidebar.noVaults') }}
                  </div>

                  <VaultSidebarItem
                    v-if="mainVault"
                    :key="mainVault.id"
                    class="mb-2"
                    :vault="mainVault"
                    :expanded="tabs.expandedVaults[mainVault.id] ?? (mainVault.path === settings.mainRepoPath)"
                    :nodes="vaults.trees[mainVault.id] ?? []"
                    :active-path="editor.currentFilePath"
                    :filters="mainVault.filters"
                    :expanded-folders="tabs.expandedFolders"
                    :allow-vault-drag="isVaultCardDraggable(mainVault)"
                    @toggle="toggleVault(mainVault)"
                    @toggle-folder="toggleFolder"
                    @create-note="(v, d) => openCreateNote(v, d)"
                    @create-folder="(v, d) => openCreateFolder(v, d)"
                    @edit-vault="(v) => openEditVault(v)"
                    @remove-vault="(v) => openRemoveVaultConfirm(v)"
                  />

                  <div
                    v-if="mainVault && otherUngroupedVaults.length"
                    class="my-2 border-t border-default"
                  />

                  <VaultSidebarItem
                    v-for="vault in otherUngroupedVaults"
                    :key="vault.id"
                    class="mb-2"
                    :vault="vault"
                    :expanded="tabs.expandedVaults[vault.id] ?? false"
                    :nodes="vaults.trees[vault.id] ?? []"
                    :active-path="editor.currentFilePath"
                    :filters="vault.filters"
                    :expanded-folders="tabs.expandedFolders"
                    :allow-vault-drag="isVaultCardDraggable(vault)"
                    @toggle="toggleVault(vault)"
                    @toggle-folder="toggleFolder"
                    @create-note="(v, d) => openCreateNote(v, d)"
                    @create-folder="(v, d) => openCreateFolder(v, d)"
                    @edit-vault="(v) => openEditVault(v)"
                    @remove-vault="(v) => openRemoveVaultConfirm(v)"
                  />
                </div>

                <div
                  v-for="group in vaults.groups"
                  :key="group.id"
                  class="mb-2"
                  @dragover="onGroupDragOver($event, group)"
                  @dragleave="onGroupDragLeave(group.id)"
                  @drop="onGroupDrop(group)"
                >
                  <UContextMenu
                    :items="[[
                      { label: $t('sidebar.renameGroup'), icon: 'i-lucide-pencil', onSelect: () => openRenameGroup(group) },
                      { label: $t('sidebar.ungroup'), icon: 'i-lucide-folder-x', color: 'error', onSelect: () => openRemoveGroupConfirm(group) },
                    ]]"
                    :modal="false"
                  >
                    <div
                      class="group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer bg-elevated/50 hover:ring-1 hover:ring-inset hover:ring-border/50"
                      :class="singleGroupDropTargetId === group.id ? 'bg-primary/10 ring-1 ring-inset ring-primary/40' : ''"
                      @click="toggleGroup(group)"
                    >
                      <UIcon
                        name="i-lucide-chevron-right"
                        class="size-4 text-muted shrink-0 transition-transform"
                        :class="{ 'rotate-90': tabs.expandedGroups[group.id] }"
                      />
                      <UIcon
                        name="i-lucide-folder-closed"
                        class="size-4 text-muted shrink-0"
                      />
                      <span class="truncate text-sm font-medium flex-1">{{ group.name }}</span>
                      <UDropdownMenu
                        :items="[[
                          { label: $t('sidebar.renameGroup'), icon: 'i-lucide-pencil', onSelect: () => openRenameGroup(group) },
                          { label: $t('sidebar.ungroup'), icon: 'i-lucide-folder-x', color: 'error', onSelect: () => openRemoveGroupConfirm(group) },
                        ]]"
                        :modal="false"
                        size="xs"
                      >
                        <UButton
                          icon="i-lucide-ellipsis-vertical"
                          size="xs"
                          color="neutral"
                          variant="ghost"
                          :title="$t('vault.more')"
                          @click.stop
                        />
                      </UDropdownMenu>
                    </div>
                  </UContextMenu>

                  <div
                    v-if="tabs.expandedGroups[group.id]"
                    class="pl-3 mt-1 space-y-1"
                  >
                    <VaultSidebarItem
                      v-for="vault in vaultsInGroup(group.id)"
                      :key="vault.id"
                      class="mb-2"
                      :vault="vault"
                      :expanded="tabs.expandedVaults[vault.id] ?? false"
                      :nodes="vaults.trees[vault.id] ?? []"
                      :active-path="editor.currentFilePath"
                      :filters="vault.filters"
                      :expanded-folders="tabs.expandedFolders"
                      :allow-vault-drag="isVaultCardDraggable(vault)"
                      @toggle="toggleVault(vault)"
                      @toggle-folder="toggleFolder"
                      @create-note="(v, d) => openCreateNote(v, d)"
                      @create-folder="(v, d) => openCreateFolder(v, d)"
                      @edit-vault="(v) => openEditVault(v)"
                      @remove-vault="(v) => openRemoveVaultConfirm(v)"
                    />
                  </div>
                </div>
              </div>

              <Splitpanes
                v-else
                class="flex-1"
                @resized="handleDualResize"
              >
                <Pane
                  :size="tabs.leftSidebarDualFirstColumnSize"
                  min-size="10"
                  max-size="60"
                  class="flex flex-col bg-default border-r border-default"
                >
                  <div class="flex-1 overflow-y-auto p-1 gap-1 flex flex-col min-h-0">
                    <!-- Favorites -->
                    <div
                      class="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer rounded-md hover:bg-elevated transition-colors"
                      :class="{
                        'bg-primary/10 text-primary ring-1 ring-inset ring-primary/30': tabs.leftSidebarDualShowFavorites,
                        'ring-1 ring-inset ring-primary/40 bg-primary/10': dualFavoritesDropTarget,
                      }"
                      :title="$t('sidebar.favorites')"
                      @click="tabs.updateLeftSidebarDualState(null, true)"
                      @dragover="openDualFavoritesDrop"
                      @dragleave="clearDualFavoritesDrop"
                      @drop="dropToFavorites"
                    >
                      <UIcon
                        name="i-lucide-star"
                        class="size-4 shrink-0"
                        :class="tabs.leftSidebarDualShowFavorites ? 'text-primary' : 'text-muted'"
                      />
                      <span class="truncate text-xs font-medium">{{ $t('sidebar.favorites') }}</span>
                    </div>

                    <div class="my-1 mx-2 border-t border-default shrink-0" />

                    <!-- Main Vault -->
                    <div
                      v-if="mainVault"
                      class="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer rounded-md hover:bg-elevated transition-colors"
                      :class="{
                        'bg-primary/10 text-primary ring-1 ring-inset ring-primary/30': tabs.leftSidebarDualSelectedVaultId === mainVault.id,
                        'ring-1 ring-inset ring-primary/40 bg-primary/10': dualVaultDropTargetId === mainVault.id,
                      }"
                      :title="mainVault.name"
                      @click="tabs.updateLeftSidebarDualState(mainVault.id, false)"
                      @dragover="openDualVaultDrop($event, mainVault)"
                      @dragleave="clearDualVaultDrop(mainVault.id)"
                      @drop="dropToVaultRoot($event, mainVault)"
                    >
                      <UIcon
                        name="i-lucide-folder-heart"
                        class="size-4 shrink-0"
                        :class="tabs.leftSidebarDualSelectedVaultId === mainVault.id ? 'text-primary' : 'text-primary/70'"
                      />
                      <span class="truncate text-xs font-medium">{{ mainVault.name }}</span>
                    </div>

                    <div
                      v-if="mainVault && otherUngroupedVaults.length"
                      class="my-1 mx-2 border-t border-default shrink-0"
                    />

                    <!-- Ungrouped Vaults -->
                    <div
                      v-for="vault in otherUngroupedVaults"
                      :key="vault.id"
                      class="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer rounded-md hover:bg-elevated transition-colors"
                      :class="{
                        'bg-primary/10 text-primary ring-1 ring-inset ring-primary/30': tabs.leftSidebarDualSelectedVaultId === vault.id,
                        'ring-1 ring-inset ring-primary/40 bg-primary/10': dualVaultDropTargetId === vault.id,
                      }"
                      :title="vault.name"
                      @click="tabs.updateLeftSidebarDualState(vault.id, false)"
                      @dragover="openDualVaultDrop($event, vault)"
                      @dragleave="clearDualVaultDrop(vault.id)"
                      @drop="dropToVaultRoot($event, vault)"
                    >
                      <UIcon
                        :name="vault.type === 'git' ? 'i-lucide-git-branch' : 'i-lucide-folder'"
                        class="size-4 shrink-0"
                        :class="tabs.leftSidebarDualSelectedVaultId === vault.id ? 'text-primary' : 'text-muted'"
                      />
                      <span class="truncate text-xs">{{ vault.name }}</span>
                    </div>

                    <!-- Groups -->
                    <template
                      v-for="group in vaults.groups"
                      :key="group.id"
                    >
                      <div
                        class="flex items-center gap-1 px-1 mt-2 mb-0.5 cursor-pointer group hover:opacity-100 opacity-70"
                        @click="toggleGroup(group)"
                      >
                        <UIcon
                          name="i-lucide-chevron-right"
                          class="size-3 text-muted shrink-0 transition-transform"
                          :class="{ 'rotate-90': tabs.expandedGroups[group.id] }"
                        />
                        <span class="text-[10px] font-semibold text-muted uppercase tracking-wider truncate flex-1">{{ group.name }}</span>
                      </div>

                      <template v-if="tabs.expandedGroups[group.id]">
                        <div
                          v-for="vault in vaultsInGroup(group.id)"
                          :key="vault.id"
                          class="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer rounded-md hover:bg-elevated transition-colors ml-2"
                          :class="{
                            'bg-primary/10 text-primary ring-1 ring-inset ring-primary/30': tabs.leftSidebarDualSelectedVaultId === vault.id,
                            'ring-1 ring-inset ring-primary/40 bg-primary/10': dualVaultDropTargetId === vault.id,
                          }"
                          :title="vault.name"
                          @click="tabs.updateLeftSidebarDualState(vault.id, false)"
                          @dragover="openDualVaultDrop($event, vault)"
                          @dragleave="clearDualVaultDrop(vault.id)"
                          @drop="dropToVaultRoot($event, vault)"
                        >
                          <UIcon
                            :name="vault.type === 'git' ? 'i-lucide-git-branch' : 'i-lucide-folder'"
                            class="size-4 shrink-0"
                            :class="tabs.leftSidebarDualSelectedVaultId === vault.id ? 'text-primary' : 'text-muted'"
                          />
                          <span class="truncate text-xs">{{ vault.name }}</span>
                        </div>
                      </template>
                    </template>
                  </div>
                </Pane>

                <Pane
                  :size="100 - tabs.leftSidebarDualFirstColumnSize"
                  class="flex flex-col min-w-0 bg-default relative p-2 overflow-y-auto"
                >
                  <template v-if="tabs.leftSidebarDualShowFavorites">
                    <div class="flex items-center gap-1.5 px-2 py-1 mb-1">
                      <UIcon
                        name="i-lucide-star"
                        class="size-3.5 text-primary shrink-0"
                      />
                      <span class="text-[10px] font-semibold text-muted uppercase tracking-wider">{{ $t('sidebar.favorites') }}</span>
                    </div>
                    <FavoritesList />
                  </template>
                  <template v-else-if="tabs.leftSidebarDualSelectedVaultId && vaults.findById(tabs.leftSidebarDualSelectedVaultId)">
                    <VaultSidebarItem
                      :key="tabs.leftSidebarDualSelectedVaultId"
                      :vault="vaults.findById(tabs.leftSidebarDualSelectedVaultId)!"
                      :expanded="true"
                      :nodes="vaults.trees[tabs.leftSidebarDualSelectedVaultId] ?? []"
                      :active-path="editor.currentFilePath"
                      :filters="vaults.findById(tabs.leftSidebarDualSelectedVaultId)!.filters"
                      :expanded-folders="tabs.expandedFolders"
                      @toggle="() => {}"
                      @toggle-folder="toggleFolder"
                      @create-note="(v, d) => openCreateNote(v, d)"
                      @create-folder="(v, d) => openCreateFolder(v, d)"
                      @edit-vault="(v) => openEditVault(v)"
                      @remove-vault="(v) => openRemoveVaultConfirm(v)"
                    />
                  </template>
                  <div
                    v-else
                    class="flex h-full items-center justify-center text-muted text-sm px-2 text-center"
                  >
                    {{ $t('sidebar.noVaultSelected', 'Select a vault to view contents') }}
                  </div>
                </Pane>
              </Splitpanes>

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
                  <PluginButtons location="left-sidebar-footer" />
                </div>
                <UButton
                  :icon="tabs.leftSidebarMode === 'single' ? 'i-lucide-panel-left' : 'i-lucide-columns'"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  title="Toggle dual column mode"
                  @click="toggleLeftSidebarMode()"
                />
              </div>
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

    <UModal
      v-model:open="addLocalVaultOpen"
      :title="$t('sidebar.addLocalVault')"
    >
      <template #body>
        <div class="space-y-3">
          <UFormField
            :label="$t('vault.name')"
            :hint="$t('vault.nameHint')"
          >
            <UInput
              v-model="newVaultName"
              :placeholder="$t('vault.myNotesPlaceholder')"
            />
          </UFormField>

          <UFormField :label="$t('vault.folder')">
            <div class="flex items-center gap-2">
              <UInput
                :model-value="newVaultPath ?? ''"
                readonly
                :placeholder="$t('vault.noFolderSelected')"
                class="flex-1"
              />
              <UButton
                icon="i-lucide-folder-search"
                :label="$t('vault.browse')"
                @click="browseFolder"
              />
            </div>
          </UFormField>

          <UFormField :label="$t('vault.contentType')">
            <ButtonGroupToggle
              v-model="newContentType"
              :items="contentTypeItems"
            />
          </UFormField>

          <p
            v-if="newContentType === 'vault'"
            class="text-xs text-muted"
          >
            {{ $t('vault.contentTypeVaultDesc') }}
          </p>

          <template v-if="newContentType === 'blog'">
            <p class="text-xs text-muted">
              {{ $t('vault.contentTypeBlogDesc') }}
            </p>
          </template>

          <template v-if="newContentType === 'custom'">
            <p class="text-xs text-muted">
              {{ $t('vault.contentTypeCustomDesc') }}
            </p>
            <UFormField :label="$t('vault.siteLangMode')">
              <URadioGroup
                v-model="newSiteLangMode"
                :items="siteLangModeItems"
              />
            </UFormField>
          </template>

          <UFormField
            v-if="newContentType !== 'vault'"
            :label="$t('vault.contentFolder')"
            :hint="$t('vault.contentFolderHint')"
          >
            <UInput v-model="newContentFolder" />
          </UFormField>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            :label="$t('vault.cancel')"
            @click="addLocalVaultOpen = false"
          />
          <UButton
            :label="$t('vault.add')"
            :disabled="!newVaultPath"
            @click="submitNewVault"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="addGitVaultOpen"
      :title="$t('sidebar.addGitVault')"
    >
      <template #body>
        <div class="space-y-3">
          <UFormField
            :label="$t('vault.name')"
            :hint="$t('vault.nameHint')"
          >
            <UInput
              v-model="newVaultName"
              :placeholder="$t('vault.myNotesPlaceholder')"
            />
          </UFormField>

          <UFormField :label="$t('vault.folder')">
            <div class="flex items-center gap-2">
              <UInput
                :model-value="newVaultPath ?? ''"
                readonly
                :placeholder="$t('vault.noFolderSelected')"
                class="flex-1"
              />
              <UButton
                icon="i-lucide-folder-search"
                :label="$t('vault.browse')"
                @click="browseFolder"
              />
            </div>
          </UFormField>

          <UFormField :label="$t('vault.repository')">
            <URadioGroup
              v-model="newGitMode"
              :items="gitModeItems"
            />
          </UFormField>

          <UFormField :label="$t('vault.commitMode')">
            <ButtonGroupToggle
              v-model="newCommitMode"
              :items="commitModeItems"
            />
          </UFormField>

          <UFormField
            v-if="showCommitDebounce"
            :label="$t('vault.commitDebounce')"
            :hint="$t('vault.commitDebounceHint')"
          >
            <UInput
              v-model="newCommitDebounceSec"
              type="number"
              :min="0"
              :step="0.5"
            />
          </UFormField>

          <UFormField :label="$t('vault.contentType')">
            <ButtonGroupToggle
              v-model="newContentType"
              :items="contentTypeItems"
            />
          </UFormField>

          <p
            v-if="newContentType === 'vault'"
            class="text-xs text-muted"
          >
            {{ $t('vault.contentTypeVaultDesc') }}
          </p>

          <template v-if="newContentType === 'blog'">
            <p class="text-xs text-muted">
              {{ $t('vault.contentTypeBlogDesc') }}
            </p>
          </template>

          <template v-if="newContentType === 'custom'">
            <p class="text-xs text-muted">
              {{ $t('vault.contentTypeCustomDesc') }}
            </p>
            <UFormField :label="$t('vault.siteLangMode')">
              <URadioGroup
                v-model="newSiteLangMode"
                :items="siteLangModeItems"
              />
            </UFormField>
          </template>

          <UFormField
            v-if="newContentType !== 'vault'"
            :label="$t('vault.contentFolder')"
            :hint="$t('vault.contentFolderHint')"
          >
            <UInput v-model="newContentFolder" />
          </UFormField>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            :label="$t('vault.cancel')"
            @click="addGitVaultOpen = false"
          />
          <UButton
            :label="$t('vault.add')"
            :disabled="!newVaultPath"
            @click="submitNewVault"
          />
        </div>
      </template>
    </UModal>

    <VaultSettingsDrawer
      v-model:open="editVaultOpen"
      :vault="editingVault"
      @close="editingVault = null"
      @remove="openRemoveVaultConfirm"
    />

    <UModal
      v-model:open="newFolderOpen"
      :title="$t('vault.newFolder')"
    >
      <template #body>
        <UFormField :label="$t('vault.folderName')">
          <UInput
            v-model="newFolderName"
            :placeholder="$t('vault.myFolderPlaceholder')"
            autofocus
          />
        </UFormField>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            :label="$t('vault.cancel')"
            @click="newFolderOpen = false"
          />
          <UButton
            :label="$t('vault.create')"
            :disabled="!newFolderName.trim()"
            @click="submitCreateFolder"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="removeVaultConfirmOpen"
      :title="$t('vault.removeVault')"
    >
      <template #body>
        <p class="text-sm">
          {{ $t('vault.removeVaultConfirm', { name: removeVaultConfirmTarget?.name }) }}
        </p>
        <p class="text-xs text-muted mt-1">
          {{ $t('vault.removeVaultHint') }}
        </p>
        <UFormField class="mt-3">
          <UCheckbox
            v-model="removeVaultClearSettings"
            :label="$t('vault.removeVaultClearSettings')"
          />
        </UFormField>
        <p class="text-xs text-muted mt-1">
          {{ $t('vault.removeVaultClearSettingsHint') }}
        </p>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            :label="$t('vault.cancel')"
            @click="removeVaultConfirmOpen = false"
          />
          <UButton
            color="error"
            :label="$t('vault.removeFromApp')"
            @click="submitRemoveVault"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="createGroupOpen"
      :title="$t('vault.createGroup')"
    >
      <template #body>
        <UFormField :label="$t('vault.groupName')">
          <UInput
            v-model="newGroupName"
            :placeholder="$t('vault.workVaultsPlaceholder')"
            autofocus
          />
        </UFormField>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            :label="$t('vault.cancel')"
            @click="createGroupOpen = false"
          />
          <UButton
            :label="$t('vault.create')"
            :disabled="!newGroupName.trim()"
            @click="submitCreateGroup"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="renameGroupOpen"
      :title="$t('sidebar.renameGroup')"
    >
      <template #body>
        <UFormField :label="$t('vault.groupName')">
          <UInput
            v-model="renameGroupName"
            :placeholder="$t('vault.workVaultsPlaceholder')"
            autofocus
          />
        </UFormField>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            :label="$t('vault.cancel')"
            @click="renameGroupOpen = false"
          />
          <UButton
            :label="$t('vault.save')"
            :disabled="!renameGroupName.trim()"
            @click="submitRenameGroup"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="removeGroupConfirmOpen"
      :title="$t('sidebar.ungroup')"
    >
      <template #body>
        <p class="text-sm">
          {{ $t('vault.deleteGroupConfirm', { name: removeGroupConfirmTarget?.name }) }}
        </p>
        <p class="text-xs text-muted mt-1">
          {{ $t('vault.deleteGroupHint') }}
        </p>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            :label="$t('vault.cancel')"
            @click="removeGroupConfirmOpen = false"
          />
          <UButton
            color="error"
            :label="$t('sidebar.ungroup')"
            @click="submitRemoveGroup"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="newNoteOpen"
      :title="$t('vault.newNote')"
    >
      <template #body>
        <UFormField
          :label="$t('vault.fileName')"
          :hint="$t('vault.fileNameHint')"
        >
          <UInput
            v-model="newNoteName"
            :placeholder="$t('vault.myNotePlaceholder')"
            autofocus
          />
        </UFormField>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            :label="$t('vault.cancel')"
            @click="newNoteOpen = false"
          />
          <UButton
            :label="$t('vault.create')"
            :disabled="!newNoteName.trim()"
            @click="submitCreateNote"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
