<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { FileNode, Vault, VaultGroup } from '~/types'

const emit = defineEmits<{
  createNote: [vault: Vault, dir?: string]
  createFolder: [vault: Vault, dir?: string]
  renameNode: [vault: Vault, node: FileNode]
  editVault: [vault: Vault]
  removeVault: [vault: Vault]
  createGroup: []
  renameGroup: [group: VaultGroup]
  removeGroup: [group: VaultGroup]
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

function isVaultCardDraggable(vault: Vault) {
  return vault.path !== settings.mainRepoPath
}

function toggleVault(vault: Vault) {
  tabs.expandedVaults[vault.id] = !tabs.expandedVaults[vault.id]
  void editor.saveUiState()
}

function toggleFolder(path: string) {
  tabs.expandedFolders[path] = !tabs.expandedFolders[path]
  void editor.saveUiState()
}

function toggleGroup(group: VaultGroup) {
  tabs.expandedGroups[group.id] = !tabs.expandedGroups[group.id]
  void editor.saveUiState()
}

/* ── Vault-to-group DnD ─────────────────────────── */

const singleUngroupedDropTarget = ref(false)
const singleGroupDropTargetId = ref<string | null>(null)

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

const groupMenuItems = computed(() => (group: VaultGroup): DropdownMenuItem[][] => [[
  { label: t('sidebar.renameGroup'), icon: 'i-lucide-pencil', onSelect: () => emit('renameGroup', group) },
  { label: t('sidebar.ungroup'), icon: 'i-lucide-folder-x', color: 'error', onSelect: () => emit('removeGroup', group) },
]])
</script>

<template>
  <div class="flex-1 overflow-auto p-2 min-h-0">
    <!-- Favorites -->
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

    <!-- Ungrouped vaults area -->
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
        @create-note="(v, d) => emit('createNote', v, d)"
        @create-folder="(v, d) => emit('createFolder', v, d)"
        @rename-node="(v, n) => emit('renameNode', v, n)"
        @edit-vault="(v) => emit('editVault', v)"
        @remove-vault="(v) => emit('removeVault', v)"
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
        @create-note="(v, d) => emit('createNote', v, d)"
        @create-folder="(v, d) => emit('createFolder', v, d)"
        @rename-node="(v, n) => emit('renameNode', v, n)"
        @edit-vault="(v) => emit('editVault', v)"
        @remove-vault="(v) => emit('removeVault', v)"
      />
    </div>

    <!-- Groups -->
    <div
      v-for="group in vaults.groups"
      :key="group.id"
      class="mb-2"
      @dragover="onGroupDragOver($event, group)"
      @dragleave="onGroupDragLeave(group.id)"
      @drop="onGroupDrop(group)"
    >
      <UContextMenu
        :items="groupMenuItems(group)"
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
            :items="groupMenuItems(group)"
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
          @create-note="(v, d) => emit('createNote', v, d)"
          @create-folder="(v, d) => emit('createFolder', v, d)"
          @rename-node="(v, n) => emit('renameNode', v, n)"
          @edit-vault="(v) => emit('editVault', v)"
          @remove-vault="(v) => emit('removeVault', v)"
        />
      </div>
    </div>
  </div>
</template>
