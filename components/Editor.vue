<script setup lang="ts">
import type { EditorTab } from '~/types'
import { getEditorViewType, isMediaFile } from '~/utils/fileTypes'
import { dirname, relativePath } from '~/utils/paths'

const props = defineProps<{
  panelId?: string
  isMobile?: boolean
}>()

const tabsStore = useTabsStore()
const editorStore = useEditorStore()
const settingsStore = useSettingsStore()

const activeTab = computed(() => {
  if (props.isMobile) {
    return tabsStore.mobileTabs.find((t) => t.id === tabsStore.mobileActiveId)
  }
  if (!props.panelId) return null
  const leaf = tabsStore.findLeaf(tabsStore.desktopLayout, props.panelId)
  return leaf?.tabs.find((t: EditorTab) => t.id === leaf.activeId)
})

const currentFilePath = computed(() => activeTab.value?.filePath ?? null)
const viewType = computed(() => getEditorViewType(currentFilePath.value))

function handleFocus() {
  if (props.panelId && !props.isMobile) {
    tabsStore.activeDesktopPanelId = props.panelId
  }
}

const dnd = useDnd()
const isDropTarget = ref(false)

function onDragOver(event: DragEvent) {
  if (props.isMobile || !dnd.draggedPath.value || dnd.draggedIsDir.value) return
  event.preventDefault()
  isDropTarget.value = true
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

function onDragLeave() {
  isDropTarget.value = false
}

async function onDrop(event: DragEvent) {
  isDropTarget.value = false
  if (props.isMobile || !dnd.draggedPath.value || dnd.draggedIsDir.value) return

  const path = dnd.draggedPath.value
  dnd.onDragEnd()

  /*
   * If the dragged file is a media file (image / video / audio) and the
   * active tab is a markdown document, insert a relative markdown reference
   * into the document instead of opening the media file as a separate tab.
   */
  if (isMediaFile(path) && currentFilePath.value && viewType.value === 'markdown') {
    const docDir = dirname(currentFilePath.value)
    const markdownPath = relativePath(docDir, path)
    editorStore.insertImportedFiles(
      [{ path, markdownPath }],
      currentFilePath.value,
      { coords: { x: event.clientX, y: event.clientY } },
    )
    return
  }

  if (props.panelId) {
    // Check if the file is already open in this panel
    const leaf = tabsStore.findLeaf(tabsStore.desktopLayout, props.panelId)
    if (leaf) {
      const existingTab = leaf.tabs.find((t) => t.filePath === path)
      if (existingTab) {
        tabsStore.activateTab(props.panelId, existingTab.id)
        return
      }
    }

    // Add the tab to the current panel and activate it
    const newTab: EditorTab = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, filePath: path }
    if (leaf) {
      leaf.tabs.push(newTab)
      leaf.activeId = newTab.id
      tabsStore.activeDesktopPanelId = props.panelId
      await editorStore.openFile(path)
      await editorStore.saveUiState()
    }
  }
}
</script>

<template>
  <div
    class="flex h-full bg-default overflow-hidden transition-colors"
    :class="[
      settingsStore.settings.tabDisplayMode === 'left_vertical' ? 'flex-row' : 'flex-col',
      isDropTarget ? 'ring-2 ring-inset ring-primary/50 bg-primary/5' : '',
    ]"
    data-drop-zone="editor"
    :data-editor-file-path="currentFilePath ?? undefined"
    @mousedown="handleFocus"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <!-- Panel Header (Tabs) -->
    <div
      class="border-default shrink-0 flex"
      :class="[
        settingsStore.settings.tabDisplayMode === 'left_vertical'
          ? 'w-48 h-full border-r flex-col overflow-y-auto overflow-x-hidden'
          : 'w-full border-b',
        settingsStore.settings.tabDisplayMode === 'single_line'
          ? 'h-10 items-center px-1 overflow-x-auto overflow-y-hidden'
          : settingsStore.settings.tabDisplayMode === 'multi_line'
            ? 'min-h-[40px] items-center px-1 flex-wrap'
            : '',
      ]"
    >
      <EditorTabs
        :panel-id="props.panelId"
        :is-mobile="props.isMobile"
      />
    </div>

    <!-- Panel Body -->
    <div class="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">
      <div
        v-if="!currentFilePath"
        class="flex flex-1 items-center justify-center text-muted"
      >
        <div class="text-center space-y-2">
          <UIcon
            name="i-lucide-file-text"
            class="size-10 mx-auto"
          />
          <p class="text-sm px-4">
            {{ $t('editor.noFileSelected') }}
          </p>
        </div>
      </div>

      <template v-else>
        <EditorVirtual
          v-if="viewType === 'virtual'"
          :file-path="currentFilePath"
        />
        <EditorVaultConfig
          v-else-if="viewType === 'vault-config'"
          :file-path="currentFilePath"
        />
        <EditorMedia
          v-else-if="viewType === 'image' || viewType === 'video' || viewType === 'audio'"
          :file-path="currentFilePath"
          :view-type="viewType"
        />
        <EditorText
          v-else-if="viewType === 'markdown'"
          :file-path="currentFilePath"
        />
        <EditorPlainText
          v-else-if="viewType === 'plain'"
          :file-path="currentFilePath"
        />
        <EditorCode
          v-else-if="viewType === 'code'"
          :file-path="currentFilePath"
        />
        <EditorUnsupported
          v-else
          :file-path="currentFilePath"
        />
      </template>

      <!-- Mobile Bottom Toolbar Placeholder -->
      <div
        v-if="props.isMobile && viewType === 'markdown'"
        class="h-10 border-t border-default bg-elevated/50 flex items-center px-4 shrink-0"
      >
        <div class="flex items-center gap-4">
          <UButton
            icon="i-lucide-bold"
            variant="ghost"
            size="xs"
            color="neutral"
          />
          <UButton
            icon="i-lucide-italic"
            variant="ghost"
            size="xs"
            color="neutral"
          />
          <UButton
            icon="i-lucide-list"
            variant="ghost"
            size="xs"
            color="neutral"
          />
          <UButton
            icon="i-lucide-link"
            variant="ghost"
            size="xs"
            color="neutral"
          />
          <UButton
            icon="i-lucide-image"
            variant="ghost"
            size="xs"
            color="neutral"
          />
        </div>
      </div>
    </div>
  </div>
</template>
