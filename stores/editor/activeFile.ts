import type { EditorBuffer } from './types'

export function useEditorActiveFile(buffers: Ref<Record<string, EditorBuffer>>) {
  const currentFilePath = computed(() => {
    const tabs = useTabsStore()
    const { isMobile } = useTauri()
    if (isMobile.value) {
      const active = tabs.mobileTabs.find((t) => t.id === tabs.mobileActiveId)
      return active?.filePath ?? null
    }

    const leaf = tabs.allLeaves(tabs.desktopLayout).find((l) => l.id === tabs.activeDesktopPanelId)
    const active = leaf?.tabs.find((t) => t.id === leaf.activeId)
    return active?.filePath ?? null
  })

  const currentContent = computed(() => {
    const path = currentFilePath.value
    return path ? buffers.value[path]?.content ?? '' : ''
  })

  const currentVault = computed(() => {
    if (!currentFilePath.value) return null
    return useVaultsStore().findVaultForPath(currentFilePath.value)
  })

  watch(currentVault, (vault) => {
    if (!vault || vault.type !== 'git') return
    useGitStore().resetCommitStatus(vault.id)
  })

  return {
    currentFilePath,
    currentContent,
    currentVault,
  }
}
