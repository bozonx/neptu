import { defineStore } from 'pinia'
import type {
  AppConfig,
  AppSettings,
  CommitStatus,
  FileNode,
  GitStatusInfo,
  GitVaultSettings,
  SaveStatus,
  Vault,
  VaultType,
} from '~/types'
import { DEFAULT_SETTINGS } from '~/composables/useConfig'

interface AddVaultPayload {
  name?: string
  type: VaultType
  path: string
  /** Required for git vaults */
  gitMode?: 'init' | 'connect'
  git?: GitVaultSettings
}

interface VaultsState {
  mainRepoPath: string | null
  initialized: boolean
  vaults: Vault[]
  settings: AppSettings
  trees: Record<string, FileNode[]>
  /** Per-vault git status, keyed by vault id */
  gitStatus: Record<string, GitStatusInfo>
  /** Per-vault commit status, keyed by vault id */
  commitStatus: Record<string, CommitStatus>
  currentFilePath: string | null
  currentContent: string
  saveStatus: SaveStatus
  saveError: string | null
}

/**
 * Per-vault scheduled commit timers. Lives outside the reactive state so that
 * Pinia does not try to make `setTimeout` handles reactive.
 */
const commitTimers = new Map<string, ReturnType<typeof setTimeout>>()

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
function findVaultForPath(vaults: Vault[], filePath: string): Vault | null {
  let best: Vault | null = null
  for (const v of vaults) {
    const prefix = v.path.endsWith('/') || v.path.endsWith('\\') ? v.path : v.path + '/'
    const candidate = filePath === v.path || filePath.startsWith(prefix)
    if (!candidate) continue
    if (!best || v.path.length > best.path.length) best = v
  }
  return best
}

export const useVaultsStore = defineStore('vaults', {
  state: (): VaultsState => ({
    mainRepoPath: null,
    initialized: false,
    vaults: [],
    settings: { ...DEFAULT_SETTINGS },
    trees: {},
    gitStatus: {},
    commitStatus: {},
    currentFilePath: null,
    currentContent: '',
    saveStatus: 'idle',
    saveError: null,
  }),

  getters: {
    needsMainRepo: (state) => state.initialized && !state.mainRepoPath,
    hasVaults: (state) => state.vaults.length > 0,
    currentVault: (state): Vault | null => {
      if (!state.currentFilePath) return null
      return findVaultForPath(state.vaults, state.currentFilePath)
    },
  },

  actions: {
    async init() {
      const config = useConfig()
      const repo = await config.getMainRepoPath()
      this.mainRepoPath = repo
      this.initialized = true
      if (repo) {
        await this.loadFromRepo(repo)
      }
    },

    async setMainRepo(path: string) {
      const config = useConfig()
      await config.setMainRepoPath(path)
      this.mainRepoPath = path
      await this.loadFromRepo(path)
    },

    async loadFromRepo(repoPath: string) {
      const config = useConfig()
      const appConfig = await config.loadAppConfig(repoPath)

      // Always make sure the main repository is present as a vault entry.
      // It may be missing if the config file was created in an older version
      // or edited manually.
      let mutated = false
      if (!appConfig.vaults.some(v => v.path === repoPath)) {
        appConfig.vaults.unshift({
          id: generateId(),
          name: basename(repoPath),
          type: 'local',
          path: repoPath,
        })
        mutated = true
      }
      if (mutated) {
        await config.saveAppConfig(repoPath, appConfig)
      }

      this.vaults = appConfig.vaults
      this.settings = appConfig.settings
      await this.refreshAllTrees()
      await this.refreshAllGitStatuses()
    },

    async updateSettings(patch: Partial<AppSettings>) {
      this.settings = { ...this.settings, ...patch }
      await this.persistConfig()
    },

    async addVault(payload: AddVaultPayload) {
      if (!this.mainRepoPath) throw new Error('Main repository is not set')

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
          commitDebounceMs: this.settings.defaultCommitDebounceMs,
        }
      }

      this.vaults.push(vault)
      await this.persistConfig()
      await this.refreshTree(vault)
      if (vault.type === 'git') await this.refreshGitStatus(vault.id)
    },

    async removeVault(id: string) {
      const idx = this.vaults.findIndex(v => v.id === id)
      if (idx === -1) return
      const removed = this.vaults[idx]
      // Forbid removing the main repository entry
      if (removed && removed.path === this.mainRepoPath) return

      this.vaults.splice(idx, 1)
      if (removed) {
        delete this.trees[removed.id]
        delete this.gitStatus[removed.id]
        delete this.commitStatus[removed.id]
        const t = commitTimers.get(removed.id)
        if (t) {
          clearTimeout(t)
          commitTimers.delete(removed.id)
        }
      }
      await this.persistConfig()
    },

    async updateVault(
      id: string,
      updates: Partial<Pick<Vault, 'name' | 'path'>> & { git?: GitVaultSettings },
    ) {
      const vault = this.vaults.find(v => v.id === id)
      if (!vault) return

      const isMainRepo = vault.path === this.mainRepoPath

      if (updates.name !== undefined) {
        vault.name = updates.name.trim() || vault.name
      }

      if (updates.path !== undefined && !isMainRepo) {
        vault.path = updates.path
        await this.refreshTree(vault)
        if (vault.type === 'git') await this.refreshGitStatus(vault.id)
      }

      if (updates.git !== undefined && vault.type === 'git') {
        vault.git = updates.git
        // Re-evaluate scheduled commit if mode changed
        if (updates.git.commitMode === 'manual') this.cancelVaultCommit(vault.id)
      }

      await this.persistConfig()
    },

    async refreshGitStatus(vaultId: string) {
      const vault = this.vaults.find(v => v.id === vaultId)
      if (!vault || vault.type !== 'git') return
      const git = useGit()
      try {
        const status = await git.status(vault.path)
        this.gitStatus[vaultId] = status
      }
      catch (error) {
        console.error('Failed to read git status', vault.path, error)
        this.gitStatus[vaultId] = { dirty: false, changedFiles: 0 }
      }
    },

    async refreshAllGitStatuses() {
      await Promise.all(
        this.vaults
          .filter(v => v.type === 'git')
          .map(v => this.refreshGitStatus(v.id)),
      )
    },

    /**
     * Resolves the commit author. App settings take precedence over git's
     * global config so users can override it per-installation.
     */
    async resolveAuthor(): Promise<{ name: string, email: string } | null> {
      const overrideName = this.settings.gitAuthorName.trim()
      const overrideEmail = this.settings.gitAuthorEmail.trim()
      if (overrideName && overrideEmail) {
        return { name: overrideName, email: overrideEmail }
      }
      const git = useGit()
      const global = await git.globalAuthor()
      const name = overrideName || (global.name ?? '').trim()
      const email = overrideEmail || (global.email ?? '').trim()
      if (!name || !email) return null
      return { name, email }
    },

    cancelVaultCommit(vaultId: string) {
      const t = commitTimers.get(vaultId)
      if (t) {
        clearTimeout(t)
        commitTimers.delete(vaultId)
      }
    },

    /**
     * Schedules a debounced auto-commit for a git vault in `auto` mode.
     * The timer is cancelled by `cancelVaultCommit` whenever the user types
     * (so the commit only runs after the next autosave settles).
     */
    scheduleVaultCommit(vaultId: string) {
      const vault = this.vaults.find(v => v.id === vaultId)
      if (!vault || vault.type !== 'git' || !vault.git) return
      if (vault.git.commitMode !== 'auto') return
      this.cancelVaultCommit(vaultId)
      const delay = Math.max(0, vault.git.commitDebounceMs)
      const handle = setTimeout(() => {
        commitTimers.delete(vaultId)
        this.commitVault(vaultId).catch((error) => {
          console.error('Auto-commit failed', error)
        })
      }, delay)
      commitTimers.set(vaultId, handle)
    },

    async commitVault(vaultId: string, message?: string) {
      const vault = this.vaults.find(v => v.id === vaultId)
      if (!vault || vault.type !== 'git') return

      const author = await this.resolveAuthor()
      if (!author) {
        const err = new Error('Git author is not configured. Set it in Settings or run `git config --global user.name/email`.')
        this.commitStatus[vaultId] = 'error'
        throw err
      }

      this.commitStatus[vaultId] = 'committing'
      try {
        const git = useGit()
        // Pre-flight to build a more meaningful message
        const status = await git.status(vault.path)
        if (!status.dirty) {
          this.commitStatus[vaultId] = 'idle'
          this.gitStatus[vaultId] = status
          return
        }
        const finalMessage = message?.trim()
          || `Update notes (${status.changedFiles} file${status.changedFiles === 1 ? '' : 's'})`
        const result = await git.commitAll({
          path: vault.path,
          message: finalMessage,
          authorName: author.name,
          authorEmail: author.email,
        })
        this.commitStatus[vaultId] = result.committed ? 'committed' : 'idle'
        await this.refreshGitStatus(vaultId)
      }
      catch (error) {
        this.commitStatus[vaultId] = 'error'
        throw error
      }
    },

    async refreshTree(vault: Vault) {
      const fs = useFs()
      try {
        const tree = await fs.scanMarkdownTree(vault.path)
        this.trees[vault.id] = tree
      }
      catch (error) {
        console.error('Failed to scan vault tree', vault.path, error)
        this.trees[vault.id] = []
      }
    },

    async refreshAllTrees() {
      await Promise.all(this.vaults.map(v => this.refreshTree(v)))
    },

    async persistConfig() {
      if (!this.mainRepoPath) return
      const config = useConfig()
      const data: AppConfig = {
        version: 1,
        vaults: this.vaults,
        settings: this.settings,
      }
      await config.saveAppConfig(this.mainRepoPath, data)
    },

    async openFile(path: string) {
      const fs = useFs()
      const content = await fs.readMarkdown(path)
      this.currentFilePath = path
      this.currentContent = content
      this.saveStatus = 'idle'
      this.saveError = null
    },

    setContent(content: string) {
      this.currentContent = content
      // Any new edit must restart the commit debounce, so cancel any pending
      // timer for the vault that owns the active file.
      const vault = this.currentVault
      if (vault && vault.type === 'git') this.cancelVaultCommit(vault.id)
    },

    async saveCurrentFile() {
      if (!this.currentFilePath) return
      const fs = useFs()
      this.saveStatus = 'saving'
      try {
        await fs.writeMarkdown(this.currentFilePath, this.currentContent)
        this.saveStatus = 'saved'
        this.saveError = null
        const vault = this.currentVault
        if (vault && vault.type === 'git') {
          await this.refreshGitStatus(vault.id)
          if (vault.git?.commitMode === 'auto') this.scheduleVaultCommit(vault.id)
        }
      }
      catch (error) {
        this.saveStatus = 'error'
        this.saveError = error instanceof Error ? error.message : String(error)
        throw error
      }
    },

    async createNote(payload: { vault: Vault, fileName: string, parentDir?: string }) {
      const fs = useFs()
      const dir = payload.parentDir ?? payload.vault.path
      const fullPath = await fs.createMarkdown(dir, payload.fileName)
      await this.refreshTree(payload.vault)
      if (payload.vault.type === 'git') await this.refreshGitStatus(payload.vault.id)
      await this.openFile(fullPath)
      return fullPath
    },

    async deleteNote(payload: { vault: Vault, path: string }) {
      const fs = useFs()
      await fs.deleteFile(payload.path)
      if (this.currentFilePath === payload.path) {
        this.currentFilePath = null
        this.currentContent = ''
        this.saveStatus = 'idle'
      }
      await this.refreshTree(payload.vault)
      if (payload.vault.type === 'git') await this.refreshGitStatus(payload.vault.id)
    },
  },
})
