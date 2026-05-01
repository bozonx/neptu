<script setup lang="ts">
const props = defineProps<{
  filePath: string
}>()

const editorStore = useEditorStore()
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const titleInputRef = ref<HTMLInputElement | null>(null)
const title = ref('')

const buffer = computed(() => props.filePath ? editorStore.buffers[props.filePath] : null)

function onInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  if (props.filePath) {
    editorStore.setContent(props.filePath, target.value)
  }
}

watch(() => props.filePath, (path) => {
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
    if (props.filePath) {
      const content = buffer.value?.content ?? ''
      editorStore.setContent(props.filePath, '\n' + content)
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
  const path = props.filePath
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

watch(() => props.filePath ? editorStore.scrollToLineTrigger[props.filePath] : null, (line) => {
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

function updateSelection() {
  const el = textareaRef.value
  if (!el || !props.filePath) {
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
  const path = props.filePath
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
  const path = props.filePath
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

watch(() => props.filePath, () => {
  restoreCursorState()
  editorStore.activeSelectionText = ''
})
</script>

<template>
  <div class="flex-1 overflow-hidden flex flex-col min-h-0">
    <FrontmatterForm :file-path="props.filePath" />
    <input
      ref="titleInputRef"
      v-model="title"
      class="w-full shrink-0 bg-transparent outline-none px-8 pt-8 pb-4 font-sans text-3xl font-bold text-default placeholder-muted"
      :placeholder="$t('editor.untitled')"
      @keydown="onTitleKeydown"
      @blur="renameCurrentFile"
    />
    <textarea
      :key="props.filePath"
      ref="textareaRef"
      :value="buffer?.content ?? ''"
      class="w-full flex-1 resize-none bg-transparent outline-none px-8 pb-8 font-mono text-base leading-7 text-default"
      spellcheck="false"
      :placeholder="$t('editor.startWriting')"
      @input="onInput"
      @keydown="onTextareaKeydown"
      @blur="saveCursorState"
    />
  </div>
</template>
