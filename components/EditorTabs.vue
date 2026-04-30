<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import type { EditorTab, Panel, PanelLeaf } from '~/types'

const props = defineProps<{
  panelId?: string
  isMobile?: boolean
}>()

const tabsStore = useTabsStore()
const editorStore = useEditorStore()
const vaults = useVaultsStore()
const settingsStore = useSettingsStore()
const dnd = useDnd()

const scrollContainer = ref<HTMLElement | null>(null)

function handleWheel(e: WheelEvent) {
  if (!scrollContainer.value) return
  if (e.deltaY !== 0 && Math.abs(e.deltaX) === 0) {
    e.preventDefault()
    scrollContainer.value.scrollLeft += e.deltaY
  }
}

const leaf = computed(() => {
  if (props.isMobile) return null
  if (!props.panelId) return null
  return tabsStore.desktopLayout.type === 'leaf' && tabsStore.desktopLayout.id === props.panelId
    ? tabsStore.desktopLayout
    : findLeaf(tabsStore.desktopLayout, props.panelId)
})

const tabs = computed(() => {
  if (props.isMobile) return tabsStore.mobileTabs
  return leaf.value?.tabs ?? []
})

const draggableTabs = computed({
  get: () => tabs.value,
  set: (val) => {
    if (props.isMobile) {
      tabsStore.mobileTabs = val
    }
    else if (leaf.value) {
      leaf.value.tabs = val
    }
  },
})

const activeId = computed(() => {
  if (props.isMobile) return tabsStore.mobileActiveId
  return leaf.value?.activeId ?? null
})

watch(activeId, (newId) => {
  if (newId && scrollContainer.value) {
    nextTick(() => {
      const activeEl = scrollContainer.value?.querySelector(`[data-tab-id="${newId}"]`)
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      }
    })
  }
}, { immediate: true })

function findLeaf(panel: Panel, id: string): PanelLeaf | null {
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

function onTabDragStart(event: DragEvent, tab: EditorTab) {
  dnd.onPathDragStart(event, tab.filePath, { isDir: false, source: 'tab' })
}

function onTabDragEnd() {
  dnd.onDragEnd()
}

function onAdd(event: { data: EditorTab }) {
  if (!props.isMobile && props.panelId) {
    tabsStore.handleTabAdd(props.panelId, event.data)
  }
}

function onRemove(event: { data: EditorTab }) {
  if (!props.isMobile && props.panelId) {
    tabsStore.handleTabRemove(props.panelId, event.data)
  }
}

const { t } = useI18n()

const tabDisplayItems = computed(() => [
  {
    label: t('settings.tabDisplaySingleLine'),
    icon: settingsStore.settings.tabDisplayMode === 'single_line' ? 'i-lucide-check' : undefined,
    onSelect: () => settingsStore.updateSettings({ tabDisplayMode: 'single_line' }),
  },
  {
    label: t('settings.tabDisplayMultiLine'),
    icon: settingsStore.settings.tabDisplayMode === 'multi_line' ? 'i-lucide-check' : undefined,
    onSelect: () => settingsStore.updateSettings({ tabDisplayMode: 'multi_line' }),
  },
  {
    label: t('settings.tabDisplayLeftVertical'),
    icon: settingsStore.settings.tabDisplayMode === 'left_vertical' ? 'i-lucide-check' : undefined,
    onSelect: () => settingsStore.updateSettings({ tabDisplayMode: 'left_vertical' }),
  },
])

const contextMenuItems = (tab: EditorTab) => [
  [
    {
      label: t('editor.close'),
      icon: 'i-lucide-x',
      onSelect: () => handleClose(tab),
    },
    {
      label: tab.pinned ? t('editor.unpin') : t('editor.pin'),
      icon: tab.pinned ? 'i-lucide-pin-off' : 'i-lucide-pin',
      onSelect: () => props.panelId && tabsStore.togglePin(props.panelId, tab.id),
    },
    {
      label: vaults.isFavorite(tab.filePath) ? t('editor.removeFromFavorites') : t('editor.addToFavorites'),
      icon: vaults.isFavorite(tab.filePath) ? 'i-lucide-star-off' : 'i-lucide-star',
      onSelect: () => vaults.isFavorite(tab.filePath) ? vaults.removeFavorite(tab.filePath) : vaults.addFavorite(tab.filePath),
    },
  ],
  [
    {
      label: t('editor.closeAllRight'),
      icon: 'i-lucide-arrow-right-to-line',
      onSelect: () => props.panelId && tabsStore.closeAllRight(props.panelId, tab.id),
    },
    {
      label: t('editor.closeOthers'),
      icon: 'i-lucide-x-square',
      onSelect: () => props.panelId && tabsStore.closeOthers(props.panelId, tab.id),
    },
    {
      label: t('editor.closeAll'),
      icon: 'i-lucide-x',
      onSelect: () => props.panelId && tabsStore.closeAll(props.panelId),
    },
  ],
  [
    {
      label: t('editor.duplicateRight'),
      icon: 'i-lucide-panel-right-dashed',
      onSelect: () => props.panelId && tabsStore.duplicateTo(props.panelId, 'right', tab),
    },
    {
      label: t('editor.duplicateLeft'),
      icon: 'i-lucide-panel-left-dashed',
      onSelect: () => props.panelId && tabsStore.duplicateTo(props.panelId, 'left', tab),
    },
  ],
  [
    {
      label: t('editor.duplicateTop'),
      icon: 'i-lucide-panel-top-dashed',
      onSelect: () => props.panelId && tabsStore.duplicateTo(props.panelId, 'top', tab),
    },
    {
      label: t('editor.duplicateBottom'),
      icon: 'i-lucide-panel-bottom-dashed',
      onSelect: () => props.panelId && tabsStore.duplicateTo(props.panelId, 'bottom', tab),
    },
  ],
  tabDisplayItems.value,
]
</script>

<template>
  <div
    ref="scrollContainer"
    class="flex w-full hide-scrollbar"
    :class="[
      settingsStore.settings.tabDisplayMode === 'left_vertical'
        ? 'flex-col h-full overflow-y-auto overflow-x-hidden'
        : settingsStore.settings.tabDisplayMode === 'multi_line'
          ? 'flex-row flex-wrap items-center'
          : 'flex-row items-center h-full overflow-x-auto',
    ]"
    @wheel="handleWheel"
  >
    <VueDraggable
      v-model="draggableTabs"
      group="editor-tabs"
      :animation="150"
      handle=".tab-sort-handle"
      class="flex flex-1 min-w-4"
      :class="[
        settingsStore.settings.tabDisplayMode === 'left_vertical'
          ? 'flex-col w-full'
          : settingsStore.settings.tabDisplayMode === 'multi_line'
            ? 'flex-row flex-wrap items-center'
            : 'flex-row items-center h-full',
      ]"
      :ghost-class="'opacity-50'"
      @add="onAdd"
      @remove="onRemove"
    >
      <template
        v-for="tab in tabs"
        :key="tab.id"
      >
        <UContextMenu
          v-if="!props.isMobile"
          :items="contextMenuItems(tab)"
        >
          <EditorTabItem
            :tab="tab"
            :active-id="activeId"
            :file-name="fileName(tab.filePath)"
            :vault-name="vaultName(tab.filePath)"
            @click="handleTabClick"
            @close="handleClose"
            @drag-start="onTabDragStart"
            @drag-end="onTabDragEnd"
          />
        </UContextMenu>
        <EditorTabItem
          v-else
          :tab="tab"
          :active-id="activeId"
          is-mobile
          :file-name="fileName(tab.filePath)"
          :vault-name="vaultName(tab.filePath)"
          @click="handleTabClick"
          @close="handleClose"
          @drag-start="onTabDragStart"
          @drag-end="onTabDragEnd"
        />
      </template>
    </VueDraggable>
    <div
      v-if="tabs.length === 0"
      class="px-4 text-[10px] text-muted uppercase tracking-widest opacity-30 select-none whitespace-nowrap"
    >
      {{ $t('editor.noOpenFiles') }}
    </div>
  </div>
</template>
