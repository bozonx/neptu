<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { isConvertibleImageFileName } from '~/composables/useImageConvert'
import { SidebarDialogsKey } from '~/composables/useSidebarDialogs'

const vaults = useVaultsStore()
const tabs = useTabsStore()
const editor = useEditorStore()
const dnd = useDnd()
const toast = useToast()
const settings = useSettingsStore()
const { t } = useI18n()
const dialogs = inject(SidebarDialogsKey)
const isDropTarget = ref(false)

function fileName(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] ?? path
}

function vaultName(path: string): string | null {
  return vaults.findVaultForPath(path)?.name ?? null
}

function openFile(path: string) {
  tabs.openFile(path, { skipReveal: true }).catch((error: unknown) => {
    toast.add({ title: t('toast.openFileFailed'), description: String(error), color: 'error' })
  })
}

function openInNewPanel(path: string) {
  tabs.openFileInNewPanel(path).catch((error: unknown) => {
    toast.add({ title: t('toast.openFilePanelFailed'), description: String(error), color: 'error' })
  })
}

function revealInFiles(path: string) {
  tabs.revealFile(path)
  nextTick(() => {
    document.querySelector('[data-active-file]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

async function handleDelete(path: string) {
  const vault = vaults.findVaultForPath(path)
  if (!vault) return
  const name = fileName(path)
  const needsConfirm = vault.type === 'git'
    ? settings.settings.confirmDeleteGit
    : settings.settings.confirmDeleteLocal
  if (needsConfirm && !confirm(t('confirm.deleteFile', { name }))) return
  try {
    await useEditorStore().deleteNote({ vault, path })
    await vaults.removeFavorite(path)
  }
  catch (error) {
    toast.add({ title: t('toast.deleteFailed'), description: String(error), color: 'error' })
  }
}

function fileMenuItems(path: string): DropdownMenuItem[][] {
  const vault = vaults.findVaultForPath(path)
  const items: DropdownMenuItem[] = [
    { label: t('vault.openInNewPanel'), icon: 'i-lucide-panel-right-open', onSelect: () => openInNewPanel(path) },
    { label: t('sidebar.revealInFiles'), icon: 'i-lucide-folder-search', onSelect: () => revealInFiles(path) },
    { label: t('sidebar.removeFromFavorites'), icon: 'i-lucide-star-off', onSelect: () => vaults.removeFavorite(path) },
  ]
  if (isConvertibleImageFileName(path) && vault && dialogs) {
    items.push({
      label: t('vault.convertImage'),
      icon: 'i-lucide-image-upscale',
      onSelect: () => dialogs.openConvertImage(vault, { name: fileName(path), path, isDir: false }),
    })
  }
  if (vault && dialogs) {
    items.push({
      label: t('vault.rename'),
      icon: 'i-lucide-pencil',
      onSelect: () => dialogs.openRenameNode(vault, { name: fileName(path), path, isDir: false }),
    })
  }
  if (vault) {
    items.push({
      label: t('vault.delete'),
      icon: 'i-lucide-trash-2',
      color: 'error',
      onSelect: () => handleDelete(path),
    })
  }
  return [items]
}

function canAcceptDrop() {
  return Boolean(dnd.draggedPath.value) && !dnd.draggedIsDir.value
}

function onDragOver(event: DragEvent) {
  if (!canAcceptDrop()) return
  event.preventDefault()
  isDropTarget.value = true
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

function onDragLeave() {
  isDropTarget.value = false
}

async function onDrop() {
  if (!canAcceptDrop() || !dnd.draggedPath.value) return

  isDropTarget.value = false

  try {
    await vaults.addFavorite(dnd.draggedPath.value)
  }
  catch (error) {
    toast.add({ title: t('toast.addFavoriteFailed'), description: String(error), color: 'error' })
  }
  finally {
    dnd.onDragEnd()
  }
}
</script>

<template>
  <div
    class="space-y-0.5 rounded-md transition-colors"
    :class="isDropTarget ? 'bg-primary/10 ring-1 ring-inset ring-primary/40' : ''"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div
      v-if="vaults.favorites.length === 0"
      class="text-sm text-muted px-2 py-2"
    >
      {{ $t('sidebar.noFavorites') }}
    </div>
    <UContextMenu
      v-for="path in vaults.favorites"
      :key="path"
      :items="fileMenuItems(path)"
      :modal="false"
    >
      <div
        class="group flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-elevated transition-colors"
        :class="editor.currentFilePath === path ? 'bg-primary/10 text-primary border-l-2 border-primary' : ''"
        draggable="true"
        @click="openFile(path)"
        @dragstart="dnd.onPathDragStart($event, path, { isDir: false, source: 'tree' })"
        @dragend="dnd.onDragEnd()"
      >
        <span class="truncate text-xs flex-1">{{ fileName(path) }}</span>
        <span
          v-if="vaultName(path)"
          class="text-[10px] text-muted opacity-70"
        >{{ vaultName(path) }}</span>
      </div>
    </UContextMenu>
  </div>
</template>
