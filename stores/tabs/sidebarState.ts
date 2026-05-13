import type { FileNode, UiState } from '~/types'

export type LeftSidebarTab = 'files' | 'search' | 'favorites' | 'trash' | 'dailyNotes'
export type LeftSidebarMode = 'single' | 'dual'

const LEFT_SIDEBAR_MIN = 15
const LEFT_SIDEBAR_MAX = 40
const RIGHT_SIDEBAR_MIN = 10
const RIGHT_SIDEBAR_MAX = 30
const CENTER_MIN = 20
const LEFT_SIDEBAR_DUAL_FIRST_MIN = 10
const LEFT_SIDEBAR_DUAL_FIRST_MAX = 60

const VALID_LEFT_SIDEBAR_TABS: LeftSidebarTab[] = ['files', 'search', 'favorites', 'trash', 'dailyNotes']

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function normalizeSidebarSizes(left: number, right: number) {
  let nextLeft = clamp(left, LEFT_SIDEBAR_MIN, LEFT_SIDEBAR_MAX)
  let nextRight = clamp(right, RIGHT_SIDEBAR_MIN, RIGHT_SIDEBAR_MAX)
  const maxCombined = 100 - CENTER_MIN

  if (nextLeft + nextRight > maxCombined) {
    nextRight = Math.min(nextRight, maxCombined - nextLeft)
    if (nextRight < RIGHT_SIDEBAR_MIN) {
      nextRight = RIGHT_SIDEBAR_MIN
      nextLeft = clamp(maxCombined - nextRight, LEFT_SIDEBAR_MIN, LEFT_SIDEBAR_MAX)
    }
  }

  return { left: nextLeft, right: nextRight }
}

function collectFolderPaths(nodes: FileNode[]): string[] {
  const result: string[] = []
  for (const node of nodes) {
    if (node.isDir) {
      result.push(node.path)
      result.push(...collectFolderPaths(node.children ?? []))
    }
  }
  return result
}

function getParentFolderPaths(filePath: string): string[] {
  const sep = filePath.includes('\\') ? '\\' : '/'
  const parts = filePath.split(sep)
  const parents: string[] = []
  let prefix = parts[0]!
  for (let i = 1; i < parts.length - 1; i++) {
    prefix = prefix + sep + parts[i]
    parents.push(prefix)
  }
  return parents
}

export function createSidebarState() {
  const leftSidebarSize = ref(20)
  const rightSidebarSize = ref(15)
  const rightSidebarCollapsed = ref(false)
  const leftSidebarMode = ref<LeftSidebarMode>('single')
  const leftSidebarDualFirstColumnSize = ref(20)
  const leftSidebarDualSelectedVaultId = ref<string | null>(null)
  const leftSidebarDualShowFavorites = ref(false)
  const leftSidebarDualShowDailyNotes = ref(false)
  const leftSidebarTab = ref<LeftSidebarTab>('files')

  const expandedGroups = ref<Record<string, boolean>>({})
  const expandedVaults = ref<Record<string, boolean>>({})
  const expandedFolders = ref<Record<string, boolean>>({})

  const autoRevealFile = ref(false)
  const expandAllActive = ref(false)

  watch(rightSidebarCollapsed, () => {
    void useEditorStore().saveUiState()
  })

  function loadSidebarState(state: UiState) {
    const normalizedSizes = normalizeSidebarSizes(
      typeof state.leftSidebarSize === 'number' ? state.leftSidebarSize : leftSidebarSize.value,
      typeof state.rightSidebarSize === 'number' ? state.rightSidebarSize : rightSidebarSize.value,
    )
    leftSidebarSize.value = normalizedSizes.left
    rightSidebarSize.value = normalizedSizes.right
    if (typeof state.rightSidebarCollapsed === 'boolean') rightSidebarCollapsed.value = state.rightSidebarCollapsed
    if (typeof state.autoRevealFile === 'boolean') autoRevealFile.value = state.autoRevealFile
    if (state.leftSidebarMode) leftSidebarMode.value = state.leftSidebarMode
    if (typeof state.leftSidebarDualFirstColumnSize === 'number') {
      leftSidebarDualFirstColumnSize.value = clamp(
        state.leftSidebarDualFirstColumnSize,
        LEFT_SIDEBAR_DUAL_FIRST_MIN,
        LEFT_SIDEBAR_DUAL_FIRST_MAX,
      )
    }
    leftSidebarDualSelectedVaultId.value = state.leftSidebarDualSelectedVaultId ?? null
    leftSidebarDualShowFavorites.value = state.leftSidebarDualShowFavorites ?? false
    leftSidebarDualShowDailyNotes.value = state.leftSidebarDualShowDailyNotes ?? false
    if (state.leftSidebarTab && VALID_LEFT_SIDEBAR_TABS.includes(state.leftSidebarTab)) {
      leftSidebarTab.value = state.leftSidebarTab
    }

    expandedGroups.value = state.expandedGroups ?? {}
    expandedVaults.value = state.expandedVaults ?? {}
    expandedFolders.value = state.expandedFolders ?? {}
  }

  async function updateSidebarSizes(left: number, right: number) {
    const normalized = normalizeSidebarSizes(left, right)
    leftSidebarSize.value = normalized.left
    rightSidebarSize.value = normalized.right
    await useEditorStore().saveUiState()
  }

  async function updateLeftSidebarMode(mode: LeftSidebarMode) {
    leftSidebarMode.value = mode
    await useEditorStore().saveUiState()
  }

  async function updateLeftSidebarDualFirstColumnSize(size: number) {
    leftSidebarDualFirstColumnSize.value = clamp(size, LEFT_SIDEBAR_DUAL_FIRST_MIN, LEFT_SIDEBAR_DUAL_FIRST_MAX)
    await useEditorStore().saveUiState()
  }

  async function updateLeftSidebarDualState(selectedVaultId: string | null, showFavorites: boolean, showDailyNotes = false) {
    leftSidebarDualSelectedVaultId.value = selectedVaultId
    leftSidebarDualShowFavorites.value = showFavorites
    leftSidebarDualShowDailyNotes.value = showDailyNotes
    await useEditorStore().saveUiState()
  }

  function toggleExpandAll() {
    const vaults = useVaultsStore()
    if (!expandAllActive.value) {
      for (const g of vaults.groups) expandedGroups.value[g.id] = true
      for (const v of vaults.list) expandedVaults.value[v.id] = true
      for (const nodes of Object.values(vaults.trees) as FileNode[][]) {
        for (const path of collectFolderPaths(nodes)) {
          expandedFolders.value[path] = true
        }
      }
      expandAllActive.value = true
    }
    else {
      expandedVaults.value = {}
      expandedFolders.value = {}
      expandAllActive.value = false
    }
    void useEditorStore().saveUiState()
  }

  async function toggleAutoReveal() {
    autoRevealFile.value = !autoRevealFile.value
    await useEditorStore().saveUiState()
  }

  function revealFile(path: string) {
    const vaults = useVaultsStore()
    const vault = vaults.findVaultForPath(path)
    if (!vault) return

    if (leftSidebarMode.value === 'dual') {
      leftSidebarDualShowFavorites.value = false
      leftSidebarDualSelectedVaultId.value = vault.id
    }

    expandedVaults.value[vault.id] = true

    if (vault.groupId) {
      expandedGroups.value[vault.groupId] = true
    }

    for (const folderPath of getParentFolderPaths(path)) {
      expandedFolders.value[folderPath] = true
    }
  }

  return {
    leftSidebarSize,
    rightSidebarSize,
    rightSidebarCollapsed,
    leftSidebarMode,
    leftSidebarDualFirstColumnSize,
    leftSidebarDualSelectedVaultId,
    leftSidebarDualShowFavorites,
    leftSidebarDualShowDailyNotes,
    leftSidebarTab,
    expandedGroups,
    expandedVaults,
    expandedFolders,
    autoRevealFile,
    expandAllActive,
    loadSidebarState,
    updateSidebarSizes,
    updateLeftSidebarMode,
    updateLeftSidebarDualFirstColumnSize,
    updateLeftSidebarDualState,
    toggleExpandAll,
    toggleAutoReveal,
    revealFile,
  }
}
