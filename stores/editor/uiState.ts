import type { CursorPosition } from '~/types'

function toRelativeCursorPositions(
  positions: Record<string, CursorPosition>,
  root: string,
): Record<string, CursorPosition> {
  const prefix = root.replace(/[/\\]+$/, '') + '/'
  const result: Record<string, CursorPosition> = {}
  for (const [path, pos] of Object.entries(positions)) {
    const rel = path.startsWith(prefix) ? path.slice(prefix.length) : path
    result[rel] = pos
  }
  return result
}

function fromRelativeCursorPositions(
  positions: Record<string, CursorPosition>,
  root: string,
): Record<string, CursorPosition> {
  const base = root.replace(/[/\\]+$/, '')
  const result: Record<string, CursorPosition> = {}
  for (const [rel, pos] of Object.entries(positions)) {
    const abs = rel.startsWith('/') || (rel.length > 1 && rel[1] === ':')
      ? rel
      : `${base}/${rel.replace(/^[/\\]+/, '')}`
    result[abs] = pos
  }
  return result
}

export function useEditorUiState(cursorPositions: Ref<Record<string, CursorPosition>>) {
  const hydrated = ref(false)
  const settings = useSettingsStore()

  async function loadUiState() {
    const config = useConfig()
    const state = await config.loadUiState()
    const root = settings.mainRepoPath
    cursorPositions.value = root
      ? fromRelativeCursorPositions(state.cursorPositions ?? {}, root)
      : state.cursorPositions ?? {}
    await useTabsStore().loadUiState(state)

    const plugins = usePluginsStore()
    if (state.activeLeftSidebarView) {
      plugins.setActiveLeftSidebarView(state.activeLeftSidebarView)
    }
    if (state.activeRightSidebarView) {
      plugins.setActiveRightSidebarView(state.activeRightSidebarView)
    }
    else if (state.activeRightTab === 'outline') {
      plugins.setActiveRightSidebarView('com.neptu.outline:main')
    }
    else if (state.activeRightTab === 'info') {
      plugins.setActiveRightSidebarView('com.neptu.file-info:main')
    }
    hydrated.value = true
  }

  async function saveUiState() {
    if (!hydrated.value) return
    const config = useConfig()
    const tabs = useTabsStore()
    const root = settings.mainRepoPath
    const positions = root
      ? toRelativeCursorPositions(cursorPositions.value, root)
      : cursorPositions.value
    await config.saveUiState({
      ...tabs.createUiStateSnapshot(),
      activeLeftSidebarView: usePluginsStore().activeLeftSidebarView,
      activeRightSidebarView: usePluginsStore().activeRightSidebarView,
      cursorPositions: positions,
    })
  }

  watch(() => usePluginsStore().activeLeftSidebarView, () => {
    void saveUiState()
  })

  watch(() => usePluginsStore().activeRightSidebarView, () => {
    void saveUiState()
  })

  return {
    hydrated,
    loadUiState,
    saveUiState,
  }
}
