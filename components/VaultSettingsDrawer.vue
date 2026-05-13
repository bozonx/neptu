<script setup lang="ts">
import { normalizeRelativePath } from '~/utils/paths'
import { DEFAULT_FILE_FILTERS } from '~/types'
import type {
  AutoConvertSettings,
  ConvertibleImageFormat,
  FileFilterSettings,
  GitCommitMode,
  MediaDirSettings,
  MediaNamingMode,
  MediaUploadMode,
  Vault,
} from '~/types'

const props = defineProps<{
  vault: Vault | null
}>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'remove', vault: Vault): void
}>()

const settings = useSettingsStore()
const vaults = useVaultsStore()
const tabs = useTabsStore()
const toast = useToast()
const { t } = useI18n()

const editVaultName = ref('')
const editVaultPath = ref<string | null>(null)
const editCommitMode = ref<GitCommitMode>('respect_config')
const editCommitDebounceSec = ref(5)
const editingCommitDebounce = ref(false)
const editFilters = ref<FileFilterSettings>(cloneFilters(DEFAULT_FILE_FILTERS))
const editContentFolder = ref('src')
const editExcludes = ref<string[]>([])
const editMediaMode = ref<MediaUploadMode>('adjacent-folder')
const editMediaFolder = ref('media')
const editMediaNaming = ref<MediaNamingMode>('original')
const newExclude = ref('')
const newCustomExt = ref('')
const showNameInput = ref(false)

const editingContentFolder = ref(false)
const editingFilters = ref(false)
const editingExcludes = ref(false)
const editingMediaDir = ref(false)
const editingAutoConvert = ref(false)
const editAutoConvertEnabled = ref(false)
const editAutoConvertFormat = ref<ConvertibleImageFormat>('webp')
const editAutoConvertQuality = ref(0.85)
const editAutoConvertMaxDimension = ref<number | undefined>(undefined)
const editAutoConvertPreserveTransparency = ref(true)
const editAutoConvertBackgroundColor = ref('#ffffff')

let skipNextWatch = false

watch(
  () => [open.value, props.vault] as const,
  ([isOpen, vault]) => {
    if (!isOpen || !vault) return
    skipNextWatch = true
    editVaultName.value = vault.name
    editVaultPath.value = vault.path
    editCommitMode.value = vault.git?.commitMode ?? 'respect_config'
    editCommitDebounceSec.value = (vault.git?.commitDebounceMs ?? settings.settings.defaultCommitDebounceMs) / 1000
    editingCommitDebounce.value = vault.git?.commitDebounceMs !== undefined

    editFilters.value = cloneFilters(vaults.getEffectiveFilters(vault))
    editingFilters.value = vault.filters !== undefined

    editContentFolder.value = vaults.getEffectiveContentFolder(vault) ?? ''
    editingContentFolder.value = vault.contentFolder !== undefined

    editExcludes.value = [...vaults.getEffectiveExcludes(vault)]
    editingExcludes.value = vault.excludes !== undefined

    const mediaDir = vaults.getEffectiveMediaDir(vault)
    setMediaDirFields(mediaDir)
    editingMediaDir.value = vault.mediaDir !== undefined

    setAutoConvertFields(vaults.getEffectiveAutoConvert(vault))
    editingAutoConvert.value = vault.autoConvert !== undefined

    newExclude.value = ''
    newCustomExt.value = ''
    showNameInput.value = false
    nextTick(() => {
      skipNextWatch = false
    })
  },
  { immediate: true },
)

async function browseEditFolder() {
  try {
    const path = await useFs().pickDirectory({ title: t('vault.selectVaultFolder') })
    if (path) editVaultPath.value = path
  }
  catch (error) {
    toast.add({ title: t('toast.cannotOpenDialog'), description: String(error), color: 'error' })
  }
}

async function save() {
  if (!props.vault) return
  try {
    const isGit = props.vault.type === 'git'
    await vaults.updateVault(props.vault.id, {
      name: editVaultName.value,
      path: editVaultPath.value ?? undefined,
      git: isGit
        ? {
            commitMode: editCommitMode.value,
            ...(editingCommitDebounce.value ? { commitDebounceMs: Math.max(1000, Math.round(editCommitDebounceSec.value * 1000)) } : {}),
          }
        : undefined,
      filters: editingFilters.value ? editFilters.value : null as never,
      contentFolder: editingContentFolder.value ? normalizeRelativePath(editContentFolder.value) : null as never,
      excludes: editingExcludes.value ? editExcludes.value : null as never,
      mediaDir: editingMediaDir.value
        ? {
          mode: editMediaMode.value,
          folder: editMediaMode.value === 'adjacent' ? undefined : editMediaFolder.value,
          naming: editMediaNaming.value,
        } satisfies MediaDirSettings
        : null as never,
      autoConvert: editingAutoConvert.value
        ? {
            enabled: editAutoConvertEnabled.value,
            format: editAutoConvertFormat.value,
            quality: editAutoConvertQuality.value,
            maxDimension: editAutoConvertMaxDimension.value || undefined,
            preserveTransparency: editAutoConvertPreserveTransparency.value,
            backgroundColor: editAutoConvertPreserveTransparency.value && editAutoConvertFormat.value !== 'jpeg' ? undefined : editAutoConvertBackgroundColor.value,
          }
        : null as never,
    })
  }
  catch (error) {
    toast.add({
      title: t('toast.autoSaveFailed'),
      description: error instanceof Error ? error.message : String(error),
      color: 'error',
    })
  }
}

const debouncedSave = useDebounceFn(save, 500)

watch(
  [editVaultName, editVaultPath, editCommitMode, editCommitDebounceSec, editFilters, editContentFolder, editExcludes, editMediaMode, editMediaFolder, editMediaNaming, editingContentFolder, editingFilters, editingExcludes, editingMediaDir, editingCommitDebounce, editAutoConvertEnabled, editAutoConvertFormat, editAutoConvertQuality, editAutoConvertMaxDimension, editAutoConvertPreserveTransparency, editAutoConvertBackgroundColor, editingAutoConvert],
  () => {
    if (skipNextWatch || !open.value) return
    debouncedSave()
  },
  { deep: true },
)

watch(open, (val) => {
  if (!val) emit('close')
})

async function openVaultFile() {
  if (!props.vault) return
  try {
    const fs = useFs()
    const path = await fs.join(props.vault.path, '.neptu-vault.yaml')
    await tabs.openFile(path)
  }
  catch (error) {
    toast.add({ title: t('vault.openVaultFileFailed'), description: String(error), color: 'error' })
  }
}

const effectiveContentFolder = computed(() =>
  props.vault ? vaults.getEffectiveContentFolder(props.vault) ?? '' : '',
)

const effectiveGlobalModeLabel = computed(() =>
  settings.settings.defaultCommitMode === 'auto' ? t('vault.autoCommit') : t('vault.manualCommit'),
)

const commitModeItems = computed(() => [
  { label: `${t('vault.respectConfigCommit')} (${effectiveGlobalModeLabel.value})`, value: 'respect_config' as const },
  { label: t('vault.autoCommit'), value: 'auto' as const },
  { label: t('vault.manualCommit'), value: 'manual' as const },
])

const showCommitDebounce = computed(() =>
  editCommitMode.value === 'auto'
  || (editCommitMode.value === 'respect_config' && settings.settings.defaultCommitMode === 'auto'),
)

const mediaModeItems = [
  { label: t('vault.mediaModeGlobal'), value: 'global-folder' as const },
  { label: t('vault.mediaModeAdjacent'), value: 'adjacent' as const },
  { label: t('vault.mediaModeAdjacentFolder'), value: 'adjacent-folder' as const },
]

const mediaNamingItems = [
  { label: t('vault.mediaNamingOriginal'), value: 'original' as const },
  { label: t('vault.mediaNamingDocumentIndex'), value: 'document-index' as const },
  { label: t('vault.mediaNamingHash'), value: 'hash' as const },
]

const autoConvertFormatItems = [
  { label: 'WebP', value: 'webp' as const },
  { label: 'PNG', value: 'png' as const },
  { label: 'JPEG', value: 'jpeg' as const },
]

function cloneFilters(filters: FileFilterSettings): FileFilterSettings {
  return JSON.parse(JSON.stringify(filters)) as FileFilterSettings
}

function setMediaDirFields(mediaDir: MediaDirSettings) {
  editMediaMode.value = mediaDir.mode
  editMediaFolder.value = mediaDir.folder ?? 'media'
  editMediaNaming.value = mediaDir.naming
}

function resetContentFolderOverride() {
  if (!props.vault) return
  editingContentFolder.value = false
  editContentFolder.value = vaults.getEffectiveContentFolder(props.vault) ?? ''
}

function resetFiltersOverride() {
  if (!props.vault) return
  editingFilters.value = false
  editFilters.value = cloneFilters(vaults.getEffectiveFilters(props.vault))
}

function resetExcludesOverride() {
  if (!props.vault) return
  editingExcludes.value = false
  editExcludes.value = [...vaults.getEffectiveExcludes(props.vault)]
}

function resetMediaDirOverride() {
  if (!props.vault) return
  editingMediaDir.value = false
  setMediaDirFields(vaults.getEffectiveMediaDir(props.vault))
}

function setAutoConvertFields(autoConvert: AutoConvertSettings | undefined) {
  editAutoConvertEnabled.value = autoConvert?.enabled ?? false
  editAutoConvertFormat.value = autoConvert?.format ?? 'webp'
  editAutoConvertQuality.value = autoConvert?.quality ?? 0.85
  editAutoConvertMaxDimension.value = autoConvert?.maxDimension
  editAutoConvertPreserveTransparency.value = autoConvert?.preserveTransparency ?? true
  editAutoConvertBackgroundColor.value = autoConvert?.backgroundColor ?? '#ffffff'
}

function resetAutoConvertOverride() {
  if (!props.vault) return
  setAutoConvertFields(vaults.vaultConfigs[props.vault.id]?.autoConvert)
  editingAutoConvert.value = false
}
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="$t('vault.editVault')"
    :description="$t('vault.editVaultDesc')"
    side="right"
    class="w-full sm:max-w-[480px]"
  >
    <template #body>
      <div class="space-y-6">
        <VaultSettingsVaultIdentitySection
          v-model:name="editVaultName"
          v-model:path="editVaultPath"
          v-model:show-name-input="showNameInput"
          :vault="vault"
          :main-repo-path="settings.mainRepoPath"
          @browse="browseEditFolder"
        />

        <VaultSettingsVaultGitSection
          v-model:commit-mode="editCommitMode"
          v-model:commit-debounce-sec="editCommitDebounceSec"
          v-model:editing-commit-debounce="editingCommitDebounce"
          :vault="vault"
          :default-commit-debounce-ms="settings.settings.defaultCommitDebounceMs"
          :commit-mode-items="commitModeItems"
          :show-commit-debounce="showCommitDebounce"
        />

        <section class="space-y-3">
          <UButton
            icon="i-lucide-file-code-2"
            color="neutral"
            variant="soft"
            size="sm"
            block
            :label="$t('vault.openVaultFile')"
            @click="openVaultFile"
          />
        </section>

        <section class="space-y-6">
          <h3 class="text-sm font-semibold text-muted uppercase tracking-wide">
            {{ $t('vault.vaultOverrides') }}
          </h3>

          <VaultSettingsVaultContentFolderSection
            v-model:content-folder="editContentFolder"
            v-model:editing="editingContentFolder"
            :effective-content-folder="effectiveContentFolder"
            :has-override="vault?.contentFolder !== undefined"
            @reset="resetContentFolderOverride"
          />

          <VaultSettingsVaultFileFiltersSection
            v-model:filters="editFilters"
            v-model:editing="editingFilters"
            v-model:new-custom-ext="newCustomExt"
            :has-override="vault?.filters !== undefined"
            @reset="resetFiltersOverride"
          />

          <VaultSettingsVaultExcludesSection
            v-model:excludes="editExcludes"
            v-model:editing="editingExcludes"
            v-model:new-exclude="newExclude"
            :has-override="vault?.excludes !== undefined"
            @reset="resetExcludesOverride"
          />

          <VaultSettingsVaultMediaDirSection
            v-model:editing="editingMediaDir"
            v-model:mode="editMediaMode"
            v-model:folder="editMediaFolder"
            v-model:naming="editMediaNaming"
            :has-override="vault?.mediaDir !== undefined"
            :media-mode-items="mediaModeItems"
            :media-naming-items="mediaNamingItems"
            @reset="resetMediaDirOverride"
          />

          <VaultSettingsVaultAutoConvertSection
            v-model:editing="editingAutoConvert"
            v-model:enabled="editAutoConvertEnabled"
            v-model:format="editAutoConvertFormat"
            v-model:quality="editAutoConvertQuality"
            v-model:max-dimension="editAutoConvertMaxDimension"
            v-model:preserve-transparency="editAutoConvertPreserveTransparency"
            v-model:background-color="editAutoConvertBackgroundColor"
            :has-override="vault?.autoConvert !== undefined"
            :format-items="autoConvertFormatItems"
            @reset="resetAutoConvertOverride"
          />
        </section>

        <section
          v-if="vault && vault.path !== settings.mainRepoPath"
          class="space-y-3 pt-6 border-t border-default"
        >
          <p class="text-xs text-muted">
            {{ $t('vault.removeHint') }}
          </p>
          <UButton
            icon="i-lucide-trash-2"
            :label="$t('vault.removeFromApp')"
            color="neutral"
            variant="soft"
            size="sm"
            block
            @click="open = false; emit('remove', vault)"
          />
        </section>
      </div>
    </template>
  </USlideover>
</template>
