import { ref } from 'vue'

type DraggedPathSource = 'tree' | 'tab'

const draggedPath = ref<string | null>(null)
const draggedIsDir = ref(false)
const draggedPathSource = ref<DraggedPathSource | null>(null)
const draggedVaultId = ref<string | null>(null)
const isCopyMode = ref(false)
const shiftPressed = ref(false)
let listenersInstalled = false

function hasActiveDrag() {
  return Boolean(draggedPath.value || draggedVaultId.value)
}

function applyDragCursorClass() {
  if (typeof document === 'undefined') return
  document.body.classList.toggle('neptu-dnd-copy', hasActiveDrag() && isCopyMode.value)
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

export function useDnd() {
  if (!listenersInstalled && typeof window !== 'undefined') {
    listenersInstalled = true

    window.addEventListener('keydown', (event) => {
      shiftPressed.value = event.shiftKey
      if (!hasActiveDrag()) return
      syncCopyMode(shiftPressed.value)
    })

    window.addEventListener('keyup', (event) => {
      shiftPressed.value = event.shiftKey
      if (!hasActiveDrag()) return
      syncCopyMode(shiftPressed.value)
    })

    window.addEventListener('blur', () => {
      shiftPressed.value = false
      if (!hasActiveDrag()) return
      syncCopyMode(false)
    })

    window.addEventListener('dragend', () => {
      resetDragState()
    })

    window.addEventListener('drop', () => {
      resetDragState()
    })

    window.addEventListener('mouseup', () => {
      if (!hasActiveDrag()) return
      resetDragState()
    })
  }

  function onPathDragStart(event: DragEvent, path: string, options?: { isDir?: boolean, source?: DraggedPathSource }) {
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

    // Find the scrollable container. We can look for the nearest parent with overflow-y-auto
    const container = (event.target as HTMLElement).closest('.overflow-auto, .overflow-y-auto') as HTMLElement | null
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
  }
}
