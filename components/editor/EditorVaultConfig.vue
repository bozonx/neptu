<script setup lang="ts">
import EditorCode from './EditorCode.vue'
import {
  DEFAULT_AUTO_CONVERT_SETTINGS,
  type VaultConfig,
} from '~/types/vault-config'
import { normalizeRelativePath } from '~/utils/paths'
import SchemasSection from '~/components/vault-config/SchemasSection.vue'
import FiltersSection from '~/components/vault-config/FiltersSection.vue'

const props = defineProps<{
  filePath: string
}>()

const { t } = useI18n()
const fs = useFs()
const toast = useToast()

const mode = ref<'ui' | 'text'>('ui')
const vaultName = computed(() => {
  const vault = useVaultsStore().findVaultForPath(props.filePath)
  return vault?.name || t('vault.configuration')
})

const config = ref<VaultConfig | null>(null)
const loading = ref(true)
const saveStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')

/**
 * Snapshot of the last-known on-disk state. Used to skip redundant writes
 * caused by default-fill mutations during loadConfig() or by re-entering UI
 * mode after a no-op text edit.
 */
let lastSavedJson = ''
let saveTimer: ReturnType<typeof setTimeout> | null = null
let pendingSave = false

/**
 * Migrate kebab-case keys produced by hand-written templates to camelCase
 * and drop legacy variants in place.
 */
function migrateKebabKeys(raw: Record<string, unknown>): void {
  if (raw['media-dir'] !== undefined) {
    if (raw.mediaDir === undefined) raw.mediaDir = raw['media-dir']
    delete raw['media-dir']
  }
  if (raw['auto-convert'] !== undefined) {
    if (raw.autoConvert === undefined)
      raw.autoConvert = raw['auto-convert']
    delete raw['auto-convert']
  }
}

/** Strip empty optional collections so the YAML stays clean. */
function sanitize(cfg: VaultConfig): VaultConfig {
  if (cfg.contentRoot)
    cfg.contentRoot = normalizeRelativePath(cfg.contentRoot)
  if (cfg.schemas && cfg.schemas.length === 0) delete cfg.schemas
  if (cfg.excludes && cfg.excludes.length === 0) delete cfg.excludes
  if (cfg.filters && cfg.filters.groups.length === 0) delete cfg.filters
  return cfg
}

async function loadConfig() {
  loading.value = true
  try {
    const rawConfig = (await fs.readYaml<VaultConfig>(props.filePath)) || {
      version: 1,
    }
    migrateKebabKeys(rawConfig as unknown as Record<string, unknown>)

    if (!rawConfig.version) {
      rawConfig.version = 1
    }
    if (!rawConfig.mediaDir) {
      rawConfig.mediaDir = {
        mode: 'adjacent-folder',
        folder: 'media',
        naming: 'original',
      }
    }
    if (!rawConfig.autoConvert) {
      rawConfig.autoConvert = { ...DEFAULT_AUTO_CONVERT_SETTINGS }
    }

    config.value = rawConfig
    // Snapshot AFTER mutations so the watcher does not auto-save on open.
    lastSavedJson = JSON.stringify(
      sanitize(structuredClone(toRaw(rawConfig))),
    )
  }
  catch (error) {
    toast.add({
      title: t('vault.loadConfigFailed'),
      description: String(error),
      color: 'error',
    })
    config.value = {
      version: 1,
      mediaDir: {
        mode: 'adjacent-folder',
        folder: 'media',
        naming: 'original',
      },
      autoConvert: { ...DEFAULT_AUTO_CONVERT_SETTINGS },
    }
    lastSavedJson = JSON.stringify(config.value)
  }
  finally {
    loading.value = false
  }
}

async function saveConfig(): Promise<void> {
  if (!config.value) return
  pendingSave = false
  const sanitized = sanitize(structuredClone(toRaw(config.value)))
  const snapshot = JSON.stringify(sanitized)
  if (snapshot === lastSavedJson) {
    saveStatus.value = 'idle'
    return
  }
  saveStatus.value = 'saving'
  try {
    await fs.writeYaml(props.filePath, sanitized)
    lastSavedJson = snapshot
    saveStatus.value = 'saved'
    const vault = useVaultsStore().findVaultForPath(props.filePath)
    if (vault) {
      await useVaultsStore().loadVaultConfig(vault)
    }
  }
  catch (error) {
    saveStatus.value = 'error'
    toast.add({
      title: t('vault.saveConfigFailed'),
      description: String(error),
      color: 'error',
    })
  }
}

function scheduleSave() {
  pendingSave = true
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    void saveConfig()
  }, 500)
}

async function flushSave() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (pendingSave) await saveConfig()
}

watch(
  config,
  () => {
    if (!loading.value) {
      scheduleSave()
    }
  },
  { deep: true },
)

async function switchTo(next: 'ui' | 'text') {
  if (mode.value === next) return
  if (mode.value === 'ui') {
    // Persist any pending UI edits before handing the file to the text editor.
    await flushSave()
  }
  mode.value = next
  if (next === 'ui') {
    // Re-read so we pick up changes the text editor may have written.
    await loadConfig()
  }
}

onMounted(loadConfig)
onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer)
  // Best-effort flush; not awaited because component is being torn down.
  if (pendingSave) void saveConfig()
})

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

function ensureAutoConvert() {
  if (!config.value) return null
  if (!config.value.autoConvert) {
    config.value.autoConvert = { ...DEFAULT_AUTO_CONVERT_SETTINGS }
  }
  return config.value.autoConvert
}

const autoConvertEnabledModel = computed({
  get: () => ensureAutoConvert()?.enabled ?? false,
  set: (value: boolean) => {
    const autoConvert = ensureAutoConvert()
    if (autoConvert) autoConvert.enabled = value
  },
})

const autoConvertFormatModel = computed({
  get: () => ensureAutoConvert()?.format ?? 'webp',
  set: (value: 'webp' | 'jpeg' | 'png') => {
    const autoConvert = ensureAutoConvert()
    if (autoConvert) autoConvert.format = value
  },
})

const autoConvertQualityModel = computed({
  get: () => ensureAutoConvert()?.quality ?? 0.85,
  set: (value: number) => {
    const autoConvert = ensureAutoConvert()
    if (autoConvert) autoConvert.quality = value
  },
})

const autoConvertMaxDimensionModel = computed({
  get: () => ensureAutoConvert()?.maxDimension,
  set: (value: number | undefined) => {
    const autoConvert = ensureAutoConvert()
    if (autoConvert) autoConvert.maxDimension = value || undefined
  },
})

const autoConvertPreserveTransparencyModel = computed({
  get: () => ensureAutoConvert()?.preserveTransparency ?? true,
  set: (value: boolean) => {
    const autoConvert = ensureAutoConvert()
    if (autoConvert) autoConvert.preserveTransparency = value
  },
})

const autoConvertBackgroundColorModel = computed({
  get: () => ensureAutoConvert()?.backgroundColor ?? '#ffffff',
  set: (value: string) => {
    const autoConvert = ensureAutoConvert()
    if (autoConvert) autoConvert.backgroundColor = value
  },
})

function addExclude() {
  const raw = newExclude.value
    .trim()
    .replace(/^[\\/]+/, '')
    .replace(/[\\/]+$/, '')
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
    <div
      class="shrink-0 h-12 border-b border-default px-4 flex items-center justify-between"
    >
      <div class="font-medium text-sm flex items-center gap-2">
        <UIcon
          name="i-lucide-settings"
          class="size-4 text-muted"
        />
        {{ vaultName }} — {{ t("vault.configuration") }}
        <span
          v-if="saveStatus === 'saving'"
          class="text-xs text-muted ml-2"
        >{{ t("vault.saving") }}</span>
        <span
          v-else-if="saveStatus === 'saved'"
          class="text-xs text-success ml-2"
        >{{ t("vault.saved") }}</span>
        <span
          v-else-if="saveStatus === 'error'"
          class="text-xs text-error ml-2"
        >{{ t("vault.saveConfigFailed") }}</span>
      </div>

      <div
        class="flex items-center gap-1 bg-elevated/50 p-1 rounded-md border border-default"
      >
        <button
          class="px-3 py-1 text-xs font-medium rounded transition-colors"
          :class="
            mode === 'ui'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted hover:text-default'
          "
          @click="switchTo('ui')"
        >
          {{ t("vault.visualEditor") }}
        </button>
        <button
          class="px-3 py-1 text-xs font-medium rounded transition-colors"
          :class="
            mode === 'text'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted hover:text-default'
          "
          @click="switchTo('text')"
        >
          {{ t("vault.textEditor") }}
        </button>
      </div>
    </div>

    <!-- UI Mode -->
    <div
      v-if="mode === 'ui'"
      class="flex-1 h-0 overflow-y-auto p-8 min-h-0"
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
        class="space-y-8 pb-12"
      >
        <div>
          <h2 class="text-xl font-semibold mb-1">
            {{ t("vault.configuration") }}
          </h2>
          <p class="text-sm text-muted mb-6">
            {{ t("vault.configSubtitle") }}
          </p>

          <div
            class="space-y-6 bg-elevated/30 border border-default rounded-lg p-6"
          >
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
              <h3
                class="text-sm font-semibold text-muted uppercase tracking-wide"
              >
                {{ $t("vault.mediaDir") }}
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
                :hint="
                  config.mediaDir!.mode === 'global-folder'
                    ? $t('vault.mediaGlobalFolderHint')
                    : $t('vault.mediaAdjacentFolderHint')
                "
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
              <h3
                class="text-sm font-semibold text-muted uppercase tracking-wide"
              >
                {{ $t("vault.autoConvert") }}
              </h3>
              <ImageConvertOptionsForm
                v-model:enabled="autoConvertEnabledModel"
                v-model:format="autoConvertFormatModel"
                v-model:quality="autoConvertQualityModel"
                v-model:max-dimension="autoConvertMaxDimensionModel"
                v-model:preserve-transparency="autoConvertPreserveTransparencyModel"
                v-model:background-color="autoConvertBackgroundColorModel"
                show-enabled
              />
            </div>

            <USeparator />

            <SchemasSection v-model="config.schemas" />

            <USeparator />

            <FiltersSection v-model="config.filters" />

            <USeparator />

            <div class="space-y-4">
              <h3
                class="text-sm font-semibold text-muted uppercase tracking-wide"
              >
                {{ $t("vault.excludes") }}
              </h3>
              <p class="text-xs text-muted">
                {{ $t("vault.excludesHint") }}
              </p>
              <div class="flex items-center gap-2">
                <UInput
                  v-model="newExclude"
                  :placeholder="
                    $t('vault.excludePlaceholder')
                  "
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
                v-if="
                  config.excludes
                    && config.excludes.length > 0
                "
                class="space-y-1 mt-2"
              >
                <div
                  v-for="(item, idx) in config.excludes"
                  :key="idx"
                  class="flex items-center justify-between rounded-md bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 text-sm"
                >
                  <span class="font-mono text-xs">{{
                    item
                  }}</span>
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
    <EditorCode
      v-else
      :file-path="props.filePath"
    />
  </div>
</template>
