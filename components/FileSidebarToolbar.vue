<script setup lang="ts">
const editor = useEditorStore()
</script>

<template>
  <div class="flex items-center gap-1">
    <div class="flex-1 flex items-center gap-1">
      <UButton
        icon="i-lucide-list-tree"
        size="xs"
        :variant="editor.activeRightTab === 'outline' ? 'subtle' : 'ghost'"
        :color="editor.activeRightTab === 'outline' ? 'primary' : 'neutral'"
        :title="$t('sidebar.outline')"
        @click="editor.activeRightTab = 'outline'"
      />
      <UButton
        icon="i-lucide-info"
        size="xs"
        :variant="editor.activeRightTab === 'info' ? 'subtle' : 'ghost'"
        :color="editor.activeRightTab === 'info' ? 'primary' : 'neutral'"
        :title="$t('sidebar.fileInfo')"
        @click="editor.activeRightTab = 'info'"
      />
    </div>
  </div>
</template>
