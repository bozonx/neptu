import { defineStore } from 'pinia'
import type { AppConfig, FileNode, Vault, VaultType, SaveStatus } from '~/types'

interface VaultsState {
  mainRepoPath: string | null
  initialized: boolean
  vaults: Vault[]
  trees: Record<string, FileNode[]>
  currentFilePath: string | null
  currentContent: string
  saveStatus: SaveStatus
  saveError: string | null
}

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function basename(path: string): string {
  const norm = path.replace(/[\\/]+$/, '')
  const parts = norm.split(/[\\/]/)
  return parts[parts.length - 1] ?? norm
}

export const useVaultsStore = defineStore('vaults', {
  state: (): VaultsState => ({
    mainRepoPath: null,
    initialized: false,
    vaults: [],
    trees: {},
    currentFilePath: null,
    currentContent: '',
    saveStatus: 'idle',
    saveError: null,
  }),

  getters: {
    needsMainRepo: (state) => state.initialized && !state.mainRepoPath,
    hasVaults: (state) => state.vaults.length > 0,
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

      // Always make sure the main repository is present as a project entry.
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
      await this.refreshAllTrees()
    },

    async addVault(payload: { name?: string, type: VaultType, path: string }) {
      if (!this.mainRepoPath) throw new Error('Main repository is not set')

      const vault: Vault = {
        id: generateId(),
        name: payload.name?.trim() || basename(payload.path),
        type: payload.type,
        path: payload.path,
      }

      this.vaults.push(vault)
      await this.persistConfig()
      await this.refreshTree(vault)
    },

    async removeVault(id: string) {
      const idx = this.vaults.findIndex(v => v.id === id)
      if (idx === -1) return
      const removed = this.vaults[idx]
      // Forbid removing the main repository entry
      if (removed && removed.path === this.mainRepoPath) return

      this.vaults.splice(idx, 1)
      if (removed) delete this.trees[removed.id]
      await this.persistConfig()
    },

    async updateVault(id: string, updates: Partial<Pick<Vault, 'name' | 'path'>>) {
      const vault = this.vaults.find(v => v.id === id)
      if (!vault) return

      const isMainRepo = vault.path === this.mainRepoPath

      if (updates.name !== undefined) {
        vault.name = updates.name.trim() || vault.name
      }

      if (updates.path !== undefined && !isMainRepo) {
        vault.path = updates.path
        await this.refreshTree(vault)
      }

      await this.persistConfig()
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
    },

    async saveCurrentFile() {
      if (!this.currentFilePath) return
      const fs = useFs()
      this.saveStatus = 'saving'
      try {
        await fs.writeMarkdown(this.currentFilePath, this.currentContent)
        this.saveStatus = 'saved'
        this.saveError = null
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
    },
  },
})
