<script setup lang="ts">
import type { FileFilterGroup, FileFilterSettings } from '~/types'

defineProps<{
  hasOverride: boolean
}>()

const emit = defineEmits<{
  (e: 'reset'): void
}>()

const filters = defineModel<FileFilterSettings>('filters', { required: true })
const editing = defineModel<boolean>('editing', { required: true })
const newCustomExt = defineModel<string>('newCustomExt', { required: true })

function formatEnabledExtensions(extensions: { ext: string, enabled: boolean }[]): string {
  const enabled = extensions.filter((e) => e.enabled).map((e) => `.${e.ext}`)
  return enabled.join(', ')
}

function setGroupEnabled(group: FileFilterGroup, value: boolean | 'indeterminate') {
  if (typeof value === 'boolean') group.enabled = value
}

function setExtensionEnabled(extension: { enabled: boolean }, value: boolean | 'indeterminate') {
  if (typeof value === 'boolean') extension.enabled = value
}

function addCustomExtension(group: FileFilterGroup) {
  const raw = newCustomExt.value.trim().toLowerCase().replace(/^\.+/, '')
  if (!raw) return
  if (!group.extensions.some((e) => e.ext === raw)) {
    group.extensions.push({ ext: raw, enabled: true })
  }
  newCustomExt.value = ''
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <h4 class="text-sm font-semibold text-muted uppercase tracking-wide">
        {{ $t('vault.fileFilters') }}
      </h4>
      <UButton
        v-if="!editing"
        size="xs"
        color="neutral"
        variant="ghost"
        :label="$t('vault.edit')"
        @click="editing = true"
      />
    </div>
    <template v-if="!editing">
      <div
        v-for="group in filters.groups"
        :key="group.label"
        class="text-sm"
      >
        <span class="font-medium">{{ $t(`filters.${group.label}`) }}:</span>
        <span class="text-muted ml-1">
          {{ formatEnabledExtensions(group.extensions) || $t('vault.noExtensions') }}
        </span>
      </div>
      <div class="text-xs text-muted mt-1">
        {{ hasOverride ? $t('vault.customValue') : $t('vault.fromVaultFile') }}
      </div>
    </template>
    <template v-else>
      <div
        v-for="group in filters.groups"
        :key="group.label"
        class="space-y-2"
      >
        <UCheckbox
          :label="$t(`filters.${group.label}`)"
          :model-value="group.enabled"
          @update:model-value="setGroupEnabled(group, $event)"
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
            @update:model-value="setExtensionEnabled(ext, $event)"
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
        @click="emit('reset')"
      />
    </template>
  </div>
</template>
