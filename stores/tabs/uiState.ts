import type { Ref } from 'vue'
import type { EditorTab, Panel, PanelLeaf, UiState } from '~/types'
import type { LeftSidebarTab, LeftSidebarMode } from './sidebarState'
import { allLeaves, createLeaf } from './panelTree'

interface TabsUiStateContext {
  desktopLayout: Ref<Panel>
  activeDesktopPanelId: Ref<string>
  mobileTabs: Ref<EditorTab[]>
  mobileActiveId: Ref<string | null>
  leftSidebarSize: Ref<number>
  rightSidebarSize: Ref<number>
  rightSidebarCollapsed: Ref<boolean>
  leftSidebarMode: Ref<LeftSidebarMode>
  leftSidebarDualFirstColumnSize: Ref<number>
  leftSidebarDualSelectedVaultId: Ref<string | null>
  leftSidebarDualShowFavorites: Ref<boolean>
  leftSidebarDualShowDailyNotes: Ref<boolean>
  leftSidebarTab: Ref<LeftSidebarTab>
  autoRevealFile: Ref<boolean>
  expandedGroups: Ref<Record<string, boolean>>
  expandedVaults: Ref<Record<string, boolean>>
  expandedFolders: Ref<Record<string, boolean>>
  loadSidebarState(state: UiState): void
  closeTab(panelId: string, tabId: string): Promise<void>
  closeMobileTab(tabId: string): Promise<void>
}

export function createTabsUiStateController(context: TabsUiStateContext) {
  async function loadUiState(state: UiState, isMobile: boolean) {
    if (state.desktopLayout) context.desktopLayout.value = state.desktopLayout
    if (state.activeDesktopPanelId) context.activeDesktopPanelId.value = state.activeDesktopPanelId
    if (state.mobileTabs) context.mobileTabs.value = state.mobileTabs
    context.mobileActiveId.value = state.mobileActiveId ?? null

    context.loadSidebarState(state)

    if (!context.desktopLayout.value) {
      context.desktopLayout.value = createLeaf()
      context.activeDesktopPanelId.value = (context.desktopLayout.value as PanelLeaf).id
    }

    const editor = useEditorStore()
    const fs = useFs()

    if (isMobile) {
      const active = context.mobileTabs.value.find((t) => t.id === context.mobileActiveId.value)
      if (active) {
        if (await fs.exists(active.filePath)) {
          await editor.openFile(active.filePath).catch(() => {})
        }
        else {
          await context.closeMobileTab(active.id)
        }
      }
      return
    }

    const leaves = allLeaves(context.desktopLayout.value)
    for (const leaf of leaves) {
      const active = leaf.tabs.find((t) => t.id === leaf.activeId)
      if (active) {
        if (await fs.exists(active.filePath)) {
          await editor.openFile(active.filePath).catch(() => {})
        }
        else {
          await context.closeTab(leaf.id, active.id)
        }
      }
    }
  }

  function createUiStateSnapshot(): UiState {
    return {
      desktopLayout: context.desktopLayout.value,
      activeDesktopPanelId: context.activeDesktopPanelId.value,
      mobileTabs: context.mobileTabs.value,
      mobileActiveId: context.mobileActiveId.value,
      leftSidebarSize: context.leftSidebarSize.value,
      rightSidebarSize: context.rightSidebarSize.value,
      rightSidebarCollapsed: context.rightSidebarCollapsed.value,
      leftSidebarMode: context.leftSidebarMode.value,
      leftSidebarDualFirstColumnSize: context.leftSidebarDualFirstColumnSize.value,
      leftSidebarDualSelectedVaultId: context.leftSidebarDualSelectedVaultId.value,
      leftSidebarDualShowFavorites: context.leftSidebarDualShowFavorites.value,
      leftSidebarDualShowDailyNotes: context.leftSidebarDualShowDailyNotes.value,
      leftSidebarTab: context.leftSidebarTab.value,
      autoRevealFile: context.autoRevealFile.value,
      expandedGroups: context.expandedGroups.value,
      expandedVaults: context.expandedVaults.value,
      expandedFolders: context.expandedFolders.value,
    }
  }

  return {
    loadUiState,
    createUiStateSnapshot,
  }
}
