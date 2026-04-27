<script setup lang="ts">
const plugins = usePluginsStore()

function isActive(fqid: string) {
  return plugins.resolvedActiveRightSidebarView?.fqid === fqid
}
</script>

<template>
  <div class="flex items-center gap-1">
    <div class="flex-1 flex items-center gap-1">
      <UButton
        v-for="view in plugins.sortedRightSidebarViews"
        :key="view.fqid"
        :icon="view.icon"
        size="xs"
        :variant="isActive(view.fqid) ? 'subtle' : 'ghost'"
        :color="isActive(view.fqid) ? 'primary' : 'neutral'"
        :title="view.title"
        @click="plugins.setActiveRightSidebarView(view.fqid)"
      />
      <PluginButtons location="right-sidebar-toolbar" />
    </div>
  </div>
</template>
