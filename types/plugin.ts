import type { Component } from 'vue'
import type { VaultConfig } from './vault-config'

/**
 * Locations where plugins may register toolbar buttons.
 * - `left-sidebar-header`: new row under the window title (desktop layout)
 * - `left-sidebar-footer`: bottom toolbar of AppSidebar, alongside Settings
 * - `right-sidebar-toolbar`: top toolbar of the right file sidebar
 */
export type SidebarButtonLocation = 'left-sidebar-header' | 'left-sidebar-footer' | 'right-sidebar-toolbar'

export interface PluginManifest {
  /** Reverse-DNS id, unique across the installation. */
  id: string
  /** Human-readable name shown in settings. */
  name: string
  /** Semver version string. */
  version: string
  description?: string
  author?: string
}

export interface SidebarButtonSpec {
  /** Id unique within the plugin (namespaced with pluginId at registration). */
  id: string
  icon: string
  label?: string
  title?: string
  location: SidebarButtonLocation
  /** Lower first. Defaults to 100. */
  order?: number
  onClick: () => void
  /** Reactive visibility flag; when false the button is skipped. */
  visible?: () => boolean
  /** Reactive active-state flag; when true the button is rendered as selected. */
  active?: () => boolean
}

export interface LeftSidebarViewSpec {
  /** Id unique within the plugin. */
  id: string
  icon: string
  title: string
  order?: number
  /** View body; rendered when this view is active in the left sidebar. */
  component: Component
}

export interface RightSidebarViewSpec {
  /** Id unique within the plugin. */
  id: string
  icon: string
  title: string
  order?: number
  /** View body; rendered when this view is active. */
  component: Component
}

export interface SettingsTabSpec {
  /** Id unique within the plugin. */
  id: string
  icon: string
  label: string
  order?: number
  /** Tab body; rendered inside SettingsDialog content area. */
  component: Component
}

export interface ModalSpec {
  /** Id unique within the plugin. */
  id: string
  component: Component
  /** Props forwarded to the component. */
  props?: Record<string, unknown>
  /** Called after the modal is closed by the host. */
  onClose?: () => void
}

export interface ContentStructureSpec {
  /** Id unique within the plugin. */
  id: string
  label: string
  description?: string
  descriptionKey?: string
  /** Lower first. Defaults to 100. */
  order?: number
  /** Template written to .neptu-vault.yaml when selected. */
  config: VaultConfig
}

export interface CommandPaletteItem {
  /** Id unique within the plugin (namespaced with pluginId at registration). */
  id: string
  label: string | (() => string)
  icon?: string
  /** Human-readable shortcut hint, e.g. "Ctrl+Shift+P". */
  shortcut?: string
  /** Extra searchable keywords. */
  keywords?: string[]
  /** Called when the command is selected. */
  onRun: () => void
  /** Reactive visibility flag; when false the command is skipped. */
  visible?: () => boolean
}

export interface StatusBarItemSpec {
  /** Id unique within the plugin. */
  id: string
  /** Lower first. Defaults to 100. */
  order?: number
  /** Component rendered inside the status bar. */
  component: Component
  /** Reactive visibility flag; when false the item is skipped. */
  visible?: () => boolean
}

/**
 * Registered variants carry the fully qualified id (`${pluginId}:${spec.id}`)
 * plus owner metadata so the registry can perform scoped operations
 * (e.g. `unregister all entries owned by X`).
 */
export interface RegisteredSidebarButton extends SidebarButtonSpec {
  pluginId: string
  fqid: string
}

export interface RegisteredLeftSidebarView extends LeftSidebarViewSpec {
  pluginId: string
  fqid: string
}

export interface RegisteredRightSidebarView extends RightSidebarViewSpec {
  pluginId: string
  fqid: string
}

export interface RegisteredSettingsTab extends SettingsTabSpec {
  pluginId: string
  fqid: string
}

export interface RegisteredModal extends ModalSpec {
  pluginId: string
  fqid: string
}

export interface RegisteredContentStructure extends ContentStructureSpec {
  pluginId: string
  fqid: string
}

export interface RegisteredCommandPaletteItem extends CommandPaletteItem {
  pluginId: string
  fqid: string
}

export interface RegisteredStatusBarItem extends StatusBarItemSpec {
  pluginId: string
  fqid: string
}

export interface PluginAPI {
  ui: {
    /** Register a command-palette item. Returns a dispose fn. */
    addCommand: (spec: CommandPaletteItem) => () => void
    /** Register a toolbar button. Returns a dispose fn. */
    addSidebarButton: (spec: SidebarButtonSpec) => () => void
    /** Register a left-sidebar view. Returns a dispose fn. */
    addLeftSidebarView: (spec: LeftSidebarViewSpec) => () => void
    /** Register a right-sidebar view. Returns a dispose fn. */
    addRightSidebarView: (spec: RightSidebarViewSpec) => () => void
    /** Register a tab inside the settings dialog. Returns a dispose fn. */
    addSettingsTab: (spec: SettingsTabSpec) => () => void
    /** Open a modal. Returns a handle with `close()` and the fqid. */
    openModal: (spec: ModalSpec) => { id: string, close: () => void }
    /** Register an interactive block in the status bar. Returns a dispose fn. */
    addStatusBarItem: (spec: StatusBarItemSpec) => () => void
  }
  storage: {
    /** Load persisted state for this plugin. */
    get: <T = unknown>() => Promise<T | null>
    /** Persist state for this plugin (debounced). */
    set: <T = unknown>(value: T) => Promise<void>
  }
  content: {
    /** Register a selectable content structure. Returns a dispose fn. */
    addStructure: (spec: ContentStructureSpec) => () => void
  }
}

export interface PluginContext {
  manifest: PluginManifest
  api: PluginAPI
  /** Register a cleanup to run on unload/deactivate. */
  onUnload: (cb: () => void) => void
}

export interface Plugin {
  manifest: PluginManifest
  activate: (ctx: PluginContext) => void | Promise<void>
  deactivate?: () => void | Promise<void>
}
