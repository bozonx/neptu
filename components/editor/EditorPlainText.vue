<script setup lang="ts">
import { basename, dirname, relativePath } from '~/utils/paths'

const props = defineProps<{
  filePath: string
}>()

const editorStore = useEditorStore()

const titleInputRef = ref<HTMLInputElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const title = ref('')

const buffer = computed(() => props.filePath ? editorStore.buffers[props.filePath] : null)

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
}

function onTitleKeydown(event: KeyboardEvent) {
  if (!titleInputRef.value) return
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

function insertAtCursor(text: string) {
  const ta = textareaRef.value
  if (!ta || !props.filePath) return
  const start = ta.selectionStart
  const end = ta.selectionEnd
  const value = buffer.value?.content ?? ''
  const next = value.substring(0, start) + text + value.substring(end)
  editorStore.setContent(props.filePath, next)
  nextTick(() => {
    ta.focus()
    ta.setSelectionRange(start + text.length, start + text.length)
    saveCursorState()
  })
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
  const name = basename(draggedPath)
  insertAtCursor(`${name} (${relPath})`)
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
  ta.scrollTop = line * 24
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
    <input
      ref="titleInputRef"
      v-model="title"
      class="w-full shrink-0 bg-transparent outline-none px-8 pt-8 pb-4 font-sans text-3xl font-bold text-default placeholder-muted"
      :placeholder="$t('editor.untitled')"
      @keydown="onTitleKeydown"
      @blur="renameCurrentFile"
    />

    <div
      class="min-h-0 flex-1 overflow-y-auto px-8 pb-6"
      @dragover.prevent
      @drop="onDrop"
    >
      <textarea
        :key="props.filePath"
        ref="textareaRef"
        :value="buffer?.content ?? ''"
        class="h-full min-h-[480px] w-full resize-none bg-transparent pb-8 font-sans text-base leading-7 text-default outline-none"
        spellcheck="true"
        :data-editor-file-path="props.filePath"
        :placeholder="$t('editor.startWriting')"
        @input="onInput"
        @keyup="updateSelection"
        @mouseup="updateSelection"
        @select="updateSelection"
        @blur="saveCursorState"
      />
    </div>
  </div>
</template>
