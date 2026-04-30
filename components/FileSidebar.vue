<script setup lang="ts">
const editor = useEditorStore()
const plugins = usePluginsStore()
</script>

<template>
  <div class="flex flex-col h-full bg-default">
    <!-- Right Sidebar Toolbar -->
    <div class="h-9 border-b border-default flex items-center px-2 shrink-0">
      <FileSidebarToolbar class="flex-1" />
    </div>

    <!-- Right Sidebar Content -->
    <div class="flex-1 overflow-auto p-4">
      <div v-if="editor.currentFilePath">
        <component
          :is="plugins.resolvedActiveRightSidebarView?.component"
          v-if="plugins.resolvedActiveRightSidebarView"
        />
      </div>

      <div
        v-else
        class="h-full flex flex-col items-center justify-center text-muted text-sm italic space-y-2 opacity-50"
      >
        <UIcon
          name="i-lucide-file-question"
          class="size-8"
        />
        <span>{{ $t('sidebar.noFileSelected') }}</span>
      </div>
    </div>
  </div>
</template>
