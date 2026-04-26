export type VaultType = 'local' | 'git'

export type GitCommitMode = 'auto' | 'manual'

export interface GitVaultSettings {
  commitMode: GitCommitMode
  /** Debounce in milliseconds before an auto-commit fires after the last autosave */
  commitDebounceMs: number
}

export interface Vault {
  id: string
  name: string
  type: VaultType
  path: string
  /** Present for git vaults */
  git?: GitVaultSettings
}

export interface FileNode {
  name: string
  path: string
  isDir: boolean
  children?: FileNode[]
}

export interface AppSettings {
  /** Debounce for autosave (writing the editor buffer to disk) */
  autosaveDebounceMs: number
  /** Default debounce for git auto-commit, used when creating a new git vault */
  defaultCommitDebounceMs: number
  /** Override for git author. Falls back to git's global config when empty */
  gitAuthorName: string
  gitAuthorEmail: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  autosaveDebounceMs: 800,
  defaultCommitDebounceMs: 5000,
  gitAuthorName: '',
  gitAuthorEmail: '',
}

export interface AppConfig {
  version: 1
  vaults: Vault[]
  settings: AppSettings
}

export interface AddVaultPayload {
  name?: string
  type: VaultType
  path: string
  /** Required for git vaults */
  gitMode?: 'init' | 'connect'
  git?: GitVaultSettings
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export type CommitStatus = 'idle' | 'committing' | 'committed' | 'error'

export interface GitAuthor {
  name?: string | null
  email?: string | null
}

export interface GitStatusInfo {
  dirty: boolean
  changedFiles: number
}

export interface CommitResult {
  committed: boolean
  oid: string | null
  changedFiles: number
}
