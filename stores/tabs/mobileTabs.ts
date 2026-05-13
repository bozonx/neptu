import type { Ref } from 'vue'
import type { EditorTab } from '~/types'
import { generateId } from './panelTree'

interface MobileTabsContext {
  mobileTabs: Ref<EditorTab[]>
  mobileActiveId: Ref<string | null>
}

export function createMobileTabsController(context: MobileTabsContext) {
  const { mobileTabs, mobileActiveId } = context

  async function openMobileFile(path: string) {
    const editor = useEditorStore()
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

  async function activateMobileTab(tabId: string) {
    const tab = mobileTabs.value.find((t) => t.id === tabId)
    if (!tab) return
    mobileActiveId.value = tabId
    await useEditorStore().openFile(tab.filePath)
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

  return {
    openMobileFile,
    activateMobileTab,
    closeMobileTab,
  }
}
