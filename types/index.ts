export type VaultType = 'local' | 'git'

export type ContentType = 'vault' | 'blog' | 'site' | 'custom'

export type SiteLangMode = 'monolingual' | 'multilingual'

export type GitCommitMode = 'auto' | 'manual' | 'respect_config'

export type MediaUploadMode = 'adjacent' | 'adjacent-folder' | 'global-folder'

export type MediaNamingMode = 'original' | 'document-index' | 'hash'

export interface MediaDirSettings {
  mode: MediaUploadMode
  /** Relative path for global-folder, or subfolder name for adjacent-folder. */
  folder?: string
  naming: MediaNamingMode
}

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
  /** Debounce in milliseconds before an auto-commit fires after the last autosave.
   *  When omitted the global defaultCommitDebounceMs is used. */
  commitDebounceMs?: number
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
  /** FQID of a registered content structure used when contentType is custom */
  contentStructureId?: string
  /** Relative folder inside the vault that is treated as the content root (e.g. "src") */
  contentFolder?: string
  /** Paths relative to vault root to exclude from the file tree */
  excludes?: string[]
  /** Local override for media uploads. Does not write to .neptu-vault.yaml. */
  mediaDir?: MediaDirSettings
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

/**
 * Settings that should roam with the user across devices (stored in the main
 * repository under `.neptu/config.json`).
 */
export interface SharedSettings {
  /** Debounce for autosave (writing the editor buffer to disk) */
  autosaveDebounceMs: number
  /** Default debounce for git auto-commit, used when creating a new git vault */
  defaultCommitDebounceMs: number
  /** Override for git author. Falls back to git's global config when empty */
  gitAuthorName: string
  gitAuthorEmail: string
  /** Global file tree sorting mode */
  fileSortMode: FileSortMode
  /** Whether to show hidden files and folders (names starting with ".") across all vaults */
  showHiddenFiles: boolean
  /** Whether to confirm before deleting files/folders in local (non-git) vaults */
  confirmDeleteLocal: boolean
  /** Whether to confirm before deleting files/folders in git vaults */
  confirmDeleteGit: boolean
  /** Whether to move deleted files in local vaults to a .trash folder instead of permanently deleting them */
  useTrash: boolean
  /** List of enabled plugin ids. Defaults to built-ins when missing. */
  enabledPlugins?: string[]
  /** Default commit mode for git vaults that are set to follow config. */
  defaultCommitMode: 'auto' | 'manual'
  /** Use auto-generated message for manual commits (no prompt). */
  gitAutoMessage: boolean
  /** Template for auto-generated commit messages. */
  gitAutoMessageTemplate: string
  /** Relative path inside the main repository for daily notes. */
  dailyNotesPath: string
}

export const DEFAULT_SHARED_SETTINGS: SharedSettings = {
  autosaveDebounceMs: 800,
  defaultCommitDebounceMs: 5000,
  gitAuthorName: '',
  gitAuthorEmail: '',
  fileSortMode: 'nameAsc',
  showHiddenFiles: false,
  confirmDeleteLocal: true,
  dailyNotesPath: '.neptu/daily_notes',
  confirmDeleteGit: true,
  useTrash: true,
  enabledPlugins: ['com.neptu.outline', 'com.neptu.file-info', 'com.neptu.history', 'com.neptu.content-types'],
  defaultCommitMode: 'auto',
  gitAutoMessage: true,
  gitAutoMessageTemplate: 'Update notes ({files} {fileWord})',
}

export type TabDisplayMode = 'single_line' | 'multi_line' | 'left_vertical'

/**
 * Settings tied to the current device / installation (stored in the Tauri app
 * config directory in `config.json`).
 */
export interface InstanceSettings {
  /** UI Layout mode */
  layoutMode: LayoutMode
  /** UI Theme */
  theme: Theme
  /** UI language locale */
  locale: 'auto' | 'en-US' | 'ru-RU'
  /** Editor tab display mode */
  tabDisplayMode: TabDisplayMode
}

export const DEFAULT_INSTANCE_SETTINGS: InstanceSettings = {
  layoutMode: 'desktop',
  theme: 'system',
  locale: 'auto',
  tabDisplayMode: 'single_line',
}

/** Convenience merge used by UI components. */
export interface AppSettings extends SharedSettings, InstanceSettings {}

export const DEFAULT_SETTINGS: AppSettings = {
  ...DEFAULT_SHARED_SETTINGS,
  ...DEFAULT_INSTANCE_SETTINGS,
}

/**
 * Shared configuration stored inside the main repository at `.neptu/config.json`
 * so it can be synced across devices by the user (e.g. Syncthing).
 *
 * - `favorites` are stored as paths relative to the main repository root.
 * - Vault paths that live inside the main repo are also stored relative.
 */
export interface SharedConfig {
  version: 1
  vaults: Vault[]
  groups: VaultGroup[]
  favorites: string[]
  settings: SharedSettings
}

/**
 * Instance-specific configuration stored in the Tauri app config directory.
 * Holds the absolute path to the main repository on this device.
 */
export interface InstanceConfig {
  version: 1
  mainRepoPath: string | null
  settings: InstanceSettings
}

/** @deprecated Use SharedConfig or InstanceConfig instead. */
export interface AppConfig extends InstanceConfig {
  vaults: Vault[]
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
  /** Selected vault in the first column of the dual left sidebar */
  leftSidebarDualSelectedVaultId?: string | null
  /** Whether the dual left sidebar is currently showing favorites */
  leftSidebarDualShowFavorites?: boolean
  /** Whether the dual left sidebar is currently showing daily notes */
  leftSidebarDualShowDailyNotes?: boolean
  /** Active built-in tab in the left sidebar: files, search, favorites, trash or dailyNotes */
  leftSidebarTab?: 'files' | 'search' | 'favorites' | 'trash' | 'dailyNotes'
  /** Whether the right sidebar is collapsed */
  rightSidebarCollapsed?: boolean
  /** Whether to auto-reveal the active file in the file tree */
  autoRevealFile?: boolean
  cursorPositions?: Record<string, CursorPosition>
  /** Expanded state of vault groups in the sidebar */
  expandedGroups?: Record<string, boolean>
  /** Expanded state of vaults in the sidebar */
  expandedVaults?: Record<string, boolean>
  /** Expanded state of folders in the file tree */
  expandedFolders?: Record<string, boolean>
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
  contentStructureId?: string
  contentFolder?: string
  siteLangMode?: SiteLangMode
  filters?: FileFilterSettings
  excludes?: string[]
  mediaDir?: MediaDirSettings
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
