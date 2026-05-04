<script setup lang="ts">
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import { Table } from '@tiptap/extension-table'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableRow } from '@tiptap/extension-table-row'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { Markdown } from '@tiptap/markdown'
import { MediaImage } from '~/app-extensions/Media'
import { SearchHighlight } from '~/app-extensions/SearchHighlight'
import { isImageFile } from '~/utils/fileTypes'

type CalloutVariant = 'note' | 'tip' | 'important' | 'warning' | 'caution'
const CALLOUT_VARIANTS: CalloutVariant[] = ['note', 'tip', 'important', 'warning', 'caution']

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

interface ClipboardMediaItem {
  name: string
  type?: string
  bytes: Uint8Array
}

const props = defineProps<{
  filePath: string
}>()

const editorStore = useEditorStore()
const importHelper = useEditorImport()
const { t } = useI18n()
const toast = useToast()

const titleInputRef = ref<HTMLInputElement | null>(null)
const sourceTextareaRef = ref<HTMLTextAreaElement | null>(null)
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

function clipboardImageName(file: File, index: number): string {
  if (file.name) return file.name
  switch (file.type) {
    case 'image/jpeg': return `clipboard-image-${index + 1}.jpg`
    case 'image/webp': return `clipboard-image-${index + 1}.webp`
    case 'image/gif': return `clipboard-image-${index + 1}.gif`
    case 'image/avif': return `clipboard-image-${index + 1}.avif`
    case 'image/svg+xml': return `clipboard-image-${index + 1}.svg`
    default: return `clipboard-image-${index + 1}.png`
  }
}

function clipboardHasImportableImages(event: ClipboardEvent): boolean {
  const hasImageFiles = Array.from(event.clipboardData?.files ?? [])
    .some((file) => file.type.startsWith('image/') || isImageFile(file.name))
  if (hasImageFiles) return true

  return /<img\b[^>]*\bsrc=["']data:image\//i.test(event.clipboardData?.getData('text/html') ?? '')
}

async function dataUrlToMediaItem(src: string, index: number): Promise<ClipboardMediaItem | null> {
  const match = src.match(/^data:([^;,]+)[^,]*,(.*)$/)
  if (!match) return null

  const response = await fetch(src)
  const type = match[1] ?? response.headers.get('content-type') ?? 'image/png'
  return {
    name: clipboardImageName(new File([], '', { type }), index),
    type,
    bytes: new Uint8Array(await response.arrayBuffer()),
  }
}

async function importClipboardImages(event: ClipboardEvent): Promise<boolean> {
  if (!props.filePath) return false
  const files = Array.from(event.clipboardData?.files ?? [])
    .filter((file) => file.type.startsWith('image/') || isImageFile(file.name))

  const html = event.clipboardData?.getData('text/html') ?? ''
  if (files.length === 0 && !clipboardHasImportableImages(event)) return false

  event.preventDefault()
  event.stopPropagation()

  try {
    const items: ClipboardMediaItem[] = files.length > 0
      ? await Promise.all(files.map(async (file, index) => ({
          name: clipboardImageName(file, index),
          type: file.type,
          bytes: new Uint8Array(await file.arrayBuffer()),
        })))
      : []

    if (items.length === 0) {
      const dataItems = await Promise.all(
        Array.from(new DOMParser().parseFromString(html, 'text/html').querySelectorAll('img[src^="data:image/"]'))
          .map((image, index) => dataUrlToMediaItem(image.getAttribute('src') ?? '', index)),
      )
      for (const item of dataItems) {
        if (item) items.push(item)
      }
    }

    const onConflict = importHelper.makeAskPolicy()
    const imported = await useVaultsStore().importMediaBytesForDocument(items, props.filePath, { onConflict })
    if (imported.length > 0) {
      editorStore.insertImportedFiles(imported, props.filePath)
      return true
    }
  }
  catch (error) {
    toast.add({
      title: t('toast.importFailed', 'Import failed'),
      description: error instanceof Error ? error.message : String(error),
      color: 'error',
    })
  }

  return true
}

const editor = useEditor({
  content: buffer.value?.content ?? '',
  contentType: 'markdown',
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: false,
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      defaultProtocol: 'https',
      HTMLAttributes: {
        class: 'text-primary underline underline-offset-2 cursor-pointer',
      },
    }),
    MediaImage.configure({
      allowBase64: true,
      HTMLAttributes: {
        class: 'max-w-full rounded-md border border-default',
      },
    }),
    TaskList.configure({
      HTMLAttributes: { class: 'neptu-task-list' },
    }),
    TaskItem.configure({
      nested: true,
      HTMLAttributes: { class: 'neptu-task-item' },
    }),
    SearchHighlight,
    Markdown.configure({
      markedOptions: {
        gfm: true,
        breaks: false,
      },
    }),
    Placeholder.configure({
      placeholder: () => t('editor.startWriting'),
    }),
    Table.configure({
      resizable: true,
    }),
    TableRow,
    TableHeader,
    TableCell,
  ],
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
    },
    transformPastedHTML(html: string) {
      const allowedTags = new Set([
        'p', 'br', 'strong', 'b', 'em', 'i', 's', 'del', 'a', 'code', 'pre',
        'blockquote', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'hr', 'img',
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
      title: t('toast.importFailed', 'Import failed'),
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

    <BubbleMenu
      v-if="editor"
      :editor="editor"
      plugin-key="neptu-formatting-bubble"
      :options="{ offset: 8, placement: 'top' }"
      :should-show="({ editor: e, state }) => !isSourceMode && !isLinkMenuOpen && !state.selection.empty && !e.isActive('table') && !e.isActive('codeBlock')"
    >
      <div class="flex items-center gap-0.5 rounded-md border border-default bg-default p-1 shadow-lg">
        <UButton
          :color="editor.isActive('bold') ? 'primary' : 'neutral'"
          :variant="editor.isActive('bold') ? 'soft' : 'ghost'"
          size="xs"
          icon="i-lucide-bold"
          :aria-label="$t('editor.toolbar.bold')"
          @click="editor.chain().focus().toggleBold().run()"
        />
        <UButton
          :color="editor.isActive('italic') ? 'primary' : 'neutral'"
          :variant="editor.isActive('italic') ? 'soft' : 'ghost'"
          size="xs"
          icon="i-lucide-italic"
          :aria-label="$t('editor.toolbar.italic')"
          @click="editor.chain().focus().toggleItalic().run()"
        />
        <UButton
          :color="editor.isActive('strike') ? 'primary' : 'neutral'"
          :variant="editor.isActive('strike') ? 'soft' : 'ghost'"
          size="xs"
          icon="i-lucide-strikethrough"
          :aria-label="$t('editor.toolbar.strike')"
          @click="editor.chain().focus().toggleStrike().run()"
        />
        <div class="mx-1 h-4 w-px bg-default" />
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-link"
          :aria-label="$t('editor.toolbar.link')"
          @mousedown.prevent
          @click="setLink"
        />
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-sparkles"
          :aria-label="$t('editor.ai.rewrite')"
          @click="showAiPlaceholder('rewrite')"
        />
      </div>
    </BubbleMenu>

    <BubbleMenu
      v-if="editor"
      :editor="editor"
      plugin-key="neptu-link-bubble"
      :options="{ offset: 8, placement: 'top' }"
      :should-show="() => isLinkMenuOpen"
    >
      <div class="flex items-center gap-2 rounded-md border border-default bg-default p-2 shadow-lg">
        <UInput
          v-model="linkUrlInput"
          size="xs"
          class="w-56"
          placeholder="https://"
          @keydown.enter="applyLink"
          @keydown.esc="cancelLink"
        />
        <UButton
          size="xs"
          color="primary"
          :label="$t('editor.apply')"
          @click="applyLink"
        />
        <UButton
          v-if="editor.isActive('link')"
          size="xs"
          color="error"
          variant="ghost"
          icon="i-lucide-trash-2"
          :aria-label="$t('editor.toolbar.unlink')"
          @click="removeLink"
        />
        <UButton
          v-else
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          :aria-label="$t('editor.close')"
          @click="cancelLink"
        />
      </div>
    </BubbleMenu>

    <BubbleMenu
      v-if="editor"
      :editor="editor"
      plugin-key="neptu-table-bubble"
      :options="{ offset: 8, placement: 'bottom' }"
      :should-show="({ editor: e }) => !isSourceMode && e.isActive('table')"
    >
      <div class="flex max-w-[90vw] items-center gap-0.5 overflow-x-auto rounded-md border border-default bg-default p-1 shadow-lg">
        <UButton
          size="xs"
          variant="ghost"
          icon="i-lucide-plus"
          :aria-label="$t('editor.table.addColumnBefore')"
          @click="editor.chain().focus().addColumnBefore().run()"
        />
        <UButton
          size="xs"
          variant="ghost"
          icon="i-lucide-plus"
          class="rotate-90"
          :aria-label="$t('editor.table.addColumnAfter')"
          @click="editor.chain().focus().addColumnAfter().run()"
        />
        <UButton
          size="xs"
          color="error"
          variant="ghost"
          icon="i-lucide-trash-2"
          :aria-label="$t('editor.table.deleteColumn')"
          @click="editor.chain().focus().deleteColumn().run()"
        />
        <div class="mx-1 h-4 w-px bg-default" />
        <UButton
          size="xs"
          variant="ghost"
          icon="i-lucide-panel-top"
          :aria-label="$t('editor.table.addRowBefore')"
          @click="editor.chain().focus().addRowBefore().run()"
        />
        <UButton
          size="xs"
          variant="ghost"
          icon="i-lucide-panel-bottom"
          :aria-label="$t('editor.table.addRowAfter')"
          @click="editor.chain().focus().addRowAfter().run()"
        />
        <UButton
          size="xs"
          color="error"
          variant="ghost"
          icon="i-lucide-trash-2"
          :aria-label="$t('editor.table.deleteRow')"
          @click="editor.chain().focus().deleteRow().run()"
        />
        <div class="mx-1 h-4 w-px bg-default" />
        <UButton
          size="xs"
          color="error"
          variant="ghost"
          icon="i-lucide-table-x"
          :aria-label="$t('editor.table.deleteTable')"
          @click="editor.chain().focus().deleteTable().run()"
        />
      </div>
    </BubbleMenu>

    <div class="mx-8 mb-3 flex shrink-0 flex-wrap items-center gap-1 rounded-md border border-default bg-muted/40 px-2 py-1">
      <UButton
        :color="isSourceMode ? 'primary' : 'neutral'"
        :variant="isSourceMode ? 'soft' : 'ghost'"
        size="xs"
        icon="i-lucide-code-2"
        :label="$t('editor.toolbar.markdown')"
        @click="isSourceMode = !isSourceMode"
      />
      <div class="mx-1 h-5 w-px bg-default" />

      <template v-if="!isSourceMode && editor">
        <UButton
          :color="editor.isActive('bold') ? 'primary' : 'neutral'"
          :variant="editor.isActive('bold') ? 'soft' : 'ghost'"
          size="xs"
          icon="i-lucide-bold"
          :aria-label="$t('editor.toolbar.bold')"
          @click="editor.chain().focus().toggleBold().run()"
        />
        <UButton
          :color="editor.isActive('italic') ? 'primary' : 'neutral'"
          :variant="editor.isActive('italic') ? 'soft' : 'ghost'"
          size="xs"
          icon="i-lucide-italic"
          :aria-label="$t('editor.toolbar.italic')"
          @click="editor.chain().focus().toggleItalic().run()"
        />
        <UButton
          :color="editor.isActive('strike') ? 'primary' : 'neutral'"
          :variant="editor.isActive('strike') ? 'soft' : 'ghost'"
          size="xs"
          icon="i-lucide-strikethrough"
          :aria-label="$t('editor.toolbar.strike')"
          @click="editor.chain().focus().toggleStrike().run()"
        />
        <UButton
          :color="editor.isActive('code') ? 'primary' : 'neutral'"
          :variant="editor.isActive('code') ? 'soft' : 'ghost'"
          size="xs"
          icon="i-lucide-code"
          :aria-label="$t('editor.toolbar.code')"
          @click="editor.chain().focus().toggleCode().run()"
        />
        <div class="mx-1 h-5 w-px bg-default" />
        <UButton
          :color="editor.isActive('heading', { level: 1 }) ? 'primary' : 'neutral'"
          :variant="editor.isActive('heading', { level: 1 }) ? 'soft' : 'ghost'"
          size="xs"
          label="H1"
          @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
        />
        <UButton
          :color="editor.isActive('heading', { level: 2 }) ? 'primary' : 'neutral'"
          :variant="editor.isActive('heading', { level: 2 }) ? 'soft' : 'ghost'"
          size="xs"
          label="H2"
          @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
        />
        <UButton
          :color="editor.isActive('heading', { level: 3 }) ? 'primary' : 'neutral'"
          :variant="editor.isActive('heading', { level: 3 }) ? 'soft' : 'ghost'"
          size="xs"
          label="H3"
          @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
        />
        <div class="mx-1 h-5 w-px bg-default" />
        <UButton
          :color="editor.isActive('bulletList') ? 'primary' : 'neutral'"
          :variant="editor.isActive('bulletList') ? 'soft' : 'ghost'"
          size="xs"
          icon="i-lucide-list"
          :aria-label="$t('editor.toolbar.bulletList')"
          @click="editor.chain().focus().toggleBulletList().run()"
        />
        <UButton
          :color="editor.isActive('orderedList') ? 'primary' : 'neutral'"
          :variant="editor.isActive('orderedList') ? 'soft' : 'ghost'"
          size="xs"
          icon="i-lucide-list-ordered"
          :aria-label="$t('editor.toolbar.orderedList')"
          @click="editor.chain().focus().toggleOrderedList().run()"
        />
        <UButton
          :color="editor.isActive('taskList') ? 'primary' : 'neutral'"
          :variant="editor.isActive('taskList') ? 'soft' : 'ghost'"
          size="xs"
          icon="i-lucide-check-square"
          :aria-label="$t('editor.toolbar.taskList')"
          @click="toggleTaskList"
        />
        <UButton
          :color="editor.isActive('blockquote') ? 'primary' : 'neutral'"
          :variant="editor.isActive('blockquote') ? 'soft' : 'ghost'"
          size="xs"
          icon="i-lucide-quote"
          :aria-label="$t('editor.toolbar.quote')"
          @click="editor.chain().focus().toggleBlockquote().run()"
        />
        <UDropdownMenu
          :items="CALLOUT_VARIANTS.map(v => ({ label: $t(`editor.callout.${v}`), onSelect: () => insertCallout(v) }))"
        >
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-alert-circle"
            :aria-label="$t('editor.toolbar.callout')"
          />
        </UDropdownMenu>
        <UButton
          :color="editor.isActive('codeBlock') ? 'primary' : 'neutral'"
          :variant="editor.isActive('codeBlock') ? 'soft' : 'ghost'"
          size="xs"
          icon="i-lucide-square-code"
          :aria-label="$t('editor.toolbar.codeBlock')"
          @click="editor.chain().focus().toggleCodeBlock().run()"
        />
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-minus"
          :aria-label="$t('editor.toolbar.divider')"
          @click="editor.chain().focus().setHorizontalRule().run()"
        />
        <div class="mx-1 h-5 w-px bg-default" />
        <UButton
          :color="(editor.isActive('link') || isLinkMenuOpen) ? 'primary' : 'neutral'"
          :variant="(editor.isActive('link') || isLinkMenuOpen) ? 'soft' : 'ghost'"
          size="xs"
          icon="i-lucide-link"
          :aria-label="$t('editor.toolbar.link')"
          @mousedown.prevent
          @click="setLink"
        />
        <UButton
          :color="editor.isActive('table') ? 'primary' : 'neutral'"
          :variant="editor.isActive('table') ? 'soft' : 'ghost'"
          size="xs"
          icon="i-lucide-table"
          :aria-label="$t('editor.toolbar.table')"
          @click="insertTable"
        />
        <div class="mx-1 h-5 w-px bg-default" />
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-undo-2"
          :aria-label="$t('editor.toolbar.undo')"
          :disabled="!editor.can().undo()"
          @click="editor.chain().focus().undo().run()"
        />
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-redo-2"
          :aria-label="$t('editor.toolbar.redo')"
          :disabled="!editor.can().redo()"
          @click="editor.chain().focus().redo().run()"
        />
        <div class="mx-1 h-5 w-px bg-default" />
        <UButton
          :color="isSearchOpen ? 'primary' : 'neutral'"
          :variant="isSearchOpen ? 'soft' : 'ghost'"
          size="xs"
          icon="i-lucide-search"
          :aria-label="$t('editor.toolbar.search')"
          @click="toggleSearch"
        />
      </template>

      <div class="min-w-2 flex-1" />
      <template v-if="!isSourceMode">
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-sparkles"
          :label="$t('editor.ai.write')"
          @click="showAiPlaceholder('write')"
        />
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-wand-sparkles"
          :label="$t('editor.ai.rewrite')"
          @click="showAiPlaceholder('rewrite')"
        />
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-languages"
          :label="$t('editor.ai.translate')"
          @click="showAiPlaceholder('translate')"
        />
      </template>
    </div>

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

      <div
        v-if="editor && !isSourceMode"
        class="sticky top-0 z-20 hidden pb-2 md:flex items-center gap-1"
      >
        <UButton
          :color="editor.isActive('bold') ? 'primary' : 'neutral'"
          :variant="editor.isActive('bold') ? 'soft' : 'ghost'"
          size="xs"
          icon="i-lucide-bold"
          :aria-label="$t('editor.toolbar.bold')"
          @click="editor.chain().focus().toggleBold().run()"
        />
        <UButton
          :color="editor.isActive('italic') ? 'primary' : 'neutral'"
          :variant="editor.isActive('italic') ? 'soft' : 'ghost'"
          size="xs"
          icon="i-lucide-italic"
          :aria-label="$t('editor.toolbar.italic')"
          @click="editor.chain().focus().toggleItalic().run()"
        />
        <UButton
          :color="editor.isActive('strike') ? 'primary' : 'neutral'"
          :variant="editor.isActive('strike') ? 'soft' : 'ghost'"
          size="xs"
          icon="i-lucide-strikethrough"
          :aria-label="$t('editor.toolbar.strike')"
          @click="editor.chain().focus().toggleStrike().run()"
        />
        <UButton
          :color="editor.isActive('heading', { level: 1 }) ? 'primary' : 'neutral'"
          :variant="editor.isActive('heading', { level: 1 }) ? 'soft' : 'ghost'"
          size="xs"
          label="H1"
          @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
        />
        <UButton
          :color="editor.isActive('heading', { level: 2 }) ? 'primary' : 'neutral'"
          :variant="editor.isActive('heading', { level: 2 }) ? 'soft' : 'ghost'"
          size="xs"
          label="H2"
          @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
        />
        <UButton
          :color="editor.isActive('bulletList') ? 'primary' : 'neutral'"
          :variant="editor.isActive('bulletList') ? 'soft' : 'ghost'"
          size="xs"
          icon="i-lucide-list"
          :aria-label="$t('editor.toolbar.bulletList')"
          @click="editor.chain().focus().toggleBulletList().run()"
        />
        <UButton
          :color="editor.isActive('taskList') ? 'primary' : 'neutral'"
          :variant="editor.isActive('taskList') ? 'soft' : 'ghost'"
          size="xs"
          icon="i-lucide-check-square"
          :aria-label="$t('editor.toolbar.taskList')"
          @click="toggleTaskList"
        />
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-minus"
          :aria-label="$t('editor.toolbar.divider')"
          @click="editor.chain().focus().setHorizontalRule().run()"
        />
        <div class="min-w-2 flex-1" />
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-search"
          :aria-label="$t('editor.toolbar.search')"
          @click="toggleSearch"
        />
      </div>

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

      <textarea
        v-show="isSourceMode"
        :key="props.filePath"
        ref="sourceTextareaRef"
        :value="buffer?.content ?? ''"
        class="h-full min-h-[480px] w-full resize-none bg-transparent pb-8 font-mono text-base leading-7 text-default outline-none"
        spellcheck="false"
        :data-editor-file-path="props.filePath"
        :placeholder="$t('editor.startWriting')"
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

<style scoped>
@reference "~/assets/css/main.css";

:deep(.neptu-tiptap) {
  min-height: 480px;
  padding-bottom: 2rem;
  color: var(--ui-text);
  font-size: 1rem;
  line-height: 1.75rem;
  outline: none;
}

:deep(.neptu-tiptap > * + *) {
  margin-top: 0.9rem;
}

:deep(.neptu-tiptap p.is-editor-empty:first-child::before) {
  color: var(--ui-text-muted);
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

:deep(.neptu-tiptap h1) {
  margin-top: 1.6rem;
  font-size: 1.9rem;
  font-weight: 700;
  line-height: 2.35rem;
}

:deep(.neptu-tiptap h2) {
  margin-top: 1.35rem;
  font-size: 1.45rem;
  font-weight: 700;
  line-height: 2rem;
}

:deep(.neptu-tiptap h3) {
  margin-top: 1.1rem;
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.75rem;
}

:deep(.neptu-tiptap ul),
:deep(.neptu-tiptap ol) {
  padding-left: 1.35rem;
}

:deep(.neptu-tiptap ul) {
  list-style: disc;
}

:deep(.neptu-tiptap ol) {
  list-style: decimal;
}

:deep(.neptu-tiptap blockquote) {
  border-left: 3px solid var(--ui-border-accented);
  color: var(--ui-text-muted);
  padding-left: 1rem;
}

:deep(.neptu-tiptap code) {
  border-radius: 0.25rem;
  background: var(--ui-bg-muted);
  padding: 0.1rem 0.3rem;
  font-family: var(--font-mono);
  font-size: 0.92em;
}

:deep(.neptu-tiptap pre) {
  overflow-x: auto;
  border-radius: 0.375rem;
  background: var(--ui-bg-muted);
  padding: 0.85rem 1rem;
}

:deep(.neptu-tiptap pre code) {
  background: transparent;
  padding: 0;
}

:deep(.neptu-tiptap hr) {
  border: 0;
  border-top: 1px solid var(--ui-border);
}

:deep(.neptu-tiptap table) {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

:deep(.neptu-tiptap th),
:deep(.neptu-tiptap td) {
  border: 1px solid var(--ui-border);
  padding: 0.45rem 0.6rem;
  vertical-align: top;
}

:deep(.neptu-tiptap th) {
  background: var(--ui-bg-muted);
  font-weight: 600;
}

:deep(.neptu-tiptap .selectedCell::after) {
  position: absolute;
  inset: 0;
  background: color-mix(in oklab, var(--ui-primary) 14%, transparent);
  content: "";
  pointer-events: none;
}

:deep(.neptu-tiptap .column-resize-handle) {
  position: absolute;
  top: 0;
  right: -2px;
  bottom: -2px;
  width: 4px;
  background: var(--ui-primary);
  pointer-events: none;
}

/* Task list (checkbox) */
:deep(.neptu-tiptap ul[data-type="taskList"]) {
  list-style: none;
  padding-left: 0;
}
:deep(.neptu-tiptap ul[data-type="taskList"] li) {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
}
:deep(.neptu-tiptap ul[data-type="taskList"] li > label) {
  flex-shrink: 0;
  margin-top: 0.25rem;
}
:deep(.neptu-tiptap ul[data-type="taskList"] li > div) {
  flex: 1;
}
:deep(.neptu-tiptap ul[data-type="taskList"] li > div p) {
  margin-top: 0;
}

/* GFM callout / alert blockquote */
:deep(.neptu-tiptap blockquote[data-callout]) {
  border-left: 4px solid var(--ui-border-accented);
  padding: 0.75rem 1rem;
  border-radius: 0.375rem;
  background: var(--ui-bg-muted);
}
:deep(.neptu-tiptap blockquote[data-callout="note"]) {
  border-left-color: #3b82f6;
}
:deep(.neptu-tiptap blockquote[data-callout="tip"]) {
  border-left-color: #22c55e;
}
:deep(.neptu-tiptap blockquote[data-callout="important"]) {
  border-left-color: #a855f7;
}
:deep(.neptu-tiptap blockquote[data-callout="warning"]) {
  border-left-color: #f59e0b;
}
:deep(.neptu-tiptap blockquote[data-callout="caution"]) {
  border-left-color: #ef4444;
}

/* Media (audio, video) */
:deep(.neptu-tiptap video),
:deep(.neptu-tiptap audio) {
  max-width: 100%;
  border-radius: 0.375rem;
}
:deep(.neptu-tiptap video) {
  display: block;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}
:deep(.neptu-tiptap audio) {
  display: block;
  width: 100%;
  max-width: 420px;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

/* Search highlight */
:deep(.neptu-search-match) {
  background: color-mix(in oklab, var(--ui-warning) 20%, transparent);
  border-radius: 2px;
}
:deep(.neptu-search-match-active) {
  background: color-mix(in oklab, var(--ui-primary) 35%, transparent);
  border-radius: 2px;
}

/* Attachment card (non-media link) */
:deep(.neptu-tiptap a[data-attachment="true"]) {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.65rem;
  border-radius: 0.375rem;
  background: var(--ui-bg-muted);
  border: 1px solid var(--ui-border);
  text-decoration: none;
  font-size: 0.88em;
  max-width: 100%;
}
:deep(.neptu-tiptap a[data-attachment="true"]:hover) {
  background: var(--ui-bg-elevated);
}
</style>
