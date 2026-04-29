<script setup lang="ts">
import type { RadioFieldSchema } from '~/types/vault-config'

const props = defineProps<{
  field: RadioFieldSchema
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
    <URadioGroup
      v-model="value"
      :items="field.options"
      size="sm"
    />
  </UFormField>
</template>
