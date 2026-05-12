<script setup lang="ts">
const settings = useSettingsStore()
const palette = useCommandPalette()
</script>

<template>
  <div class="flex items-center justify-end gap-1 px-2 h-9 border-b border-default shrink-0 bg-elevated/30">
    <UButton
      icon="i-lucide-terminal"
      size="xs"
      color="neutral"
      variant="ghost"
      :title="$t('sidebar.commandPalette')"
      @click="palette.open()"
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
