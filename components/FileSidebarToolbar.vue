<script setup lang="ts">
const editor = useEditorStore()

defineEmits<{
  (e: 'properties'): void
}>()
</script>

<template>
  <div class="flex items-center gap-1">
    <div class="flex-1 flex items-center gap-1">
      <UButton
        icon="i-lucide-list-tree"
        size="xs"
        :variant="editor.activeRightTab === 'outline' ? 'subtle' : 'ghost'"
        :color="editor.activeRightTab === 'outline' ? 'primary' : 'neutral'"
        title="Outline"
        @click="editor.activeRightTab = 'outline'"
      />
      <UButton
        icon="i-lucide-info"
        size="xs"
        :variant="editor.activeRightTab === 'info' ? 'subtle' : 'ghost'"
        :color="editor.activeRightTab === 'info' ? 'primary' : 'neutral'"
        title="File Info"
        @click="editor.activeRightTab = 'info'"
      />
    </div>

    <UButton
      v-if="editor.currentFilePath"
      icon="i-lucide-settings-2"
      size="xs"
      variant="ghost"
      color="neutral"
      title="File Properties"
      @click="$emit('properties')"
    />
  </div>
</template>
