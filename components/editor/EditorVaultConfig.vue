<script setup lang="ts">
import EditorText from './EditorText.vue'
import type { VaultConfig } from '~/types/vault-config'

const props = defineProps<{
  filePath: string
}>()

const mode = ref<'ui' | 'text'>('ui')
const vaultName = computed(() => {
  const vault = useVaultsStore().findVaultForPath(props.filePath)
  return vault?.name || 'Vault Configuration'
})

const { t } = useI18n()
const fs = useFs()
const toast = useToast()

const config = ref<VaultConfig | null>(null)
const loading = ref(true)

async function loadConfig() {
  loading.value = true
  try {
    const rawConfig = await fs.readYaml<VaultConfig>(props.filePath)
    config.value = rawConfig || { version: 1 }

    if (!config.value.version) {
      config.value.version = 1
    }
    if (!config.value.mediaDir && config.value.media) {
      config.value.mediaDir = {
        mode: config.value.media.uploadMode,
        folder: config.value.media.globalFolder,
        naming: 'original',
      }
      delete config.value.media
    }
    if (!config.value.mediaDir) {
      config.value.mediaDir = {
        mode: 'adjacent-folder',
        folder: 'media',
        naming: 'original',
      }
    }
  }
  catch (error) {
    toast.add({ title: 'Failed to load configuration', description: String(error), color: 'error' })
  }
  finally {
    loading.value = false
  }
}

async function saveConfig() {
  if (!config.value) return
  try {
    await fs.writeYaml(props.filePath, config.value)
    const vault = useVaultsStore().findVaultForPath(props.filePath)
    if (vault) {
      await useVaultsStore().loadVaultConfig(vault)
    }
  }
  catch (error) {
    toast.add({ title: 'Failed to save configuration', description: String(error), color: 'error' })
  }
}

const debouncedSave = useDebounceFn(saveConfig, 500)

watch(config, () => {
  if (!loading.value) {
    debouncedSave()
  }
}, { deep: true })

onMounted(loadConfig)

const mediaModeItems = computed(() => [
  { label: t('vault.mediaModeGlobal'), value: 'global-folder' },
  { label: t('vault.mediaModeAdjacent'), value: 'adjacent' },
  { label: t('vault.mediaModeAdjacentFolder'), value: 'adjacent-folder' },
])

const mediaNamingItems = computed(() => [
  { label: t('vault.mediaNamingOriginal'), value: 'original' },
  { label: t('vault.mediaNamingDocumentIndex'), value: 'document-index' },
  { label: t('vault.mediaNamingHash'), value: 'hash' },
])

const newExclude = ref('')

function addExclude() {
  const raw = newExclude.value.trim().replace(/^[\\/]+/, '').replace(/[\\/]+$/, '')
  if (!raw) return
  if (!config.value) return
  if (!config.value.excludes) config.value.excludes = []
  if (!config.value.excludes.includes(raw)) {
    config.value.excludes.push(raw)
  }
  newExclude.value = ''
}

function removeExclude(idx: number) {
  if (!config.value?.excludes) return
  config.value.excludes.splice(idx, 1)
  if (config.value.excludes.length === 0) {
    delete config.value.excludes
  }
}
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
          @click="mode = 'ui'; loadConfig()"
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
      <div
        v-if="loading"
        class="flex justify-center py-12"
      >
        <UIcon
          name="i-lucide-loader-2"
          class="size-6 text-muted animate-spin"
        />
      </div>
      <div
        v-else-if="config"
        class="max-w-2xl mx-auto space-y-8 pb-12"
      >
        <div>
          <h2 class="text-xl font-semibold mb-1">
            Configuration
          </h2>
          <p class="text-sm text-muted mb-6">
            Manage settings specific to this vault.
          </p>

          <div class="space-y-6 bg-elevated/30 border border-default rounded-lg p-6">
            <UFormField
              :label="$t('vault.contentFolder')"
              :hint="$t('vault.contentFolderHint')"
            >
              <UInput
                v-model="config.contentRoot"
                placeholder="src"
              />
            </UFormField>

            <USeparator />

            <div class="space-y-4">
              <h3 class="text-sm font-semibold text-muted uppercase tracking-wide">
                {{ $t('vault.mediaDir') }}
              </h3>
              <UFormField :label="$t('vault.mediaMode')">
                <ButtonGroupToggle
                  v-model="config.mediaDir!.mode"
                  :items="mediaModeItems"
                />
              </UFormField>
              <UFormField
                v-if="config.mediaDir!.mode !== 'adjacent'"
                :label="$t('vault.mediaFolder')"
                :hint="config.mediaDir!.mode === 'global-folder' ? $t('vault.mediaGlobalFolderHint') : $t('vault.mediaAdjacentFolderHint')"
              >
                <UInput v-model="config.mediaDir!.folder" />
              </UFormField>
              <UFormField :label="$t('vault.mediaNaming')">
                <ButtonGroupToggle
                  v-model="config.mediaDir!.naming"
                  :items="mediaNamingItems"
                />
              </UFormField>
            </div>

            <USeparator />

            <div class="space-y-4">
              <h3 class="text-sm font-semibold text-muted uppercase tracking-wide">
                {{ $t('vault.excludes') }}
              </h3>
              <p class="text-xs text-muted">
                {{ $t('vault.excludesHint') }}
              </p>
              <div class="flex items-center gap-2">
                <UInput
                  v-model="newExclude"
                  :placeholder="$t('vault.excludePlaceholder')"
                  class="flex-1"
                  @keydown.enter="addExclude"
                />
                <UButton
                  icon="i-lucide-plus"
                  color="neutral"
                  variant="ghost"
                  @click="addExclude"
                />
              </div>
              <div
                v-if="config.excludes && config.excludes.length > 0"
                class="space-y-1 mt-2"
              >
                <div
                  v-for="(item, idx) in config.excludes"
                  :key="idx"
                  class="flex items-center justify-between rounded-md bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 text-sm"
                >
                  <span class="font-mono text-xs">{{ item }}</span>
                  <UButton
                    icon="i-lucide-x"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    @click="removeExclude(idx)"
                  />
                </div>
              </div>
            </div>
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
