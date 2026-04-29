<script setup lang="ts">
import type { NumberFieldSchema } from '~/types/vault-config'

const props = defineProps<{
  field: NumberFieldSchema
  modelValue: unknown
}>()

const emit = defineEmits<{
  'update:modelValue': [unknown]
}>()

const value = computed({
  get: () => {
    const v = props.modelValue
    if (v === undefined || v === null || v === '') return undefined
    return Number(v)
  },
  set: (v: number | undefined) => emit('update:modelValue', v),
})
</script>

<template>
  <UFormField
    :label="field.label"
    :required="field.required"
  >
    <UInput
      v-model="value"
      type="number"
      size="sm"
      class="w-full"
      :min="field.min"
      :max="field.max"
      :step="field.step"
    />
  </UFormField>
</template>
