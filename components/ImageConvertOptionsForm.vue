<script setup lang="ts">
import type { ConvertibleImageFormat } from '~/types'

interface FormatItem {
  label: string
  value: ConvertibleImageFormat
}

const props = withDefaults(defineProps<{
  showEnabled?: boolean
  enabledLabel?: string
  formatItems?: FormatItem[]
}>(), {
  showEnabled: false,
  enabledLabel: undefined,
  formatItems: () => [
    { label: 'WebP', value: 'webp' },
    { label: 'PNG', value: 'png' },
    { label: 'JPEG', value: 'jpeg' },
  ],
})

const enabled = defineModel<boolean>('enabled', { default: true })
const format = defineModel<ConvertibleImageFormat>('format', { required: true })
const quality = defineModel<number>('quality', { required: true })
const maxDimension = defineModel<number | undefined>('maxDimension', { required: true })
const preserveTransparency = defineModel<boolean>('preserveTransparency', { required: true })
const backgroundColor = defineModel<string>('backgroundColor', { required: true })

const qualityValue = computed({
  get: () => quality.value ?? 0.85,
  set: (value: number) => {
    quality.value = value
  },
})

const showControls = computed(() => !props.showEnabled || enabled.value)
</script>

<template>
  <div class="space-y-4">
    <UCheckbox
      v-if="showEnabled"
      v-model="enabled"
      :label="enabledLabel ?? $t('vault.autoConvertEnabled')"
    />

    <template v-if="showControls">
      <UFormField :label="$t('convertImage.format')">
        <ButtonGroupToggle
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
            v-model="qualityValue"
            :min="0.1"
            :max="1"
            :step="0.05"
            class="flex-1"
          />
          <span class="text-sm text-muted w-12 text-right">
            {{ Math.round(qualityValue * 100) }}%
          </span>
        </div>
      </UFormField>

      <UFormField :label="$t('convertImage.maxDimension')">
        <UInput
          v-model.number="maxDimension"
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
          placeholder="#ffffff"
        />
      </UFormField>
    </template>
  </div>
</template>
