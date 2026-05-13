import { onScopeDispose, ref } from 'vue'

type DraggedPathSource = 'tree' | 'tab'

const draggedPath = ref<string | null>(null)
const draggedIsDir = ref(false)
const draggedPathSource = ref<DraggedPathSource | null>(null)
const draggedVaultId = ref<string | null>(null)
const isCopyMode = ref(false)
const shiftPressed = ref(false)

const isOsDragging = ref(false)
const osDragPosition = ref<{ x: number, y: number } | null>(null)

let listenersRefCount = 0
let listenersCleanup: (() => void) | null = null
let installPromise: Promise<void> | null = null

function hasActiveDrag() {
  return Boolean(draggedPath.value || draggedVaultId.value)
}

function applyDragCursorClass() {
  if (typeof document === 'undefined') return
  document.body.classList.toggle(
    'neptu-dnd-copy',
    hasActiveDrag() && isCopyMode.value,
  )
}

function syncCopyMode(shiftKey: boolean) {
  isCopyMode.value = shiftKey
  applyDragCursorClass()
}

function resetDragState() {
  draggedPath.value = null
  draggedIsDir.value = false
  draggedPathSource.value = null
  draggedVaultId.value = null
  shiftPressed.value = false
  syncCopyMode(false)
}

async function installDndListeners() {
  if (installPromise) return installPromise

  const cleanups: Array<() => void> = []

  const keydownHandler = (event: KeyboardEvent) => {
    shiftPressed.value = event.shiftKey
    if (!hasActiveDrag()) return
    syncCopyMode(shiftPressed.value)
  }

  const keyupHandler = (event: KeyboardEvent) => {
    shiftPressed.value = event.shiftKey
    if (!hasActiveDrag()) return
    syncCopyMode(shiftPressed.value)
  }

  const blurHandler = () => {
    shiftPressed.value = false
    if (!hasActiveDrag()) return
    syncCopyMode(false)
  }

  const dragendHandler = () => {
    resetDragState()
  }

  const dropHandler = () => {
    resetDragState()
  }

  const mouseupHandler = () => {
    if (!hasActiveDrag()) return
    resetDragState()
  }

  window.addEventListener('keydown', keydownHandler)
  cleanups.push(() => window.removeEventListener('keydown', keydownHandler))

  window.addEventListener('keyup', keyupHandler)
  cleanups.push(() => window.removeEventListener('keyup', keyupHandler))

  window.addEventListener('blur', blurHandler)
  cleanups.push(() => window.removeEventListener('blur', blurHandler))

  window.addEventListener('dragend', dragendHandler)
  cleanups.push(() => window.removeEventListener('dragend', dragendHandler))

  window.addEventListener('drop', dropHandler)
  cleanups.push(() => window.removeEventListener('drop', dropHandler))

  window.addEventListener('mouseup', mouseupHandler)
  cleanups.push(() => window.removeEventListener('mouseup', mouseupHandler))

  if ('__TAURI_INTERNALS__' in window) {
    installPromise = import('@tauri-apps/api/event')
      .then(async ({ listen }) => {
        const unlisteners = await Promise.all([
          listen('tauri://drag-enter', () => {
            isOsDragging.value = true
          }),

          listen<{ x: number, y: number }>('tauri://drag-over', (event) => {
            isOsDragging.value = true
            osDragPosition.value = event.payload
          }),

          listen('tauri://drag-leave', () => {
            isOsDragging.value = false
            osDragPosition.value = null
          }),

          listen<{ paths: string[], position: { x: number, y: number } }>(
            'tauri://drag-drop',
            async (event) => {
              isOsDragging.value = false
              osDragPosition.value = null

              const { paths, position } = event.payload
              if (!paths || paths.length === 0) return

              const targetElement = document.elementFromPoint(
                position.x,
                position.y,
              ) as HTMLElement | null
              if (!targetElement) return

              const dropPath = targetElement.closest(
                '[data-drop-path]',
              ) as HTMLElement | null
              const dropZone = targetElement.closest(
                '[data-drop-zone]',
              ) as HTMLElement | null

              if (dropPath) {
                const targetDir = dropPath.getAttribute('data-drop-path')
                if (targetDir) {
                  await useVaultsStore().importExternalFiles(paths, targetDir)
                }
              }
              else if (dropZone) {
                const zone = dropZone.getAttribute('data-drop-zone')
                if (zone === 'editor') {
                  const editor = useEditorStore()
                  const targetPath
                    = targetElement
                      .closest('[data-editor-file-path]')
                      ?.getAttribute('data-editor-file-path')
                      || dropZone.getAttribute('data-editor-file-path')
                      || editor.currentFilePath
                  if (targetPath) {
                    const onConflict = useEditorImport().makeAskPolicy()
                    const importedPaths
                      = await useVaultsStore().importMediaFilesForDocument(
                        paths,
                        targetPath,
                        { onConflict },
                      )

                    if (importedPaths.length > 0) {
                      const onMedia = !!targetElement.closest(
                        '[data-original-src], img, video, audio',
                      )
                      editor.insertImportedFiles(importedPaths, targetPath, {
                        coords: position,
                        replaceTarget: onMedia ? 'media-at-coords' : undefined,
                      })
                    }
                  }
                }
                else if (zone === 'vault-root') {
                  const vaultId = dropZone.getAttribute('data-vault-id')
                  if (vaultId) {
                    const vault = useVaultsStore().findById(vaultId)
                    if (vault) {
                      await useVaultsStore().importExternalFiles(
                        paths,
                        vault.path,
                      )
                    }
                  }
                }
              }
            },
          ),
        ])
        cleanups.push(...unlisteners)
      })
      .catch(console.error)
  }
  else {
    installPromise = Promise.resolve()
  }

  listenersCleanup = () => {
    cleanups.forEach((fn) => fn())
    listenersCleanup = null
    installPromise = null
  }

  return installPromise
}

export function useDnd() {
  if (typeof window !== 'undefined') {
    listenersRefCount++
    void installDndListeners()

    onScopeDispose(() => {
      listenersRefCount--
      if (listenersRefCount <= 0 && listenersCleanup) {
        listenersCleanup()
      }
    })
  }

  function onPathDragStart(
    event: DragEvent,
    path: string,
    options?: { isDir?: boolean, source?: DraggedPathSource },
  ) {
    draggedPath.value = path
    draggedIsDir.value = options?.isDir ?? false
    draggedPathSource.value = options?.source ?? 'tree'
    draggedVaultId.value = null
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', path)
      event.dataTransfer.setData('application/x-neptu-path', path)
      event.dataTransfer.effectAllowed = 'copyMove'
    }
    shiftPressed.value = false
    syncCopyMode(false)
  }

  function onVaultDragStart(event: DragEvent, vaultId: string) {
    draggedPath.value = null
    draggedIsDir.value = false
    draggedPathSource.value = null
    draggedVaultId.value = vaultId
    syncCopyMode(false)

    if (event.dataTransfer) {
      event.dataTransfer.setData('application/x-neptu-vault', vaultId)
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.dropEffect = 'move'
    }
  }

  function onDragEnd() {
    resetDragState()
  }

  function updateCopyMode(event: DragEvent) {
    shiftPressed.value = event.shiftKey
    syncCopyMode(shiftPressed.value)
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = isCopyMode.value ? 'copy' : 'move'
    }
  }

  function handleAutoScroll(event: DragEvent) {
    const scrollStep = 10
    const threshold = 50

    const container = (event.target as HTMLElement).closest(
      '.overflow-auto, .overflow-y-auto',
    ) as HTMLElement | null
    if (!container) return

    const rect = container.getBoundingClientRect()
    const y = event.clientY

    if (y < rect.top + threshold) {
      container.scrollTop -= scrollStep
    }
    else if (y > rect.bottom - threshold) {
      container.scrollTop += scrollStep
    }
  }

  return {
    draggedPath,
    draggedIsDir,
    draggedPathSource,
    draggedVaultId,
    isCopyMode,
    onPathDragStart,
    onVaultDragStart,
    onDragEnd,
    updateCopyMode,
    handleAutoScroll,
    isOsDragging,
    osDragPosition,
  }
}
