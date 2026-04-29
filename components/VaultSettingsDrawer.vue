<script setup lang="ts">
import { DEFAULT_FILE_FILTERS } from '~/types'
import type { ContentType, FileFilterGroup, GitCommitMode, SiteLangMode, Vault } from '~/types'

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
const toast = useToast()
const { t } = useI18n()

const editVaultName = ref('')
const editVaultPath = ref<string | null>(null)
const editCommitMode = ref<GitCommitMode>('auto')
const editCommitDebounceSec = ref(5)
const editFilters = ref(JSON.parse(JSON.stringify(DEFAULT_FILE_FILTERS)))
const editContentType = ref<ContentType>('vault')
const editContentFolder = ref('src')
const editUseCustomContentFolder = ref(false)
const editSiteLangMode = ref<SiteLangMode>('monolingual')
const editExcludes = ref<string[]>([])
const newExclude = ref('')
const newCustomExt = ref('')
const editFiltersOpen = ref(false)
const showNameInput = ref(false)

let skipNextWatch = false

watch(
  () => [open.value, props.vault] as const,
  ([isOpen, vault]) => {
    if (!isOpen || !vault) return
    skipNextWatch = true
    editVaultName.value = vault.name
    editVaultPath.value = vault.path
    editCommitMode.value = vault.git?.commitMode ?? 'auto'
    editCommitDebounceSec.value = (vault.git?.commitDebounceMs ?? settings.settings.defaultCommitDebounceMs) / 1000
    editFilters.value = vault.filters
      ? JSON.parse(JSON.stringify(vault.filters))
      : JSON.parse(JSON.stringify(DEFAULT_FILE_FILTERS))
    editContentType.value = vault.contentType ?? 'vault'
    const configRoot = vaults.vaultConfigs[vault.id]?.contentRoot
    editUseCustomContentFolder.value = vault.contentFolder !== undefined
    editContentFolder.value = vault.contentFolder ?? configRoot ?? 'src'
    editSiteLangMode.value = vault.siteLangMode ?? 'monolingual'
    editExcludes.value = vault.excludes ? [...vault.excludes] : []
    newExclude.value = ''
    newCustomExt.value = ''
    editFiltersOpen.value = false
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
    const path = await useFs().pickDirectory({ title: 'Select vault folder' })
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
            commitDebounceMs: Math.max(1000, Math.round(editCommitDebounceSec.value * 1000)),
          }
        : undefined,
      filters: editFilters.value,
      contentType: editContentType.value,
      contentFolder: editUseCustomContentFolder.value ? editContentFolder.value : undefined,
      siteLangMode: editContentType.value === 'site' ? editSiteLangMode.value : undefined,
      excludes: editExcludes.value,
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
  [editVaultName, editVaultPath, editCommitMode, editCommitDebounceSec, editFilters, editContentType, editUseCustomContentFolder, editContentFolder, editSiteLangMode, editExcludes],
  () => {
    if (skipNextWatch || !open.value) return
    debouncedSave()
  },
  { deep: true },
)

watch(open, (val) => {
  if (!val) emit('close')
})

const commitModeItems = [
  { label: t('vault.autoCommit'), value: 'auto' as const },
  { label: t('vault.manualCommit'), value: 'manual' as const },
]

const contentTypeItems = [
  { label: t('vault.contentTypeVault'), value: 'vault' as const },
  { label: t('vault.contentTypeBlog'), value: 'blog' as const },
  { label: t('vault.contentTypeSite'), value: 'site' as const },
]

const siteLangModeItems = [
  { label: t('vault.siteLangMonolingual'), value: 'monolingual' as const },
  { label: t('vault.siteLangMultilingual'), value: 'multilingual' as const },
]
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
            />
          </UFormField>
        </section>

        <template v-if="vault?.type === 'git'">
          <section class="space-y-3">
            <h3 class="text-sm font-semibold text-muted uppercase tracking-wide">
              {{ $t('settings.git') }}
            </h3>
            <UFormField :label="$t('vault.commitMode')">
              <URadioGroup
                v-model="editCommitMode"
                :items="commitModeItems"
              />
            </UFormField>
            <UFormField
              v-if="editCommitMode === 'auto'"
              :label="$t('vault.commitDebounce')"
            >
              <UInput
                v-model="editCommitDebounceSec"
                type="number"
                :min="1"
                :step="0.5"
              />
            </UFormField>
          </section>
        </template>

        <section class="space-y-3">
          <h3 class="text-sm font-semibold text-muted uppercase tracking-wide">
            {{ $t('vault.contentType') }}
          </h3>
          <UFormField :label="$t('vault.contentType')">
            <ButtonGroupToggle
              v-model="editContentType"
              :items="contentTypeItems"
            />
          </UFormField>

          <p
            v-if="editContentType === 'vault'"
            class="text-xs text-muted"
          >
            {{ $t('vault.contentTypeVaultDesc') }}
          </p>

          <template v-if="editContentType === 'blog'">
            <p class="text-xs text-muted">
              {{ $t('vault.contentTypeBlogDesc') }}
            </p>
          </template>

          <template v-if="editContentType === 'site'">
            <p class="text-xs text-muted">
              {{ $t('vault.contentTypeSiteDesc') }}
            </p>
            <UFormField :label="$t('vault.siteLangMode')">
              <URadioGroup
                v-model="editSiteLangMode"
                :items="siteLangModeItems"
              />
            </UFormField>
          </template>
        </section>

        <section class="space-y-3">
          <h3 class="text-sm font-semibold text-muted uppercase tracking-wide">
            {{ $t('vault.contentFolder') }}
          </h3>
          <UFormField>
            <UCheckbox
              v-model="editUseCustomContentFolder"
              :label="$t('vault.useCustomContentFolder')"
            />
          </UFormField>
          <UFormField
            :label="$t('vault.contentFolder')"
            :hint="$t('vault.contentFolderHint')"
          >
            <UInput
              v-model="editContentFolder"
              :disabled="!editUseCustomContentFolder"
            />
          </UFormField>
        </section>

        <section class="space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-muted uppercase tracking-wide">
              {{ $t('vault.fileFilters') }}
            </h3>
            <UButton
              v-if="!editFiltersOpen"
              size="xs"
              color="neutral"
              variant="ghost"
              :label="$t('vault.editFilters')"
              @click="editFiltersOpen = true"
            />
          </div>
          <template v-if="!editFiltersOpen">
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
          </template>
        </section>

        <section class="space-y-3">
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

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          color="neutral"
          variant="ghost"
          :label="$t('settings.close')"
          @click="open = false"
        />
      </div>
    </template>
  </USlideover>
</template>
