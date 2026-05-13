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
        <UFormField :label="$t('convertImage.format')">
          <URadioGroup
            v-model="format"
            :items="formatItems"
          />
        </UFormField>
        <UFormField
          v-if="format !== 'png'"
          :label="$t('convertImage.quality')"
        >
          <div class="flex items-center gap-3">
            <USlider
              v-model="quality"
              :min="0.1"
              :max="1"
              :step="0.05"
              class="flex-1"
            />
            <span class="text-sm text-muted w-12 text-right">{{ Math.round(quality * 100) }}%</span>
          </div>
        </UFormField>
        <UFormField :label="$t('convertImage.maxDimension')">
          <UInput
            v-model="maxDimension"
            type="number"
            :min="1"
            :placeholder="$t('convertImage.maxDimensionPlaceholder')"
          />
        </UFormField>
        <UCheckbox
          v-model="preserveTransparency"
          :label="$t('convertImage.preserveTransparency')"
        />
        <UFormField
          v-if="!preserveTransparency || format === 'jpeg'"
          :label="$t('convertImage.backgroundColor')"
        >
          <UInput
            v-model="backgroundColor"
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
        @click="emit('reset')"
      />
    </template>
  </div>
</template>
