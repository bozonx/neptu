<script setup lang="ts">
import EditorTabs from '~/components/EditorTabs.vue'
import type { EditorTab, Panel, PanelLeaf } from '~/types'

const props = defineProps<{
  panelId?: string
  isMobile?: boolean
}>()

const tabsStore = useTabsStore()
const editorStore = useEditorStore()
const textareaRef = ref<HTMLTextAreaElement | null>(null)

function findLeaf(panel: Panel, id: string): PanelLeaf | null {
  if (panel.type === 'leaf') return panel.id === id ? panel : null
  return findLeaf(panel.first, id) ?? findLeaf(panel.second, id)
}

const activeTab = computed(() => {
  if (props.isMobile) {
    return tabsStore.mobileTabs.find((t) => t.id === tabsStore.mobileActiveId)
  }
  if (!props.panelId) return null
  const leaf = findLeaf(tabsStore.desktopLayout, props.panelId)
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

    const lineHeight = 20
    textareaRef.value.scrollTop = line * lineHeight
  }
})

function handleFocus() {
  if (props.panelId && !props.isMobile) {
    tabsStore.activeDesktopPanelId = props.panelId
  }
}

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
})
</script>

<template>
  <div
    class="flex h-full flex-col bg-default overflow-hidden"
    @mousedown="handleFocus"
  >
    <!-- Panel Header (Tabs) -->
    <div class="h-10 border-b border-default flex items-center px-1 shrink-0 overflow-x-auto overflow-y-hidden">
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

      <textarea
        v-else
        :key="currentFilePath"
        ref="textareaRef"
        :value="buffer?.content ?? ''"
        class="w-full flex-1 resize-none bg-transparent outline-none p-6 font-mono text-sm leading-relaxed text-default"
        spellcheck="false"
        :placeholder="$t('editor.startWriting')"
        @input="onInput"
        @blur="saveCursorState"
      />

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
