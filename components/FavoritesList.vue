<script setup lang="ts">
const vaults = useVaultsStore()
const tabs = useTabsStore()
const toast = useToast()
const { t } = useI18n()

function fileName(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] ?? path
}

function vaultName(path: string): string | null {
  return vaults.findVaultForPath(path)?.name ?? null
}

function openFile(path: string) {
  tabs.openFile(path).catch((error: unknown) => {
    toast.add({ title: t('toast.openFileFailed'), description: String(error), color: 'error' })
  })
}
</script>

<template>
  <div class="space-y-0.5">
    <div
      v-if="vaults.favorites.length === 0"
      class="text-sm text-muted px-2 py-2"
    >
      {{ $t('sidebar.noFavorites') }}
    </div>
    <UContextMenu
      v-for="path in vaults.favorites"
      :key="path"
      :items="[
        [
          {
            label: $t('sidebar.removeFromFavorites'),
            icon: 'i-lucide-star-off',
            onSelect: () => vaults.removeFavorite(path),
          },
        ],
      ]"
      :modal="false"
    >
      <div
        class="group flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-elevated transition-colors"
        @click="openFile(path)"
      >
        <UIcon
          name="i-lucide-star"
          class="size-4 text-primary shrink-0"
        />
        <span class="truncate text-xs flex-1">{{ fileName(path) }}</span>
        <span
          v-if="vaultName(path)"
          class="text-[10px] text-muted opacity-70"
        >{{ vaultName(path) }}</span>
      </div>
    </UContextMenu>
  </div>
</template>
