<script setup lang="ts">
import type { ConvertibleImageFormat } from '~/types'

interface RadioItem<T extends string = string> {
  label: string
  value: T
}

defineProps<{
  hasOverride: boolean
  formatItems: RadioItem<ConvertibleImageFormat>[]
}>()

const emit = defineEmits<{
  (e: 'reset'): void
}>()

const editing = defineModel<boolean>('editing', { required: true })
const enabled = defineModel<boolean>('enabled', { required: true })
const format = defineModel<ConvertibleImageFormat>('format', { required: true })
const quality = defineModel<number>('quality', { required: true })
const maxDimension = defineModel<number | undefined>('maxDimension', { required: true })
const preserveTransparency = defineModel<boolean>('preserveTransparency', { required: true })
const backgroundColor = defineModel<string>('backgroundColor', { required: true })
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <h4 class="text-sm font-semibold text-muted uppercase tracking-wide">
        {{ $t('vault.autoConvert', 'Auto-convert images') }}
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
          <span class="font-medium">{{ $t('vault.enabled') }}:</span>
          <span class="text-muted ml-1">
            {{ enabled ? $t('vault.yes') : $t('vault.no') }}
          </span>
        </div>
        <div v-if="enabled">
          <span class="font-medium">{{ $t('convertImage.format') }}:</span>
          <span class="text-muted ml-1 uppercase">{{ format }}</span>
        </div>
      </div>
      <div class="text-xs text-muted mt-1">
        {{ hasOverride ? $t('vault.customValue') : $t('vault.fromVaultFile') }}
      </div>
    </template>
    <template v-else>
      <UCheckbox
        v-model="enabled"
        :label="$t('vault.autoConvertEnabled', 'Auto-convert uploaded images')"
      />
      <template v-if="enabled">
        <ImageConvertOptionsForm
          v-model:format="format"
          v-model:quality="quality"
          v-model:max-dimension="maxDimension"
          v-model:preserve-transparency="preserveTransparency"
          v-model:background-color="backgroundColor"
          :format-items="formatItems"
        />
      </template>
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
