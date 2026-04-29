<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { FileFilterSettings, FileNode, Vault } from '~/types'

interface Props {
  vault: Vault
  nodes: FileNode[]
  activePath: string | null
  level?: number
  filters?: FileFilterSettings
  expandedFolders?: Record<string, boolean>
}

withDefaults(defineProps<Props>(), { level: 0, expandedFolders: () => ({}) })

const emit = defineEmits<{
  open: [path: string]
  openInNewPanel: [path: string]
  delete: [node: FileNode]
  createIn: [dirPath: string]
  createSubfolder: [dirPath: string]
  toggleFolder: [path: string]
}>()

const { t } = useI18n()
const dnd = useDnd()
const vaults = useVaultsStore()
const toast = useToast()

const dropTarget = ref<string | null>(null)

function toggle(node: FileNode) {
  emit('toggleFolder', node.path)
}

function onDragStart(event: DragEvent, node: FileNode) {
  dnd.onPathDragStart(event, node.path, { isDir: node.isDir, source: 'tree' })
}

function onDragEnd() {
  dnd.onDragEnd()
  dropTarget.value = null
}

function onDragOver(event: DragEvent, node: FileNode) {
  if (!node.isDir || dnd.draggedPath.value === node.path) return
  // Don't allow dropping a folder into itself or its children
  const dragged = dnd.draggedPath.value
  if (dragged) {
    const sep = dragged.includes('\\') ? '\\' : '/'
    const prefix = dragged.endsWith(sep) ? dragged : dragged + sep
    if (node.path === dragged || node.path.startsWith(prefix)) return
  }

  event.preventDefault()
  dnd.updateCopyMode(event)
  dnd.handleAutoScroll(event)
  dropTarget.value = node.path
}

function onDragLeave() {
  dropTarget.value = null
}

async function onDrop(event: DragEvent, node: FileNode) {
  if (!node.isDir || !dnd.draggedPath.value) return
  dropTarget.value = null

  const sourcePath = dnd.draggedPath.value
  const targetDir = node.path

  try {
    if (event.shiftKey) {
      await vaults.copyNode(sourcePath, targetDir)
    }
    else {
      await vaults.moveNode(sourcePath, targetDir)
    }
  }
  catch (error) {
    toast.add({ title: t('toast.moveFailed', 'Move failed'), description: String(error), color: 'error' })
  }
}

function getFileIcon(fileName: string, filters?: FileFilterSettings): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (!ext) return 'i-lucide-file'

  if (filters) {
    for (const group of filters.groups) {
      if (!group.enabled) continue
      if (group.extensions.some((e) => e.ext.toLowerCase() === ext)) {
        switch (group.label) {
          case 'Image': return 'i-lucide-image'
          case 'Video': return 'i-lucide-video'
          case 'Audio': return 'i-lucide-music'
          case 'Text': return 'i-lucide-file-text'
        }
      }
    }
  }
  return 'i-lucide-file-text'
}

function fileMenuItems(node: FileNode): DropdownMenuItem[][] {
  const isFav = vaults.isFavorite(node.path)
  return [
    [
      { label: t('vault.openInNewPanel'), icon: 'i-lucide-panel-right-open', onSelect: () => emit('openInNewPanel', node.path) },
      {
        label: isFav ? t('sidebar.removeFromFavorites') : t('sidebar.addToFavorites'),
        icon: isFav ? 'i-lucide-star-off' : 'i-lucide-star',
        onSelect: () => isFav ? vaults.removeFavorite(node.path) : vaults.addFavorite(node.path),
      },
      { label: t('vault.delete'), icon: 'i-lucide-trash-2', color: 'error', onSelect: () => emit('delete', node) },
    ],
  ]
}

function folderMenuItems(node: FileNode): DropdownMenuItem[][] {
  return [
    [
      { label: t('vault.newFolderBtn'), icon: 'i-lucide-folder-plus', onSelect: () => emit('createSubfolder', node.path) },
      { label: t('vault.delete'), icon: 'i-lucide-trash-2', color: 'error', onSelect: () => emit('delete', node) },
    ],
  ]
}
</script>

<template>
  <ul class="space-y-0.5">
    <li
      v-for="node in nodes"
      :key="node.path"
    >
      <UContextMenu
        v-if="node.isDir"
        :items="folderMenuItems(node)"
        :modal="false"
      >
        <div
          class="group flex items-center gap-1 rounded-md px-2 py-1 text-sm hover:bg-elevated cursor-pointer transition-colors"
          :class="{ 'bg-primary/20 ring-2 ring-inset ring-primary/50': dropTarget === node.path }"
          :style="{ paddingLeft: `${0.5 + level * 0.75}rem` }"
          draggable="true"
          @click="toggle(node)"
          @dragstart="onDragStart($event, node)"
          @dragend="onDragEnd"
          @dragover="onDragOver($event, node)"
          @dragleave="onDragLeave"
          @drop="onDrop($event, node)"
        >
          <UIcon
            :name="expandedFolders?.[node.path] ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
            class="size-4 text-muted shrink-0"
          />
          <UIcon
            name="i-lucide-folder"
            class="size-4 text-muted shrink-0"
          />
          <span class="truncate flex-1">{{ node.name }}</span>
          <UButton
            icon="i-lucide-file-plus"
            size="xs"
            color="neutral"
            variant="ghost"
            class="opacity-0 group-hover:opacity-100"
            :title="$t('vault.newNoteBtn')"
            @click.stop="emit('createIn', node.path)"
          />
          <UDropdownMenu
            :items="folderMenuItems(node)"
            :modal="false"
            size="xs"
          >
            <UButton
              icon="i-lucide-ellipsis-vertical"
              size="xs"
              color="neutral"
              variant="ghost"
              class="opacity-0 group-hover:opacity-100"
              @click.stop
            />
          </UDropdownMenu>
        </div>
      </UContextMenu>

      <VaultTree
        v-if="node.isDir && expandedFolders?.[node.path]"
        :vault="vault"
        :nodes="node.children ?? []"
        :active-path="activePath"
        :level="level + 1"
        :filters="filters"
        :expanded-folders="expandedFolders"
        @open="(p: string) => emit('open', p)"
        @open-in-new-panel="(p: string) => emit('openInNewPanel', p)"
        @delete="(n: FileNode) => emit('delete', n)"
        @create-in="(d: string) => emit('createIn', d)"
        @create-subfolder="(d: string) => emit('createSubfolder', d)"
        @toggle-folder="(p: string) => emit('toggleFolder', p)"
      />

      <UContextMenu
        v-if="!node.isDir"
        :items="fileMenuItems(node)"
        :modal="false"
      >
        <div
          class="group flex items-center gap-1 rounded-md px-2 py-1 text-sm hover:bg-elevated cursor-pointer"
          :class="{ 'bg-elevated text-primary': activePath === node.path }"
          :style="{ paddingLeft: `${1.25 + level * 0.75}rem` }"
          draggable="true"
          @click="emit('open', node.path)"
          @dragstart="onDragStart($event, node)"
          @dragend="onDragEnd"
        >
          <UIcon
            :name="getFileIcon(node.name, filters)"
            class="size-4 text-muted shrink-0"
          />
          <span class="truncate flex-1">{{ node.name }}</span>
          <UDropdownMenu
            :items="fileMenuItems(node)"
            :modal="false"
            size="xs"
          >
            <UButton
              icon="i-lucide-ellipsis-vertical"
              size="xs"
              color="neutral"
              variant="ghost"
              class="opacity-0 group-hover:opacity-100"
              @click.stop
            />
          </UDropdownMenu>
        </div>
      </UContextMenu>
    </li>
  </ul>
</template>
