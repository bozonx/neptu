import type { Vault } from '~/types'
import { getEditorViewType, isTextViewType } from '~/utils/fileTypes'
import {
  findSchemaForFile,
  parseFrontmatter,
  splitFrontmatter,
  synthesizeFile,
} from '~/composables/useFrontmatter'
import type { EditorBuffer } from './types'

const SAVED_HINT_MS = 1500

function findVaultForPath(path: string | null): Vault | null {
  if (!path) return null
  return useVaultsStore().findVaultForPath(path)
}

export function useEditorBuffers() {
  const buffers = ref<Record<string, EditorBuffer>>({})
  const savedHintTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const settings = useSettingsStore()
  const debounceMs = computed(
    () => Math.max(100, settings.settings.autosaveDebounceMs),
  )

  function setSaveStatus(path: string, next: EditorBuffer['saveStatus'], error: string | null = null) {
    const buffer = buffers.value[path]
    if (!buffer) return
    buffer.saveStatus = next
    buffer.saveError = error
    if (next === 'saved') {
      const existingTimer = savedHintTimers.get(path)
      if (existingTimer) clearTimeout(existingTimer)
      const timer = setTimeout(() => {
        savedHintTimers.delete(path)
        if (buffers.value[path]?.saveStatus === 'saved') {
          buffers.value[path].saveStatus = 'idle'
        }
      }, SAVED_HINT_MS)
      savedHintTimers.set(path, timer)
    }
  }

  async function openFile(path: string) {
    if (buffers.value[path]) return buffers.value[path]

    const viewType = getEditorViewType(path)
    let rawContent = ''
    let schema = null

    if (viewType !== 'virtual') {
      const fs = useFs()
      if (!(await fs.exists(path))) {
        throw new Error(`File not found: ${path}`)
      }

      if (isTextViewType(viewType)) {
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

  function markDirty(path: string) {
    const buffer = buffers.value[path]
    if (!buffer) return
    buffer.isDirty = true
    buffer.lastEditTimestamp = Date.now()

    const vault = findVaultForPath(path)
    if (vault?.type === 'git') useGitStore().cancelCommit(vault.id)
  }

  function setContent(path: string, content: string) {
    const buffer = buffers.value[path]
    if (!buffer || buffer.content === content) return
    buffer.content = content
    markDirty(path)
  }

  function setFrontmatter(path: string, frontmatter: Record<string, unknown>) {
    const buffer = buffers.value[path]
    if (!buffer) return
    buffer.frontmatter = frontmatter
    markDirty(path)
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
        // Error already handled in save().
      }
    }
  }

  function reset(path?: string) {
    if (path) {
      const timer = savedHintTimers.get(path)
      if (timer) {
        clearTimeout(timer)
        savedHintTimers.delete(path)
      }
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete buffers.value[path]
    }
    else {
      clearSavedHintTimers()
      buffers.value = {}
    }
  }

  function migrateBufferPath(oldPath: string, newPath: string) {
    if (!buffers.value[oldPath]) return
    buffers.value[newPath] = { ...buffers.value[oldPath] }
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete buffers.value[oldPath]
  }

  const autosaveInterval = setInterval(async () => {
    const now = Date.now()
    const entries = Object.entries(buffers.value)
    for (const [path, buffer] of entries) {
      if (buffer.isDirty && buffer.saveStatus !== 'saving' && now - buffer.lastEditTimestamp >= debounceMs.value) {
        try {
          await save(path)
        }
        catch {
          // Error already handled in save().
        }
      }
    }
  }, 500)

  function clearSavedHintTimers() {
    for (const timer of savedHintTimers.values()) {
      clearTimeout(timer)
    }
    savedHintTimers.clear()
  }

  function clearBufferTimers() {
    clearInterval(autosaveInterval)
    clearSavedHintTimers()
  }

  onScopeDispose(() => {
    clearBufferTimers()
  })

  return {
    buffers,
    openFile,
    setContent,
    setFrontmatter,
    save,
    flushVault,
    reset,
    migrateBufferPath,
    clearTimers: clearBufferTimers,
  }
}
