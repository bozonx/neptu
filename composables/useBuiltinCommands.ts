import type { RegisteredCommandPaletteItem } from '~/types/plugin'

/**
 * Registers core (built-in) command-palette commands.
 * Returns a cleanup function that unregisters all core commands.
 */
export function useBuiltinCommands() {
  const store = usePluginsStore()
  const editor = useEditorStore()
  const tabs = useTabsStore()
  const vaults = useVaultsStore()
  const settings = useSettingsStore()
  const git = useGitStore()
  const { t } = useI18n()
  const dialogs = useSidebarDialogs()
  const palette = useCommandPalette()

  const commands: RegisteredCommandPaletteItem[] = [
    {
      id: 'open-command-palette',
      pluginId: 'core',
      fqid: 'core:open-command-palette',
      label: () => t('commands.openCommandPalette'),
      icon: 'i-lucide-terminal',
      shortcut: 'Ctrl+Shift+P',
      onRun: () => palette.toggle(),
    },
    {
      id: 'open-settings',
      pluginId: 'core',
      fqid: 'core:open-settings',
      label: () => t('commands.openSettings'),
      icon: 'i-lucide-settings',
      onRun: () => settings.openSettingsDialog(),
    },
    {
      id: 'open-files',
      pluginId: 'core',
      fqid: 'core:open-files',
      label: () => t('commands.openFiles'),
      icon: 'i-lucide-files',
      onRun: () => {
        tabs.leftSidebarTab = 'files'
        store.setActiveLeftSidebarView(null)
      },
    },
    {
      id: 'open-search',
      pluginId: 'core',
      fqid: 'core:open-search',
      label: () => t('commands.openSearch'),
      icon: 'i-lucide-search',
      onRun: () => {
        tabs.leftSidebarTab = 'search'
        store.setActiveLeftSidebarView(null)
      },
    },
    {
      id: 'open-daily-notes',
      pluginId: 'core',
      fqid: 'core:open-daily-notes',
      label: () => t('commands.openDailyNotes'),
      icon: 'i-lucide-calendar-days',
      onRun: () => {
        tabs.leftSidebarTab = 'dailyNotes'
        store.setActiveLeftSidebarView(null)
      },
    },
    {
      id: 'open-trash',
      pluginId: 'core',
      fqid: 'core:open-trash',
      label: () => t('commands.openTrash'),
      icon: 'i-lucide-trash-2',
      visible: () => settings.settings.useTrash && vaults.list.some((v) => v.type === 'local'),
      onRun: () => {
        tabs.leftSidebarTab = 'trash'
        store.setActiveLeftSidebarView(null)
      },
    },
    {
      id: 'toggle-right-sidebar',
      pluginId: 'core',
      fqid: 'core:toggle-right-sidebar',
      label: () => t('commands.toggleRightSidebar'),
      icon: 'i-lucide-panel-right',
      onRun: () => {
        tabs.rightSidebarCollapsed = !tabs.rightSidebarCollapsed
      },
    },
    {
      id: 'toggle-expand-all',
      pluginId: 'core',
      fqid: 'core:toggle-expand-all',
      label: () => t('commands.toggleExpandAll'),
      icon: 'i-lucide-chevrons-up-down',
      onRun: () => tabs.toggleExpandAll(),
    },
    {
      id: 'toggle-auto-reveal',
      pluginId: 'core',
      fqid: 'core:toggle-auto-reveal',
      label: () => t('commands.toggleAutoReveal'),
      icon: 'i-lucide-crosshair',
      onRun: () => tabs.toggleAutoReveal(),
    },
    {
      id: 'toggle-hidden-files',
      pluginId: 'core',
      fqid: 'core:toggle-hidden-files',
      label: () => t('commands.toggleHiddenFiles'),
      icon: 'i-lucide-eye',
      onRun: async () => {
        settings.settings.showHiddenFiles = !settings.settings.showHiddenFiles
        await settings.persist()
        await vaults.refreshAllTrees()
      },
    },
    {
      id: 'new-note',
      pluginId: 'core',
      fqid: 'core:new-note',
      label: () => t('commands.newNote'),
      icon: 'i-lucide-file-plus',
      visible: () => vaults.list.length > 0,
      onRun: () => {
        const vault = editor.currentVault ?? vaults.list[0]
        if (vault) dialogs.openCreateNote(vault)
      },
    },
    {
      id: 'new-file',
      pluginId: 'core',
      fqid: 'core:new-file',
      label: () => t('commands.newFile'),
      icon: 'i-lucide-file-plus-2',
      visible: () => vaults.list.length > 0,
      onRun: () => {
        const vault = editor.currentVault ?? vaults.list[0]
        if (vault) dialogs.openCreateFile(vault)
      },
    },
    {
      id: 'save-current-file',
      pluginId: 'core',
      fqid: 'core:save-current-file',
      label: () => t('commands.saveCurrentFile'),
      icon: 'i-lucide-save',
      shortcut: 'Ctrl+S',
      visible: () => {
        const path = editor.currentFilePath
        return !!path && !!editor.buffers[path]?.isDirty
      },
      onRun: () => {
        const path = editor.currentFilePath
        if (path) void editor.save(path)
      },
    },
    {
      id: 'close-current-tab',
      pluginId: 'core',
      fqid: 'core:close-current-tab',
      label: () => t('commands.closeCurrentTab'),
      icon: 'i-lucide-x',
      visible: () => {
        const panel = tabs.findLeaf(tabs.desktopLayout, tabs.activeDesktopPanelId)
        return !!panel && panel.tabs.length > 0
      },
      onRun: () => {
        const panel = tabs.findLeaf(tabs.desktopLayout, tabs.activeDesktopPanelId)
        if (panel && panel.activeId) {
          void tabs.closeTab(panel.id, panel.activeId)
        }
      },
    },
    {
      id: 'close-all-tabs',
      pluginId: 'core',
      fqid: 'core:close-all-tabs',
      label: () => t('commands.closeAllTabs'),
      icon: 'i-lucide-x-square',
      visible: () => {
        const panel = tabs.findLeaf(tabs.desktopLayout, tabs.activeDesktopPanelId)
        return !!panel && panel.tabs.length > 0
      },
      onRun: () => {
        const panel = tabs.findLeaf(tabs.desktopLayout, tabs.activeDesktopPanelId)
        if (panel) void tabs.closeAll(panel.id)
      },
    },
    {
      id: 'close-other-tabs',
      pluginId: 'core',
      fqid: 'core:close-other-tabs',
      label: () => t('commands.closeOtherTabs'),
      icon: 'i-lucide-x-circle',
      visible: () => {
        const panel = tabs.findLeaf(tabs.desktopLayout, tabs.activeDesktopPanelId)
        return !!panel && panel.tabs.length > 1
      },
      onRun: () => {
        const panel = tabs.findLeaf(tabs.desktopLayout, tabs.activeDesktopPanelId)
        if (panel && panel.activeId) {
          void tabs.closeOthers(panel.id, panel.activeId)
        }
      },
    },
    {
      id: 'split-right',
      pluginId: 'core',
      fqid: 'core:split-right',
      label: () => t('commands.splitRight'),
      icon: 'i-lucide-columns-2',
      visible: () => {
        const panel = tabs.findLeaf(tabs.desktopLayout, tabs.activeDesktopPanelId)
        return !!panel && !!panel.activeId
      },
      onRun: () => {
        const panel = tabs.findLeaf(tabs.desktopLayout, tabs.activeDesktopPanelId)
        if (panel && panel.activeId) {
          const tab = panel.tabs.find((tabItem) => tabItem.id === panel.activeId)
          if (tab) void tabs.duplicateTo(panel.id, 'right', tab)
        }
      },
    },
    {
      id: 'git-commit',
      pluginId: 'core',
      fqid: 'core:git-commit',
      label: () => t('commands.gitCommit'),
      icon: 'i-lucide-git-commit-horizontal',
      visible: () => {
        const path = editor.currentFilePath
        if (!path) return false
        const vault = vaults.findVaultForPath(path)
        return vault?.type === 'git'
      },
      onRun: () => {
        const path = editor.currentFilePath
        if (!path) return
        const vault = vaults.findVaultForPath(path)
        if (vault?.type === 'git') void git.commit(vault.id)
      },
    },
    {
      id: 'git-refresh',
      pluginId: 'core',
      fqid: 'core:git-refresh',
      label: () => t('commands.gitRefresh'),
      icon: 'i-lucide-refresh-cw',
      visible: () => vaults.list.some((v) => v.type === 'git'),
      onRun: () => void git.refreshAllStatuses(),
    },
  ]

  const cleanups: Array<() => void> = []
  for (const cmd of commands) {
    cleanups.push(store.registerCommandPaletteItem(cmd))
  }

  return {
    unregister: () => {
      for (const fn of cleanups) fn()
    },
  }
}
