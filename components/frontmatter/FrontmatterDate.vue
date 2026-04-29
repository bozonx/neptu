<script setup lang="ts">
import type { DateFieldSchema } from '~/types/vault-config'

const props = defineProps<{
  field: DateFieldSchema
  modelValue: unknown
}>()

const emit = defineEmits<{
  'update:modelValue': [unknown]
}>()

const value = computed({
  get: () => (props.modelValue as string | undefined) ?? '',
  set: (v: string) => emit('update:modelValue', v || undefined),
})
</script>

<template>
  <UFormField
    :label="field.label"
    :required="field.required"
  >
    <UInput
      v-model="value"
      type="date"
      size="sm"
      class="w-full"
      :min="field.min"
      :max="field.max"
    />
  </UFormField>
</template>
