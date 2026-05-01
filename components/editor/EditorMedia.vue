<script setup lang="ts">
import { convertFileSrc } from '@tauri-apps/api/core'

const props = defineProps<{
  filePath: string
  viewType: 'image' | 'video' | 'audio'
}>()

const assetUrl = ref('')

// Image Viewer State
const scale = ref(1)
const panX = ref(0)
const panY = ref(0)
const isDragging = ref(false)
const lastMouseX = ref(0)
const lastMouseY = ref(0)

function resetView() {
  scale.value = 1
  panX.value = 0
  panY.value = 0
}

function onWheel(e: WheelEvent) {
  if (props.viewType !== 'image') return
  // Zoom logic
  const zoomSensitivity = 0.001
  const delta = -e.deltaY * zoomSensitivity
  const newScale = Math.max(0.1, Math.min(scale.value + delta, 10))
  scale.value = newScale
}

function onMouseDown(e: MouseEvent) {
  if (props.viewType !== 'image' || e.button !== 0) return // Left click only
  isDragging.value = true
  lastMouseX.value = e.clientX
  lastMouseY.value = e.clientY
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging.value) return
  const dx = e.clientX - lastMouseX.value
  const dy = e.clientY - lastMouseY.value
  panX.value += dx
  panY.value += dy
  lastMouseX.value = e.clientX
  lastMouseY.value = e.clientY
}

function onMouseUp(e: MouseEvent) {
  if (e.button === 0) {
    isDragging.value = false
  }
}

watch(() => props.filePath, (path) => {
  resetView()
  if (path) {
    // Convert absolute path to a Tauri asset URL
    assetUrl.value = convertFileSrc(path)
  } else {
    assetUrl.value = ''
  }
}, { immediate: true })
</script>

<template>
  <div class="flex-1 overflow-hidden flex items-center justify-center bg-elevated/30 p-8">
    <template v-if="props.viewType === 'image'">
      <UContextMenu
        :items="[
          [{ label: 'Сбросить pan и zoom', icon: 'i-lucide-maximize', onSelect: resetView }]
        ]"
        :modal="false"
        class="w-full h-full flex items-center justify-center"
      >
        <div
          class="w-full h-full flex items-center justify-center overflow-hidden"
          :class="isDragging ? 'cursor-grabbing' : 'cursor-grab'"
          @wheel.prevent="onWheel"
          @mousedown.prevent="onMouseDown"
          @mousemove.prevent="onMouseMove"
          @mouseup="onMouseUp"
          @mouseleave="onMouseUp"
        >
          <img
            v-if="assetUrl"
            :src="assetUrl"
            class="max-w-full max-h-full object-contain rounded shadow-sm select-none pointer-events-none"
            :style="{ transform: `translate(${panX}px, ${panY}px) scale(${scale})`, transformOrigin: 'center center' }"
            alt="Image Viewer"
            draggable="false"
          />
        </div>
      </UContextMenu>
    </template>
    <template v-else-if="props.viewType === 'video'">
      <video
        v-if="assetUrl"
        :src="assetUrl"
        controls
        class="max-w-full max-h-full rounded shadow-sm"
      />
    </template>
    <template v-else-if="props.viewType === 'audio'">
      <div class="w-full max-w-md bg-default p-6 rounded-lg shadow-sm border border-default text-center">
        <UIcon name="i-lucide-music" class="size-16 mx-auto mb-6 text-primary opacity-80" />
        <audio
          v-if="assetUrl"
          :src="assetUrl"
          controls
          class="w-full"
        />
        <div class="mt-4 text-sm text-muted font-medium truncate px-4">
          {{ props.filePath.split(/[\/\\]/).pop() }}
        </div>
      </div>
    </template>
  </div>
</template>
