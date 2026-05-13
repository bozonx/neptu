import { defineStore } from 'pinia'
import type { EditorTab, Panel, PanelLeaf, UiState } from '~/types'
import { createDesktopTabsController } from './tabs/desktopTabs'
import { createMobileTabsController } from './tabs/mobileTabs'
import { allLeaves, createLeaf, findLeaf } from './tabs/panelTree'
import { createSidebarState } from './tabs/sidebarState'
import { createTabsUiStateController } from './tabs/uiState'

export const useTabsStore = defineStore('tabs', () => {
  const desktopLayout = ref<Panel>(createLeaf())
  const activeDesktopPanelId = ref<string>((desktopLayout.value as PanelLeaf).id)

  const mobileTabs = ref<EditorTab[]>([])
  const mobileActiveId = ref<string | null>(null)

  const sidebar = createSidebarState()
  const { isMobile } = useTauri()

  const mobileTabsController = createMobileTabsController({
    mobileTabs,
    mobileActiveId,
  })

  const desktopTabsController = createDesktopTabsController({
    desktopLayout,
    activeDesktopPanelId,
  })

  const uiStateController = createTabsUiStateController({
    desktopLayout,
    activeDesktopPanelId,
    mobileTabs,
    mobileActiveId,
    leftSidebarSize: sidebar.leftSidebarSize,
    rightSidebarSize: sidebar.rightSidebarSize,
    rightSidebarCollapsed: sidebar.rightSidebarCollapsed,
    leftSidebarMode: sidebar.leftSidebarMode,
    leftSidebarDualFirstColumnSize: sidebar.leftSidebarDualFirstColumnSize,
    leftSidebarDualSelectedVaultId: sidebar.leftSidebarDualSelectedVaultId,
    leftSidebarDualShowFavorites: sidebar.leftSidebarDualShowFavorites,
    leftSidebarDualShowDailyNotes: sidebar.leftSidebarDualShowDailyNotes,
    leftSidebarTab: sidebar.leftSidebarTab,
    autoRevealFile: sidebar.autoRevealFile,
    expandedGroups: sidebar.expandedGroups,
    expandedVaults: sidebar.expandedVaults,
    expandedFolders: sidebar.expandedFolders,
    loadSidebarState: sidebar.loadSidebarState,
    closeTab: desktopTabsController.closeTab,
    closeMobileTab: mobileTabsController.closeMobileTab,
  })

  async function openFile(path: string, options?: { skipReveal?: boolean }) {
    if (options?.skipReveal) {
      sidebar.suppressNextAutoReveal(path)
    }
    if (isMobile.value) {
      await mobileTabsController.openMobileFile(path)
    }
    else {
      await desktopTabsController.openDesktopFile(path)
    }
    await useEditorStore().saveUiState()
  }

  async function openFileInNewPanel(path: string) {
    if (isMobile.value) {
      await openFile(path)
      return
    }

    await desktopTabsController.openFileInNewPanel(path)
  }

  async function dropByPath(path: string) {
    const leaves = allLeaves(desktopLayout.value)
    for (const leaf of leaves) {
      const tab = leaf.tabs.find((t) => t.filePath === path)
      if (tab) {
        await desktopTabsController.closeTab(leaf.id, tab.id)
      }
    }

    const mobileTab = mobileTabs.value.find((t) => t.filePath === path)
    if (mobileTab) {
      await mobileTabsController.closeMobileTab(mobileTab.id)
    }
  }

  async function dropByPrefix(prefix: string) {
    const sep = prefix.endsWith('/') || prefix.endsWith('\\') ? prefix : prefix + '/'
    const match = (path: string) => path === prefix || path.startsWith(sep)

    const leaves = allLeaves(desktopLayout.value)
    for (const leaf of leaves) {
      const toDrop = leaf.tabs.filter((t) => match(t.filePath))
      for (const tab of toDrop) {
        await desktopTabsController.closeTab(leaf.id, tab.id)
      }
    }

    const mobileTabsToDrop = mobileTabs.value.filter((t) => match(t.filePath))
    for (const tab of mobileTabsToDrop) {
      await mobileTabsController.closeMobileTab(tab.id)
    }
  }

  async function updatePath(oldPath: string, newPath: string, isFolder = !oldPath.endsWith('.md')) {
    const match = (path: string) => {
      if (path === oldPath) return true
      if (isFolder) {
        const sep = oldPath.endsWith('/') || oldPath.endsWith('\\') ? oldPath : oldPath + '/'
        return path.startsWith(sep)
      }
      return false
    }
    const replace = (path: string) => {
      if (path === oldPath) return newPath
      if (isFolder) {
        const sep = oldPath.endsWith('/') || oldPath.endsWith('\\') ? oldPath : oldPath + '/'
        if (path.startsWith(sep)) {
          return newPath + (newPath.endsWith('/') || newPath.endsWith('\\') ? '' : '/') + path.slice(sep.length)
        }
      }
      return path
    }

    const editor = useEditorStore()

    const leaves = allLeaves(desktopLayout.value)
    for (const leaf of leaves) {
      for (const tab of leaf.tabs) {
        if (match(tab.filePath)) {
          const oldFilePath = tab.filePath
          const newFilePath = replace(oldFilePath)
          tab.filePath = newFilePath
          editor.onPathMigrated(oldFilePath, newFilePath)
        }
      }
    }

    for (const tab of mobileTabs.value) {
      if (match(tab.filePath)) {
        const oldFilePath = tab.filePath
        const newFilePath = replace(oldFilePath)
        tab.filePath = newFilePath
        editor.onPathMigrated(oldFilePath, newFilePath)
      }
    }

    await editor.saveUiState()
  }

  async function loadUiState(state: UiState) {
    await uiStateController.loadUiState(state, isMobile.value)
  }

  return {
    desktopLayout,
    activeDesktopPanelId,
    mobileTabs,
    mobileActiveId,
    leftSidebarSize: sidebar.leftSidebarSize,
    rightSidebarSize: sidebar.rightSidebarSize,
    rightSidebarCollapsed: sidebar.rightSidebarCollapsed,
    leftSidebarMode: sidebar.leftSidebarMode,
    leftSidebarDualFirstColumnSize: sidebar.leftSidebarDualFirstColumnSize,
    leftSidebarDualSelectedVaultId: sidebar.leftSidebarDualSelectedVaultId,
    leftSidebarDualShowFavorites: sidebar.leftSidebarDualShowFavorites,
    leftSidebarDualShowDailyNotes: sidebar.leftSidebarDualShowDailyNotes,
    leftSidebarTab: sidebar.leftSidebarTab,
    expandedGroups: sidebar.expandedGroups,
    expandedVaults: sidebar.expandedVaults,
    expandedFolders: sidebar.expandedFolders,
    autoRevealFile: sidebar.autoRevealFile,
    expandAllActive: sidebar.expandAllActive,
    openFile,
    activateTab: desktopTabsController.activateTab,
    activateMobileTab: mobileTabsController.activateMobileTab,
    closeTab: desktopTabsController.closeTab,
    closeMobileTab: mobileTabsController.closeMobileTab,
    closeAllRight: desktopTabsController.closeAllRight,
    closeOthers: desktopTabsController.closeOthers,
    closeAll: desktopTabsController.closeAll,
    togglePin: desktopTabsController.togglePin,
    splitPanel: desktopTabsController.splitPanel,
    duplicateTo: desktopTabsController.duplicateTo,
    openFileInNewPanel,
    dropByPath,
    dropByPrefix,
    updatePath,
    loadUiState,
    createUiStateSnapshot: uiStateController.createUiStateSnapshot,
    findLeaf,
    allLeaves,
    updatePanelRatio: desktopTabsController.updatePanelRatio,
    updateSidebarSizes: sidebar.updateSidebarSizes,
    updateLeftSidebarMode: sidebar.updateLeftSidebarMode,
    updateLeftSidebarDualFirstColumnSize: sidebar.updateLeftSidebarDualFirstColumnSize,
    updateLeftSidebarDualState: sidebar.updateLeftSidebarDualState,
    handleTabAdd: desktopTabsController.handleTabAdd,
    handleTabRemove: desktopTabsController.handleTabRemove,
    toggleExpandAll: sidebar.toggleExpandAll,
    toggleAutoReveal: sidebar.toggleAutoReveal,
    revealFile: sidebar.revealFile,
    consumeSuppressedAutoReveal: sidebar.consumeSuppressedAutoReveal,
  }
})
