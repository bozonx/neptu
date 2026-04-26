<script setup lang="ts">
const tabs = useTabsStore()
const editor = useEditorStore()
const vaults = useVaultsStore()

function fileName(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] ?? path
}

function vaultName(path: string): string | null {
  return vaults.findVaultForPath(path)?.name ?? null
}
</script>

<template>
  <div class="flex items-center gap-px h-full">
    <template v-if="tabs.tabs.length">
      <button
        v-for="tab in tabs.tabs"
        :key="tab.id"
        type="button"
        class="group flex items-center gap-2 h-full border-r border-default px-3 text-xs whitespace-nowrap transition-colors relative"
        :class="tab.id === tabs.activeId
          ? 'bg-default text-default'
          : 'bg-elevated/50 text-muted hover:text-default'"
        :title="tab.filePath"
        @click="tabs.activate(tab.id)"
      >
        <div
          v-if="tab.id === tabs.activeId"
          class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
        />
        <span
          v-if="tab.id === tabs.activeId && editor.isDirty"
          class="size-1.5 rounded-full bg-primary"
        />
        <span class="font-medium truncate max-w-[150px]">{{ fileName(tab.filePath) }}</span>
        <span
          v-if="vaultName(tab.filePath)"
          class="text-[10px] text-muted opacity-70"
        >{{ vaultName(tab.filePath) }}</span>
        <UButton
          icon="i-lucide-x"
          size="xs"
          variant="ghost"
          color="neutral"
          class="size-4 p-0 opacity-0 group-hover:opacity-100"
          @click.stop="tabs.close(tab.id)"
        />
      </button>
    </template>
    <div
      v-else
      class="px-4 text-[10px] text-muted uppercase tracking-widest opacity-30 select-none"
    >
      No open files
    </div>
  </div>
</template>
