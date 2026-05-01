export function useAutoReveal() {
  const tabs = useTabsStore()
  const editor = useEditorStore()

  watch(() => editor.currentFilePath, (path, oldPath) => {
    if (!path || !tabs.autoRevealFile || path === oldPath) return

    tabs.revealFile(path)

    nextTick(() => {
      document.querySelector('[data-active-file]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  })
}
