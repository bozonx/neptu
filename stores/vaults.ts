import { defineStore } from 'pinia'
import {
  DEFAULT_FILE_FILTERS,
  getVaultScanRoot,
  type AddVaultPayload,
  type FileNode,
  type GitVaultSettings,
  type Vault,
  type VaultGroup,
} from '~/types'
import {
  DEFAULT_VAULT_CONFIG,
  BLOG_VAULT_CONFIG,
  isValidVaultConfig,
  type VaultConfig,
} from '~/types/vault-config'

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function basename(path: string): string {
  const norm = path.replace(/[\\/]+$/, '')
  const parts = norm.split(/[\\/]/)
  return parts[parts.length - 1] ?? norm
}

/**
 * Returns the deepest vault whose `path` is a prefix of `filePath`.
 * Used to associate the currently edited file with its owning vault.
 */
function pickVaultForPath(vaults: Vault[], filePath: string): Vault | null {
  let best: Vault | null = null
  for (const v of vaults) {
    const prefix = v.path.endsWith('/') || v.path.endsWith('\\')
      ? v.path
      : v.path + '/'
    const candidate = filePath === v.path || filePath.startsWith(prefix)
    if (!candidate) continue
    if (!best || v.path.length > best.path.length) best = v
  }
  return best
}

/**
 * Owns the list of vaults and their file trees. Filesystem scanning happens
 * here; native git operations live in `useGitStore`. After every mutation that
 * affects persisted data we call `useSettingsStore().persist()`.
 */
export const useVaultsStore = defineStore('vaults', () => {
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
  async function hydrate(vaults: Vault[], mainRepoPath: string, loadedGroups?: VaultGroup[], loadedFavorites?: string[]) {
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

    for (const v of vaults) {
      if (!v.filters) {
        v.filters = JSON.parse(JSON.stringify(DEFAULT_FILE_FILTERS))
        mutated = true
      }
    }

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
    const fs = useFs()
    const markerPath = await fs.join(vault.path, '.neptu-vault.yaml')
    if (!(await fs.exists(markerPath))) {
      const config = vault.contentType === 'blog' ? BLOG_VAULT_CONFIG : DEFAULT_VAULT_CONFIG
      await fs.writeYaml(markerPath, config)
    }
  }

  async function loadVaultConfig(vault: Vault): Promise<VaultConfig> {
    const fs = useFs()
    const path = await fs.join(vault.path, '.neptu-vault.yaml')
    try {
      const data = await fs.readYaml<unknown>(path)
      if (isValidVaultConfig(data)) {
        vaultConfigs.value[vault.id] = data
        return data
      }
      console.warn('[vaults] Invalid .neptu-vault.yaml, using defaults', vault.path)
    }
    catch {
      // File missing or unreadable — fall through to defaults
    }
    const fallback = { ...DEFAULT_VAULT_CONFIG }
    vaultConfigs.value[vault.id] = fallback
    return fallback
  }

  async function saveVaultConfig(vault: Vault, config: VaultConfig): Promise<void> {
    const fs = useFs()
    const path = await fs.join(vault.path, '.neptu-vault.yaml')
    await fs.writeYaml(path, config)
    vaultConfigs.value[vault.id] = config
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
      filters: DEFAULT_FILE_FILTERS,
      contentType: payload.contentType ?? 'vault',
      contentFolder: payload.contentFolder,
      siteLangMode: payload.siteLangMode,
    }

    if (payload.type === 'git') {
      const git = useGit()
      if (payload.gitMode === 'init') {
        await git.initRepo(payload.path)
      }
      else {
        const ok = await git.isRepo(payload.path)
        if (!ok) throw Object.assign(new Error('Selected folder is not a git repository'), { code: 'NOT_GIT_REPO' })
      }
      vault.git = payload.git ?? {
        commitMode: 'auto',
        commitDebounceMs: settings.settings.defaultCommitDebounceMs,
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
    updates: Partial<Pick<Vault, 'name' | 'path' | 'filters' | 'contentType' | 'contentFolder' | 'siteLangMode' | 'excludes'>> & { git?: GitVaultSettings },
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
    }

    if (updates.filters !== undefined) {
      vault.filters = updates.filters
      needsRefresh = true
    }

    if (updates.contentType !== undefined) {
      vault.contentType = updates.contentType
      needsRefresh = true
    }
    if (updates.contentFolder !== undefined) {
      vault.contentFolder = updates.contentFolder
      needsRefresh = true
    }
    if (updates.siteLangMode !== undefined) {
      vault.siteLangMode = updates.siteLangMode
      needsRefresh = true
    }
    if (updates.excludes !== undefined) {
      vault.excludes = updates.excludes
      needsRefresh = true
    }

    await settings.persist()

    if (needsRefresh) await refreshTree(vault)
  }

  async function createVaultFolder(vault: Vault, parentDir: string, folderName: string) {
    const fs = useFs()
    const fullPath = await fs.createFolder(parentDir, folderName)
    await refreshTree(vault)
    return fullPath
  }

  async function moveNode(sourcePath: string, targetDirPath: string) {
    const fs = useFs()
    const name = basename(sourcePath)
    const destPath = await fs.join(targetDirPath, name)

    if (sourcePath === destPath) return

    await fs.moveFile(sourcePath, destPath)

    // Find affected vaults and refresh them
    const sourceVault = findVaultForPath(sourcePath)
    const targetVault = findVaultForPath(targetDirPath)

    if (sourceVault) await refreshTree(sourceVault)
    if (targetVault && targetVault.id !== sourceVault?.id) await refreshTree(targetVault)

    // Update editor/tabs if needed
    const tabs = useTabsStore()
    await tabs.updatePath(sourcePath, destPath)
  }

  async function copyNode(sourcePath: string, targetDirPath: string) {
    const fs = useFs()
    const name = basename(sourcePath)
    const destPath = await fs.join(targetDirPath, name)

    if (sourcePath === destPath) return

    const info = await fs.stat(sourcePath)
    if (info.isDirectory) {
      await fs.copyFolder(sourcePath, destPath)
    }
    else {
      await fs.copyFile(sourcePath, destPath)
    }

    const targetVault = findVaultForPath(targetDirPath)
    if (targetVault) await refreshTree(targetVault)
  }

  async function refreshTree(vault: Vault) {
    const fs = useFs()
    const settingsStore = useSettingsStore()
    const scanRoot = getEffectiveContentRoot(vault)
    try {
      trees.value[vault.id] = await fs.scanMarkdownTree(scanRoot, {
        showHidden: settingsStore.settings.showHiddenFiles,
        filterSettings: vault.filters,
        sortMode: settingsStore.settings.fileSortMode,
        excludes: vault.excludes,
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

  /**
   * Returns the effective content scan root for a vault, preferring
   * `contentRoot` from `.neptu-vault.yaml` over legacy `vault.contentFolder`.
   */
  function getEffectiveContentRoot(vault: Vault): string {
    const configRoot = vaultConfigs.value[vault.id]?.contentRoot
    if (configRoot) {
      const base = vault.path.replace(/[/\\]+$/, '')
      return `${base}/${configRoot}`
    }
    return getVaultScanRoot(vault)
  }

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
    createVaultFolder,
    refreshTree,
    refreshAllTrees,
    addGroup,
    removeGroup,
    moveNode,
    copyNode,
    addFavorite,
    removeFavorite,
    isFavorite,
    ensureVaultMarker,
    loadVaultConfig,
    saveVaultConfig,
    getEffectiveContentRoot,
  }
})
