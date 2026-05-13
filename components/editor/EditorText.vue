<script setup lang="ts">
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { isMediaFile } from '~/utils/fileTypes'

type CalloutVariant = 'note' | 'tip' | 'important' | 'warning' | 'caution'

interface MarkdownNode {
  type?: string
  content?: MarkdownNode[]
  text?: string
  attrs?: Record<string, unknown>
}

interface MarkdownDocument {
  content?: MarkdownNode[]
}

interface MarkdownManager {
  parse: (markdown: string) => MarkdownDocument | null
}

interface MarkdownStorageHost {
  storage?: {
    markdown?: {
      manager?: MarkdownManager
    }
  }
}

const props = defineProps<{
  filePath: string
}>()

const editorStore = useEditorStore()
const importHelper = useEditorImport()
const { t } = useI18n()
const toast = useToast()

const titleInputRef = ref<HTMLInputElement | null>(null)
const sourceModeRef = ref<{ textarea: HTMLTextAreaElement | null } | null>(null)
const editorScrollerRef = ref<HTMLElement | null>(null)
const title = ref('')
const isSourceMode = ref(false)
const isLinkMenuOpen = ref(false)
const linkUrlInput = ref('')
const isApplyingEditorUpdate = ref(false)
const isSearchOpen = ref(false)
const isSystemDropTarget = ref(false)
const contextMenuOpen = ref(false)
const contextMenuVirtualEl = ref<HTMLElement | null>(null)

const buffer = computed(() => props.filePath ? editorStore.buffers[props.filePath] : null)
const sourceTextareaRef = computed(() => sourceModeRef.value?.textarea ?? null)
const { clipboardHasImportableImages, importClipboardImages } = useEditorTextClipboardImport({
  getFilePath: () => props.filePath,
})

function normalizeMarkdown(markdown: string): string {
  return markdown
    .replace(/\u00a0/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/^[ \t]+$/gm, '')
}

function currentMarkdown(): string {
  return normalizeMarkdown(editor.value?.getMarkdown() ?? '')
}

function setMarkdownContent(markdown: string) {
  const e = editor.value
  if (!e) return
  const next = normalizeMarkdown(markdown)
  if (currentMarkdown() === next) return
  isApplyingEditorUpdate.value = true
  e.commands.setContent(next, { emitUpdate: false, contentType: 'markdown' })
  nextTick(() => {
    isApplyingEditorUpdate.value = false
  })
}

function setStoreContent(markdown: string) {
  if (!props.filePath) return
  const next = normalizeMarkdown(markdown)
  if (next !== (buffer.value?.content ?? '')) {
    editorStore.setContent(props.filePath, next)
  }
}

const editor = useEditor({
  content: buffer.value?.content ?? '',
  contentType: 'markdown',
  extensions: useEditorTextExtensions(t),
  editorProps: {
    attributes: {
      class: 'neptu-tiptap focus:outline-none',
    },
    handleDOMEvents: {
      blur: () => {
        saveCursorState()
        return false
      },
      paste: (_view, event) => {
        void importClipboardImages(event)
        return clipboardHasImportableImages(event)
      },
      drop: (_view, event) => {
        const dnd = useDnd()
        const path = dnd.draggedPath.value
        if (path) {
          event.preventDefault()
          event.stopPropagation()
          if (!dnd.draggedIsDir.value) {
            if (isMediaFile(path) && props.filePath) {
              import('~/utils/paths').then(({ dirname, relativePath }) => {
                const docDir = dirname(props.filePath)
                const markdownPath = relativePath(docDir, path)
                editorStore.insertImportedFiles(
                  [{ path, markdownPath }],
                  props.filePath,
                  { coords: { x: event.clientX, y: event.clientY } },
                )
              })
            }
            else {
              useTabsStore().openFile(path).catch(() => {})
            }
          }
          dnd.onDragEnd()
          return true
        }
        return false
      },
    },
    transformPastedHTML(html: string) {
      const allowedTags = new Set([
        'p', 'br', 'strong', 'b', 'em', 'i', 's', 'del', 'a', 'code', 'pre',
        'blockquote', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'hr', 'img',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
      ])
      const doc = new DOMParser().parseFromString(html, 'text/html')
      function clean(el: Element) {
        for (const child of Array.from(el.children)) {
          if (!allowedTags.has(child.tagName.toLowerCase())) {
            child.replaceWith(...Array.from(child.childNodes))
            continue
          }
          for (const attr of Array.from(child.attributes)) {
            const isAllowedLink = child.tagName === 'A' && attr.name === 'href'
            const isAllowedImage = child.tagName === 'IMG' && ['src', 'alt', 'title'].includes(attr.name)
            if (!isAllowedLink && !isAllowedImage) child.removeAttribute(attr.name)
          }
          clean(child)
        }
      }
      clean(doc.body)
      return doc.body.innerHTML
    },
  },
  onCreate: ({ editor }) => {
    const storage = editor.storage as unknown as Record<string, { documentPath?: string | null } | undefined>
    if (storage.image) storage.image.documentPath = props.filePath
    if (storage.wikilink) storage.wikilink.documentPath = props.filePath
  },
  onUpdate: ({ editor }) => {
    if (isApplyingEditorUpdate.value) return
    setStoreContent(editor.getMarkdown())
  },
  onSelectionUpdate: ({ editor }) => {
    const { from, to, empty } = editor.state.selection
    editorStore.activeSelectionText = empty ? '' : editor.state.doc.textBetween(from, to, '\n')
  },
})

function getOldTitle(path: string): string {
  const name = path.split(/[/\\]/).pop() || ''
  const lastDot = name.lastIndexOf('.')
  return lastDot > 0 ? name.substring(0, lastDot) : name
}

watch(() => props.filePath, (path) => {
  title.value = path ? getOldTitle(path) : ''
  editorStore.activeSelectionText = ''
  const e = editor.value
  if (e) {
    const storage = e.storage as unknown as Record<string, { documentPath?: string | null } | undefined>
    if (storage.image) storage.image.documentPath = path
    if (storage.wikilink) storage.wikilink.documentPath = path
    // Re-render so MediaImage picks up the new documentPath for src resolution.
    e.view.updateState(e.state)
  }
  nextTick(() => {
    restoreCursorState()
  })
}, { immediate: true })

watch(() => buffer.value?.content ?? '', (content) => {
  setMarkdownContent(content)
}, { immediate: true })

watch(isSourceMode, (sourceMode) => {
  if (sourceMode) {
    nextTick(() => {
      restoreCursorState()
    })
  }
  else {
    nextTick(() => {
      editor.value?.commands.focus()
      restoreCursorState()
    })
  }
})

function onSourceInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  setStoreContent(target.value)
  setMarkdownContent(target.value)
  updateSourceSelection()
}

function onSourcePaste(event: ClipboardEvent) {
  void importClipboardImages(event)
}

function updateSourceSelection() {
  const textarea = sourceTextareaRef.value
  if (!textarea) {
    editorStore.activeSelectionText = ''
    return
  }
  editorStore.activeSelectionText = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd)
}

function onTitleKeydown(event: KeyboardEvent) {
  if (!titleInputRef.value) return
  if (event.key === 'ArrowDown' || event.key === 'Enter') {
    event.preventDefault()
    focusEditorAtStart()
  }
  else if (event.key === 'ArrowRight' && titleInputRef.value.selectionStart === title.value.length && titleInputRef.value.selectionEnd === title.value.length) {
    event.preventDefault()
    focusEditorAtStart()
  }
}

function onEditorKeydown(event: KeyboardEvent) {
  const e = editor.value
  if (!e || isSourceMode.value) return
  const selection = e.state.selection
  if ((event.key === 'ArrowLeft' || event.key === 'ArrowUp') && selection.empty && selection.from <= 1) {
    event.preventDefault()
    focusTitleAtEnd()
  }
}

function onSourceKeydown(event: KeyboardEvent) {
  const textarea = sourceTextareaRef.value
  if (!textarea) return
  if (event.key === 'ArrowLeft' && textarea.selectionStart === 0 && textarea.selectionEnd === 0) {
    event.preventDefault()
    focusTitleAtEnd()
  }
  else if (event.key === 'ArrowUp' && !textarea.value.substring(0, textarea.selectionStart).includes('\n')) {
    event.preventDefault()
    focusTitleAtEnd()
  }
}

function focusTitleAtEnd() {
  titleInputRef.value?.focus()
  nextTick(() => {
    if (!titleInputRef.value) return
    titleInputRef.value.selectionStart = title.value.length
    titleInputRef.value.selectionEnd = title.value.length
  })
}

function focusEditorAtStart() {
  if (isSourceMode.value) {
    sourceTextareaRef.value?.focus()
    sourceTextareaRef.value?.setSelectionRange(0, 0)
    return
  }
  editor.value?.commands.focus('start')
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

function getMarkdownManager() {
  return (editor.value as MarkdownStorageHost | undefined)?.storage?.markdown?.manager ?? null
}

function insertMarkdown(markdown: string, options?: { coords?: { x: number, y: number }, replaceTarget?: 'media-at-coords' }) {
  const e = editor.value
  if (!e) return

  // When dropped onto an existing media node, replace its src instead of
  // inserting a brand-new node (covers `Drag&Drop файла на ссылку → замена`).
  if (options?.coords && options.replaceTarget === 'media-at-coords') {
    const replaced = tryReplaceMediaAtCoords(markdown, options.coords)
    if (replaced) return
  }

  // Move caret to drop coordinates so the insertion lands where the user
  // released the file rather than at the previous selection.
  if (options?.coords) {
    const pos = e.view.posAtCoords({ left: options.coords.x, top: options.coords.y })
    if (pos) {
      e.commands.setTextSelection(pos.pos)
    }
  }

  const manager = getMarkdownManager()
  if (!manager) {
    e.chain().focus().insertContent(markdown).run()
    return
  }

  const parsed = manager.parse(markdown)
  const content = parsed?.content?.length === 1 && parsed.content[0]?.type === 'paragraph'
    ? parsed.content[0].content ?? [{ type: 'text', text: markdown }]
    : parsed?.content

  if (content?.length) {
    e.chain().focus().insertContent(content).run()
  }
  else {
    e.chain().focus().insertContent(markdown).run()
  }
}

/**
 * If the drop coordinates land on an existing image/video/audio node, swap
 * that node's `src` to point at the freshly imported media file instead of
 * adding a new sibling node.
 */
function tryReplaceMediaAtCoords(markdown: string, coords: { x: number, y: number }): boolean {
  const e = editor.value
  if (!e) return false
  const pos = e.view.posAtCoords({ left: coords.x, top: coords.y })
  if (!pos) return false

  const $pos = e.state.doc.resolve(pos.pos)
  for (let depth = $pos.depth; depth >= 0; depth--) {
    const node = $pos.node(depth)
    if (node.type.name === 'image') {
      // Single image: extract the new src from the markdown we are about to insert.
      const newSrc = markdown.match(/!\[[^\]]*\]\(([^)]+)\)/)?.[1] ?? markdown.match(/\[[^\]]*\]\(([^)]+)\)/)?.[1]
      if (!newSrc) return false
      const start = $pos.before(depth)
      e.chain().focus().setNodeSelection(start).updateAttributes('image', { src: newSrc }).run()
      return true
    }
  }
  return false
}

function insertSourceText(text: string) {
  const textarea = sourceTextareaRef.value
  if (!textarea) return
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const content = buffer.value?.content ?? ''
  const next = content.substring(0, start) + text + content.substring(end)
  setStoreContent(next)
  setMarkdownContent(next)
  nextTick(() => {
    textarea.focus()
    textarea.setSelectionRange(start + text.length, start + text.length)
    saveCursorState()
  })
}

watch(() => editorStore.insertTrigger, (trigger) => {
  if (!trigger || trigger.path !== props.filePath) return
  if (isSourceMode.value) {
    insertSourceText(trigger.text)
  }
  else {
    insertMarkdown(trigger.text, { coords: trigger.coords, replaceTarget: trigger.replaceTarget })
    saveCursorState()
  }
})

watch(() => props.filePath ? editorStore.scrollToLineTrigger[props.filePath] : null, (line) => {
  if (line === undefined || line === null) return
  const text = buffer.value?.content ?? ''
  const lines = text.split('\n')
  let charIndex = 0
  for (let i = 0; i < line; i++) {
    charIndex += (lines[i] ?? '').length + 1
  }

  if (isSourceMode.value && sourceTextareaRef.value) {
    sourceTextareaRef.value.focus()
    sourceTextareaRef.value.setSelectionRange(charIndex, charIndex)
    sourceTextareaRef.value.scrollTop = line * 28
    return
  }

  const e = editor.value
  if (!e) return
  e.commands.focus()
  e.commands.setTextSelection(Math.min(charIndex + 1, e.state.doc.content.size))
  if (editorScrollerRef.value) editorScrollerRef.value.scrollTop = line * 28
})

function saveCursorState() {
  const path = props.filePath
  if (!path) return
  if (isSourceMode.value && sourceTextareaRef.value) {
    editorStore.saveCursorPosition(path, {
      selectionStart: sourceTextareaRef.value.selectionStart,
      selectionEnd: sourceTextareaRef.value.selectionEnd,
      scrollTop: sourceTextareaRef.value.scrollTop,
    })
  }
  else if (editor.value) {
    editorStore.saveCursorPosition(path, {
      selectionStart: editor.value.state.selection.from,
      selectionEnd: editor.value.state.selection.to,
      scrollTop: editorScrollerRef.value?.scrollTop ?? 0,
    })
  }
  editorStore.saveUiState()
}

function restoreCursorState() {
  const path = props.filePath
  if (!path) return
  const pos = editorStore.getCursorPosition(path)
  if (!pos) return

  if (isSourceMode.value && sourceTextareaRef.value) {
    const max = sourceTextareaRef.value.value.length
    sourceTextareaRef.value.setSelectionRange(Math.min(pos.selectionStart, max), Math.min(pos.selectionEnd, max))
    sourceTextareaRef.value.scrollTop = pos.scrollTop
    return
  }

  const e = editor.value
  if (!e) return
  const max = e.state.doc.content.size
  e.commands.setTextSelection({
    from: Math.max(1, Math.min(pos.selectionStart, max)),
    to: Math.max(1, Math.min(pos.selectionEnd, max)),
  })
  if (editorScrollerRef.value) editorScrollerRef.value.scrollTop = pos.scrollTop
}

function setLink() {
  const e = editor.value
  if (!e) return
  linkUrlInput.value = e.getAttributes('link').href ?? ''
  isLinkMenuOpen.value = true
}

function applyLink() {
  const e = editor.value
  if (!e) return
  const url = linkUrlInput.value.trim()
  if (!url) {
    e.chain().focus().extendMarkRange('link').unsetLink().run()
  }
  else {
    e.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }
  isLinkMenuOpen.value = false
  linkUrlInput.value = ''
}

function cancelLink() {
  isLinkMenuOpen.value = false
  linkUrlInput.value = ''
  editor.value?.commands.focus()
}

function removeLink() {
  editor.value?.chain().focus().extendMarkRange('link').unsetLink().run()
  cancelLink()
}

function insertTable() {
  editor.value?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
}

function showAiPlaceholder(kind: 'write' | 'rewrite' | 'translate') {
  toast.add({
    title: t(`editor.ai.${kind}`),
    description: t('editor.ai.placeholder'),
    color: 'neutral',
  })
}

function toggleTaskList() {
  editor.value?.chain().focus().toggleTaskList().run()
}

/**
 * Inserts (or replaces) a GFM-alert callout: a blockquote whose first line is
 * `[!NOTE]` / `[!TIP]` / etc. This is rendered specially via CSS and stays
 * fully compatible with GitHub and Obsidian markdown.
 */
function insertCallout(variant: CalloutVariant) {
  const e = editor.value
  if (!e) return
  if (isSourceMode.value) {
    insertSourceText(`\n> [!${variant.toUpperCase()}]\n> \n`)
    return
  }
  const marker = `[!${variant.toUpperCase()}]`
  const placeholder = t(`editor.callout.${variant}`)
  e.chain().focus()
    .insertContent({
      type: 'blockquote',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: marker }] },
        { type: 'paragraph', content: [{ type: 'text', text: placeholder }] },
      ],
    })
    .run()
}

function toggleSearch() {
  isSearchOpen.value = !isSearchOpen.value
}

async function pasteAsPlainText() {
  if (!editor.value) return
  try {
    const text = await navigator.clipboard.readText()
    if (!text) return
    if (isSourceMode.value) {
      insertSourceText(text)
    }
    else {
      editor.value.chain().focus().insertContent(text).run()
    }
  }
  catch (error) {
    console.error('Plain paste failed', error)
  }
}

async function pasteFromClipboard() {
  if (!editor.value) return
  try {
    const text = await navigator.clipboard.readText()
    if (!text) return
    if (isSourceMode.value) {
      insertSourceText(text)
    }
    else {
      // Re-use the markdown manager so that pasted text is parsed as markdown
      // (links, headings, etc.) rather than inserted as a literal string.
      insertMarkdown(text)
    }
  }
  catch (error) {
    console.error('Paste from clipboard failed', error)
  }
}

function copySelection() {
  if (!editor.value) return
  const { from, to, empty } = editor.value.state.selection
  if (empty) return
  const text = editor.value.state.doc.textBetween(from, to, '\n')
  void navigator.clipboard.writeText(text)
}

function cutSelection() {
  if (!editor.value) return
  const { from, to, empty } = editor.value.state.selection
  if (empty) return
  const text = editor.value.state.doc.textBetween(from, to, '\n')
  void navigator.clipboard.writeText(text)
  editor.value.chain().focus().deleteSelection().run()
}

function selectAllInEditor() {
  editor.value?.commands.selectAll()
}

const contextMenuItems = computed(() => [[
  { label: t('editor.context.cut'), icon: 'i-lucide-scissors', kbds: ['meta', 'X'], onSelect: cutSelection },
  { label: t('editor.context.copy'), icon: 'i-lucide-copy', kbds: ['meta', 'C'], onSelect: copySelection },
  { label: t('editor.context.paste'), icon: 'i-lucide-clipboard', kbds: ['meta', 'V'], onSelect: pasteFromClipboard },
  { label: t('editor.context.pastePlain'), icon: 'i-lucide-clipboard-paste', kbds: ['meta', 'shift', 'V'], onSelect: pasteAsPlainText },
], [
  { label: t('editor.context.selectAll'), icon: 'i-lucide-square-dashed', kbds: ['meta', 'A'], onSelect: selectAllInEditor },
  { label: t('editor.context.find'), icon: 'i-lucide-search', kbds: ['meta', 'F'], onSelect: () => { isSearchOpen.value = true } },
]])

function onEditorContextMenu(event: MouseEvent) {
  contextMenuVirtualEl.value = event.target as HTMLElement
  contextMenuOpen.value = true
}

function onEditorRootKeydown(event: KeyboardEvent) {
  const mod = event.ctrlKey || event.metaKey
  if (!mod) return
  if (event.key === 'f' || event.key === 'F') {
    event.preventDefault()
    isSearchOpen.value = true
  }
  else if (event.key === 'h' || event.key === 'H') {
    event.preventDefault()
    isSearchOpen.value = true
  }
  else if (event.shiftKey && (event.key === 'v' || event.key === 'V')) {
    event.preventDefault()
    void pasteAsPlainText()
  }
}

function onSystemDragOver(event: DragEvent) {
  if (!event.dataTransfer) return
  const hasFiles = Array.from(event.dataTransfer.types).includes('Files')
  if (!hasFiles) return
  event.preventDefault()
  isSystemDropTarget.value = true
  event.dataTransfer.dropEffect = 'copy'
}

function onSystemDragLeave(event: DragEvent) {
  // Only clear when leaving the editor root, not children.
  const related = event.relatedTarget as Node | null
  if (related && (event.currentTarget as HTMLElement).contains(related)) return
  isSystemDropTarget.value = false
}

async function onSystemDrop(event: DragEvent) {
  isSystemDropTarget.value = false
  const files = Array.from(event.dataTransfer?.files ?? [])
  if (files.length === 0 || !props.filePath) return
  event.preventDefault()
  event.stopPropagation()

  try {
    const items = await Promise.all(files.map(async (file) => ({
      name: file.name || `file-${Date.now()}`,
      type: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    })))
    const onConflict = importHelper.makeAskPolicy()
    const imported = await useVaultsStore().importMediaBytesForDocument(items, props.filePath, { onConflict })
    if (imported.length > 0) {
      const targetEl = event.target as Element | null
      const onMedia = !!targetEl?.closest('[data-original-src], img, video, audio')
      editorStore.insertImportedFiles(imported, props.filePath, {
        coords: { x: event.clientX, y: event.clientY },
        replaceTarget: onMedia ? 'media-at-coords' : undefined,
      })
    }
  }
  catch (error) {
    toast.add({
      title: t('toast.importFailed'),
      description: error instanceof Error ? error.message : String(error),
      color: 'error',
    })
  }
}

onUnmounted(() => {
  editor.value?.destroy()
  editorStore.activeSelectionText = ''
})
</script>

<template>
  <div
    class="flex-1 overflow-hidden flex flex-col min-h-0"
    :data-editor-file-path="props.filePath"
  >
    <FrontmatterForm :file-path="props.filePath" />

    <input
      ref="titleInputRef"
      v-model="title"
      class="w-full shrink-0 bg-transparent outline-none px-8 pt-8 pb-4 font-sans text-3xl font-bold text-default placeholder-muted"
      :placeholder="$t('editor.untitled')"
      @keydown="onTitleKeydown"
      @blur="renameCurrentFile"
    />

    <EditorTextBubbleMenus
      v-model:link-url-input="linkUrlInput"
      :editor="editor ?? null"
      :is-source-mode="isSourceMode"
      :is-link-menu-open="isLinkMenuOpen"
      @set-link="setLink"
      @apply-link="applyLink"
      @cancel-link="cancelLink"
      @remove-link="removeLink"
      @show-ai-placeholder="showAiPlaceholder"
    />

    <EditorTextToolbar
      v-model:source-mode="isSourceMode"
      :editor="editor ?? null"
      :is-link-menu-open="isLinkMenuOpen"
      :is-search-open="isSearchOpen"
      @set-link="setLink"
      @insert-table="insertTable"
      @toggle-task-list="toggleTaskList"
      @insert-callout="insertCallout"
      @toggle-search="toggleSearch"
      @show-ai-placeholder="showAiPlaceholder"
    />

    <EditorSearchPanel
      v-if="editor"
      :editor="editor"
      :open="isSearchOpen"
      @close="isSearchOpen = false"
    />

    <div
      ref="editorScrollerRef"
      class="relative min-h-0 flex-1 overflow-y-auto px-8 pb-6"
      @dragover.prevent="onSystemDragOver"
      @dragleave="onSystemDragLeave"
      @drop="onSystemDrop"
      @keydown="onEditorRootKeydown"
    >
      <div
        v-show="isSystemDropTarget"
        class="absolute inset-0 z-10 flex items-center justify-center bg-primary/5 border-2 border-dashed border-primary/50 rounded-md"
      >
        <div class="bg-elevated px-6 py-4 rounded-xl shadow-2xl border border-default flex flex-col items-center gap-2">
          <UIcon
            name="i-lucide-download"
            class="size-8 text-primary"
          />
          <span class="text-sm text-muted font-medium">{{ $t('editor.dropHere') }}</span>
        </div>
      </div>

      <EditorTextStickyToolbar
        v-if="editor && !isSourceMode"
        :editor="editor"
        @toggle-task-list="toggleTaskList"
        @toggle-search="toggleSearch"
      />

      <UContextMenu
        v-if="editor && !isSourceMode"
        v-model:open="contextMenuOpen"
        :items="contextMenuItems"
        :virtual-element="contextMenuVirtualEl ?? undefined"
      >
        <EditorContent
          v-show="!isSourceMode"
          :editor="editor"
          :data-editor-file-path="props.filePath"
          @keydown="onEditorKeydown"
          @contextmenu.prevent="onEditorContextMenu"
        />
      </UContextMenu>

      <EditorTextSourceMode
        v-show="isSourceMode"
        ref="sourceModeRef"
        :file-path="props.filePath"
        :content="buffer?.content ?? ''"
        @input="onSourceInput"
        @paste="onSourcePaste"
        @keydown="onSourceKeydown"
        @keyup="updateSourceSelection"
        @mouseup="updateSourceSelection"
        @blur="saveCursorState"
        @select="updateSourceSelection"
      />
    </div>
  </div>
</template>
