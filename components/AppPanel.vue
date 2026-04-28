<script setup lang="ts">
const settings = useSettingsStore()
const tabsStore = useTabsStore()
</script>

<template>
  <div class="flex items-center justify-end gap-1 px-2 py-1 border-b border-default shrink-0 bg-elevated/30">
    <UButton
      icon="i-lucide-chevron-right"
      size="xs"
      color="neutral"
      variant="ghost"
      class="w-5 justify-center px-0"
      :title="$t('sidebar.hideRightSidebar')"
      @click="tabsStore.rightSidebarCollapsed = true"
    />
    <UButton
      icon="i-lucide-settings"
      size="xs"
      color="neutral"
      variant="ghost"
      :title="$t('sidebar.settings')"
      @click="settings.openSettingsDialog()"
    />
  </div>
</template>
