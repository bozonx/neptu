<script setup lang="ts">
import type { FileNode } from '~/types'

const vaults = useVaultsStore()
const tabs = useTabsStore()
const { t } = useI18n()

interface HistoryItem {
  path: string
  name: string
  mtime: number
  vaultName: string
}

function flattenFiles(nodes: FileNode[], vaultName: string): HistoryItem[] {
  const items: HistoryItem[] = []
  for (const node of nodes) {
    if (node.isDir && node.children) {
      items.push(...flattenFiles(node.children, vaultName))
    }
    else if (!node.isDir && node.mtime) {
      items.push({ path: node.path, name: node.name, mtime: node.mtime, vaultName })
    }
  }
  return items
}

const historyItems = computed(() => {
  const all: HistoryItem[] = []
  for (const vault of vaults.list) {
    const tree = vaults.trees[vault.id] ?? []
    all.push(...flattenFiles(tree, vault.name))
  }
  all.sort((a, b) => b.mtime - a.mtime)
  return all.slice(0, 100)
})

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString()
}

function openFile(path: string) {
  tabs.openFile(path).catch(() => {})
}
</script>

<template>
  <div class="flex flex-col h-full overflow-auto p-2 gap-0.5">
    <div
      v-for="item in historyItems"
      :key="item.path"
      class="flex flex-col gap-0.5 px-2 py-1.5 rounded-md hover:bg-elevated cursor-pointer"
      @click="openFile(item.path)"
    >
      <span class="text-sm truncate">{{ item.name }}</span>
      <span class="text-[10px] text-muted truncate">
        {{ item.vaultName }} &middot; {{ formatTime(item.mtime) }}
      </span>
    </div>
    <div
      v-if="historyItems.length === 0"
      class="text-sm text-muted px-2 py-4"
    >
      {{ t('sidebar.noRecentChanges', 'No recent changes') }}
    </div>
  </div>
</template>
