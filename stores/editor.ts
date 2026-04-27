import { defineStore } from 'pinia'
import type { CursorPosition, SaveStatus, Vault } from '~/types'

const SAVED_HINT_MS = 1500

interface EditorBuffer {
  content: string
  isDirty: boolean
  saveStatus: SaveStatus
  saveError: string | null
  openEpoch: number
  lastEditTimestamp: number
}

/**
 * Owns the editor buffers and autosave pipeline.
 */
export const useEditorStore = defineStore('editor', () => {
  const buffers = ref<Record<string, EditorBuffer>>({})

  const currentFilePath = computed(() => {
    const tabs = useTabsStore()
    const { isMobile } = useTauri()
    if (isMobile.value) {
      const active = tabs.mobileTabs.find((t) => t.id === tabs.mobileActiveId)
      return active?.filePath ?? null
    }
    else {
      const leaf = tabs.allLeaves(tabs.desktopLayout).find((l) => l.id === tabs.activeDesktopPanelId)
      const active = leaf?.tabs.find((t) => t.id === leaf.activeId)
      return active?.filePath ?? null
    }
  })

  const currentContent = computed(() => {
    const path = currentFilePath.value
    return path ? buffers.value[path]?.content ?? '' : ''
  })

  const currentVault = computed(() => {
    if (!currentFilePath.value) return null
    return useVaultsStore().findVaultForPath(currentFilePath.value)
  })

  function findVaultForPath(path: string | null): Vault | null {
    if (!path) return null
    return useVaultsStore().findVaultForPath(path)
  }

  function setSaveStatus(path: string, next: SaveStatus, error: string | null = null) {
    const buffer = buffers.value[path]
    if (!buffer) return
    buffer.saveStatus = next
    buffer.saveError = error
    if (next === 'saved') {
      setTimeout(() => {
        if (buffers.value[path]?.saveStatus === 'saved') {
          buffers.value[path].saveStatus = 'idle'
        }
      }, SAVED_HINT_MS)
    }
  }

  async function openFile(path: string) {
    if (buffers.value[path]) return buffers.value[path]

    const fs = useFs()
    const content = await fs.readText(path)

    buffers.value[path] = {
      content,
      isDirty: false,
      saveStatus: 'idle',
      saveError: null,
      openEpoch: Date.now(),
      lastEditTimestamp: Date.now(),
    }
    return buffers.value[path]
  }

  function setContent(path: string, content: string) {
    const buffer = buffers.value[path]
    if (!buffer || buffer.content === content) return
    buffer.content = content
    buffer.isDirty = true
    buffer.lastEditTimestamp = Date.now()

    const vault = findVaultForPath(path)
    if (vault?.type === 'git') useGitStore().cancelCommit(vault.id)
  }

  async function save(path: string) {
    const buffer = buffers.value[path]
    if (!buffer || !buffer.isDirty) return

    const fs = useFs()
    setSaveStatus(path, 'saving')
    try {
      await fs.writeText(path, buffer.content)
      buffer.isDirty = false
      setSaveStatus(path, 'saved')
      const vault = findVaultForPath(path)
      if (vault?.type === 'git') {
        const git = useGitStore()
        await git.refreshStatus(vault.id)
        if (vault.git?.commitMode === 'auto') git.scheduleCommit(vault.id)
      }
    }
    catch (error) {
      setSaveStatus(path, 'error', error instanceof Error ? error.message : String(error))
      throw error
    }
  }

  async function createNote(payload: {
    vault: Vault
    fileName: string
    parentDir?: string
  }) {
    const fs = useFs()
    const dir = payload.parentDir ?? payload.vault.path
    const fullPath = await fs.createMarkdown(dir, payload.fileName)
    const vaults = useVaultsStore()
    await vaults.refreshTree(payload.vault)
    if (payload.vault.type === 'git') {
      await useGitStore().refreshStatus(payload.vault.id)
    }
    await useTabsStore().openFile(fullPath)
    return fullPath
  }

  async function deleteNote(payload: { vault: Vault, path: string }) {
    const fs = useFs()
    if (payload.vault.type === 'git') useGitStore().cancelCommit(payload.vault.id)
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete buffers.value[payload.path]

    await useTabsStore().dropByPath(payload.path)
    await fs.deleteFile(payload.path)
    const vaults = useVaultsStore()
    await vaults.refreshTree(payload.vault)
    if (payload.vault.type === 'git') {
      await useGitStore().refreshStatus(payload.vault.id)
    }
  }

  function reset(path?: string) {
    if (path) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete buffers.value[path]
    }
    else {
      buffers.value = {}
    }
  }

  const settings = useSettingsStore()
  const debounceMs = computed(
    () => Math.max(100, settings.settings.autosaveDebounceMs),
  )

  // Autosave ticker
  setInterval(async () => {
    const now = Date.now()
    const entries = Object.entries(buffers.value)
    for (const [path, buffer] of entries) {
      if (buffer.isDirty && buffer.saveStatus !== 'saving' && now - buffer.lastEditTimestamp >= debounceMs.value) {
        try {
          await save(path)
        }
        catch {
          // Error already handled in save()
        }
      }
    }
  }, 500)

  const scrollToLineTrigger = ref<Record<string, number | null>>({})
  const activeRightTab = ref<'info' | 'outline'>('outline')
  const cursorPositions = ref<Record<string, CursorPosition>>({})

  function scrollToLine(line: number, path?: string) {
    const p = path ?? currentFilePath.value
    if (!p) return
    scrollToLineTrigger.value[p] = line
    nextTick(() => {
      scrollToLineTrigger.value[p] = null
    })
  }

  function saveCursorPosition(path: string, position: CursorPosition) {
    cursorPositions.value[path] = position
  }

  function getCursorPosition(path: string): CursorPosition | undefined {
    return cursorPositions.value[path]
  }

  /**
   * True once loadUiState has finished restoring persisted state. Until then
   * saveUiState() is a no-op so that on-mount events from third-party widgets
   * (e.g. Splitpanes emitting `@resized` with default sizes) cannot overwrite
   * the persisted file before we've had a chance to read it.
   */
  const hydrated = ref(false)

  async function loadUiState() {
    const config = useConfig()
    const state = await config.loadUiState()
    activeRightTab.value = state.activeRightTab
    cursorPositions.value = state.cursorPositions ?? {}
    await useTabsStore().loadUiState(state)
    hydrated.value = true
  }

  async function saveUiState() {
    if (!hydrated.value) return
    const config = useConfig()
    const tabs = useTabsStore()
    await config.saveUiState({
      activeRightTab: activeRightTab.value,
      desktopLayout: tabs.desktopLayout,
      activeDesktopPanelId: tabs.activeDesktopPanelId,
      mobileTabs: tabs.mobileTabs,
      mobileActiveId: tabs.mobileActiveId,
      leftSidebarSize: tabs.leftSidebarSize,
      rightSidebarSize: tabs.rightSidebarSize,
      cursorPositions: cursorPositions.value,
    })
  }

  watch(activeRightTab, () => {
    void saveUiState()
  })

  return {
    buffers,
    currentFilePath,
    currentContent,
    currentVault,
    activeRightTab,
    scrollToLineTrigger,
    cursorPositions,
    openFile,
    setContent,
    save,
    createNote,
    deleteNote,
    reset,
    scrollToLine,
    saveCursorPosition,
    getCursorPosition,
    loadUiState,
    saveUiState,
  }
})
