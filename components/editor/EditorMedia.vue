<script setup lang="ts">
import { convertFileSrc } from '@tauri-apps/api/core'

const props = defineProps<{
  filePath: string
  viewType: 'image' | 'video' | 'audio'
}>()

const assetUrl = ref('')

watch(() => props.filePath, (path) => {
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
      <img
        v-if="assetUrl"
        :src="assetUrl"
        class="max-w-full max-h-full object-contain rounded shadow-sm"
        alt="Image Viewer"
      />
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
