export function useAutoReveal() {
  const tabs = useTabsStore()
  const editor = useEditorStore()

  watch(() => editor.currentFilePath, (path, oldPath) => {
    if (!path || path === oldPath) return
    if (tabs.consumeSuppressedAutoReveal(path)) return
    if (!tabs.autoRevealFile) return

    tabs.revealFile(path)

    nextTick(() => {
      document.querySelector('[data-active-file]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  })
}
