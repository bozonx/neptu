export type VaultType = 'local' | 'git' | 'github' | 'gitlab'

export interface Vault {
  id: string
  name: string
  type: VaultType
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
  vaults: Vault[]
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
