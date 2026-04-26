<script setup lang="ts">
import type { FileFilterSettings, FileNode, Vault } from '~/types'

interface Props {
  vault: Vault
  nodes: FileNode[]
  activePath: string | null
  level?: number
  filters?: FileFilterSettings
}

withDefaults(defineProps<Props>(), { level: 0 })

const emit = defineEmits<{
  open: [path: string]
  delete: [node: FileNode]
  createIn: [dirPath: string]
}>()

const expanded = ref<Record<string, boolean>>({})

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

function toggle(node: FileNode) {
  expanded.value[node.path] = !expanded.value[node.path]
}
</script>

<template>
  <ul class="space-y-0.5">
    <li
      v-for="node in nodes"
      :key="node.path"
    >
      <div
        v-if="node.isDir"
        class="group flex items-center gap-1 rounded-md px-2 py-1 text-sm hover:bg-elevated cursor-pointer"
        :style="{ paddingLeft: `${0.5 + level * 0.75}rem` }"
        @click="toggle(node)"
      >
        <UIcon
          :name="expanded[node.path] ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
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
          @click.stop="emit('createIn', node.path)"
        />
      </div>

      <VaultTree
        v-if="node.isDir && expanded[node.path]"
        :vault="vault"
        :nodes="node.children ?? []"
        :active-path="activePath"
        :level="level + 1"
        :filters="filters"
        @open="(p) => emit('open', p)"
        @delete="(n) => emit('delete', n)"
        @create-in="(d) => emit('createIn', d)"
      />

      <div
        v-if="!node.isDir"
        class="group flex items-center gap-1 rounded-md px-2 py-1 text-sm hover:bg-elevated cursor-pointer"
        :class="{ 'bg-elevated text-primary': activePath === node.path }"
        :style="{ paddingLeft: `${1.25 + level * 0.75}rem` }"
        @click="emit('open', node.path)"
      >
        <UIcon
          :name="getFileIcon(node.name, filters)"
          class="size-4 text-muted shrink-0"
        />
        <span class="truncate flex-1">{{ node.name }}</span>
        <UButton
          icon="i-lucide-trash-2"
          size="xs"
          color="error"
          variant="ghost"
          class="opacity-0 group-hover:opacity-100"
          @click.stop="emit('delete', node)"
        />
      </div>
    </li>
  </ul>
</template>
