<script setup lang="ts">
import { basename, dirname, relativePath } from '~/utils/paths'
import { getCodeLanguage } from '~/utils/fileTypes'
import { highlightCode } from '~/composables/useShiki'

const props = defineProps<{
  filePath: string
}>()

const editorStore = useEditorStore()
const colorMode = useColorMode()

const titleInputRef = ref<HTMLInputElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const highlightRef = ref<HTMLDivElement | null>(null)
const title = ref('')

const buffer = computed(() => props.filePath ? editorStore.buffers[props.filePath] : null)
const language = computed(() => getCodeLanguage(props.filePath) ?? 'text')

const highlightedHtml = ref('')
const isHighlightReady = ref(false)

const lineCount = computed(() => {
  const content = buffer.value?.content ?? ''
  return content.length === 0 ? 1 : content.split('\n').length
})

const lineNumbers = computed(() => Array.from({ length: lineCount.value }, (_, i) => i + 1))

const INDENT = '  '

function getOldTitle(path: string): string {
  const name = path.split(/[/\\]/).pop() || ''
  const lastDot = name.lastIndexOf('.')
  return lastDot > 0 ? name.substring(0, lastDot) : name
}

watch(() => props.filePath, (path) => {
  title.value = path ? getOldTitle(path) : ''
  editorStore.activeSelectionText = ''
  nextTick(() => {
    restoreCursorState()
  })
}, { immediate: true })

function onInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  if (props.filePath) {
    editorStore.setContent(props.filePath, target.value)
  }
  updateSelection()
}

function updateSelection() {
  const ta = textareaRef.value
  if (!ta) {
    editorStore.activeSelectionText = ''
    return
  }
  editorStore.activeSelectionText = ta.value.slice(ta.selectionStart, ta.selectionEnd)
}

function syncScroll() {
  const ta = textareaRef.value
  const gutter = gutterRef.value
  const highlight = highlightRef.value
  if (ta) {
    if (gutter) gutter.scrollTop = ta.scrollTop
    if (highlight) highlight.scrollTop = ta.scrollTop
  }
}

async function updateHighlight() {
  const code = buffer.value?.content ?? ''
  const lang = language.value
  if (!code || lang === 'text') {
    highlightedHtml.value = ''
    isHighlightReady.value = false
    return
  }
  try {
    highlightedHtml.value = await highlightCode({
      code,
      lang,
      theme: colorMode.value === 'dark' ? 'dark' : 'light',
    })
    isHighlightReady.value = true
  }
  catch {
    highlightedHtml.value = ''
    isHighlightReady.value = false
  }
}

const gutterRef = ref<HTMLElement | null>(null)

function saveCursorState() {
  const path = props.filePath
  const ta = textareaRef.value
  if (!path || !ta) return
  editorStore.saveCursorPosition(path, {
    selectionStart: ta.selectionStart,
    selectionEnd: ta.selectionEnd,
    scrollTop: ta.scrollTop,
  })
  editorStore.saveUiState()
}

function restoreCursorState() {
  const path = props.filePath
  const ta = textareaRef.value
  if (!path || !ta) return
  const pos = editorStore.getCursorPosition(path)
  if (!pos) return
  const max = ta.value.length
  ta.setSelectionRange(Math.min(pos.selectionStart, max), Math.min(pos.selectionEnd, max))
  ta.scrollTop = pos.scrollTop
  syncScroll()
}

function onTitleKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'Enter') {
    event.preventDefault()
    textareaRef.value?.focus()
    textareaRef.value?.setSelectionRange(0, 0)
  }
}

async function renameCurrentFile() {
  const path = props.filePath
  if (!path) return
  const vault = editorStore.currentVault
  if (!vault) return

  const name = path.split(/[/\\]/).pop() || ''
  const lastDot = name.lastIndexOf('.')
  const ext = lastDot > 0 ? name.substring(lastDot) : ''
  const oldTitle = getOldTitle(path)
  const newTitle = title.value.trim()

  if (!newTitle || newTitle === oldTitle) {
    title.value = oldTitle
    return
  }
  if (/[<>:"/\\|?*]/g.test(newTitle)) {
    title.value = oldTitle
    return
  }

  try {
    await useVaultsStore().renameNode(vault.id, path, newTitle + ext)
  }
  catch (err) {
    console.error(err)
    title.value = oldTitle
  }
}

function applyTextareaEdit(start: number, end: number, replacement: string, caret: number) {
  const ta = textareaRef.value
  if (!ta || !props.filePath) return
  const value = ta.value
  const next = value.substring(0, start) + replacement + value.substring(end)
  editorStore.setContent(props.filePath, next)
  nextTick(() => {
    ta.focus()
    ta.setSelectionRange(caret, caret)
    saveCursorState()
  })
}

function onKeydown(event: KeyboardEvent) {
  const ta = textareaRef.value
  if (!ta) return

  // Tab indents; Shift+Tab outdents (single-line for now)
  if (event.key === 'Tab') {
    event.preventDefault()
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const value = ta.value

    // Multi-line block selection: indent every selected line
    if (start !== end && value.substring(start, end).includes('\n')) {
      const lineStart = value.lastIndexOf('\n', start - 1) + 1
      const block = value.substring(lineStart, end)
      let updated: string
      let removedFirst = 0
      if (event.shiftKey) {
        const lines = block.split('\n')
        const trimmed = lines.map((line, idx) => {
          if (line.startsWith(INDENT)) {
            if (idx === 0) removedFirst = INDENT.length
            return line.substring(INDENT.length)
          }
          if (line.startsWith('\t')) {
            if (idx === 0) removedFirst = 1
            return line.substring(1)
          }
          return line
        })
        updated = trimmed.join('\n')
      }
      else {
        updated = block.split('\n').map((line) => INDENT + line).join('\n')
      }
      const newStart = event.shiftKey ? Math.max(lineStart, start - removedFirst) : start + INDENT.length
      const newEnd = lineStart + updated.length
      const nextValue = value.substring(0, lineStart) + updated + value.substring(end)
      editorStore.setContent(props.filePath, nextValue)
      nextTick(() => {
        ta.focus()
        ta.setSelectionRange(newStart, newEnd)
        saveCursorState()
      })
      return
    }

    // Single caret/selection: insert/remove a single indent
    if (event.shiftKey) {
      const lineStart = value.lastIndexOf('\n', start - 1) + 1
      const head = value.substring(lineStart, start)
      if (head.endsWith(INDENT)) {
        applyTextareaEdit(start - INDENT.length, start, '', start - INDENT.length)
      }
      else if (head.endsWith('\t')) {
        applyTextareaEdit(start - 1, start, '', start - 1)
      }
      return
    }
    applyTextareaEdit(start, end, INDENT, start + INDENT.length)
    return
  }

  // Auto-indent on Enter
  if (event.key === 'Enter') {
    const start = ta.selectionStart
    const value = ta.value
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const lineHead = value.substring(lineStart, start)
    const indentMatch = lineHead.match(/^[ \t]*/)
    const indent = indentMatch ? indentMatch[0] : ''
    if (indent) {
      event.preventDefault()
      applyTextareaEdit(start, ta.selectionEnd, `\n${indent}`, start + 1 + indent.length)
    }
  }
}

function insertAtCursor(text: string) {
  const ta = textareaRef.value
  if (!ta) return
  applyTextareaEdit(ta.selectionStart, ta.selectionEnd, text, ta.selectionStart + text.length)
}

function onDrop(event: DragEvent) {
  const dnd = useDnd()
  const draggedPath = event.dataTransfer?.getData('application/x-neptu-path') || dnd.draggedPath.value
  if (!draggedPath || dnd.draggedIsDir.value || !props.filePath) return

  event.preventDefault()
  event.stopPropagation()
  dnd.onDragEnd()

  const currentDir = dirname(props.filePath)
  const relPath = relativePath(currentDir, draggedPath)
  // Code files get the relative path inserted as-is — let the user wrap it.
  insertAtCursor(relPath || basename(draggedPath))
}

watch(() => editorStore.insertTrigger, (trigger) => {
  if (!trigger || trigger.path !== props.filePath) return
  insertAtCursor(trigger.text)
})

watch(() => props.filePath ? editorStore.scrollToLineTrigger[props.filePath] : null, (line) => {
  if (line === undefined || line === null) return
  const ta = textareaRef.value
  if (!ta) return
  const text = buffer.value?.content ?? ''
  const lines = text.split('\n')
  let charIndex = 0
  for (let i = 0; i < line; i++) {
    charIndex += (lines[i] ?? '').length + 1
  }
  ta.focus()
  ta.setSelectionRange(charIndex, charIndex)
  ta.scrollTop = line * 22
  syncScroll()
})

watch(() => buffer.value?.content ?? '', async () => {
  await updateHighlight()
}, { immediate: true })

watch(() => colorMode.value, async () => {
  await updateHighlight()
})

onUnmounted(() => {
  editorStore.activeSelectionText = ''
})
</script>

<template>
  <div
    class="flex-1 overflow-hidden flex flex-col min-h-0"
    :data-editor-file-path="props.filePath"
  >
    <div class="flex shrink-0 items-center gap-3 px-8 pt-6 pb-3">
      <input
        ref="titleInputRef"
        v-model="title"
        class="flex-1 bg-transparent outline-none font-mono text-xl font-semibold text-default placeholder-muted"
        :placeholder="$t('editor.untitled')"
        @keydown="onTitleKeydown"
        @blur="renameCurrentFile"
      />
      <UBadge
        size="sm"
        color="neutral"
        variant="subtle"
        class="font-mono uppercase"
      >
        {{ language }}
      </UBadge>
    </div>

    <div
      class="min-h-0 flex-1 overflow-hidden flex"
      @dragover.prevent
      @drop="onDrop"
    >
      <div
        ref="gutterRef"
        class="select-none overflow-hidden border-r border-default bg-muted/30 px-3 py-2 text-right font-mono text-xs leading-[22px] text-muted"
        aria-hidden="true"
      >
        <div
          v-for="n in lineNumbers"
          :key="n"
        >
          {{ n }}
        </div>
      </div>

      <div class="relative min-h-0 flex-1 overflow-hidden">
        <div
          v-if="isHighlightReady"
          ref="highlightRef"
          class="absolute inset-0 overflow-auto whitespace-pre px-4 py-2 font-mono text-sm leading-[22px] pointer-events-none select-none"
          v-html="highlightedHtml"
        />
        <textarea
          :key="props.filePath"
          ref="textareaRef"
          :value="buffer?.content ?? ''"
          class="relative z-10 min-h-0 h-full w-full resize-none whitespace-pre overflow-auto bg-transparent px-4 py-2 font-mono text-sm leading-[22px] outline-none"
          :class="isHighlightReady ? 'text-transparent caret-default' : 'text-default'"
          spellcheck="false"
          autocapitalize="off"
          autocomplete="off"
          autocorrect="off"
          wrap="off"
          :data-editor-file-path="props.filePath"
          :placeholder="$t('editor.startWriting')"
          @input="onInput"
          @keydown="onKeydown"
          @keyup="updateSelection"
          @mouseup="updateSelection"
          @select="updateSelection"
          @scroll="syncScroll"
          @blur="saveCursorState"
        />
      </div>
    </div>
  </div>
</template>
