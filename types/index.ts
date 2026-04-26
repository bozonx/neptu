export type ProjectType = 'local' | 'git' | 'github' | 'gitlab'

export interface Project {
  id: string
  name: string
  type: ProjectType
  path: string
}

export interface FileNode {
  name: string
  path: string
  isDir: boolean
  children?: FileNode[]
}

export interface AppConfig {
  version: 1
  projects: Project[]
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
