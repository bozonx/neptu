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
const editCommitMode = ref<GitCommitMode>('respect_config')
const editCommitDebounceSec = ref(5)
const editingCommitDebounce = ref(false)
const editFilters = ref(JSON.parse(JSON.stringify(DEFAULT_FILE_FILTERS)))
const editContentType = ref<ContentType>('vault')
const editContentFolder = ref('src')
const editSiteLangMode = ref<SiteLangMode>('monolingual')
const editExcludes = ref<string[]>([])
const newExclude = ref('')
const newCustomExt = ref('')
const showNameInput = ref(false)
const changeTypeConfirmOpen = ref(false)
const pendingContentType = ref<ContentType | null>(null)

const editingContentFolder = ref(false)
const editingFilters = ref(false)
const editingExcludes = ref(false)

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
    editContentType.value = vault.contentType ?? 'vault'
    editSiteLangMode.value = vault.siteLangMode ?? 'monolingual'

    // Initialize from effective values (may come from .neptu-vault.yaml or Vault overrides)
    editFilters.value = JSON.parse(JSON.stringify(vaults.getEffectiveFilters(vault)))
    editingFilters.value = vault.filters !== undefined

    editContentFolder.value = vaults.getEffectiveContentFolder(vault) ?? 'src'
    editingContentFolder.value = vault.contentFolder !== undefined

    editExcludes.value = [...vaults.getEffectiveExcludes(vault)]
    editingExcludes.value = vault.excludes !== undefined

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
            ...(editingCommitDebounce.value ? { commitDebounceMs: Math.max(1000, Math.round(editCommitDebounceSec.value * 1000)) } : {}),
          }
        : undefined,
      filters: editingFilters.value ? editFilters.value : null as never,
      contentType: editContentType.value,
      contentFolder: editingContentFolder.value ? (editContentFolder.value || undefined) : null as never,
      siteLangMode: editContentType.value === 'custom' ? editSiteLangMode.value : undefined,
      excludes: editingExcludes.value ? editExcludes.value : null as never,
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
  [editVaultName, editVaultPath, editCommitMode, editCommitDebounceSec, editFilters, editContentType, editContentFolder, editSiteLangMode, editExcludes, editingContentFolder, editingFilters, editingExcludes, editingCommitDebounce],
  () => {
    if (skipNextWatch || !open.value) return
    debouncedSave()
  },
  { deep: true },
)

watch(open, (val) => {
  if (!val) emit('close')
})

watch(editContentType, (newVal, oldVal) => {
  if (skipNextWatch || !open.value || !props.vault || newVal === oldVal) return
  if (newVal !== props.vault.contentType) {
    pendingContentType.value = newVal
    skipNextWatch = true
    editContentType.value = oldVal
    nextTick(() => {
      skipNextWatch = false
    })
    changeTypeConfirmOpen.value = true
  }
})

async function confirmChangeType() {
  if (!props.vault || !pendingContentType.value) return
  try {
    await vaults.changeVaultType(props.vault, pendingContentType.value)
    skipNextWatch = true
    editContentType.value = pendingContentType.value
    nextTick(() => {
      skipNextWatch = false
    })
    changeTypeConfirmOpen.value = false
    pendingContentType.value = null
    toast.add({ title: t('vault.typeChanged'), color: 'success' })
  }
  catch (error) {
    toast.add({ title: t('vault.typeChangeFailed'), description: String(error), color: 'error' })
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

const contentTypeItems = [
  { label: t('vault.contentTypeVault'), value: 'vault' as const },
  { label: t('vault.contentTypeBlog'), value: 'blog' as const },
  { label: t('vault.contentTypeSiteLanding'), value: 'site' as const },
  { label: t('vault.contentTypeCustom'), value: 'custom' as const },
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

          <template v-if="editContentType === 'custom'">
            <p class="text-xs text-muted">
              {{ $t('vault.contentTypeCustomDesc') }}
            </p>
            <UFormField :label="$t('vault.siteLangMode')">
              <URadioGroup
                v-model="editSiteLangMode"
                :items="siteLangModeItems"
              />
            </UFormField>
          </template>
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
                  {{ vaults.getEffectiveContentFolder(vault!) ?? 'src' }}
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
                <UInput v-model="editContentFolder" />
              </UFormField>
              <UButton
                size="xs"
                color="neutral"
                variant="link"
                :label="$t('vault.resetToFileDefaults')"
                @click="editingContentFolder = false; editContentFolder = vaults.getEffectiveContentFolder(vault!) ?? 'src'"
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

  <UModal
    v-model:open="changeTypeConfirmOpen"
    :title="$t('vault.changeTypeTitle')"
  >
    <template #body>
      <p class="text-sm">
        {{ $t('vault.changeTypeConfirm', { name: vault?.name }) }}
      </p>
      <p class="text-xs text-muted mt-1">
        {{ $t('vault.changeTypeHint') }}
      </p>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          color="neutral"
          variant="ghost"
          :label="$t('vault.cancel')"
          @click="changeTypeConfirmOpen = false; pendingContentType = null"
        />
        <UButton
          :label="$t('vault.change')"
          @click="confirmChangeType"
        />
      </div>
    </template>
  </UModal>
</template>
