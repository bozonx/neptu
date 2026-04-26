import { defineStore } from 'pinia'
import type { AppConfig, FileNode, Project, ProjectType, SaveStatus } from '~/types'

interface ProjectsState {
  mainRepoPath: string | null
  initialized: boolean
  projects: Project[]
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

export const useProjectsStore = defineStore('projects', {
  state: (): ProjectsState => ({
    mainRepoPath: null,
    initialized: false,
    projects: [],
    trees: {},
    currentFilePath: null,
    currentContent: '',
    saveStatus: 'idle',
    saveError: null,
  }),

  getters: {
    needsMainRepo: (state) => state.initialized && !state.mainRepoPath,
    hasProjects: (state) => state.projects.length > 0,
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
      if (!appConfig.projects.some(p => p.path === repoPath)) {
        appConfig.projects.unshift({
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

      this.projects = appConfig.projects
      await this.refreshAllTrees()
    },

    async addProject(payload: { name?: string, type: ProjectType, path: string }) {
      if (!this.mainRepoPath) throw new Error('Main repository is not set')

      const project: Project = {
        id: generateId(),
        name: payload.name?.trim() || basename(payload.path),
        type: payload.type,
        path: payload.path,
      }

      this.projects.push(project)
      await this.persistConfig()
      await this.refreshTree(project)
    },

    async removeProject(id: string) {
      const idx = this.projects.findIndex(p => p.id === id)
      if (idx === -1) return
      const removed = this.projects[idx]
      // Forbid removing the main repository entry
      if (removed && removed.path === this.mainRepoPath) return

      this.projects.splice(idx, 1)
      if (removed) delete this.trees[removed.id]
      await this.persistConfig()
    },

    async refreshTree(project: Project) {
      const fs = useFs()
      try {
        const tree = await fs.scanMarkdownTree(project.path)
        this.trees[project.id] = tree
      }
      catch (error) {
        console.error('Failed to scan project tree', project.path, error)
        this.trees[project.id] = []
      }
    },

    async refreshAllTrees() {
      await Promise.all(this.projects.map(p => this.refreshTree(p)))
    },

    async persistConfig() {
      if (!this.mainRepoPath) return
      const config = useConfig()
      const data: AppConfig = {
        version: 1,
        projects: this.projects,
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

    async createNote(payload: { project: Project, fileName: string, parentDir?: string }) {
      const fs = useFs()
      const dir = payload.parentDir ?? payload.project.path
      const fullPath = await fs.createMarkdown(dir, payload.fileName)
      await this.refreshTree(payload.project)
      await this.openFile(fullPath)
      return fullPath
    },

    async deleteNote(payload: { project: Project, path: string }) {
      const fs = useFs()
      await fs.deleteFile(payload.path)
      if (this.currentFilePath === payload.path) {
        this.currentFilePath = null
        this.currentContent = ''
        this.saveStatus = 'idle'
      }
      await this.refreshTree(payload.project)
    },
  },
})
