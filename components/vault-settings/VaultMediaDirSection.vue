<script setup lang="ts">
import type { MediaNamingMode, MediaUploadMode } from '~/types'

interface ToggleItem<T extends string = string> {
  label: string
  value: T
}

defineProps<{
  hasOverride: boolean
  mediaModeItems: ToggleItem<MediaUploadMode>[]
  mediaNamingItems: ToggleItem<MediaNamingMode>[]
}>()

const emit = defineEmits<{
  (e: 'reset'): void
}>()

const editing = defineModel<boolean>('editing', { required: true })
const mode = defineModel<MediaUploadMode>('mode', { required: true })
const folder = defineModel<string>('folder', { required: true })
const naming = defineModel<MediaNamingMode>('naming', { required: true })
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <h4 class="text-sm font-semibold text-muted uppercase tracking-wide">
        {{ $t('vault.mediaDir') }}
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
      <div class="space-y-1 text-sm">
        <div>
          <span class="font-medium">{{ $t('vault.mediaMode') }}:</span>
          <span class="text-muted ml-1">
            {{ mediaModeItems.find((item) => item.value === mode)?.label }}
          </span>
        </div>
        <div v-if="mode !== 'adjacent'">
          <span class="font-medium">{{ $t('vault.mediaFolder') }}:</span>
          <span class="font-mono text-xs bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded ml-1">
            {{ folder }}
          </span>
        </div>
        <div>
          <span class="font-medium">{{ $t('vault.mediaNaming') }}:</span>
          <span class="text-muted ml-1">
            {{ mediaNamingItems.find((item) => item.value === naming)?.label }}
          </span>
        </div>
      </div>
      <div class="text-xs text-muted mt-1">
        {{ hasOverride ? $t('vault.customValue') : $t('vault.fromVaultFile') }}
      </div>
    </template>
    <template v-else>
      <UFormField :label="$t('vault.mediaMode')">
        <ButtonGroupToggle
          v-model="mode"
          :items="mediaModeItems"
        />
      </UFormField>
      <UFormField
        v-if="mode !== 'adjacent'"
        :label="$t('vault.mediaFolder')"
        :hint="mode === 'global-folder' ? $t('vault.mediaGlobalFolderHint') : $t('vault.mediaAdjacentFolderHint')"
      >
        <UInput v-model="folder" />
      </UFormField>
      <UFormField :label="$t('vault.mediaNaming')">
        <ButtonGroupToggle
          v-model="naming"
          :items="mediaNamingItems"
        />
      </UFormField>
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
