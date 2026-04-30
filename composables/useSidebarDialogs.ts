import type { ContentType, GitCommitMode, SiteLangMode, Vault, VaultGroup, VaultType } from '~/types'

/**
 * Composable that manages all sidebar dialog state and CRUD actions.
 * Extracted from AppSidebar to reduce its size.
 */
export function useSidebarDialogs() {
  const settings = useSettingsStore()
  const vaults = useVaultsStore()
  const editor = useEditorStore()
  const git = useGitStore()
  const toast = useToast()
  const { t } = useI18n()

  /* ── Add Vault ────────────────────────────────── */

  const addLocalVaultOpen = ref(false)
  const addGitVaultOpen = ref(false)
  const newVaultName = ref('')
  const newVaultType = ref<VaultType>('local')
  const newVaultPath = ref<string | null>(null)
  const newGitMode = ref<'connect' | 'init'>('connect')
  const newCommitMode = ref<GitCommitMode>('respect_config')
  const newCommitDebounceSec = ref(5)
  const newContentType = ref<ContentType>('vault')
  const newContentFolder = ref('src')
  const newSiteLangMode = ref<SiteLangMode>('monolingual')

  const gitModeItems = [
    { label: t('vault.connectExisting'), value: 'connect' as const },
    { label: t('vault.initNew'), value: 'init' as const },
  ]

  const commitModeItems = [
    { label: t('vault.respectConfigCommit'), value: 'respect_config' as const },
    { label: t('vault.autoCommit'), value: 'auto' as const },
    { label: t('vault.manualCommit'), value: 'manual' as const },
  ]

  const showCommitDebounce = computed(() =>
    newCommitMode.value === 'auto'
    || (newCommitMode.value === 'respect_config' && settings.settings.defaultCommitMode === 'auto'),
  )

  const contentTypeItems = [
    { label: t('vault.contentTypeVault'), value: 'vault' as const },
    { label: t('vault.contentTypeBlog'), value: 'blog' as const },
    { label: t('vault.contentTypeSiteLanding'), value: 'site' as const },
    { label: t('vault.contentTypeCustom'), value: 'custom' as const },
  ]

  const siteLangModeItems = [
    { label: t('vault.siteLangMonolingual'), value: 'monolingual' as const },
    { label: t('vault.siteLangMultilingual'), value: 'multilingual' as const },
  ]

  function resetAddForm(type: VaultType = 'local') {
    newVaultName.value = ''
    newVaultPath.value = null
    newVaultType.value = type
    newGitMode.value = 'connect'
    newCommitMode.value = 'respect_config'
    newCommitDebounceSec.value = settings.settings.defaultCommitDebounceMs / 1000
    newContentType.value = 'vault'
    newContentFolder.value = 'src'
    newSiteLangMode.value = 'monolingual'
  }

  watch(addLocalVaultOpen, (value) => {
    if (value) resetAddForm('local')
  })

  watch(addGitVaultOpen, (value) => {
    if (value) resetAddForm('git')
  })

  async function browseFolder() {
    try {
      const path = await useFs().pickDirectory({ title: 'Select vault folder' })
      if (path) newVaultPath.value = path
    }
    catch (error) {
      toast.add({ title: t('toast.cannotOpenDialog'), description: String(error), color: 'error' })
    }
  }

  async function submitNewVault() {
    if (!newVaultPath.value) return

    if (newVaultType.value === 'git') {
      const author = await git.resolveAuthor()
      if (!author) {
        toast.add({
          title: t('toast.configureGitAuthor'),
          description: t('toast.gitAuthorHint'),
          color: 'warning',
        })
        settings.openSettingsDialog()
        return
      }
    }

    try {
      await vaults.addVault({
        name: newVaultName.value,
        type: newVaultType.value,
        path: newVaultPath.value,
        gitMode: newVaultType.value === 'git' ? newGitMode.value : undefined,
        git: newVaultType.value === 'git'
          ? {
              commitMode: newCommitMode.value,
              ...(newCommitMode.value !== 'respect_config' ? { commitDebounceMs: Math.max(0, Math.round(newCommitDebounceSec.value * 1000)) } : {}),
            }
          : undefined,
        contentType: newContentType.value,
        contentFolder: newContentType.value !== 'vault' ? newContentFolder.value : undefined,
        siteLangMode: newContentType.value === 'custom' ? newSiteLangMode.value : undefined,
      })
      addLocalVaultOpen.value = false
      addGitVaultOpen.value = false
      resetAddForm()
    }
    catch (error) {
      const isNotGitRepo = error instanceof Error && 'code' in error && (error as { code?: unknown }).code === 'NOT_GIT_REPO'
      toast.add({
        title: t('toast.addVaultFailed'),
        description: isNotGitRepo ? t('error.notGitRepo') : (error instanceof Error ? error.message : String(error)),
        color: 'error',
      })
    }
  }

  /* ── Create Note ──────────────────────────────── */

  const newNoteOpen = ref(false)
  const newNoteName = ref('')
  const newNoteCtx = ref<{ vault: Vault, dir: string } | null>(null)

  function openCreateNote(vault: Vault, dir?: string) {
    newNoteCtx.value = { vault, dir: dir ?? vaults.getEffectiveContentRoot(vault) }
    newNoteName.value = ''
    newNoteOpen.value = true
  }

  async function submitCreateNote() {
    if (!newNoteCtx.value || !newNoteName.value.trim()) return
    try {
      await editor.createNote({
        vault: newNoteCtx.value.vault,
        fileName: newNoteName.value.trim(),
        parentDir: newNoteCtx.value.dir,
      })
      newNoteOpen.value = false
    }
    catch (error) {
      toast.add({ title: t('toast.createNoteFailed'), description: String(error), color: 'error' })
    }
  }

  /* ── Create Folder ────────────────────────────── */

  const newFolderOpen = ref(false)
  const newFolderName = ref('')
  const newFolderCtx = ref<{ vault: Vault, dir: string } | null>(null)

  function openCreateFolder(vault: Vault, dir?: string) {
    newFolderCtx.value = { vault, dir: dir ?? vaults.getEffectiveContentRoot(vault) }
    newFolderName.value = ''
    newFolderOpen.value = true
  }

  async function submitCreateFolder() {
    if (!newFolderCtx.value || !newFolderName.value.trim()) return
    try {
      await vaults.createVaultFolder(newFolderCtx.value.vault, newFolderCtx.value.dir, newFolderName.value.trim())
      newFolderOpen.value = false
    }
    catch (error) {
      toast.add({ title: t('toast.createFolderFailed'), description: String(error), color: 'error' })
    }
  }

  /* ── Edit Vault ───────────────────────────────── */

  const editVaultOpen = ref(false)
  const editingVault = ref<Vault | null>(null)

  function openEditVault(vault: Vault) {
    editingVault.value = vault
    editVaultOpen.value = true
  }

  /* ── Remove Vault ─────────────────────────────── */

  const removeVaultConfirmOpen = ref(false)
  const removeVaultConfirmTarget = ref<Vault | null>(null)
  const removeVaultClearSettings = ref(false)

  function openRemoveVaultConfirm(vault: Vault) {
    removeVaultConfirmTarget.value = vault
    removeVaultConfirmOpen.value = true
  }

  async function submitRemoveVault() {
    if (!removeVaultConfirmTarget.value) return
    try {
      await vaults.removeVault(removeVaultConfirmTarget.value.id, removeVaultClearSettings.value)
      removeVaultConfirmOpen.value = false
      removeVaultConfirmTarget.value = null
      removeVaultClearSettings.value = false
      if (editingVault.value && !vaults.findById(editingVault.value.id)) {
        editVaultOpen.value = false
        editingVault.value = null
      }
    }
    catch (error) {
      toast.add({ title: t('toast.removeVaultFailed'), description: String(error), color: 'error' })
    }
  }

  /* ── Groups ───────────────────────────────────── */

  const createGroupOpen = ref(false)
  const newGroupName = ref('')
  const renameGroupOpen = ref(false)
  const renameGroupTarget = ref<VaultGroup | null>(null)
  const renameGroupName = ref('')
  const removeGroupConfirmOpen = ref(false)
  const removeGroupConfirmTarget = ref<VaultGroup | null>(null)

  function openCreateGroup() {
    newGroupName.value = ''
    createGroupOpen.value = true
  }

  async function submitCreateGroup() {
    if (!newGroupName.value.trim()) return
    await vaults.addGroup(newGroupName.value.trim())
    createGroupOpen.value = false
  }

  function openRenameGroup(group: VaultGroup) {
    renameGroupTarget.value = group
    renameGroupName.value = group.name
    renameGroupOpen.value = true
  }

  async function submitRenameGroup() {
    if (!renameGroupTarget.value || !renameGroupName.value.trim()) return
    await vaults.renameGroup(renameGroupTarget.value.id, renameGroupName.value.trim())
    renameGroupOpen.value = false
    renameGroupTarget.value = null
  }

  function openRemoveGroupConfirm(group: VaultGroup) {
    removeGroupConfirmTarget.value = group
    removeGroupConfirmOpen.value = true
  }

  async function submitRemoveGroup() {
    if (!removeGroupConfirmTarget.value) return
    await vaults.removeGroup(removeGroupConfirmTarget.value.id)
    removeGroupConfirmOpen.value = false
    removeGroupConfirmTarget.value = null
  }

  return {
    /* Add vault */
    addLocalVaultOpen,
    addGitVaultOpen,
    newVaultName,
    newVaultType,
    newVaultPath,
    newGitMode,
    newCommitMode,
    newCommitDebounceSec,
    newContentType,
    newContentFolder,
    newSiteLangMode,
    gitModeItems,
    commitModeItems,
    showCommitDebounce,
    contentTypeItems,
    siteLangModeItems,
    browseFolder,
    submitNewVault,
    /* Create note */
    newNoteOpen,
    newNoteName,
    newNoteCtx,
    openCreateNote,
    submitCreateNote,
    /* Create folder */
    newFolderOpen,
    newFolderName,
    newFolderCtx,
    openCreateFolder,
    submitCreateFolder,
    /* Edit vault */
    editVaultOpen,
    editingVault,
    openEditVault,
    /* Remove vault */
    removeVaultConfirmOpen,
    removeVaultConfirmTarget,
    removeVaultClearSettings,
    openRemoveVaultConfirm,
    submitRemoveVault,
    /* Groups */
    createGroupOpen,
    newGroupName,
    renameGroupOpen,
    renameGroupTarget,
    renameGroupName,
    removeGroupConfirmOpen,
    removeGroupConfirmTarget,
    openCreateGroup,
    submitCreateGroup,
    openRenameGroup,
    submitRenameGroup,
    openRemoveGroupConfirm,
    submitRemoveGroup,
  }
}

export type SidebarDialogsContext = ReturnType<typeof useSidebarDialogs>
