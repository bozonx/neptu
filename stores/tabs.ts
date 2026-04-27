import { defineStore } from 'pinia'
import type { EditorTab, Panel, PanelLeaf, PanelNode, SplitDirection, UiState } from '~/types'

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function createLeaf(tabs: EditorTab[] = [], activeId: string | null = null): PanelLeaf {
  return {
    type: 'leaf',
    id: generateId(),
    tabs,
    activeId,
  }
}

export const useTabsStore = defineStore('tabs', () => {
  const desktopLayout = ref<Panel>(createLeaf())
  const activeDesktopPanelId = ref<string>((desktopLayout.value as PanelLeaf).id)

  const mobileTabs = ref<EditorTab[]>([])
  const mobileActiveId = ref<string | null>(null)

  const leftSidebarSize = ref(20)
  const rightSidebarSize = ref(15)
  const leftSidebarMode = ref<'single' | 'dual'>('single')
  const leftSidebarDualFirstColumnSize = ref(20)

  const { isMobile } = useTauri()

  // Helpers to traverse the tree
  function findLeaf(panel: Panel, id: string): PanelLeaf | null {
    if (panel.type === 'leaf') {
      return panel.id === id ? panel : null
    }
    return findLeaf(panel.first, id) ?? findLeaf(panel.second, id)
  }

  function findParent(panel: Panel, id: string): PanelNode | null {
    if (panel.type === 'leaf') return null
    if (panel.first.id === id || panel.second.id === id) return panel
    return findParent(panel.first, id) ?? findParent(panel.second, id)
  }

  function allLeaves(panel: Panel): PanelLeaf[] {
    if (panel.type === 'leaf') return [panel]
    return [...allLeaves(panel.first), ...allLeaves(panel.second)]
  }

  const activePanel = computed(() => findLeaf(desktopLayout.value, activeDesktopPanelId.value))

  async function openFile(path: string) {
    const editor = useEditorStore()
    if (isMobile.value) {
      const existing = mobileTabs.value.find((t) => t.filePath === path)
      if (existing) {
        mobileActiveId.value = existing.id
      }
      else {
        const tab: EditorTab = { id: generateId(), filePath: path }
        mobileTabs.value.push(tab)
        mobileActiveId.value = tab.id
      }
      await editor.openFile(path)
    }
    else {
      let panel: PanelLeaf | null = activePanel.value
      if (!panel) {
        const leaves = allLeaves(desktopLayout.value)
        if (leaves.length === 0) {
          desktopLayout.value = createLeaf()
          activeDesktopPanelId.value = (desktopLayout.value as PanelLeaf).id
          panel = desktopLayout.value as PanelLeaf
        }
        else {
          panel = leaves[0]!
          activeDesktopPanelId.value = panel.id
        }
      }
      if (!panel) return

      const existing = panel.tabs.find((t) => t.filePath === path)
      if (existing) {
        panel.activeId = existing.id
      }
      else {
        const tab: EditorTab = { id: generateId(), filePath: path }
        panel.tabs.push(tab)
        panel.activeId = tab.id
      }
      await editor.openFile(path)
    }
    await editor.saveUiState()
  }

  async function activateTab(panelId: string, tabId: string) {
    const panel = findLeaf(desktopLayout.value, panelId)
    if (!panel) return
    const tab = panel.tabs.find((t) => t.id === tabId)
    if (!tab) return

    panel.activeId = tabId
    activeDesktopPanelId.value = panelId
    await useEditorStore().openFile(tab.filePath)
    await useEditorStore().saveUiState()
  }

  async function activateMobileTab(tabId: string) {
    const tab = mobileTabs.value.find((t) => t.id === tabId)
    if (!tab) return
    mobileActiveId.value = tabId
    await useEditorStore().openFile(tab.filePath)
    await useEditorStore().saveUiState()
  }

  async function closeTab(panelId: string, tabId: string) {
    const panel = findLeaf(desktopLayout.value, panelId)
    if (!panel) return

    const idx = panel.tabs.findIndex((t) => t.id === tabId)
    if (idx === -1) return

    const wasActive = panel.activeId === tabId
    panel.tabs.splice(idx, 1)

    if (wasActive) {
      const next = panel.tabs[idx] ?? panel.tabs[idx - 1] ?? null
      if (next) {
        panel.activeId = next.id
        await useEditorStore().openFile(next.filePath)
      }
      else {
        panel.activeId = null
        // If it was the last tab in the panel, we might want to close the panel
        // but for now let's just keep it empty.
      }
    }

    // Cleanup empty panels (except if it's the last one)
    if (panel.tabs.length === 0) {
      const parent = findParent(desktopLayout.value, panelId)
      if (parent) {
        const other = parent.first.id === panelId ? parent.second : parent.first
        const grandParent = findParent(desktopLayout.value, parent.id)

        if (grandParent) {
          if (grandParent.first.id === parent.id) grandParent.first = other
          else grandParent.second = other
        }
        else {
          desktopLayout.value = other
        }
        // Ensure active panel ID is still valid
        if (activeDesktopPanelId.value === panelId) {
          const leaves = allLeaves(desktopLayout.value)
          activeDesktopPanelId.value = leaves.length > 0 ? leaves[0]!.id : (desktopLayout.value as PanelLeaf).id
        }
      }
    }
    await useEditorStore().saveUiState()
  }

  async function closeMobileTab(tabId: string) {
    const idx = mobileTabs.value.findIndex((t) => t.id === tabId)
    if (idx === -1) return

    const wasActive = mobileActiveId.value === tabId
    mobileTabs.value.splice(idx, 1)

    if (wasActive) {
      const next = mobileTabs.value[idx] ?? mobileTabs.value[idx - 1] ?? null
      if (next) {
        mobileActiveId.value = next.id
        await useEditorStore().openFile(next.filePath)
      }
      else {
        mobileActiveId.value = null
      }
    }
    await useEditorStore().saveUiState()
  }

  async function splitPanel(panelId: string, direction: SplitDirection, tabToDuplicate?: EditorTab) {
    const panel = findLeaf(desktopLayout.value, panelId)
    if (!panel) return

    const newTab: EditorTab = tabToDuplicate
      ? { ...tabToDuplicate, id: generateId() }
      : panel.tabs.find((t) => t.id === panel.activeId)
        ? { ...panel.tabs.find((t) => t.id === panel.activeId)!, id: generateId() }
        : { id: generateId(), filePath: '' } // Should not happen

    if (!newTab.filePath) return

    const newLeaf = createLeaf([newTab], newTab.id)
    const parent = findParent(desktopLayout.value, panelId)

    const newNode: PanelNode = {
      type: 'node',
      id: generateId(),
      direction,
      first: panel,
      second: newLeaf,
      ratio: 0.5,
    }

    // If duplicating to 'left' or 'top', we swap first and second
    // Actually, let's keep it simple: splitRight/splitBottom always adds second.
    // The direction and order can be handled by the caller or UI.
    // For now: 'horizontal' means side-by-side, 'vertical' means stacked.

    if (parent) {
      if (parent.first.id === panelId) parent.first = newNode
      else parent.second = newNode
    }
    else {
      desktopLayout.value = newNode
    }

    activeDesktopPanelId.value = newLeaf.id
    await useEditorStore().openFile(newTab.filePath)
    await useEditorStore().saveUiState()
  }

  /**
   * More specific split methods for the context menu
   */
  async function duplicateTo(panelId: string, side: 'left' | 'right' | 'top' | 'bottom', tab: EditorTab) {
    const panel = findLeaf(desktopLayout.value, panelId)
    if (!panel) return

    const newTab: EditorTab = { ...tab, id: generateId() }
    const newLeaf = createLeaf([newTab], newTab.id)

    const parent = findParent(desktopLayout.value, panelId)
    const direction: SplitDirection = (side === 'left' || side === 'right') ? 'horizontal' : 'vertical'

    const newNode: PanelNode = {
      type: 'node',
      id: generateId(),
      direction,
      first: (side === 'right' || side === 'bottom') ? panel : newLeaf,
      second: (side === 'right' || side === 'bottom') ? newLeaf : panel,
      ratio: 0.5,
    }

    if (parent) {
      if (parent.first.id === panelId) parent.first = newNode
      else parent.second = newNode
    }
    else {
      desktopLayout.value = newNode
    }

    activeDesktopPanelId.value = newLeaf.id
    await useEditorStore().openFile(newTab.filePath)
    await useEditorStore().saveUiState()
  }

  async function dropByPath(path: string) {
    // Remove from all desktop panels
    const leaves = allLeaves(desktopLayout.value)
    for (const leaf of leaves) {
      const idx = leaf.tabs.findIndex((t) => t.filePath === path)
      const tab = leaf.tabs[idx]
      if (tab) {
        await closeTab(leaf.id, tab.id)
      }
    }
    // Remove from mobile
    const mIdx = mobileTabs.value.findIndex((t) => t.filePath === path)
    const mTab = mobileTabs.value[mIdx]
    if (mTab) {
      await closeMobileTab(mTab.id)
    }
  }

  async function dropByPrefix(prefix: string) {
    const sep = prefix.endsWith('/') || prefix.endsWith('\\') ? prefix : prefix + '/'
    const match = (p: string) => p === prefix || p.startsWith(sep)

    const leaves = allLeaves(desktopLayout.value)
    for (const leaf of leaves) {
      const toDrop = leaf.tabs.filter((t) => match(t.filePath))
      for (const tab of toDrop) {
        await closeTab(leaf.id, tab.id)
      }
    }

    const mToDrop = mobileTabs.value.filter((t) => match(t.filePath))
    for (const tab of mToDrop) {
      await closeMobileTab(tab.id)
    }
  }

  async function openFileInNewPanel(path: string) {
    if (isMobile.value) {
      await openFile(path)
      return
    }

    const newTab: EditorTab = { id: generateId(), filePath: path }
    const newLeaf = createLeaf([newTab], newTab.id)

    const panelId = activeDesktopPanelId.value
    const panel = findLeaf(desktopLayout.value, panelId) ?? allLeaves(desktopLayout.value)[0]
    if (!panel) {
      desktopLayout.value = newLeaf
      activeDesktopPanelId.value = newLeaf.id
      await useEditorStore().openFile(path)
      await useEditorStore().saveUiState()
      return
    }

    const parent = findParent(desktopLayout.value, panel.id)

    const newNode: PanelNode = {
      type: 'node',
      id: generateId(),
      direction: 'horizontal',
      first: panel,
      second: newLeaf,
      ratio: 0.5,
    }

    if (parent) {
      if (parent.first.id === panel.id) parent.first = newNode
      else parent.second = newNode
    }
    else {
      desktopLayout.value = newNode
    }

    activeDesktopPanelId.value = newLeaf.id
    await useEditorStore().openFile(path)
    await useEditorStore().saveUiState()
  }

  async function loadUiState(state: UiState) {
    if (state.desktopLayout) desktopLayout.value = state.desktopLayout
    if (state.activeDesktopPanelId) activeDesktopPanelId.value = state.activeDesktopPanelId
    if (state.mobileTabs) mobileTabs.value = state.mobileTabs
    mobileActiveId.value = state.mobileActiveId ?? null
    if (typeof state.leftSidebarSize === 'number') leftSidebarSize.value = state.leftSidebarSize
    if (typeof state.rightSidebarSize === 'number') rightSidebarSize.value = state.rightSidebarSize
    if (state.leftSidebarMode) leftSidebarMode.value = state.leftSidebarMode
    if (typeof state.leftSidebarDualFirstColumnSize === 'number') leftSidebarDualFirstColumnSize.value = state.leftSidebarDualFirstColumnSize

    // Ensure we have at least one leaf
    if (!desktopLayout.value) {
      desktopLayout.value = createLeaf()
      activeDesktopPanelId.value = (desktopLayout.value as PanelLeaf).id
    }

    // Open active files in buffers
    const editor = useEditorStore()
    if (isMobile.value) {
      const active = mobileTabs.value.find((t) => t.id === mobileActiveId.value)
      if (active) await editor.openFile(active.filePath)
    }
    else {
      const leaves = allLeaves(desktopLayout.value)
      for (const leaf of leaves) {
        const active = leaf.tabs.find((t) => t.id === leaf.activeId)
        if (active) await editor.openFile(active.filePath)
      }
    }
  }

  async function updatePanelRatio(panelId: string, ratio: number) {
    const parent = findParent(desktopLayout.value, panelId)
    if (parent) {
      // ratio is applied to the first child usually, but we need to know if this panel is first or second
      // Actually, it's easier to just find the node itself and update its ratio.
    }

    // Direct search for the node
    const findNode = (p: Panel, id: string): PanelNode | null => {
      if (p.type === 'leaf') return null
      if (p.id === id) return p
      return findNode(p.first, id) ?? findNode(p.second, id)
    }

    const node = findNode(desktopLayout.value, panelId)
    if (node) {
      node.ratio = ratio
      await useEditorStore().saveUiState()
    }
  }

  async function updateSidebarSizes(left: number, right: number) {
    leftSidebarSize.value = left
    rightSidebarSize.value = right
    await useEditorStore().saveUiState()
  }

  async function updateLeftSidebarMode(mode: 'single' | 'dual') {
    leftSidebarMode.value = mode
    await useEditorStore().saveUiState()
  }

  async function updateLeftSidebarDualFirstColumnSize(size: number) {
    leftSidebarDualFirstColumnSize.value = size
    await useEditorStore().saveUiState()
  }

  async function handleTabAdd(panelId: string, tab: EditorTab) {
    const panel = findLeaf(desktopLayout.value, panelId)
    if (!panel) return

    panel.activeId = tab.id
    activeDesktopPanelId.value = panelId
    await useEditorStore().openFile(tab.filePath)
    await useEditorStore().saveUiState()
  }

  async function handleTabRemove(panelId: string, tab: EditorTab) {
    const panel = findLeaf(desktopLayout.value, panelId)
    if (!panel) return

    if (panel.activeId === tab.id) {
      panel.activeId = panel.tabs[0]?.id ?? null
      if (panel.activeId) {
        const activeTab = panel.tabs.find((t) => t.id === panel.activeId)
        if (activeTab) await useEditorStore().openFile(activeTab.filePath)
      }
    }

    // If panel becomes empty and it's not the only one, it will be handled by the layout logic
    // vue-draggable-plus already removed the element from the array.
    // We might need to trigger the same cleanup logic as in closeTab.
    if (panel.tabs.length === 0) {
      const parent = findParent(desktopLayout.value, panelId)
      if (parent) {
        const other = parent.first.id === panelId ? parent.second : parent.first
        const grandParent = findParent(desktopLayout.value, parent.id)
        if (grandParent) {
          if (grandParent.first.id === parent.id) grandParent.first = other
          else grandParent.second = other
        }
        else {
          desktopLayout.value = other
        }
        if (activeDesktopPanelId.value === panelId) {
          const leaves = allLeaves(desktopLayout.value)
          activeDesktopPanelId.value = leaves.length > 0 ? leaves[0]!.id : (desktopLayout.value as PanelLeaf).id
        }
      }
    }

    await useEditorStore().saveUiState()
  }

  return {
    desktopLayout,
    activeDesktopPanelId,
    mobileTabs,
    mobileActiveId,
    leftSidebarSize,
    rightSidebarSize,
    leftSidebarMode,
    leftSidebarDualFirstColumnSize,
    openFile,
    activateTab,
    activateMobileTab,
    closeTab,
    closeMobileTab,
    splitPanel,
    duplicateTo,
    openFileInNewPanel,
    dropByPath,
    dropByPrefix,
    loadUiState,
    allLeaves,
    updatePanelRatio,
    updateSidebarSizes,
    updateLeftSidebarMode,
    updateLeftSidebarDualFirstColumnSize,
    handleTabAdd,
    handleTabRemove,
  }
})
