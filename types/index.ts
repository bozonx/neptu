export type VaultType = 'local' | 'git'

export type ContentType = 'vault' | 'blog' | 'site'

export type SiteLangMode = 'monolingual' | 'multilingual'

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
  /** ID of the group this vault belongs to */
  groupId?: string
  /** Content structure type */
  contentType?: ContentType
  /** Relative folder inside the vault that is treated as the content root (e.g. "src") */
  contentFolder?: string
  /** Language mode for informational sites */
  siteLangMode?: SiteLangMode
}

export type FileSortMode
  = | 'nameAsc'
    | 'nameDesc'
    | 'mtimeDesc'
    | 'mtimeAsc'
    | 'birthtimeDesc'
    | 'birthtimeAsc'

export interface FileNode {
  name: string
  path: string
  isDir: boolean
  mtime?: number
  birthtime?: number
  children?: FileNode[]
}

export type LayoutMode = 'desktop' | 'mobile'
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
  /** UI language locale */
  locale: 'auto' | 'en-US' | 'ru-RU'
  /** Global file tree sorting mode */
  fileSortMode: FileSortMode
  /** Whether to show hidden files and folders (names starting with ".") across all vaults */
  showHiddenFiles: boolean
  /** List of enabled plugin ids. Defaults to built-ins when missing. */
  enabledPlugins?: string[]
}

export const DEFAULT_SETTINGS: AppSettings = {
  autosaveDebounceMs: 800,
  defaultCommitDebounceMs: 5000,
  gitAuthorName: '',
  gitAuthorEmail: '',
  layoutMode: 'desktop',
  theme: 'system',
  locale: 'auto',
  fileSortMode: 'nameAsc',
  showHiddenFiles: false,
  enabledPlugins: ['com.neptu.outline', 'com.neptu.file-info', 'com.neptu.history'],
}

export interface AppConfig {
  version: 1
  mainRepoPath: string | null
  vaults: Vault[]
  settings: AppSettings
  groups: VaultGroup[]
  favorites?: string[]
}

export type SplitDirection = 'horizontal' | 'vertical'

export interface EditorTab {
  id: string
  filePath: string
  pinned?: boolean
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
  /** Legacy field — migrated on load to activeRightSidebarView */
  activeRightTab?: 'outline' | 'info'
  /** FQID of the active left-sidebar view, e.g. `com.neptu.history:main`. */
  activeLeftSidebarView?: string | null
  /** FQID of the active right-sidebar view, e.g. `com.neptu.outline:main`. */
  activeRightSidebarView?: string | null
  desktopLayout?: Panel
  activeDesktopPanelId?: string
  mobileTabs?: EditorTab[]
  mobileActiveId?: string | null
  leftSidebarSize?: number
  rightSidebarSize?: number
  leftSidebarMode?: 'single' | 'dual'
  leftSidebarDualFirstColumnSize?: number
  /** Active built-in tab in the left sidebar: files, search or favorites */
  leftSidebarTab?: 'files' | 'search' | 'favorites'
  /** Whether the right sidebar is collapsed */
  rightSidebarCollapsed?: boolean
  cursorPositions?: Record<string, CursorPosition>
}

export const DEFAULT_UI_STATE: UiState = {
  activeRightSidebarView: null,
}

export interface AddVaultPayload {
  name?: string
  type: VaultType
  path: string
  /** Required for git vaults */
  gitMode?: 'init' | 'connect'
  git?: GitVaultSettings
  contentType?: ContentType
  contentFolder?: string
  siteLangMode?: SiteLangMode
}

/** Returns the absolute path that should be scanned as the content root for a vault */
export function getVaultScanRoot(vault: Vault): string {
  if (vault.contentType === 'vault' || !vault.contentType) {
    return vault.path
  }
  const folder = vault.contentFolder ?? 'src'
  const base = vault.path.replace(/[/\\]+$/, '')
  return `${base}/${folder}`
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
