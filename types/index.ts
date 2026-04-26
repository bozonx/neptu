export type VaultType = 'local' | 'git'

export type GitCommitMode = 'auto' | 'manual'

export interface FileFilterExtension {
  ext: string
  enabled: boolean
}

export interface FileFilterGroup {
  label: string
  enabled: boolean
  /** Whether the user can add/remove extensions in this group */
  editable: boolean
  extensions: FileFilterExtension[]
}

export interface FileFilterSettings {
  groups: FileFilterGroup[]
}

export const DEFAULT_FILE_FILTERS: FileFilterSettings = {
  groups: [
    {
      label: 'Text',
      enabled: true,
      editable: true,
      extensions: [
        { ext: 'md', enabled: true },
        { ext: 'txt', enabled: true },
        { ext: 'yaml', enabled: true },
        { ext: 'yml', enabled: true },
      ],
    },
    {
      label: 'Image',
      enabled: true,
      editable: false,
      extensions: [
        { ext: 'avif', enabled: true },
        { ext: 'webp', enabled: true },
        { ext: 'png', enabled: true },
        { ext: 'jpg', enabled: true },
        { ext: 'jpeg', enabled: true },
      ],
    },
    {
      label: 'Video',
      enabled: true,
      editable: false,
      extensions: [
        { ext: 'avi', enabled: true },
        { ext: 'mp4', enabled: true },
        { ext: 'mkv', enabled: true },
        { ext: 'webm', enabled: true },
      ],
    },
    {
      label: 'Audio',
      enabled: true,
      editable: false,
      extensions: [
        { ext: 'weba', enabled: true },
        { ext: 'mp3', enabled: true },
        { ext: 'aac', enabled: true },
        { ext: 'm4a', enabled: true },
        { ext: 'opus', enabled: true },
      ],
    },
  ],
}

export interface GitVaultSettings {
  commitMode: GitCommitMode
  /** Debounce in milliseconds before an auto-commit fires after the last autosave */
  commitDebounceMs: number
}

export interface VaultGroup {
  id: string
  name: string
}

export interface Vault {
  id: string
  name: string
  type: VaultType
  path: string
  /** Present for git vaults */
  git?: GitVaultSettings
  /** Per-vault file-extension filter settings */
  filters?: FileFilterSettings
  /** Whether to show hidden files and folders (names starting with ".") */
  showHidden?: boolean
  /** ID of the group this vault belongs to */
  groupId?: string
}

export interface FileNode {
  name: string
  path: string
  isDir: boolean
  children?: FileNode[]
}

export type LayoutMode = 'auto' | 'desktop' | 'mobile'
export type Theme = 'system' | 'light' | 'dark'

export interface AppSettings {
  /** Debounce for autosave (writing the editor buffer to disk) */
  autosaveDebounceMs: number
  /** Default debounce for git auto-commit, used when creating a new git vault */
  defaultCommitDebounceMs: number
  /** Override for git author. Falls back to git's global config when empty */
  gitAuthorName: string
  gitAuthorEmail: string
  /** UI Layout mode */
  layoutMode: LayoutMode
  /** UI Theme */
  theme: Theme
}

export const DEFAULT_SETTINGS: AppSettings = {
  autosaveDebounceMs: 800,
  defaultCommitDebounceMs: 5000,
  gitAuthorName: '',
  gitAuthorEmail: '',
  layoutMode: 'auto',
  theme: 'system',
}

export interface AppConfig {
  version: 1
  mainRepoPath: string | null
  vaults: Vault[]
  settings: AppSettings
  groups: VaultGroup[]
}

export type SplitDirection = 'horizontal' | 'vertical'

export interface EditorTab {
  id: string
  filePath: string
}

export interface PanelLeaf {
  type: 'leaf'
  id: string
  tabs: EditorTab[]
  activeId: string | null
}

export interface PanelNode {
  type: 'node'
  id: string
  direction: SplitDirection
  first: Panel
  second: Panel
  ratio: number
}

export type Panel = PanelLeaf | PanelNode

export interface CursorPosition {
  selectionStart: number
  selectionEnd: number
  scrollTop: number
}

export interface UiState {
  activeRightTab: 'outline' | 'info'
  desktopLayout?: Panel
  activeDesktopPanelId?: string
  mobileTabs?: EditorTab[]
  mobileActiveId?: string | null
  leftSidebarSize?: number
  rightSidebarSize?: number
  cursorPositions?: Record<string, CursorPosition>
}

export const DEFAULT_UI_STATE: UiState = {
  activeRightTab: 'outline',
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
