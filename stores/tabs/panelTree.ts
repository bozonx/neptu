import type { EditorTab, Panel, PanelLeaf, PanelNode } from '~/types'

export function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function createLeaf(tabs: EditorTab[] = [], activeId: string | null = null): PanelLeaf {
  return {
    type: 'leaf',
    id: generateId(),
    tabs,
    activeId,
  }
}

export function findLeaf(panel: Panel, id: string): PanelLeaf | null {
  if (panel.type === 'leaf') {
    return panel.id === id ? panel : null
  }
  return findLeaf(panel.first, id) ?? findLeaf(panel.second, id)
}

export function findParent(panel: Panel, id: string): PanelNode | null {
  if (panel.type === 'leaf') return null
  if (panel.first.id === id || panel.second.id === id) return panel
  return findParent(panel.first, id) ?? findParent(panel.second, id)
}

export function allLeaves(panel: Panel): PanelLeaf[] {
  if (panel.type === 'leaf') return [panel]
  return [...allLeaves(panel.first), ...allLeaves(panel.second)]
}

export function findNode(panel: Panel, id: string): PanelNode | null {
  if (panel.type === 'leaf') return null
  if (panel.id === id) return panel
  return findNode(panel.first, id) ?? findNode(panel.second, id)
}

export function removeLeafPanel(root: Panel, panelId: string): Panel {
  const parent = findParent(root, panelId)
  if (!parent) return root

  const other = parent.first.id === panelId ? parent.second : parent.first
  const grandParent = findParent(root, parent.id)

  if (!grandParent) return other

  if (grandParent.first.id === parent.id) grandParent.first = other
  else grandParent.second = other
  return root
}

export function getFallbackLeafId(panel: Panel): string {
  return allLeaves(panel)[0]?.id ?? panel.id
}
