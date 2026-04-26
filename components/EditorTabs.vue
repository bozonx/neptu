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
  <div
    v-if="tabs.tabs.length"
    class="flex items-end gap-0.5 overflow-x-auto px-1 pt-1"
  >
    <button
      v-for="tab in tabs.tabs"
      :key="tab.id"
      type="button"
      class="group flex items-center gap-2 rounded-t-md border border-b-0 px-3 py-1.5 text-xs whitespace-nowrap transition-colors"
      :class="tab.id === tabs.activeId
        ? 'bg-default border-default text-default'
        : 'bg-elevated border-transparent text-muted hover:text-default'"
      :title="tab.filePath"
      @click="tabs.activate(tab.id)"
    >
      <span
        v-if="tab.id === tabs.activeId && editor.isDirty"
        class="size-1.5 rounded-full bg-primary"
      />
      <span class="font-medium">{{ fileName(tab.filePath) }}</span>
      <span
        v-if="vaultName(tab.filePath)"
        class="text-muted"
      >· {{ vaultName(tab.filePath) }}</span>
      <UIcon
        name="i-lucide-x"
        class="size-3.5 opacity-60 hover:opacity-100"
        @click.stop="tabs.close(tab.id)"
      />
    </button>
  </div>
</template>
