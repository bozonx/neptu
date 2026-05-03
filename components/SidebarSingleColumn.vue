<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import type { DropdownMenuItem } from '@nuxt/ui'
import type { FileNode, Vault, VaultGroup } from '~/types'

const emit = defineEmits<{
  createNote: [vault: Vault, dir?: string]
  createFile: [vault: Vault, dir?: string]
  createFolder: [vault: Vault, dir?: string]
  renameNode: [vault: Vault, node: FileNode]
  convertImage: [vault: Vault, node: FileNode]
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

const draggableGroups = computed({
  get: () => vaults.groups,
  set: (val) => vaults.updateGroupsOrder(val),
})

const draggableUngroupedVaults = computed({
  get: () => otherUngroupedVaults.value,
  set: (val) => vaults.updateVaultsOrder(val),
})

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

    <!-- Daily Notes -->
    <DailyNotesTree
      class="mb-2"
      inline
    />

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
        @create-file="(v, d) => emit('createFile', v, d)"
        @create-folder="(v, d) => emit('createFolder', v, d)"
        @rename-node="(v, n) => emit('renameNode', v, n)"
        @convert-image="(v, n) => emit('convertImage', v, n)"
        @edit-vault="(v) => emit('editVault', v)"
        @remove-vault="(v) => emit('removeVault', v)"
      />

      <div
        v-if="mainVault && otherUngroupedVaults.length"
        class="my-2 border-t border-default"
      />

      <VueDraggable
        v-model="draggableUngroupedVaults"
        group="ungrouped-vaults"
        :animation="150"
      >
        <VaultSidebarItem
          v-for="vault in draggableUngroupedVaults"
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
          @create-file="(v, d) => emit('createFile', v, d)"
          @create-folder="(v, d) => emit('createFolder', v, d)"
          @rename-node="(v, n) => emit('renameNode', v, n)"
          @convert-image="(v, n) => emit('convertImage', v, n)"
          @edit-vault="(v) => emit('editVault', v)"
          @remove-vault="(v) => emit('removeVault', v)"
        />
      </VueDraggable>
    </div>

    <!-- Groups -->
    <VueDraggable
      v-model="draggableGroups"
      group="vault-groups"
      :animation="150"
    >
      <div
        v-for="group in draggableGroups"
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
            class="group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer border-l-2 border-l-primary/20 hover:border-l-primary/40 transition-colors"
            :class="singleGroupDropTargetId === group.id ? 'bg-primary/10 ring-1 ring-inset ring-primary/40 border-l-primary/40' : ''"
            @click="toggleGroup(group)"
          >
            <span class="truncate text-xs text-muted flex-1">{{ group.name }}</span>
            <UIcon
              name="i-lucide-chevron-right"
              class="size-3 text-muted shrink-0 transition-transform"
              :class="{ 'rotate-90': tabs.expandedGroups[group.id] }"
            />
          </div>
        </UContextMenu>

        <div
          v-if="tabs.expandedGroups[group.id]"
          class="pl-3 mt-1 space-y-1 relative"
        >
          <div class="absolute left-1 top-0 bottom-0 w-px bg-border/40" />
          <VueDraggable
            :model-value="vaultsInGroup(group.id)"
            :group="`group-vaults-${group.id}`"
            :animation="150"
            @update:model-value="vaults.updateVaultsOrder($event)"
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
              @create-file="(v, d) => emit('createFile', v, d)"
              @create-folder="(v, d) => emit('createFolder', v, d)"
              @rename-node="(v, n) => emit('renameNode', v, n)"
              @convert-image="(v, n) => emit('convertImage', v, n)"
              @edit-vault="(v) => emit('editVault', v)"
              @remove-vault="(v) => emit('removeVault', v)"
            />
          </VueDraggable>
        </div>
      </div>
    </VueDraggable>
  </div>
</template>
