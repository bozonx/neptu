import { defineStore } from 'pinia'
import type { CursorPosition, SaveStatus, Vault } from '~/types'
import type { Schema } from '~/types/vault-config'
import {
  findSchemaForFile,
  parseFrontmatter,
  splitFrontmatter,
  synthesizeFile,
} from '~/composables/useFrontmatter'

const SAVED_HINT_MS = 1500

interface EditorBuffer {
  content: string
  isDirty: boolean
  saveStatus: SaveStatus
  saveError: string | null
  openEpoch: number
  lastEditTimestamp: number
  // Populated when the file matches a vault schema
  frontmatter?: Record<string, unknown>
  extraFrontmatter?: Record<string, unknown>
  schema?: Schema | null
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

  watch(currentVault, (v) => {
    if (!v || v.type !== 'git') return
    useGitStore().resetCommitStatus(v.id)
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

    const viewType = getEditorViewType(path)
    let rawContent = ''
    let schema = null

    if (viewType === 'virtual') {
      // Virtual pages don't exist on disk, no content to read
    } else {
      const fs = useFs()
      if (!(await fs.exists(path))) {
        throw new Error(`File not found: ${path}`)
      }
      
      // Only read text for types that are actually text-based
      if (viewType === 'text' || viewType === 'vault-config') {
        rawContent = await fs.readText(path)
      }

      const vault = findVaultForPath(path)
      const vaultsStore = useVaultsStore()
      const vaultConfig = vault ? vaultsStore.vaultConfigs[vault.id] : null
      schema = findSchemaForFile(path, vault?.path ?? '', vaultConfig)
    }

    let content = rawContent
    let frontmatter: Record<string, unknown> | undefined
    let extraFrontmatter: Record<string, unknown> | undefined

    if (schema && rawContent) {
      const parsed = parseFrontmatter(rawContent)
      if (parsed.frontmatter) {
        const split = splitFrontmatter(parsed.frontmatter, schema)
        frontmatter = split.schemaValues
        extraFrontmatter = split.extraFrontmatter
      }
      else {
        frontmatter = {}
        extraFrontmatter = {}
      }
      content = parsed.body
    }

    buffers.value[path] = {
      content,
      isDirty: false,
      saveStatus: 'idle',
      saveError: null,
      openEpoch: Date.now(),
      lastEditTimestamp: Date.now(),
      frontmatter,
      extraFrontmatter,
      schema,
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
      let fileContent = buffer.content
      if (buffer.schema && buffer.frontmatter !== undefined) {
        const merged = { ...(buffer.extraFrontmatter ?? {}), ...(buffer.frontmatter ?? {}) }
        fileContent = synthesizeFile(merged, buffer.content)
      }
      await fs.writeText(path, fileContent)
      buffer.isDirty = false
      setSaveStatus(path, 'saved')
      const vault = findVaultForPath(path)
      if (vault?.type === 'git' && vault.git?.commitMode === 'auto') {
        useGitStore().scheduleCommit(vault.id)
      }
      useSearchStore().updateFile(path, fileContent)
    }
    catch (error) {
      setSaveStatus(path, 'error', error instanceof Error ? error.message : String(error))
      throw error
    }
  }

  async function flushVault(vault: Vault) {
    const prefix = vault.path.replace(/[/\\]+$/, '') + '/'
    for (const [path, buffer] of Object.entries(buffers.value)) {
      if (!buffer.isDirty) continue
      if (!path.startsWith(prefix)) continue
      try {
        await save(path)
      }
      catch {
        // Error already handled in save()
      }
    }
  }

  async function createNote(payload: {
    vault: Vault
    fileName: string
    parentDir?: string
  }) {
    const fs = useFs()
    const dir = payload.parentDir ?? useVaultsStore().getEffectiveContentRoot(payload.vault)
    const fullPath = await fs.createMarkdown(dir, payload.fileName)
    const vaults = useVaultsStore()
    await vaults.refreshTree(payload.vault)
    if (payload.vault.type === 'git') {
      const git = useGitStore()
      await git.commit(payload.vault.id)
      await git.refreshStatus(payload.vault.id)
    }
    await useTabsStore().openFile(fullPath)
    useSearchStore().updateFile(fullPath, '')
    return fullPath
  }

  async function deleteNote(payload: { vault: Vault, path: string }) {
    const fs = useFs()
    if (payload.vault.type === 'git') useGitStore().cancelCommit(payload.vault.id)
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete buffers.value[payload.path]

    await useTabsStore().dropByPath(payload.path)
    await fs.deleteFile(payload.path)
    useSearchStore().removeFile(payload.path)
    const vaults = useVaultsStore()
    await vaults.refreshTree(payload.vault)
    if (payload.vault.type === 'git') {
      const git = useGitStore()
      await git.commit(payload.vault.id)
      await git.refreshStatus(payload.vault.id)
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

  const activeSelectionText = ref('')

  function onPathMigrated(oldPath: string, newPath: string) {
    if (buffers.value[oldPath]) {
      buffers.value[newPath] = { ...buffers.value[oldPath] }
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete buffers.value[oldPath]
    }
    if (cursorPositions.value[oldPath]) {
      cursorPositions.value[newPath] = { ...cursorPositions.value[oldPath] }
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete cursorPositions.value[oldPath]
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
  const cursorPositions = ref<Record<string, CursorPosition>>({})

  function toRelativeCursorPositions(
    positions: Record<string, CursorPosition>,
    root: string,
  ): Record<string, CursorPosition> {
    const prefix = root.replace(/[/\\]+$/, '') + '/'
    const result: Record<string, CursorPosition> = {}
    for (const [path, pos] of Object.entries(positions)) {
      const rel = path.startsWith(prefix) ? path.slice(prefix.length) : path
      result[rel] = pos
    }
    return result
  }

  function fromRelativeCursorPositions(
    positions: Record<string, CursorPosition>,
    root: string,
  ): Record<string, CursorPosition> {
    const base = root.replace(/[/\\]+$/, '')
    const result: Record<string, CursorPosition> = {}
    for (const [rel, pos] of Object.entries(positions)) {
      const abs = rel.startsWith('/') || (rel.length > 1 && rel[1] === ':')
        ? rel
        : `${base}/${rel.replace(/^[/\\]+/, '')}`
      result[abs] = pos
    }
    return result
  }

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
    const root = settings.mainRepoPath
    cursorPositions.value = root
      ? fromRelativeCursorPositions(state.cursorPositions ?? {}, root)
      : state.cursorPositions ?? {}
    await useTabsStore().loadUiState(state)
    // Migrate legacy activeRightTab to plugin FQID
    const plugins = usePluginsStore()
    if (state.activeLeftSidebarView) {
      plugins.setActiveLeftSidebarView(state.activeLeftSidebarView)
    }
    if (state.activeRightSidebarView) {
      plugins.setActiveRightSidebarView(state.activeRightSidebarView)
    }
    else if (state.activeRightTab === 'outline') {
      plugins.setActiveRightSidebarView('com.neptu.outline:main')
    }
    else if (state.activeRightTab === 'info') {
      plugins.setActiveRightSidebarView('com.neptu.file-info:main')
    }
    hydrated.value = true
  }

  async function saveUiState() {
    if (!hydrated.value) return
    const config = useConfig()
    const tabs = useTabsStore()
    const root = settings.mainRepoPath
    const positions = root
      ? toRelativeCursorPositions(cursorPositions.value, root)
      : cursorPositions.value
    await config.saveUiState({
      activeLeftSidebarView: usePluginsStore().activeLeftSidebarView,
      activeRightSidebarView: usePluginsStore().activeRightSidebarView,
      desktopLayout: tabs.desktopLayout,
      activeDesktopPanelId: tabs.activeDesktopPanelId,
      mobileTabs: tabs.mobileTabs,
      mobileActiveId: tabs.mobileActiveId,
      leftSidebarSize: tabs.leftSidebarSize,
      rightSidebarSize: tabs.rightSidebarSize,
      rightSidebarCollapsed: tabs.rightSidebarCollapsed,
      leftSidebarMode: tabs.leftSidebarMode,
      leftSidebarDualFirstColumnSize: tabs.leftSidebarDualFirstColumnSize,
      leftSidebarDualSelectedVaultId: tabs.leftSidebarDualSelectedVaultId,
      leftSidebarDualShowFavorites: tabs.leftSidebarDualShowFavorites,
      leftSidebarTab: tabs.leftSidebarTab,
      cursorPositions: positions,
      expandedGroups: tabs.expandedGroups,
      expandedVaults: tabs.expandedVaults,
      expandedFolders: tabs.expandedFolders,
    })
  }

  watch(() => usePluginsStore().activeLeftSidebarView, () => {
    void saveUiState()
  })

  watch(() => usePluginsStore().activeRightSidebarView, () => {
    void saveUiState()
  })

  function setFrontmatter(path: string, frontmatter: Record<string, unknown>) {
    const buffer = buffers.value[path]
    if (!buffer) return
    buffer.frontmatter = frontmatter
    buffer.isDirty = true
    buffer.lastEditTimestamp = Date.now()

    const vault = findVaultForPath(path)
    if (vault?.type === 'git') useGitStore().cancelCommit(vault.id)
  }

  const insertTrigger = ref<{ path: string, text: string, id: number } | null>(null)

  function insertText(path: string, text: string) {
    insertTrigger.value = { path, text, id: Date.now() }
  }

  function insertImportedFiles(paths: string[]) {
    const currentPath = currentFilePath.value
    if (!currentPath) return

    import('#imports').then(({ useToast }) => {
      useToast().add({ title: 'Inserting Files', description: `Paths: ${paths.join(', ')}` })
    }).catch(console.error)

    let insertedText = ''
    for (const path of paths) {
      const name = path.split(/[\/\\]/).pop() || ''
      const ext = name.split('.').pop()?.toLowerCase() || ''
      const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)
      if (isImage) {
         insertedText += `\n![${name}](./${name})\n`
      } else {
         insertedText += `\n[${name}](./${name})\n`
      }
    }
    
    if (insertedText) {
      insertText(currentPath, insertedText.trim() + '\n')
    }
  }

  return {
    buffers,
    currentFilePath,
    currentContent,
    currentVault,
    hydrated,
    activeSelectionText,
    scrollToLineTrigger,
    cursorPositions,
    openFile,
    setContent,
    setFrontmatter,
    save,
    flushVault,
    createNote,
    deleteNote,
    reset,
    scrollToLine,
    saveCursorPosition,
    getCursorPosition,
    loadUiState,
    saveUiState,
    onPathMigrated,
    insertTrigger,
    insertText,
    insertImportedFiles,
  }
})
