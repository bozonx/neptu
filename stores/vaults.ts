import { defineStore } from 'pinia'
import type {
  AddVaultPayload,
  FileNode,
  GitVaultSettings,
  Vault,
} from '~/types'

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
  async function hydrate(vaults: Vault[], mainRepoPath: string) {
    let mutated = false
    if (!vaults.some((v) => v.path === mainRepoPath)) {
      vaults.unshift({
        id: generateId(),
        name: basename(mainRepoPath),
        type: 'local',
        path: mainRepoPath,
      })
      mutated = true
    }
    list.value = vaults

    if (mutated) await useSettingsStore().persist()
    await refreshAllTrees()
  }

  async function addVault(payload: AddVaultPayload) {
    const settings = useSettingsStore()
    if (!settings.mainRepoPath) throw new Error('Main repository is not set')

    const vault: Vault = {
      id: generateId(),
      name: payload.name?.trim() || basename(payload.path),
      type: payload.type,
      path: payload.path,
    }

    if (payload.type === 'git') {
      const git = useGit()
      if (payload.gitMode === 'init') {
        await git.initRepo(payload.path)
      }
      else {
        const ok = await git.isRepo(payload.path)
        if (!ok) throw new Error('Selected folder is not a git repository')
      }
      vault.git = payload.git ?? {
        commitMode: 'auto',
        commitDebounceMs: settings.settings.defaultCommitDebounceMs,
      }
    }

    list.value.push(vault)
    await settings.persist()
    await refreshTree(vault)
    if (vault.type === 'git') await useGitStore().refreshStatus(vault.id)
  }

  async function removeVault(id: string) {
    const settings = useSettingsStore()
    const idx = list.value.findIndex((v) => v.id === id)
    if (idx === -1) return
    const removed = list.value[idx]!
    // Forbid removing the main repository entry
    if (removed.path === settings.mainRepoPath) return

    const editor = useEditorStore()
    const git = useGitStore()
    git.cancelCommit(id)
    git.dropVault(id)
    if (editor.currentFilePath?.startsWith(removed.path)) editor.reset()

    list.value.splice(idx, 1)
    Reflect.deleteProperty(trees.value, removed.id)
    await settings.persist()
  }

  async function updateVault(
    id: string,
    updates: Partial<Pick<Vault, 'name' | 'path'>> & { git?: GitVaultSettings },
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
      git.cancelCommit(vault.id)
      if (editor.currentFilePath?.startsWith(vault.path)) editor.reset()
      vault.path = updates.path
      await refreshTree(vault)
      if (vault.type === 'git') await git.refreshStatus(vault.id)
    }

    if (updates.git !== undefined && vault.type === 'git') {
      vault.git = updates.git
      // Re-evaluate scheduled commit if mode changed
      if (updates.git.commitMode === 'manual') {
        useGitStore().cancelCommit(vault.id)
      }
    }

    await settings.persist()
  }

  async function refreshTree(vault: Vault) {
    const fs = useFs()
    try {
      trees.value[vault.id] = await fs.scanMarkdownTree(vault.path)
    }
    catch (error) {
      console.error('Failed to scan vault tree', vault.path, error)
      trees.value[vault.id] = []
    }
  }

  async function refreshAllTrees() {
    await Promise.all(list.value.map((v) => refreshTree(v)))
  }

  return {
    list,
    trees,
    findById,
    findVaultForPath,
    hydrate,
    addVault,
    removeVault,
    updateVault,
    refreshTree,
    refreshAllTrees,
  }
})
