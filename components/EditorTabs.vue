<script setup lang="ts">
import type { EditorTab } from '~/types'

const props = defineProps<{
  panelId?: string
  isMobile?: boolean
}>()

const tabsStore = useTabsStore()
const editorStore = useEditorStore()
const vaults = useVaultsStore()

const tabs = computed(() => {
  if (props.isMobile) return tabsStore.mobileTabs
  if (!props.panelId) return []
  const leaf = (tabsStore.desktopLayout as any).type === 'leaf' && tabsStore.desktopLayout.id === props.panelId
    ? tabsStore.desktopLayout
    : findLeaf(tabsStore.desktopLayout, props.panelId)
  return leaf?.tabs ?? []
})

const activeId = computed(() => {
  if (props.isMobile) return tabsStore.mobileActiveId
  if (!props.panelId) return null
  const leaf = findLeaf(tabsStore.desktopLayout, props.panelId)
  return leaf?.activeId ?? null
})

function findLeaf(panel: any, id: string): any {
  if (panel.type === 'leaf') return panel.id === id ? panel : null
  return findLeaf(panel.first, id) ?? findLeaf(panel.second, id)
}

function fileName(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] ?? path
}

function vaultName(path: string): string | null {
  return vaults.findVaultForPath(path)?.name ?? null
}

function handleTabClick(tab: EditorTab) {
  if (props.isMobile) {
    tabsStore.activateMobileTab(tab.id)
  }
  else if (props.panelId) {
    tabsStore.activateTab(props.panelId, tab.id)
  }
}

function handleClose(tab: EditorTab) {
  if (props.isMobile) {
    tabsStore.closeMobileTab(tab.id)
  }
  else if (props.panelId) {
    tabsStore.closeTab(props.panelId, tab.id)
  }
}

const contextMenuItems = (tab: EditorTab) => [
  [
    {
      label: 'Duplicate to right',
      icon: 'i-lucide-panel-right-dashed',
      onSelect: () => props.panelId && tabsStore.duplicateTo(props.panelId, 'right', tab),
    },
    {
      label: 'Duplicate to left',
      icon: 'i-lucide-panel-left-dashed',
      onSelect: () => props.panelId && tabsStore.duplicateTo(props.panelId, 'left', tab),
    },
  ],
  [
    {
      label: 'Duplicate to top',
      icon: 'i-lucide-panel-top-dashed',
      onSelect: () => props.panelId && tabsStore.duplicateTo(props.panelId, 'top', tab),
    },
    {
      label: 'Duplicate to bottom',
      icon: 'i-lucide-panel-bottom-dashed',
      onSelect: () => props.panelId && tabsStore.duplicateTo(props.panelId, 'bottom', tab),
    },
  ],
]
</script>

<template>
  <div class="flex items-center gap-px h-full">
    <template v-if="tabs.length">
      <template v-if="!props.isMobile">
        <UContextMenu
          v-for="tab in tabs"
          :key="`ctx-${tab.id}`"
          :items="contextMenuItems(tab)"
        >
          <button
            type="button"
            class="group flex items-center gap-2 h-full border-r border-default px-3 text-xs whitespace-nowrap transition-colors relative"
            :class="tab.id === activeId
              ? 'bg-default text-default'
              : 'bg-elevated/50 text-muted hover:text-default'"
            :title="tab.filePath"
            @click="handleTabClick(tab)"
          >
            <div
              v-if="tab.id === activeId"
              class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
            />
            <span
              v-if="tab.id === activeId && editorStore.buffers[tab.filePath]?.isDirty"
              class="size-1.5 rounded-full bg-primary"
            />
            <span class="font-medium truncate max-w-[150px]">{{ fileName(tab.filePath) }}</span>
            <span
              v-if="vaultName(tab.filePath)"
              class="text-[10px] text-muted opacity-70"
            >{{ vaultName(tab.filePath) }}</span>
            <UButton
              icon="i-lucide-x"
              size="xs"
              variant="ghost"
              color="neutral"
              class="size-4 p-0 opacity-0 group-hover:opacity-100"
              @click.stop="handleClose(tab)"
            />
          </button>
        </UContextMenu>
      </template>
      <template v-else>
        <button
          v-for="tab in tabs"
          :key="`btn-${tab.id}`"
          type="button"
          class="group flex items-center gap-2 h-full border-r border-default px-3 text-xs whitespace-nowrap transition-colors relative"
          :class="tab.id === activeId
            ? 'bg-default text-default'
            : 'bg-elevated/50 text-muted hover:text-default'"
          :title="tab.filePath"
          @click="handleTabClick(tab)"
        >
          <div
            v-if="tab.id === activeId"
            class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
          />
          <span
            v-if="tab.id === activeId && editorStore.buffers[tab.filePath]?.isDirty"
            class="size-1.5 rounded-full bg-primary"
          />
          <span class="font-medium truncate max-w-[150px]">{{ fileName(tab.filePath) }}</span>
          <span
            v-if="vaultName(tab.filePath)"
            class="text-[10px] text-muted opacity-70"
          >{{ vaultName(tab.filePath) }}</span>
          <UButton
            icon="i-lucide-x"
            size="xs"
            variant="ghost"
            color="neutral"
            class="size-4 p-0 opacity-0 group-hover:opacity-100"
            @click.stop="handleClose(tab)"
          />
        </button>
      </template>
    </template>
    <div
      v-else
      class="px-4 text-[10px] text-muted uppercase tracking-widest opacity-30 select-none"
    >
      No open files
    </div>
  </div>
</template>
