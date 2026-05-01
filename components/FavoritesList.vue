<script setup lang="ts">
const vaults = useVaultsStore()
const tabs = useTabsStore()
const dnd = useDnd()
const toast = useToast()
const { t } = useI18n()
const isDropTarget = ref(false)

function fileName(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] ?? path
}

function vaultName(path: string): string | null {
  return vaults.findVaultForPath(path)?.name ?? null
}

function openFile(path: string) {
  tabs.openFile(path).catch((error: unknown) => {
    toast.add({ title: t('toast.openFileFailed'), description: String(error), color: 'error' })
  })
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
    toast.add({ title: t('toast.addFavoriteFailed', 'Failed to add favorite'), description: String(error), color: 'error' })
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
      :items="[
        [
          {
            label: $t('sidebar.removeFromFavorites'),
            icon: 'i-lucide-star-off',
            onSelect: () => vaults.removeFavorite(path),
          },
        ],
      ]"
      :modal="false"
    >
      <div
        class="group flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-elevated transition-colors"
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
