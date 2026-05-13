import { DEFAULT_FILE_FILTERS } from '~/types'
import type { FileFilterGroup, FileFilterSettings, FileNode, GitCommitMode, MediaDirSettings, MediaNamingMode, MediaUploadMode, Vault, VaultGroup, VaultType } from '~/types'
import type { InjectionKey } from 'vue'

export const SidebarDialogsKey: InjectionKey<ReturnType<typeof useSidebarDialogs>> = Symbol('sidebar-dialogs')

/**
 * Composable that manages all sidebar dialog state and CRUD actions.
 * Extracted from AppSidebar to reduce its size.
 */
export function useSidebarDialogs() {
  const settings = useSettingsStore()
  const vaults = useVaultsStore()
  const editor = useEditorStore()
  const git = useGitStore()
  const plugins = usePluginsStore()
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
  const selectedStructureId = ref('vault')
  const newContentFolder = ref('src')
  const newOverrideFilters = ref(false)
  const newOverrideExcludes = ref(false)
  const newOverrideContentFolder = ref(false)
  const newOverrideMediaDir = ref(false)
  const newMediaMode = ref<MediaUploadMode>('adjacent-folder')
  const newMediaFolder = ref('media')
  const newMediaNaming = ref<MediaNamingMode>('original')
  const newFilters = ref<FileFilterSettings>(JSON.parse(JSON.stringify(DEFAULT_FILE_FILTERS)))
  const newExcludes = ref<string[]>([])
  const newExcludeInput = ref('')
  const newCustomExt = ref('')

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

  const structureOptions = computed(() => [
    { label: t('vault.contentTypeVault'), value: 'vault', type: 'vault' as const },
    { label: t('vault.contentTypeBlog'), value: 'blog', type: 'blog' as const },
    { label: t('vault.contentTypeSite'), value: 'site', type: 'site' as const },
    ...plugins.sortedContentStructures.map((structure) => ({
      label: structure.label,
      value: structure.fqid,
      type: 'custom' as const,
      description: structure.descriptionKey ? t(structure.descriptionKey) : structure.description,
    })),
    { label: t('vault.contentTypeCustom'), value: 'custom', type: 'custom' as const },
  ])

  const selectedStructure = computed(() =>
    structureOptions.value.find((opt) => opt.value === selectedStructureId.value) ?? null,
  )

  const selectedStructureDescription = computed(() => {
    const s = selectedStructure.value
    if (!s) return ''
    if (s.value === 'vault') return t('vault.contentTypeVaultDesc')
    if (s.value === 'blog') return t('vault.contentTypeBlogDesc')
    if (s.value === 'site') return t('vault.contentTypeSiteDesc')
    if (s.value === 'custom') return t('vault.contentTypeCustomDesc')
    return (s as { description?: string }).description ?? ''
  })

  const mediaModeItems = [
    { label: t('vault.mediaModeGlobal'), value: 'global-folder' as const },
    { label: t('vault.mediaModeAdjacent'), value: 'adjacent' as const },
    { label: t('vault.mediaModeAdjacentFolder'), value: 'adjacent-folder' as const },
  ]

  const mediaNamingItems = [
    { label: t('vault.mediaNamingOriginal'), value: 'original' as const },
    { label: t('vault.mediaNamingDocumentIndex'), value: 'document-index' as const },
    { label: t('vault.mediaNamingHash'), value: 'hash' as const },
  ]

  function resetAddForm(type: VaultType = 'local') {
    newVaultName.value = ''
    newVaultPath.value = null
    newVaultType.value = type
    newGitMode.value = 'connect'
    newCommitMode.value = 'respect_config'
    newCommitDebounceSec.value = settings.settings.defaultCommitDebounceMs / 1000
    selectedStructureId.value = 'vault'
    newContentFolder.value = 'src'
    newOverrideFilters.value = false
    newOverrideExcludes.value = false
    newOverrideContentFolder.value = false
    newOverrideMediaDir.value = false
    newMediaMode.value = 'adjacent-folder'
    newMediaFolder.value = 'media'
    newMediaNaming.value = 'original'
    newFilters.value = JSON.parse(JSON.stringify(DEFAULT_FILE_FILTERS))
    newExcludes.value = []
    newExcludeInput.value = ''
    newCustomExt.value = ''
  }

  function formatEnabledExtensions(extensions: { ext: string, enabled: boolean }[]): string {
    return extensions.filter((e) => e.enabled).map((e) => `.${e.ext}`).join(', ')
  }

  function setNewCustomExt(value: string) {
    newCustomExt.value = value
  }

  function setNewOverrideMediaDir(value: boolean | 'indeterminate') {
    if (typeof value === 'boolean') newOverrideMediaDir.value = value
  }

  function setNewMediaMode(value: string) {
    if (value === 'adjacent' || value === 'adjacent-folder' || value === 'global-folder') {
      newMediaMode.value = value
    }
  }

  function setNewMediaFolder(value: string | number) {
    newMediaFolder.value = String(value)
  }

  function setNewMediaNaming(value: string) {
    if (value === 'original' || value === 'document-index' || value === 'hash') {
      newMediaNaming.value = value
    }
  }

  function findNewFilterGroup(label: string): FileFilterGroup | null {
    return newFilters.value.groups.find((group) => group.label === label) ?? null
  }

  function setNewFilterGroupEnabled(label: string, value: boolean | 'indeterminate') {
    if (typeof value !== 'boolean') return
    const group = findNewFilterGroup(label)
    if (group) group.enabled = value
  }

  function setNewFilterExtensionEnabled(label: string, ext: string, value: boolean | 'indeterminate') {
    if (typeof value !== 'boolean') return
    const group = findNewFilterGroup(label)
    const extension = group?.extensions.find((entry) => entry.ext === ext)
    if (extension) extension.enabled = value
  }

  function addNewCustomExtension(label: string) {
    const raw = newCustomExt.value.trim().toLowerCase().replace(/^\.+/, '')
    const group = findNewFilterGroup(label)
    if (!raw) return
    if (group && !group.extensions.some((e) => e.ext === raw)) {
      group.extensions.push({ ext: raw, enabled: true })
    }
    newCustomExt.value = ''
  }

  watch(addLocalVaultOpen, (value) => {
    if (value) resetAddForm('local')
  })

  watch(addGitVaultOpen, (value) => {
    if (value) resetAddForm('git')
  })

  async function browseFolder() {
    try {
      const path = await useFs().pickDirectory({ title: t('vault.selectVaultFolder') })
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
      const selected = selectedStructure.value
      const contentType = selected?.type ?? 'vault'
      const contentStructureId = selected?.type === 'custom' && selected.value !== 'custom'
        ? selected.value
        : undefined
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
        contentType,
        contentStructureId,
        contentFolder: contentType !== 'vault' && newOverrideContentFolder.value
          ? newContentFolder.value
          : undefined,
        filters: newOverrideFilters.value ? newFilters.value : undefined,
        excludes: newOverrideExcludes.value ? newExcludes.value : undefined,
        mediaDir: newOverrideMediaDir.value
          ? {
            mode: newMediaMode.value,
            folder: newMediaMode.value === 'adjacent' ? undefined : newMediaFolder.value,
            naming: newMediaNaming.value,
          } satisfies MediaDirSettings
          : undefined,
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

  /* ── Create File ──────────────────────────────── */

  const newFileOpen = ref(false)
  const newFileName = ref('')
  const newFileCtx = ref<{ vault: Vault, dir: string } | null>(null)

  function openCreateFile(vault: Vault, dir?: string) {
    newFileCtx.value = { vault, dir: dir ?? vaults.getEffectiveContentRoot(vault) }
    newFileName.value = 'My note.md'
    newFileOpen.value = true
  }

  async function submitCreateFile() {
    if (!newFileCtx.value || !newFileName.value.trim()) return
    try {
      await editor.createFile({
        vault: newFileCtx.value.vault,
        fileName: newFileName.value.trim(),
        parentDir: newFileCtx.value.dir,
      })
      newFileOpen.value = false
    }
    catch (error) {
      toast.add({ title: t('toast.createFileFailed'), description: String(error), color: 'error' })
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

  /* ── Rename File/Folder ───────────────────────── */

  const renameNodeOpen = ref(false)
  const renameNodeName = ref('')
  const renameNodeCtx = ref<{ vault: Vault, node: FileNode } | null>(null)

  function openRenameNode(vault: Vault, node: FileNode) {
    renameNodeCtx.value = { vault, node }
    renameNodeName.value = node.name
    renameNodeOpen.value = true
  }

  async function submitRenameNode() {
    if (!renameNodeCtx.value || !renameNodeName.value.trim()) return
    try {
      await vaults.renameNode(renameNodeCtx.value.vault.id, renameNodeCtx.value.node.path, renameNodeName.value.trim())
      renameNodeOpen.value = false
    }
    catch (error) {
      toast.add({ title: t('toast.renameFailed'), description: String(error), color: 'error' })
    }
  }

  /* ── Convert Image ────────────────────────────── */

  const convertImageOpen = ref(false)
  const convertImagePath = ref('')

  function openConvertImage(vault: Vault, node: FileNode) {
    convertImagePath.value = node.path
    convertImageOpen.value = true
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
    selectedStructureId,
    newContentFolder,
    newOverrideFilters,
    newOverrideExcludes,
    newOverrideContentFolder,
    newOverrideMediaDir,
    newMediaMode,
    newMediaFolder,
    newMediaNaming,
    newFilters,
    newExcludes,
    newExcludeInput,
    newCustomExt,
    gitModeItems,
    commitModeItems,
    showCommitDebounce,
    structureOptions,
    selectedStructure,
    selectedStructureDescription,
    mediaModeItems,
    mediaNamingItems,
    formatEnabledExtensions,
    setNewCustomExt,
    setNewOverrideMediaDir,
    setNewMediaMode,
    setNewMediaFolder,
    setNewMediaNaming,
    setNewFilterGroupEnabled,
    setNewFilterExtensionEnabled,
    addNewCustomExtension,
    browseFolder,
    submitNewVault,
    /* Create note */
    newNoteOpen,
    newNoteName,
    newNoteCtx,
    openCreateNote,
    submitCreateNote,
    /* Create file */
    newFileOpen,
    newFileName,
    newFileCtx,
    openCreateFile,
    submitCreateFile,
    /* Create folder */
    newFolderOpen,
    newFolderName,
    newFolderCtx,
    openCreateFolder,
    submitCreateFolder,
    /* Rename node */
    renameNodeOpen,
    renameNodeName,
    renameNodeCtx,
    openRenameNode,
    submitRenameNode,
    /* Convert image */
    convertImageOpen,
    convertImagePath,
    openConvertImage,
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
