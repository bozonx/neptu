<script setup lang="ts">
import type { FileNode, Vault } from '~/types'

interface Props {
  nodes: FileNode[]
  vault: Vault
  level?: number
}

const _props = withDefaults(defineProps<Props>(), {
  level: 0,
})

const emit = defineEmits<{
  open: [path: string]
  restore: [node: FileNode]
  delete: [node: FileNode]
}>()

const expanded = ref<Record<string, boolean>>({})

function getExt(name: string): string | null {
  const idx = name.lastIndexOf('.')
  if (idx <= 0 || idx === name.length - 1) return null
  return name.slice(idx + 1).toLowerCase()
}

function isImage(name: string): boolean {
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'].includes(getExt(name) ?? '')
}

function isMedia(name: string): boolean {
  return ['mp4', 'avi', 'mkv', 'webm', 'weba', 'mp3', 'aac', 'm4a', 'opus'].includes(getExt(name) ?? '')
}

function nodeIcon(node: FileNode): string {
  if (node.isDir) return 'i-lucide-folder'
  if (isImage(node.name)) return 'i-lucide-image'
  if (isMedia(node.name)) return 'i-lucide-film'
  if (node.name.endsWith('.md')) return 'i-lucide-file-text'
  return 'i-lucide-file'
}
</script>

<template>
  <div>
    <div
      v-for="node in nodes"
      :key="node.path"
    >
      <div
        class="group flex items-center justify-between gap-1 py-1 pr-1 cursor-pointer hover:bg-elevated/50 select-none"
        :style="{ paddingLeft: `${(level + 1) * 0.75 + 0.5}rem` }"
        @click="node.isDir ? (expanded[node.path] = !expanded[node.path]) : emit('open', node.path)"
      >
        <div class="flex items-center gap-1 min-w-0 flex-1">
          <UIcon
            v-if="node.isDir"
            name="i-lucide-chevron-right"
            class="size-3.5 text-muted shrink-0 transition-transform"
            :class="{ 'rotate-90': expanded[node.path] }"
          />
          <UIcon
            v-else
            name="i-lucide-file"
            class="size-3.5 text-transparent shrink-0"
          />
          <UIcon
            :name="nodeIcon(node)"
            class="size-4 shrink-0 text-muted"
          />
          <span class="truncate text-sm">{{ node.name }}</span>
        </div>
        <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <UButton
            icon="i-lucide-rotate-ccw"
            size="xs"
            color="neutral"
            variant="ghost"
            :title="$t('sidebar.restore')"
            @click.stop="emit('restore', node)"
          />
          <UButton
            icon="i-lucide-trash-2"
            size="xs"
            color="error"
            variant="ghost"
            :title="$t('sidebar.deletePermanently')"
            @click.stop="emit('delete', node)"
          />
        </div>
      </div>
      <TrashTree
        v-if="node.isDir && expanded[node.path]"
        :nodes="node.children ?? []"
        :vault="vault"
        :level="level + 1"
        @open="emit('open', $event)"
        @restore="emit('restore', $event)"
        @delete="emit('delete', $event)"
      />
    </div>
  </div>
</template>
