import { ref } from 'vue'

const draggedPath = ref<string | null>(null)
const isCopyMode = ref(false)

export function useDnd() {
  function onDragStart(event: DragEvent, path: string) {
    draggedPath.value = path
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', path)
      event.dataTransfer.effectAllowed = 'move'
    }
    // Update copy mode initially
    isCopyMode.value = event.shiftKey
  }

  function onDragEnd() {
    draggedPath.value = null
    isCopyMode.value = false
  }

  function updateCopyMode(event: DragEvent) {
    isCopyMode.value = event.shiftKey
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
    isCopyMode,
    onDragStart,
    onDragEnd,
    updateCopyMode,
    handleAutoScroll,
  }
}
