import type { Ref } from 'vue'
import type { EditorTab, Panel, PanelLeaf, PanelNode, SplitDirection } from '~/types'
import { allLeaves, createLeaf, findLeaf, findNode, findParent, generateId, getFallbackLeafId, removeLeafPanel } from './panelTree'

interface DesktopTabsContext {
  desktopLayout: Ref<Panel>
  activeDesktopPanelId: Ref<string>
}

export function createDesktopTabsController(context: DesktopTabsContext) {
  const { desktopLayout, activeDesktopPanelId } = context

  const activePanel = computed(() => findLeaf(desktopLayout.value, activeDesktopPanelId.value))

  function ensureActivePanel(): PanelLeaf | null {
    let panel: PanelLeaf | null = activePanel.value
    if (panel) return panel

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
    return panel
  }

  function cleanupEmptyPanel(panelId: string) {
    const panel = findLeaf(desktopLayout.value, panelId)
    if (panel?.tabs.length || !findParent(desktopLayout.value, panelId)) return

    desktopLayout.value = removeLeafPanel(desktopLayout.value, panelId)
    if (activeDesktopPanelId.value === panelId) {
      activeDesktopPanelId.value = getFallbackLeafId(desktopLayout.value)
    }
  }

  async function openDesktopFile(path: string) {
    const editor = useEditorStore()
    const leaves = allLeaves(desktopLayout.value)
    let foundPanel: PanelLeaf | null = null
    let foundTab: EditorTab | null = null

    if (activePanel.value) {
      const tab = activePanel.value.tabs.find((t) => t.filePath === path)
      if (tab) {
        foundPanel = activePanel.value
        foundTab = tab
      }
    }

    if (!foundPanel) {
      for (const leaf of leaves) {
        const tab = leaf.tabs.find((t) => t.filePath === path)
        if (tab) {
          foundPanel = leaf
          foundTab = tab
          break
        }
      }
    }

    if (foundPanel && foundTab) {
      foundPanel.activeId = foundTab.id
      activeDesktopPanelId.value = foundPanel.id
      await editor.openFile(path)
      return
    }

    const panel = ensureActivePanel()
    if (!panel) return

    const tab: EditorTab = { id: generateId(), filePath: path }
    panel.tabs.push(tab)
    panel.activeId = tab.id
    await editor.openFile(path)
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
      }
    }

    cleanupEmptyPanel(panelId)
    await useEditorStore().saveUiState()
  }

  async function togglePin(panelId: string, tabId: string) {
    const panel = findLeaf(desktopLayout.value, panelId)
    if (!panel) return
    const tab = panel.tabs.find((t) => t.id === tabId)
    if (!tab) return

    tab.pinned = !tab.pinned
    await useEditorStore().saveUiState()
  }

  async function closeAllRight(panelId: string, tabId: string) {
    const panel = findLeaf(desktopLayout.value, panelId)
    if (!panel) return

    const idx = panel.tabs.findIndex((t) => t.id === tabId)
    if (idx === -1) return

    const toClose = panel.tabs.slice(idx + 1).filter((t) => !t.pinned)
    for (const tab of toClose) {
      await closeTab(panelId, tab.id)
    }
  }

  async function closeOthers(panelId: string, tabId: string) {
    const panel = findLeaf(desktopLayout.value, panelId)
    if (!panel) return

    const toClose = panel.tabs.filter((t) => t.id !== tabId && !t.pinned)
    for (const tab of toClose) {
      await closeTab(panelId, tab.id)
    }
  }

  async function closeAll(panelId: string) {
    const panel = findLeaf(desktopLayout.value, panelId)
    if (!panel) return

    const toClose = panel.tabs.filter((t) => !t.pinned)
    for (const tab of toClose) {
      await closeTab(panelId, tab.id)
    }
  }

  async function splitPanel(panelId: string, direction: SplitDirection, tabToDuplicate?: EditorTab) {
    const panel = findLeaf(desktopLayout.value, panelId)
    if (!panel) return

    const activeTab = panel.tabs.find((t) => t.id === panel.activeId)
    const newTab: EditorTab = tabToDuplicate
      ? { ...tabToDuplicate, id: generateId() }
      : activeTab
        ? { ...activeTab, id: generateId() }
        : { id: generateId(), filePath: '' }

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

  async function openFileInNewPanel(path: string) {
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

  async function updatePanelRatio(panelId: string, ratio: number) {
    const node = findNode(desktopLayout.value, panelId)
    if (node) {
      node.ratio = ratio
      await useEditorStore().saveUiState()
    }
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

    cleanupEmptyPanel(panelId)
    await useEditorStore().saveUiState()
  }

  return {
    activePanel,
    openDesktopFile,
    activateTab,
    closeTab,
    togglePin,
    closeAllRight,
    closeOthers,
    closeAll,
    splitPanel,
    duplicateTo,
    openFileInNewPanel,
    updatePanelRatio,
    handleTabAdd,
    handleTabRemove,
  }
}
