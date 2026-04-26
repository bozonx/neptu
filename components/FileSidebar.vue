<script setup lang="ts">
const editor = useEditorStore()
const vaults = useVaultsStore()

const fileName = computed(() => {
  if (!editor.currentFilePath) return null
  const parts = editor.currentFilePath.split(/[\\/]/)
  return parts[parts.length - 1]
})

const vaultName = computed(() => {
  if (!editor.currentFilePath) return null
  return vaults.findVaultForPath(editor.currentFilePath)?.name
})

const fileStats = ref<{ size: number, mtime: string | null } | null>(null)

async function refreshStats() {
  if (!editor.currentFilePath) {
    fileStats.value = null
    return
  }
  // TODO: Implement file stats fetching if needed
  // For now we just show path and basic info from store
}

watch(() => editor.currentFilePath, refreshStats, { immediate: true })

function handleProperties() {
  // TODO: implement properties dialog or action
}
</script>

<template>
  <div class="flex flex-col h-full bg-default">
    <!-- Right Sidebar Toolbar -->
    <div class="h-10 border-b border-default flex items-center px-3 shrink-0">
      <UButton
        icon="i-lucide-info"
        label="Properties"
        size="xs"
        variant="ghost"
        color="neutral"
        @click="handleProperties"
      />
    </div>

    <!-- Right Sidebar Content -->
    <div class="flex-1 overflow-auto p-4">
      <div
        v-if="editor.currentFilePath"
        class="space-y-4"
      >
        <div>
          <h3 class="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            File Info
          </h3>
          <div class="space-y-2">
            <div>
              <div class="text-[10px] text-muted uppercase">
                Name
              </div>
              <div
                class="text-sm truncate"
                :title="fileName ?? ''"
              >
                {{ fileName }}
              </div>
            </div>
            <div>
              <div class="text-[10px] text-muted uppercase">
                Vault
              </div>
              <div class="text-sm truncate">
                {{ vaultName }}
              </div>
            </div>
            <div>
              <div class="text-[10px] text-muted uppercase">
                Full Path
              </div>
              <div class="text-xs text-muted break-all">
                {{ editor.currentFilePath }}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        v-else
        class="h-full flex items-center justify-center text-muted text-sm italic"
      >
        No file selected
      </div>
    </div>
  </div>
</template>
