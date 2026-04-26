import { defineStore } from 'pinia'
import { watchDebounced } from '@vueuse/core'
import type { SaveStatus, Vault } from '~/types'

const SAVED_HINT_MS = 1500
const AUTOSAVE_MAX_WAIT_MS = 8000

/**
 * Owns the editor buffer and autosave pipeline. The store mounts an internal
 * debounced watcher so components only have to bind `currentContent` and
 * surface `saveError`.
 */
export const useEditorStore = defineStore('editor', () => {
  const currentFilePath = ref<string | null>(null)
  const currentContent = ref('')
  const saveStatus = ref<SaveStatus>('idle')
  const saveError = ref<string | null>(null)
  const isDirty = ref(false)

  let savedHintHandle: ReturnType<typeof setTimeout> | null = null

  // Monotonic token used to discard stale `readTextFile` results when the
  // user switches files quickly.
  let openEpoch = 0

  const currentVault = computed<Vault | null>(() => {
    if (!currentFilePath.value) return null
    return useVaultsStore().findVaultForPath(currentFilePath.value)
  })

  function setSaveStatus(next: SaveStatus, error: string | null = null) {
    if (savedHintHandle) {
      clearTimeout(savedHintHandle)
      savedHintHandle = null
    }
    saveStatus.value = next
    saveError.value = error
    if (next === 'saved') {
      savedHintHandle = setTimeout(() => {
        if (saveStatus.value === 'saved') saveStatus.value = 'idle'
      }, SAVED_HINT_MS)
    }
  }

  async function openFile(path: string) {
    openEpoch += 1
    const epoch = openEpoch
    const fs = useFs()
    const content = await fs.readText(path)
    // Discard stale read if the user has already moved to another file.
    if (epoch !== openEpoch) return
    currentFilePath.value = path
    currentContent.value = content
    isDirty.value = false
    setSaveStatus('idle')
  }

  function setContent(content: string) {
    if (content === currentContent.value) return
    currentContent.value = content
    isDirty.value = true
    // Any new edit must restart the commit debounce
    const vault = currentVault.value
    if (vault?.type === 'git') useGitStore().cancelCommit(vault.id)
  }

  async function save() {
    if (!currentFilePath.value || !isDirty.value) return
    const fs = useFs()
    setSaveStatus('saving')
    try {
      await fs.writeText(currentFilePath.value, currentContent.value)
      isDirty.value = false
      setSaveStatus('saved')
      const vault = currentVault.value
      if (vault?.type === 'git') {
        const git = useGitStore()
        await git.refreshStatus(vault.id)
        if (vault.git?.commitMode === 'auto') git.scheduleCommit(vault.id)
      }
    }
    catch (error) {
      setSaveStatus('error', error instanceof Error ? error.message : String(error))
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
    const isActive = currentFilePath.value === payload.path
    if (isActive) {
      // Cancel pending autosave/commit and clear the buffer before unlink so
      // the debounced watcher cannot resurrect the file on disk.
      if (payload.vault.type === 'git') useGitStore().cancelCommit(payload.vault.id)
      reset()
    }
    await useTabsStore().dropByPath(payload.path)
    await fs.deleteFile(payload.path)
    const vaults = useVaultsStore()
    await vaults.refreshTree(payload.vault)
    if (payload.vault.type === 'git') {
      await useGitStore().refreshStatus(payload.vault.id)
    }
  }

  /** Drops the active buffer, e.g. when its file is deleted or the vault path moves. */
  function reset() {
    openEpoch += 1
    currentFilePath.value = null
    currentContent.value = ''
    isDirty.value = false
    setSaveStatus('idle')
  }

  // Autosave watcher. Lives inside the store so components don't duplicate
  // debounce logic. The delay is reactive to settings changes.
  const settings = useSettingsStore()
  const debounceMs = computed(
    () => Math.max(100, settings.settings.autosaveDebounceMs),
  )

  watchDebounced(
    currentContent,
    async () => {
      if (!isDirty.value || !currentFilePath.value) return
      try {
        await save()
      }
      catch {
        // saveError already populated; UI surfaces it via watch.
      }
    },
    { debounce: debounceMs, maxWait: AUTOSAVE_MAX_WAIT_MS },
  )

  const scrollToLineTrigger = ref<number | null>(null)

  function scrollToLine(line: number) {
    scrollToLineTrigger.value = line
    // Reset after a short delay so the same line can be triggered again
    nextTick(() => {
      scrollToLineTrigger.value = null
    })
  }

  return {
    currentFilePath,
    currentContent,
    saveStatus,
    saveError,
    isDirty,
    currentVault,
    scrollToLineTrigger,
    openFile,
    setContent,
    save,
    createNote,
    deleteNote,
    reset,
    scrollToLine,
  }
})
