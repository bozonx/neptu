<script setup lang="ts">
import { Splitpanes, Pane } from 'splitpanes'
import type { Vault, VaultGroup } from '~/types'

const emit = defineEmits<{
  createNote: [vault: Vault, dir?: string]
  createFolder: [vault: Vault, dir?: string]
  renameNode: [vault: Vault, node: FileNode]
  editVault: [vault: Vault]
  removeVault: [vault: Vault]
}>()

const settings = useSettingsStore()
const vaults = useVaultsStore()
const editor = useEditorStore()
const tabs = useTabsStore()
const dnd = useDnd()
const toast = useToast()
const { t } = useI18n()

const mainVault = computed(() => vaults.list.find((v) => v.path === settings.mainRepoPath))
const otherUngroupedVaults = computed(() =>
  vaults.list.filter((v) => !v.groupId && v.path !== settings.mainRepoPath),
)

function vaultsInGroup(groupId: string) {
  return vaults.list.filter((v) => v.groupId === groupId)
}

function toggleGroup(group: VaultGroup) {
  tabs.expandedGroups[group.id] = !tabs.expandedGroups[group.id]
  void editor.saveUiState()
}

function toggleFolder(path: string) {
  tabs.expandedFolders[path] = !tabs.expandedFolders[path]
  void editor.saveUiState()
}

function handleDualResize(event: Array<{ pane: number, size: number }>) {
  if (event.length === 2 && event[0] !== undefined) {
    tabs.updateLeftSidebarDualFirstColumnSize(event[0].size)
  }
}

/* ── Dual-mode DnD ──────────────────────────────── */

const dualFavoritesDropTarget = ref(false)
const dualVaultDropTargetId = ref<string | null>(null)

function isFileDrag() {
  return Boolean(dnd.draggedPath.value)
}

function isFavoriteCandidate() {
  return isFileDrag() && !dnd.draggedIsDir.value
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

/* ── Auto-select vault on mount / vault deletion ── */

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
</script>

<template>
  <Splitpanes
    class="flex-1"
    @resized="handleDualResize"
  >
    <!-- First column: vault picker -->
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

    <!-- Second column: selected vault tree or favorites -->
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
        <div
          class="flex flex-col flex-1 min-h-0 rounded-md transition-colors"
          :class="dualVaultDropTargetId === tabs.leftSidebarDualSelectedVaultId ? 'bg-primary/5 ring-1 ring-inset ring-primary/30' : ''"
          @dragover="openDualVaultDrop($event, vaults.findById(tabs.leftSidebarDualSelectedVaultId!)!)"
          @dragleave="clearDualVaultDrop(tabs.leftSidebarDualSelectedVaultId!)"
          @drop="dropToVaultRoot($event, vaults.findById(tabs.leftSidebarDualSelectedVaultId!)!)"
        >
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
            @create-note="(v, d) => emit('createNote', v, d)"
            @create-folder="(v, d) => emit('createFolder', v, d)"
            @rename-node="(v, n) => emit('renameNode', v, n)"
            @edit-vault="(v) => emit('editVault', v)"
            @remove-vault="(v) => emit('removeVault', v)"
          />
        </div>
      </template>
      <div
        v-else
        class="flex h-full items-center justify-center text-muted text-sm px-2 text-center"
      >
        {{ $t('sidebar.noVaultSelected', 'Select a vault to view contents') }}
      </div>
    </Pane>
  </Splitpanes>
</template>
