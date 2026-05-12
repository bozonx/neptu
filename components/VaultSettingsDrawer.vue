<script setup lang="ts">
import { normalizeRelativePath } from '~/utils/paths'
import { DEFAULT_FILE_FILTERS } from '~/types'
import type { FileFilterGroup, GitCommitMode, MediaDirSettings, MediaNamingMode, MediaUploadMode, Vault } from '~/types'

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
const editFilters = ref(JSON.parse(JSON.stringify(DEFAULT_FILE_FILTERS)))
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
const editAutoConvertFormat = ref<'webp' | 'png' | 'jpeg'>('webp')
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
    // Initialize from effective values (may come from .neptu-vault.yaml or Vault overrides)
    editFilters.value = JSON.parse(JSON.stringify(vaults.getEffectiveFilters(vault)))
    editingFilters.value = vault.filters !== undefined

    editContentFolder.value = vaults.getEffectiveContentFolder(vault) ?? ''
    editingContentFolder.value = vault.contentFolder !== undefined

    editExcludes.value = [...vaults.getEffectiveExcludes(vault)]
    editingExcludes.value = vault.excludes !== undefined
    const mediaDir = vaults.getEffectiveMediaDir(vault)
    editMediaMode.value = mediaDir.mode
    editMediaFolder.value = mediaDir.folder ?? 'media'
    editMediaNaming.value = mediaDir.naming
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

function formatEnabledExtensions(extensions: { ext: string, enabled: boolean }[]): string {
  const enabled = extensions.filter((e) => e.enabled).map((e) => `.${e.ext}`)
  return enabled.join(', ')
}

function addExclude() {
  const raw = newExclude.value.trim().replace(/^[\\/]+/, '').replace(/[\\/]+$/, '')
  if (!raw) return
  if (!editExcludes.value.includes(raw)) {
    editExcludes.value.push(raw)
  }
  newExclude.value = ''
}

function removeExclude(idx: number) {
  editExcludes.value.splice(idx, 1)
}

function addCustomExtension(group: FileFilterGroup) {
  const raw = newCustomExt.value.trim().toLowerCase().replace(/^\.+/, '')
  if (!raw) return
  if (!group.extensions.some((e) => e.ext === raw)) {
    group.extensions.push({ ext: raw, enabled: true })
  }
  newCustomExt.value = ''
}

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

const effectiveGlobalModeLabel = computed(() =>
  settings.settings.defaultCommitMode === 'auto' ? t('vault.autoCommit') : t('vault.manualCommit'),
)

const commitModeItems = [
  { label: `${t('vault.respectConfigCommit')} (${effectiveGlobalModeLabel.value})`, value: 'respect_config' as const },
  { label: t('vault.autoCommit'), value: 'auto' as const },
  { label: t('vault.manualCommit'), value: 'manual' as const },
]

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

function setAutoConvertFields(autoConvert: ReturnType<typeof vaults.getEffectiveAutoConvert>) {
  editAutoConvertEnabled.value = autoConvert?.enabled ?? false
  editAutoConvertFormat.value = (autoConvert?.format as 'webp' | 'png' | 'jpeg') ?? 'webp'
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
        <section class="space-y-3">
          <h3 class="text-sm font-semibold text-muted uppercase tracking-wide">
            {{ $t('vault.name') }}
          </h3>
          <UFormField :label="$t('vault.folder')">
            <div class="flex items-center gap-2">
              <UInput
                :model-value="editVaultPath ?? ''"
                readonly
                :placeholder="$t('vault.noFolderSelected')"
                class="flex-1"
                :disabled="vault?.path === settings.mainRepoPath"
              />
              <UButton
                icon="i-lucide-folder-search"
                :label="$t('vault.browse')"
                :disabled="vault?.path === settings.mainRepoPath"
                @click="browseEditFolder"
              />
            </div>
          </UFormField>

          <div class="flex items-center gap-2">
            <UButton
              v-if="!showNameInput"
              size="xs"
              color="neutral"
              variant="link"
              :label="$t('vault.setVisibleName')"
              @click="showNameInput = true"
            />
          </div>

          <UFormField
            v-if="showNameInput"
            :label="$t('vault.name')"
          >
            <ClearableInput
              v-model="editVaultName"
              :placeholder="vault?.name ?? $t('vault.vaultNamePlaceholder')"
              @clear="showNameInput = false; editVaultName = vault?.name ?? ''"
            />
          </UFormField>
        </section>

        <template v-if="vault?.type === 'git'">
          <section class="space-y-3">
            <h3 class="text-sm font-semibold text-muted uppercase tracking-wide">
              {{ $t('settings.git') }}
            </h3>
            <UFormField :label="$t('vault.commitMode')">
              <ButtonGroupToggle
                v-model="editCommitMode"
                :items="commitModeItems"
              />
            </UFormField>
            <UFormField
              v-if="showCommitDebounce"
              :label="$t('vault.commitDebounce')"
            >
              <template v-if="!editingCommitDebounce">
                <div class="flex items-center gap-2">
                  <span class="font-mono text-xs bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded">
                    {{ ((vault?.git?.commitDebounceMs ?? settings.settings.defaultCommitDebounceMs) / 1000).toFixed(1) }}s
                  </span>
                  <span
                    v-if="vault?.git?.commitDebounceMs !== undefined"
                    class="text-xs text-muted"
                  >
                    {{ $t('vault.customValue') }}
                  </span>
                  <span
                    v-else
                    class="text-xs text-muted"
                  >
                    {{ $t('vault.fromConfig') }}
                  </span>
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    :label="$t('vault.edit')"
                    @click="editingCommitDebounce = true"
                  />
                </div>
              </template>
              <template v-else>
                <UInput
                  v-model="editCommitDebounceSec"
                  type="number"
                  :min="1"
                  :step="0.5"
                />
                <UButton
                  size="xs"
                  color="neutral"
                  variant="link"
                  :label="$t('vault.resetToConfigDefault')"
                  @click="editingCommitDebounce = false; editCommitDebounceSec = settings.settings.defaultCommitDebounceMs / 1000"
                />
              </template>
            </UFormField>
          </section>
        </template>

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
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <h4 class="text-sm font-semibold text-muted uppercase tracking-wide">
                {{ $t('vault.contentFolder') }}
              </h4>
              <UButton
                v-if="!editingContentFolder"
                size="xs"
                color="neutral"
                variant="ghost"
                :label="$t('vault.edit')"
                @click="editingContentFolder = true"
              />
            </div>
            <template v-if="!editingContentFolder">
              <div class="text-sm flex items-center gap-2">
                <span class="font-mono text-xs bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded">
                  {{ vaults.getEffectiveContentFolder(vault!) || $t('vault.contentFolderRoot') }}
                </span>
                <span
                  v-if="vault?.contentFolder !== undefined"
                  class="text-xs text-muted"
                >
                  {{ $t('vault.customValue') }}
                </span>
                <span
                  v-else
                  class="text-xs text-muted"
                >
                  {{ $t('vault.fromVaultFile') }}
                </span>
              </div>
            </template>
            <template v-else>
              <UFormField :hint="$t('vault.contentFolderHint')">
                <UInput
                  v-model="editContentFolder"
                  :placeholder="$t('vault.contentFolderPlaceholder')"
                />
              </UFormField>
              <UButton
                size="xs"
                color="neutral"
                variant="link"
                :label="$t('vault.resetToFileDefaults')"
                @click="editingContentFolder = false; editContentFolder = vaults.getEffectiveContentFolder(vault!) ?? ''"
              />
            </template>
          </div>

          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <h4 class="text-sm font-semibold text-muted uppercase tracking-wide">
                {{ $t('vault.fileFilters') }}
              </h4>
              <UButton
                v-if="!editingFilters"
                size="xs"
                color="neutral"
                variant="ghost"
                :label="$t('vault.edit')"
                @click="editingFilters = true"
              />
            </div>
            <template v-if="!editingFilters">
              <div
                v-for="group in editFilters.groups"
                :key="group.label"
                class="text-sm"
              >
                <span class="font-medium">{{ $t(`filters.${group.label}`) }}:</span>
                <span class="text-muted ml-1">
                  {{ formatEnabledExtensions(group.extensions) || $t('vault.noExtensions') }}
                </span>
              </div>
              <div
                v-if="vault?.filters === undefined"
                class="text-xs text-muted mt-1"
              >
                {{ $t('vault.fromVaultFile') }}
              </div>
              <div
                v-else
                class="text-xs text-muted mt-1"
              >
                {{ $t('vault.customValue') }}
              </div>
            </template>
            <template v-else>
              <div
                v-for="group in editFilters.groups"
                :key="group.label"
                class="space-y-2"
              >
                <UCheckbox
                  :label="$t(`filters.${group.label}`)"
                  :model-value="group.enabled"
                  @update:model-value="(v: boolean | 'indeterminate') => { if (typeof v === 'boolean') group.enabled = v }"
                />
                <div
                  v-if="group.enabled"
                  class="flex flex-wrap gap-2 ml-6"
                >
                  <UCheckbox
                    v-for="ext in group.extensions"
                    :key="ext.ext"
                    :label="`.${ext.ext}`"
                    :model-value="ext.enabled"
                    @update:model-value="(v: boolean | 'indeterminate') => { if (typeof v === 'boolean') ext.enabled = v }"
                  />
                </div>
                <div
                  v-if="group.editable && group.enabled"
                  class="flex items-center gap-2 ml-6"
                >
                  <UInput
                    v-model="newCustomExt"
                    :placeholder="$t('vault.addCustomExtension')"
                    size="xs"
                    class="w-36"
                    @keydown.enter="addCustomExtension(group)"
                  />
                  <UButton
                    icon="i-lucide-plus"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    @click="addCustomExtension(group)"
                  />
                </div>
              </div>
              <UButton
                size="xs"
                color="neutral"
                variant="link"
                :label="$t('vault.resetToFileDefaults')"
                @click="editingFilters = false; editFilters = JSON.parse(JSON.stringify(vaults.getEffectiveFilters(vault!)))"
              />
            </template>
          </div>

          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <h4 class="text-sm font-semibold text-muted uppercase tracking-wide">
                {{ $t('vault.excludes') }}
              </h4>
              <UButton
                v-if="!editingExcludes"
                size="xs"
                color="neutral"
                variant="ghost"
                :label="$t('vault.edit')"
                @click="editingExcludes = true"
              />
            </div>
            <template v-if="!editingExcludes">
              <p
                v-if="editExcludes.length === 0"
                class="text-sm text-muted"
              >
                {{ $t('vault.noExcludes') }}
              </p>
              <div
                v-else
                class="space-y-1"
              >
                <div
                  v-for="item in editExcludes"
                  :key="item"
                  class="font-mono text-xs bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded"
                >
                  {{ item }}
                </div>
              </div>
              <div
                v-if="vault?.excludes === undefined"
                class="text-xs text-muted mt-1"
              >
                {{ $t('vault.fromVaultFile') }}
              </div>
              <div
                v-else
                class="text-xs text-muted mt-1"
              >
                {{ $t('vault.customValue') }}
              </div>
            </template>
            <template v-else>
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
                v-if="editExcludes.length > 0"
                class="space-y-1"
              >
                <div
                  v-for="(item, idx) in editExcludes"
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
              <UButton
                size="xs"
                color="neutral"
                variant="link"
                :label="$t('vault.resetToFileDefaults')"
                @click="editingExcludes = false; editExcludes = [...vaults.getEffectiveExcludes(vault!)]"
              />
            </template>
          </div>

          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <h4 class="text-sm font-semibold text-muted uppercase tracking-wide">
                {{ $t('vault.mediaDir') }}
              </h4>
              <UButton
                v-if="!editingMediaDir"
                size="xs"
                color="neutral"
                variant="ghost"
                :label="$t('vault.edit')"
                @click="editingMediaDir = true"
              />
            </div>
            <template v-if="!editingMediaDir">
              <div class="space-y-1 text-sm">
                <div>
                  <span class="font-medium">{{ $t('vault.mediaMode') }}:</span>
                  <span class="text-muted ml-1">
                    {{ mediaModeItems.find((item) => item.value === editMediaMode)?.label }}
                  </span>
                </div>
                <div v-if="editMediaMode !== 'adjacent'">
                  <span class="font-medium">{{ $t('vault.mediaFolder') }}:</span>
                  <span class="font-mono text-xs bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded ml-1">
                    {{ editMediaFolder }}
                  </span>
                </div>
                <div>
                  <span class="font-medium">{{ $t('vault.mediaNaming') }}:</span>
                  <span class="text-muted ml-1">
                    {{ mediaNamingItems.find((item) => item.value === editMediaNaming)?.label }}
                  </span>
                </div>
              </div>
              <div
                v-if="vault?.mediaDir === undefined"
                class="text-xs text-muted mt-1"
              >
                {{ $t('vault.fromVaultFile') }}
              </div>
              <div
                v-else
                class="text-xs text-muted mt-1"
              >
                {{ $t('vault.customValue') }}
              </div>
            </template>
            <template v-else>
              <UFormField :label="$t('vault.mediaMode')">
                <ButtonGroupToggle
                  v-model="editMediaMode"
                  :items="mediaModeItems"
                />
              </UFormField>
              <UFormField
                v-if="editMediaMode !== 'adjacent'"
                :label="$t('vault.mediaFolder')"
                :hint="editMediaMode === 'global-folder' ? $t('vault.mediaGlobalFolderHint') : $t('vault.mediaAdjacentFolderHint')"
              >
                <UInput v-model="editMediaFolder" />
              </UFormField>
              <UFormField :label="$t('vault.mediaNaming')">
                <ButtonGroupToggle
                  v-model="editMediaNaming"
                  :items="mediaNamingItems"
                />
              </UFormField>
              <UButton
                size="xs"
                color="neutral"
                variant="link"
                :label="$t('vault.resetToFileDefaults')"
                @click="() => { const mediaDir = vaults.getEffectiveMediaDir(vault!); editingMediaDir = false; editMediaMode = mediaDir.mode; editMediaFolder = mediaDir.folder ?? 'media'; editMediaNaming = mediaDir.naming }"
              />
            </template>
          </div>

          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <h4 class="text-sm font-semibold text-muted uppercase tracking-wide">
                {{ $t('vault.autoConvert', 'Auto-convert images') }}
              </h4>
              <UButton
                v-if="!editingAutoConvert"
                size="xs"
                color="neutral"
                variant="ghost"
                :label="$t('vault.edit')"
                @click="editingAutoConvert = true"
              />
            </div>
            <template v-if="!editingAutoConvert">
              <div class="space-y-1 text-sm">
                <div>
                  <span class="font-medium">{{ $t('vault.enabled') }}:</span>
                  <span class="text-muted ml-1">
                    {{ editAutoConvertEnabled ? $t('vault.yes') : $t('vault.no') }}
                  </span>
                </div>
                <div v-if="editAutoConvertEnabled">
                  <span class="font-medium">{{ $t('convertImage.format') }}:</span>
                  <span class="text-muted ml-1 uppercase">{{ editAutoConvertFormat }}</span>
                </div>
              </div>
              <div
                v-if="vault?.autoConvert === undefined"
                class="text-xs text-muted mt-1"
              >
                {{ $t('vault.fromVaultFile') }}
              </div>
              <div
                v-else
                class="text-xs text-muted mt-1"
              >
                {{ $t('vault.customValue') }}
              </div>
            </template>
            <template v-else>
              <UCheckbox
                v-model="editAutoConvertEnabled"
                :label="$t('vault.autoConvertEnabled', 'Auto-convert uploaded images')"
              />
              <template v-if="editAutoConvertEnabled">
                <UFormField :label="$t('convertImage.format')">
                  <URadioGroup
                    v-model="editAutoConvertFormat"
                    :items="autoConvertFormatItems"
                  />
                </UFormField>
                <UFormField
                  v-if="editAutoConvertFormat !== 'png'"
                  :label="$t('convertImage.quality')"
                >
                  <div class="flex items-center gap-3">
                    <USlider
                      v-model="editAutoConvertQuality"
                      :min="0.1"
                      :max="1"
                      :step="0.05"
                      class="flex-1"
                    />
                    <span class="text-sm text-muted w-12 text-right">{{ Math.round(editAutoConvertQuality * 100) }}%</span>
                  </div>
                </UFormField>
                <UFormField :label="$t('convertImage.maxDimension')">
                  <UInput
                    v-model="editAutoConvertMaxDimension"
                    type="number"
                    :min="1"
                    :placeholder="$t('convertImage.maxDimensionPlaceholder')"
                  />
                </UFormField>
                <UCheckbox
                  v-model="editAutoConvertPreserveTransparency"
                  :label="$t('convertImage.preserveTransparency')"
                />
                <UFormField
                  v-if="!editAutoConvertPreserveTransparency || editAutoConvertFormat === 'jpeg'"
                  :label="$t('convertImage.backgroundColor')"
                >
                  <UInput
                    v-model="editAutoConvertBackgroundColor"
                    type="text"
                    :placeholder="$t('convertImage.backgroundColorPlaceholder')"
                  />
                </UFormField>
              </template>
              <UButton
                size="xs"
                color="neutral"
                variant="link"
                :label="$t('vault.resetToFileDefaults')"
                @click="resetAutoConvertOverride"
              />
            </template>
          </div>
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
