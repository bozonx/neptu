<script setup lang="ts">
import type { DateTimeFieldSchema } from '~/types/vault-config'

const props = defineProps<{
  field: DateTimeFieldSchema
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
      type="datetime-local"
      size="sm"
      class="w-full"
      :min="field.min"
      :max="field.max"
    />
  </UFormField>
</template>
