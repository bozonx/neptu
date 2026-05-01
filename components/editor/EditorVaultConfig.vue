<script setup lang="ts">
import EditorText from './EditorText.vue'

const props = defineProps<{
  filePath: string
}>()

const mode = ref<'ui' | 'text'>('ui')
const vaultName = computed(() => {
  const vault = useVaultsStore().findVaultForPath(props.filePath)
  return vault?.name || 'Vault Configuration'
})
</script>

<template>
  <div class="flex-1 overflow-hidden flex flex-col min-h-0 bg-default">
    <!-- Header with Toggle -->
    <div class="shrink-0 h-12 border-b border-default px-4 flex items-center justify-between">
      <div class="font-medium text-sm flex items-center gap-2">
        <UIcon
          name="i-lucide-settings"
          class="size-4 text-muted"
        />
        {{ vaultName }} Settings
      </div>

      <div class="flex items-center gap-1 bg-elevated/50 p-1 rounded-md border border-default">
        <button
          class="px-3 py-1 text-xs font-medium rounded transition-colors"
          :class="mode === 'ui' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted hover:text-default'"
          @click="mode = 'ui'"
        >
          Visual Editor
        </button>
        <button
          class="px-3 py-1 text-xs font-medium rounded transition-colors"
          :class="mode === 'text' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted hover:text-default'"
          @click="mode = 'text'"
        >
          Text Editor
        </button>
      </div>
    </div>

    <!-- UI Mode -->
    <div
      v-if="mode === 'ui'"
      class="flex-1 overflow-y-auto p-8"
    >
      <div class="max-w-2xl mx-auto space-y-8">
        <div>
          <h2 class="text-xl font-semibold mb-1">
            Configuration
          </h2>
          <p class="text-sm text-muted mb-6">
            Manage settings specific to this vault.
          </p>

          <div class="bg-elevated/30 border border-default rounded-lg p-6 flex flex-col items-center justify-center text-center">
            <UIcon
              name="i-lucide-hammer"
              class="size-12 text-muted opacity-50 mb-4"
            />
            <h3 class="text-lg font-medium mb-2">
              Visual Editor Under Construction
            </h3>
            <p class="text-sm text-muted max-w-sm">
              The graphical interface for editing `.neptu-vault.yaml` is coming soon.
              For now, you can switch to the Text Editor mode to modify the file directly.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Text Mode -->
    <EditorText
      v-else
      :file-path="props.filePath"
    />
  </div>
</template>
