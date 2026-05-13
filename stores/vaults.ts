import { defineStore } from 'pinia'
import {
  basename,
  dirname,
  fileExt,
  fileStem,
  relativePath,
  stripLeadingDot,
} from '~/utils/paths'
import {
  DEFAULT_FILE_FILTERS,
  type AddVaultPayload,
  type FileFilterSettings,
  type FileNode,
  type GitVaultSettings,
  type MediaDirSettings,
  type Vault,
  type VaultGroup,
} from '~/types'
import {
  isImageFileName,
  type ConvertOptions,
} from '~/composables/useImageConvert'
import type { AutoConvertSettings, VaultConfig } from '~/types/vault-config'
import { generateId, pickVaultForPath } from '~/utils/vaults/common'
import {
  ensureVaultMarker as ensureVaultMarkerFile,
  getTemplateYaml,
  readVaultConfig,
} from '~/utils/vaults/config'
import { createVaultFileActions } from '~/utils/vaults/file-actions'
import {
  getEffectiveAutoConvert as resolveEffectiveAutoConvert,
  getEffectiveContentFolder as resolveEffectiveContentFolder,
  getEffectiveContentRoot as resolveEffectiveContentRoot,
  getEffectiveExcludes as resolveEffectiveExcludes,
  getEffectiveFilters as resolveEffectiveFilters,
  getEffectiveMediaDir as resolveEffectiveMediaDir,
} from '~/utils/vaults/effective'
import {
  applyAutoConvert,
  extFromMime,
  resolveConflictPolicy,
  writeConvertedImage,
  type ConflictPolicy,
} from '~/utils/vaults/media'

export type { ConflictChoice, ConflictPolicy } from '~/utils/vaults/media'

/**
 * Owns the list of vaults and their file trees. Filesystem scanning happens
 * here; native git operations live in `useGitStore`. After every mutation that
 * affects persisted data we call `useSettingsStore().persist()`.
 */
export const useVaultsStore = defineStore('vaults', () => {
  const { t } = useI18n()
  const confirm = useConfirm()
  const list = ref<Vault[]>([])
  const trees = ref<Record<string, FileNode[]>>({})
  const groups = ref<VaultGroup[]>([])
  const favorites = ref<string[]>([])
  const vaultConfigs = ref<Record<string, VaultConfig>>({})

  function findById(id: string): Vault | null {
    return list.value.find((v) => v.id === id) ?? null
  }

  function findVaultForPath(filePath: string): Vault | null {
    return pickVaultForPath(list.value, filePath)
  }

  /**
   * Initial load from `AppConfig`. Ensures the main repo is always present in
   * the vault list (in case the config file was edited manually).
   */
  async function hydrate(
    vaults: Vault[],
    mainRepoPath: string,
    loadedGroups?: VaultGroup[],
    loadedFavorites?: string[],
  ) {
    let mutated = false
    if (!vaults.some((v) => v.path === mainRepoPath)) {
      vaults.unshift({
        id: generateId(),
        name: basename(mainRepoPath),
        type: 'local',
        path: mainRepoPath,
        filters: JSON.parse(JSON.stringify(DEFAULT_FILE_FILTERS)),
        contentType: 'vault',
      })
      mutated = true
    }

    // Vault filters/excludes/contentFolder intentionally left undefined
    // so that effective values fall back to .neptu-vault.yaml.

    list.value = vaults
    groups.value = loadedGroups ?? []
    favorites.value = loadedFavorites ?? []

    if (mutated) await useSettingsStore().persist()

    // Ensure markers and load per-vault configs
    for (const v of vaults) {
      await ensureVaultMarker(v)
      await loadVaultConfig(v)
    }

    await refreshAllTrees()
  }

  async function ensureVaultMarker(vault: Vault) {
    await ensureVaultMarkerFile(vault)
  }

  async function loadVaultConfig(vault: Vault): Promise<VaultConfig> {
    const config = await readVaultConfig(vault)
    vaultConfigs.value[vault.id] = config
    return config
  }

  async function addFavorite(path: string) {
    if (favorites.value.includes(path)) return
    favorites.value.push(path)
    await useSettingsStore().persist()
  }

  async function removeFavorite(path: string) {
    const idx = favorites.value.indexOf(path)
    if (idx === -1) return
    favorites.value.splice(idx, 1)
    await useSettingsStore().persist()
  }

  function isFavorite(path: string): boolean {
    return favorites.value.includes(path)
  }

  async function addVault(payload: AddVaultPayload) {
    const settings = useSettingsStore()
    if (!settings.mainRepoPath) throw new Error('Main repository is not set')

    const vault: Vault = {
      id: generateId(),
      name: payload.name?.trim() || basename(payload.path),
      type: payload.type,
      path: payload.path,
      contentType: payload.contentType ?? 'vault',
      contentStructureId:
        payload.contentType === 'custom'
        && payload.contentStructureId !== 'custom'
          ? payload.contentStructureId
          : undefined,
      contentFolder: payload.contentFolder,
      filters: payload.filters,
      excludes: payload.excludes,
      mediaDir: payload.mediaDir,
    }

    if (payload.type === 'git') {
      const git = useGit()
      if (payload.gitMode === 'init') {
        await git.initRepo(payload.path)
      }
      else {
        const ok = await git.isRepo(payload.path)
        if (!ok)
          throw Object.assign(
            new Error('Selected folder is not a git repository'),
            { code: 'NOT_GIT_REPO' },
          )
      }
      vault.git = payload.git ?? {
        commitMode: 'respect_config',
      }
    }

    list.value.push(vault)
    await ensureVaultMarker(vault)
    await loadVaultConfig(vault)
    await settings.persist()
    await refreshTree(vault)
    if (vault.type === 'git') await useGitStore().refreshStatus(vault.id)
  }

  async function removeVault(id: string, clearSettings = false) {
    const settings = useSettingsStore()
    const idx = list.value.findIndex((v) => v.id === id)
    if (idx === -1) return
    const removed = list.value[idx]!
    // Forbid removing the main repository entry
    if (removed.path === settings.mainRepoPath) return

    if (clearSettings) {
      const editor = useEditorStore()
      const git = useGitStore()
      const tabs = useTabsStore()
      git.cancelCommit(id)
      git.dropVault(id)
      if (editor.currentFilePath?.startsWith(removed.path)) editor.reset()
      await tabs.dropByPrefix(removed.path)
    }

    list.value.splice(idx, 1)
    Reflect.deleteProperty(trees.value, removed.id)
    Reflect.deleteProperty(vaultConfigs.value, removed.id)
    await settings.persist()
  }

  async function updateVault(
    id: string,
    updates: Partial<
      Pick<
        Vault,
        | 'name'
        | 'path'
        | 'filters'
        | 'contentType'
        | 'contentStructureId'
        | 'contentFolder'
        | 'excludes'
        | 'mediaDir'
        | 'autoConvert'
      >
    > & { git?: GitVaultSettings },
  ) {
    const vault = findById(id)
    if (!vault) return
    const settings = useSettingsStore()
    const isMainRepo = vault.path === settings.mainRepoPath

    if (updates.name !== undefined) {
      vault.name = updates.name.trim() || vault.name
    }

    if (updates.path !== undefined && !isMainRepo) {
      const editor = useEditorStore()
      const git = useGitStore()
      const tabs = useTabsStore()
      git.cancelCommit(vault.id)
      if (editor.currentFilePath?.startsWith(vault.path)) editor.reset()
      await tabs.dropByPrefix(vault.path)
      vault.path = updates.path
      await refreshTree(vault)
      if (vault.type === 'git') await git.refreshStatus(vault.id)
    }

    let needsRefresh = false

    if (updates.git !== undefined && vault.type === 'git') {
      vault.git = updates.git
      // Re-evaluate scheduled commit if mode changed
      if (updates.git.commitMode === 'manual') {
        useGitStore().cancelCommit(vault.id)
      }
      else if (updates.git.commitMode === 'respect_config') {
        // Re-evaluate: if the global default switched to manual, cancel any pending commit
        if (useSettingsStore().settings.defaultCommitMode === 'manual') {
          useGitStore().cancelCommit(vault.id)
        }
      }
    }

    if (updates.contentType !== undefined) {
      vault.contentType = updates.contentType
      needsRefresh = true
    }
    if (updates.contentStructureId !== undefined) {
      if (updates.contentStructureId === null) {
        delete vault.contentStructureId
      }
      else {
        vault.contentStructureId = updates.contentStructureId
      }
      needsRefresh = true
    }
    if (updates.contentFolder !== undefined) {
      if (updates.contentFolder === null) {
        delete vault.contentFolder
      }
      else {
        vault.contentFolder = updates.contentFolder
      }
      needsRefresh = true
    }
    if (updates.excludes !== undefined) {
      if (updates.excludes === null) {
        delete vault.excludes
      }
      else {
        vault.excludes = updates.excludes
      }
      needsRefresh = true
    }
    if (updates.mediaDir !== undefined) {
      if (updates.mediaDir === null) {
        delete vault.mediaDir
      }
      else {
        vault.mediaDir = updates.mediaDir
      }
    }
    if (updates.autoConvert !== undefined) {
      if (updates.autoConvert === null) {
        delete vault.autoConvert
      }
      else {
        vault.autoConvert = updates.autoConvert
      }
    }
    if (updates.filters !== undefined) {
      if (updates.filters === null) {
        delete vault.filters
      }
      else {
        vault.filters = updates.filters
      }
      needsRefresh = true
    }

    await settings.persist()

    if (needsRefresh) await refreshTree(vault)
  }

  function getEffectiveFilters(vault: Vault): FileFilterSettings {
    return resolveEffectiveFilters(vault, vaultConfigs.value[vault.id])
  }

  function getEffectiveExcludes(vault: Vault): string[] {
    return resolveEffectiveExcludes(vault, vaultConfigs.value[vault.id])
  }

  function getEffectiveContentFolder(vault: Vault): string | undefined {
    return resolveEffectiveContentFolder(vault, vaultConfigs.value[vault.id])
  }

  function getEffectiveMediaDir(vault: Vault): MediaDirSettings {
    return resolveEffectiveMediaDir(vault, vaultConfigs.value[vault.id])
  }

  function getEffectiveAutoConvert(
    vault: Vault,
  ): AutoConvertSettings | undefined {
    return resolveEffectiveAutoConvert(vault, vaultConfigs.value[vault.id])
  }

  async function convertImageFile(
    vaultId: string,
    filePath: string,
    options: ConvertOptions,
  ): Promise<string> {
    if (!isImageFileName(filePath)) return filePath

    const vault = findById(vaultId) ?? findVaultForPath(filePath)
    if (!vault) return filePath

    const editor = useEditorStore()
    const tabs = useTabsStore()
    const git = useGitStore()

    await editor.flushVault(vault)
    const finalPath = await writeConvertedImage(filePath, options)

    await refreshTree(vault)
    await tabs.updatePath(filePath, finalPath, false)

    let favoritesChanged = false
    favorites.value = favorites.value.map((favoritePath) => {
      const nextPath = favoritePath === filePath ? finalPath : favoritePath
      if (nextPath !== favoritePath) favoritesChanged = true
      return nextPath
    })

    if (vault.type === 'git') {
      await git.commitIfAuto(vault.id)
    }
    if (favoritesChanged) await useSettingsStore().persist()

    return finalPath
  }

  async function importMediaBytesForDocument(
    items: Array<{ name: string, type?: string, bytes: Uint8Array }>,
    documentPath: string,
    options?: { onConflict?: ConflictPolicy },
  ): Promise<Array<{ path: string, markdownPath: string }>> {
    const vault = findVaultForPath(documentPath)
    if (!vault) return []

    const fs = useFs()
    const imported: Array<{ path: string, markdownPath: string }> = []

    for (let i = 0; i < items.length; i++) {
      const item = items[i]!
      try {
        const fallbackExt = extFromMime(item.type ?? '') || '.png'
        const sourceName = stripLeadingDot(
          fileExt(item.name)
            ? item.name
            : `${fileStem(item.name || 'clipboard-image')}${fallbackExt}`,
        )
        const decision = await resolveConflictPolicy(
          vault,
          documentPath,
          sourceName,
          i,
          item.bytes,
          getEffectiveMediaDir(vault),
          options?.onConflict,
        )
        if (!decision) continue
        const { destPath, markdownPath } = decision
        const destDir = dirname(destPath)
        await fs.ensureDir(destDir)
        await fs.writeBytes(destPath, item.bytes)
        const finalPath = await applyAutoConvert(
          vault,
          destPath,
          getEffectiveAutoConvert,
        )
        const finalMarkdownPath
          = finalPath === destPath
            ? markdownPath
            : relativePath(dirname(documentPath), finalPath)
        imported.push({ path: finalPath, markdownPath: finalMarkdownPath })
      }
      catch (error) {
        console.error('Failed to import media bytes', item.name, error)
      }
    }

    if (imported.length > 0) {
      await refreshTree(vault)
      if (vault.type === 'git') {
        const git = useGitStore()
        await git.commitIfAuto(vault.id)
      }
    }

    return imported
  }

  async function importMediaFilesForDocument(
    paths: string[],
    documentPath: string,
    options?: { onConflict?: ConflictPolicy },
  ): Promise<Array<{ path: string, markdownPath: string }>> {
    const vault = findVaultForPath(documentPath)
    if (!vault) return []

    const fs = useFs()
    const imported: Array<{ path: string, markdownPath: string }> = []

    for (let i = 0; i < paths.length; i++) {
      const sourcePath = paths[i]!
      try {
        const sourceBytes = await fs.readBytes(sourcePath)
        const decision = await resolveConflictPolicy(
          vault,
          documentPath,
          stripLeadingDot(basename(sourcePath)),
          i,
          sourceBytes,
          getEffectiveMediaDir(vault),
          options?.onConflict,
        )
        if (!decision) continue
        const { destPath, markdownPath } = decision
        const destDir = dirname(destPath)
        await fs.ensureDir(destDir)
        if (sourcePath !== destPath) {
          await fs.copyFile(sourcePath, destPath)
        }
        const finalPath
          = sourcePath === destPath
            ? destPath
            : await applyAutoConvert(vault, destPath, getEffectiveAutoConvert)
        const finalMarkdownPath
          = finalPath === destPath
            ? markdownPath
            : relativePath(dirname(documentPath), finalPath)
        imported.push({ path: finalPath, markdownPath: finalMarkdownPath })
      }
      catch (error) {
        console.error('Failed to import media file', sourcePath, error)
      }
    }

    if (imported.length > 0) {
      await refreshTree(vault)
      if (vault.type === 'git') {
        const git = useGitStore()
        await git.commitIfAuto(vault.id)
      }
    }

    return imported
  }

  async function refreshTree(vault: Vault) {
    const fs = useFs()
    const settingsStore = useSettingsStore()
    const scanRoot = getEffectiveContentRoot(vault)
    try {
      trees.value[vault.id] = await fs.scanMarkdownTree(scanRoot, {
        showHidden: settingsStore.settings.showHiddenFiles,
        filterSettings: getEffectiveFilters(vault),
        sortMode: settingsStore.settings.fileSortMode,
        excludes: getEffectiveExcludes(vault),
      })
    }
    catch (error) {
      console.error('Failed to scan vault tree', scanRoot, error)
      trees.value[vault.id] = []
    }
  }

  async function refreshAllTrees() {
    await Promise.all(list.value.map((v) => refreshTree(v)))
  }

  async function addGroup(name: string) {
    const group: VaultGroup = {
      id: generateId(),
      name: name.trim(),
    }
    groups.value.push(group)
    await useSettingsStore().persist()
  }

  async function renameGroup(id: string, name: string) {
    const group = groups.value.find((g) => g.id === id)
    if (!group) return
    group.name = name.trim()
    await useSettingsStore().persist()
  }

  async function removeGroup(id: string) {
    for (const v of list.value) {
      if (v.groupId === id) {
        delete v.groupId
      }
    }
    const idx = groups.value.findIndex((g) => g.id === id)
    if (idx !== -1) groups.value.splice(idx, 1)
    await useSettingsStore().persist()
  }

  async function updateGroupsOrder(newGroups: VaultGroup[]) {
    groups.value = newGroups
    await useSettingsStore().persist()
  }

  async function updateVaultsOrder(newOrder: Vault[]) {
    const orderMap = new Map<string, number>()
    newOrder.forEach((v, idx) => orderMap.set(v.id, idx))

    const indices: number[] = []
    const items: Vault[] = []

    for (let i = 0; i < list.value.length; i++) {
      const v = list.value[i]!
      if (orderMap.has(v.id)) {
        indices.push(i)
        items.push(v)
      }
    }

    items.sort((a, b) => orderMap.get(a.id)! - orderMap.get(b.id)!)

    for (let i = 0; i < indices.length; i++) {
      list.value[indices[i]!] = items[i]!
    }

    await useSettingsStore().persist()
  }

  async function setVaultGroup(vaultId: string, groupId?: string | null) {
    const vault = findById(vaultId)
    if (!vault) return

    if (vault.path === useSettingsStore().mainRepoPath) return

    if (groupId) {
      const group = groups.value.find((entry) => entry.id === groupId)
      if (!group) return
      vault.groupId = group.id
    }
    else {
      delete vault.groupId
    }

    await useSettingsStore().persist()
  }

  /**
   * Returns the absolute path that should be scanned as the content root for a vault.
   */
  function getEffectiveContentRoot(vault: Vault): string {
    return resolveEffectiveContentRoot(vault, getEffectiveContentFolder(vault))
  }

  async function resetVaultOverrides(
    id: string,
    fields: Array<'filters' | 'excludes' | 'contentFolder'>,
  ) {
    const vault = findById(id)
    if (!vault) return
    for (const field of fields) {
      if (field === 'filters') delete vault.filters
      if (field === 'excludes') delete vault.excludes
      if (field === 'contentFolder') delete vault.contentFolder
    }
    await useSettingsStore().persist()
    await refreshTree(vault)
  }

  const {
    createVaultFolder,
    moveNode,
    copyNode,
    renameNode,
    importExternalFiles,
  } = createVaultFileActions({
    t,
    confirm,
    favorites,
    findById,
    findVaultForPath,
    refreshTree,
    getEffectiveFilters,
    getEffectiveExcludes,
    getEffectiveAutoConvert,
  })

  return {
    list,
    trees,
    groups,
    favorites,
    vaultConfigs,
    findById,
    findVaultForPath,
    hydrate,
    addVault,
    removeVault,
    updateVault,
    importExternalFiles,
    importMediaFilesForDocument,
    importMediaBytesForDocument,
    createVaultFolder,
    refreshTree,
    refreshAllTrees,
    addGroup,
    renameGroup,
    removeGroup,
    setVaultGroup,
    moveNode,
    copyNode,
    renameNode,
    addFavorite,
    removeFavorite,
    isFavorite,
    ensureVaultMarker,
    loadVaultConfig,
    getTemplateYaml,
    getEffectiveContentRoot,
    getEffectiveFilters,
    getEffectiveExcludes,
    getEffectiveContentFolder,
    getEffectiveMediaDir,
    getEffectiveAutoConvert,
    convertImageFile,
    resetVaultOverrides,
    updateGroupsOrder,
    updateVaultsOrder,
  }
})
