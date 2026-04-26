<script setup lang="ts">
import type { FileNode, Project } from '~/types'

interface Props {
  project: Project
  nodes: FileNode[]
  activePath: string | null
  level?: number
}

const props = withDefaults(defineProps<Props>(), { level: 0 })

const emit = defineEmits<{
  open: [path: string]
  delete: [node: FileNode]
  createIn: [dirPath: string]
}>()

const expanded = ref<Record<string, boolean>>({})

function toggle(node: FileNode) {
  expanded.value[node.path] = !expanded.value[node.path]
}
</script>

<template>
  <ul class="space-y-0.5">
    <li v-for="node in nodes" :key="node.path">
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
        <UIcon name="i-lucide-folder" class="size-4 text-muted shrink-0" />
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

      <ProjectTree
        v-if="node.isDir && expanded[node.path]"
        :project="project"
        :nodes="node.children ?? []"
        :active-path="activePath"
        :level="level + 1"
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
        <UIcon name="i-lucide-file-text" class="size-4 text-muted shrink-0" />
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
