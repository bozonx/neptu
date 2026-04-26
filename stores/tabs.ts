import { defineStore } from 'pinia'

export interface EditorTab {
  id: string
  filePath: string
}

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Owns the list of open editor tabs. A tab is a pointer to a file path on
 * disk; the actual buffer of the *active* tab lives in `useEditorStore`.
 * Switching tabs flushes the current buffer to disk (respecting autosave
 * semantics) and loads the target file into the editor.
 *
 * Tabs may reference files from different vaults.
 */
export const useTabsStore = defineStore('tabs', () => {
  const tabs = ref<EditorTab[]>([])
  const activeId = ref<string | null>(null)

  const activeTab = computed<EditorTab | null>(() =>
    tabs.value.find((t) => t.id === activeId.value) ?? null,
  )

  function findByPath(path: string): EditorTab | null {
    return tabs.value.find((t) => t.filePath === path) ?? null
  }

  async function flushActive() {
    const editor = useEditorStore()
    if (!editor.isDirty) return
    try {
      await editor.save()
    }
    catch {
      // The editor store surfaces the error via `saveError`; swallow here so
      // tab navigation keeps working.
    }
  }

  /**
   * Opens `path` in a new tab, or activates an existing tab pointing to it.
   * This is the entry point used by the sidebar and note-creation flow.
   */
  async function openFile(path: string) {
    const existing = findByPath(path)
    if (existing) {
      if (activeId.value !== existing.id) await activate(existing.id)
      return
    }
    await flushActive()
    const tab: EditorTab = { id: generateId(), filePath: path }
    tabs.value.push(tab)
    activeId.value = tab.id
    await useEditorStore().openFile(path)
  }

  async function activate(id: string) {
    if (activeId.value === id) return
    const tab = tabs.value.find((t) => t.id === id)
    if (!tab) return
    await flushActive()
    activeId.value = id
    await useEditorStore().openFile(tab.filePath)
  }

  /**
   * Closes a tab. If it was active, the previous sibling (or next, when
   * closing the first tab) becomes active. When no tabs remain the editor
   * is reset to an empty state.
   */
  async function close(id: string) {
    const idx = tabs.value.findIndex((t) => t.id === id)
    if (idx === -1) return
    const wasActive = activeId.value === id
    if (wasActive) await flushActive()
    tabs.value.splice(idx, 1)
    if (!wasActive) return
    const next = tabs.value[idx] ?? tabs.value[idx - 1] ?? null
    const editor = useEditorStore()
    if (next) {
      activeId.value = next.id
      await editor.openFile(next.filePath)
    }
    else {
      activeId.value = null
      editor.reset()
    }
  }

  /**
   * Drops the tab for `path` without flushing the buffer. Intended for
   * callers that have already invalidated the underlying file (e.g. delete).
   */
  async function dropByPath(path: string) {
    const tab = findByPath(path)
    if (!tab) return
    const idx = tabs.value.indexOf(tab)
    const wasActive = activeId.value === tab.id
    tabs.value.splice(idx, 1)
    if (!wasActive) return
    const next = tabs.value[idx] ?? tabs.value[idx - 1] ?? null
    const editor = useEditorStore()
    if (next) {
      activeId.value = next.id
      await editor.openFile(next.filePath)
    }
    else {
      activeId.value = null
      editor.reset()
    }
  }

  /**
   * Removes all tabs whose file path is inside `prefix` (a vault path). Used
   * when a vault is removed or its path changes. Does not flush buffers.
   */
  async function dropByPrefix(prefix: string) {
    const sep = prefix.endsWith('/') || prefix.endsWith('\\') ? prefix : prefix + '/'
    const match = (p: string) => p === prefix || p.startsWith(sep)
    const activePath = activeTab.value?.filePath ?? null
    const remaining = tabs.value.filter((t) => !match(t.filePath))
    if (remaining.length === tabs.value.length) return
    tabs.value = remaining
    if (activePath && match(activePath)) {
      const next = remaining[0] ?? null
      const editor = useEditorStore()
      if (next) {
        activeId.value = next.id
        await editor.openFile(next.filePath)
      }
      else {
        activeId.value = null
        editor.reset()
      }
    }
  }

  return {
    tabs,
    activeId,
    activeTab,
    findByPath,
    openFile,
    activate,
    close,
    dropByPath,
    dropByPrefix,
  }
})
