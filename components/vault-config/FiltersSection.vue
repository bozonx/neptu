<script setup lang="ts">
import type { FileFilterSettings, FileFilterGroup } from '~/types'
import { DEFAULT_FILE_FILTERS } from '~/types'

const filters = defineModel<FileFilterSettings | undefined>({ required: true })
const { t } = useI18n()

const newExt = ref<Record<string, string>>({})

function ensureFilters(): FileFilterSettings {
  if (!filters.value) {
    filters.value = JSON.parse(JSON.stringify(DEFAULT_FILE_FILTERS)) as FileFilterSettings
  }
  return filters.value
}

function resetToDefaults() {
  filters.value = JSON.parse(JSON.stringify(DEFAULT_FILE_FILTERS)) as FileFilterSettings
}

function clearFilters() {
  filters.value = undefined
}

function setGroupEnabled(group: FileFilterGroup, v: boolean | 'indeterminate') {
  group.enabled = v === true
}

function setExtEnabled(ext: { ext: string, enabled: boolean }, v: boolean | 'indeterminate') {
  ext.enabled = v === true
}

function addExtension(group: FileFilterGroup) {
  const raw = (newExt.value[group.label] || '').trim().toLowerCase().replace(/^\.+/, '')
  if (!raw) return
  if (!group.extensions.some((e) => e.ext === raw)) {
    group.extensions.push({ ext: raw, enabled: true })
  }
  newExt.value[group.label] = ''
}

function removeExtension(group: FileFilterGroup, idx: number) {
  group.extensions.splice(idx, 1)
}

function addGroup() {
  const f = ensureFilters()
  const label = `Custom ${f.groups.length + 1}`
  f.groups.push({
    label,
    enabled: true,
    editable: true,
    extensions: [],
  })
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold text-muted uppercase tracking-wide">
        {{ t('vault.fileFilters') }}
      </h3>
      <div class="flex items-center gap-1">
        <UButton
          v-if="!filters"
          size="xs"
          color="neutral"
          variant="ghost"
          :label="t('vault.edit')"
          @click="resetToDefaults"
        />
        <UButton
          v-else
          size="xs"
          color="neutral"
          variant="ghost"
          :label="t('vault.resetToFileDefaults')"
          @click="clearFilters"
        />
      </div>
    </div>
    <p class="text-xs text-muted">
      {{ t('vault.fileFiltersHint') }}
    </p>

    <div
      v-if="!filters"
      class="text-sm text-muted text-center py-4 border border-dashed border-default rounded-md"
    >
      {{ t('vault.fromVaultFile') }}
    </div>

    <div
      v-else
      class="space-y-4"
    >
      <div
        v-for="group in filters.groups"
        :key="group.label"
        class="border border-default rounded-md p-3 space-y-2"
      >
        <div class="flex items-center justify-between">
          <UCheckbox
            :model-value="group.enabled"
            :label="t(`filters.${group.label}`, group.label)"
            @update:model-value="(v: boolean | 'indeterminate') => setGroupEnabled(group, v)"
          />
          <UCheckbox
            :model-value="group.editable"
            :label="t('vault.filterGroupEditable')"
            @update:model-value="(v: boolean | 'indeterminate') => group.editable = v === true"
          />
        </div>

        <div class="flex flex-wrap gap-2 ml-1">
          <div
            v-for="(ext, i) in group.extensions"
            :key="ext.ext"
            class="flex items-center gap-1 bg-elevated/50 rounded px-2 py-1"
          >
            <UCheckbox
              :model-value="ext.enabled"
              :label="`.${ext.ext}`"
              @update:model-value="(v: boolean | 'indeterminate') => setExtEnabled(ext, v)"
            />
            <UButton
              v-if="group.editable"
              icon="i-lucide-x"
              size="xs"
              color="neutral"
              variant="ghost"
              @click="removeExtension(group, i)"
            />
          </div>
        </div>

        <div
          v-if="group.editable"
          class="flex items-center gap-2"
        >
          <UInput
            v-model="newExt[group.label]"
            :placeholder="t('vault.extensionPlaceholder')"
            size="sm"
            class="w-32"
            @keydown.enter="addExtension(group)"
          />
          <UButton
            icon="i-lucide-plus"
            size="xs"
            color="neutral"
            variant="ghost"
            :label="t('vault.addExtension')"
            @click="addExtension(group)"
          />
        </div>
      </div>

      <UButton
        icon="i-lucide-plus"
        size="sm"
        color="neutral"
        variant="soft"
        :label="t('vault.addFilterGroup')"
        @click="addGroup"
      />
    </div>
  </div>
</template>
