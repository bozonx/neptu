import type { CursorPosition } from '~/types'

export function useEditorCursorState(currentFilePath: Ref<string | null>) {
  const scrollToLineTrigger = ref<Record<string, number | null>>({})
  const cursorPositions = ref<Record<string, CursorPosition>>({})

  function scrollToLine(line: number, path?: string) {
    const p = path ?? currentFilePath.value
    if (!p) return
    scrollToLineTrigger.value[p] = line
    nextTick(() => {
      scrollToLineTrigger.value[p] = null
    })
  }

  function saveCursorPosition(path: string, position: CursorPosition) {
    cursorPositions.value[path] = position
  }

  function getCursorPosition(path: string): CursorPosition | undefined {
    return cursorPositions.value[path]
  }

  function migrateCursorPath(oldPath: string, newPath: string) {
    if (!cursorPositions.value[oldPath]) return
    cursorPositions.value[newPath] = { ...cursorPositions.value[oldPath] }
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete cursorPositions.value[oldPath]
  }

  return {
    scrollToLineTrigger,
    cursorPositions,
    scrollToLine,
    saveCursorPosition,
    getCursorPosition,
    migrateCursorPath,
  }
}
