<script setup lang="ts">
import type { EditorTab } from '~/types'

const props = defineProps<{
  panelId?: string
  isMobile?: boolean
}>()

const tabsStore = useTabsStore()
const editorStore = useEditorStore()
const settingsStore = useSettingsStore()
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const titleInputRef = ref<HTMLInputElement | null>(null)
const title = ref('')

const activeTab = computed(() => {
  if (props.isMobile) {
    return tabsStore.mobileTabs.find((t) => t.id === tabsStore.mobileActiveId)
  }
  if (!props.panelId) return null
  const leaf = tabsStore.findLeaf(tabsStore.desktopLayout, props.panelId)
  return leaf?.tabs.find((t: EditorTab) => t.id === leaf.activeId)
})

const currentFilePath = computed(() => activeTab.value?.filePath ?? null)
const buffer = computed(() => currentFilePath.value ? editorStore.buffers[currentFilePath.value] : null)

function onInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  if (currentFilePath.value) {
    editorStore.setContent(currentFilePath.value, target.value)
  }
}

watch(currentFilePath, (path) => {
  if (path) {
    const name = path.split(/[\/\\]/).pop() || ''
    const lastDot = name.lastIndexOf('.')
    if (lastDot > 0) {
      title.value = name.substring(0, lastDot)
    } else {
      title.value = name
    }
  } else {
    title.value = ''
  }
}, { immediate: true })

function onTextareaKeydown(event: KeyboardEvent) {
  if (!textareaRef.value) return
  if (event.key === 'ArrowLeft') {
    if (textareaRef.value.selectionStart === 0 && textareaRef.value.selectionEnd === 0) {
      event.preventDefault()
      titleInputRef.value?.focus()
      nextTick(() => {
        if (titleInputRef.value) {
          titleInputRef.value.selectionStart = title.value.length
          titleInputRef.value.selectionEnd = title.value.length
        }
      })
    }
  } else if (event.key === 'ArrowUp') {
    const textBefore = textareaRef.value.value.substring(0, textareaRef.value.selectionStart)
    if (!textBefore.includes('\n')) {
      event.preventDefault()
      titleInputRef.value?.focus()
      nextTick(() => {
        if (titleInputRef.value) {
          titleInputRef.value.selectionStart = title.value.length
          titleInputRef.value.selectionEnd = title.value.length
        }
      })
    }
  }
}

function onTitleKeydown(event: KeyboardEvent) {
  if (!titleInputRef.value || !textareaRef.value) return
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    textareaRef.value.focus()
    textareaRef.value.selectionStart = 0
    textareaRef.value.selectionEnd = 0
  } else if (event.key === 'ArrowRight') {
    if (titleInputRef.value.selectionStart === title.value.length && titleInputRef.value.selectionEnd === title.value.length) {
      event.preventDefault()
      textareaRef.value.focus()
      textareaRef.value.selectionStart = 0
      textareaRef.value.selectionEnd = 0
    }
  } else if (event.key === 'Enter') {
    event.preventDefault()
    if (currentFilePath.value) {
      const content = buffer.value?.content ?? ''
      editorStore.setContent(currentFilePath.value, '\n' + content)
      nextTick(() => {
        if (textareaRef.value) {
          textareaRef.value.focus()
          textareaRef.value.selectionStart = 0
          textareaRef.value.selectionEnd = 0
        }
      })
    }
  }
}

async function renameCurrentFile() {
  const path = currentFilePath.value
  if (!path) return
  const vault = editorStore.currentVault
  if (!vault) return
  
  const name = path.split(/[\/\\]/).pop() || ''
  const lastDot = name.lastIndexOf('.')
  const ext = lastDot > 0 ? name.substring(lastDot) : ''
  const oldTitle = lastDot > 0 ? name.substring(0, lastDot) : name
  
  const newTitle = title.value.trim()
  if (!newTitle || newTitle === oldTitle) {
    title.value = oldTitle
    return
  }
  
  const invalidChars = /[<>:"/\\|?*]/g
  if (invalidChars.test(newTitle)) {
    title.value = oldTitle
    return
  }

  const newName = newTitle + ext
  
  try {
    const vaultsStore = useVaultsStore()
    await vaultsStore.renameNode(vault.id, path, newName)
  } catch (err) {
    console.error(err)
    title.value = oldTitle
  }
}

watch(() => currentFilePath.value ? editorStore.scrollToLineTrigger[currentFilePath.value] : null, (line) => {
  if (line !== undefined && line !== null && textareaRef.value) {
    const text = textareaRef.value.value
    const lines = text.split('\n')
    let charIndex = 0
    for (let i = 0; i < line; i++) {
      charIndex += (lines[i] ?? '').length + 1
    }

    textareaRef.value.focus()
    textareaRef.value.setSelectionRange(charIndex, charIndex)

    const lineHeight = parseFloat(getComputedStyle(textareaRef.value).lineHeight) || 28
    textareaRef.value.scrollTop = line * lineHeight
  }
})

function handleFocus() {
  if (props.panelId && !props.isMobile) {
    tabsStore.activeDesktopPanelId = props.panelId
  }
  updateSelection()
}

function updateSelection() {
  const el = textareaRef.value
  if (!el || !currentFilePath.value) {
    editorStore.activeSelectionText = ''
    return
  }
  const text = el.value
  editorStore.activeSelectionText = text.slice(el.selectionStart, el.selectionEnd)
}

function handleSelectionChange() {
  if (document.activeElement === textareaRef.value) {
    updateSelection()
  }
  else {
    editorStore.activeSelectionText = ''
  }
}

onMounted(() => {
  document.addEventListener('selectionchange', handleSelectionChange)
})

onUnmounted(() => {
  document.removeEventListener('selectionchange', handleSelectionChange)
})

function saveCursorState() {
  const el = textareaRef.value
  const path = currentFilePath.value
  if (!el || !path) return
  editorStore.saveCursorPosition(path, {
    selectionStart: el.selectionStart,
    selectionEnd: el.selectionEnd,
    scrollTop: el.scrollTop,
  })
  editorStore.saveUiState()
}

function restoreCursorState() {
  const el = textareaRef.value
  const path = currentFilePath.value
  if (!el || !path) return
  const pos = editorStore.getCursorPosition(path)
  if (!pos) return
  nextTick(() => {
    if (!textareaRef.value) return
    const max = textareaRef.value.value.length
    const start = Math.min(pos.selectionStart, max)
    const end = Math.min(pos.selectionEnd, max)
    textareaRef.value.setSelectionRange(start, end)
    textareaRef.value.scrollTop = pos.scrollTop
  })
}

watch(currentFilePath, () => {
  restoreCursorState()
  editorStore.activeSelectionText = ''
})

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

async function onDrop() {
  isDropTarget.value = false
  if (props.isMobile || !dnd.draggedPath.value || dnd.draggedIsDir.value) return
  
  const path = dnd.draggedPath.value
  dnd.onDragEnd()
  
  if (props.panelId) {
    // Check if the file is already open in this panel
    const leaf = tabsStore.findLeaf(tabsStore.desktopLayout, props.panelId)
    if (leaf) {
      const existingTab = leaf.tabs.find(t => t.filePath === path)
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
      isDropTarget ? 'ring-2 ring-inset ring-primary/50 bg-primary/5' : ''
    ]"
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
    <div class="flex-1 overflow-hidden flex flex-col">
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
        <FrontmatterForm :file-path="currentFilePath" />
        <input
          ref="titleInputRef"
          v-model="title"
          class="w-full bg-transparent outline-none px-8 pt-8 pb-4 font-sans text-3xl font-bold text-default placeholder-muted"
          :placeholder="$t('editor.untitled')"
          @keydown="onTitleKeydown"
          @blur="renameCurrentFile"
        />
        <textarea
          :key="currentFilePath"
          ref="textareaRef"
          :value="buffer?.content ?? ''"
          class="w-full flex-1 resize-none bg-transparent outline-none px-8 pb-8 font-mono text-base leading-7 text-default"
          spellcheck="false"
          :placeholder="$t('editor.startWriting')"
          @input="onInput"
          @keydown="onTextareaKeydown"
          @blur="saveCursorState"
        />
      </template>

      <!-- Mobile Bottom Toolbar Placeholder -->
      <div
        v-if="props.isMobile"
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
