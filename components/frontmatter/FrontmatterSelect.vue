<script setup lang="ts">
import type { SelectFieldSchema } from '~/types/vault-config'

const props = defineProps<{
  field: SelectFieldSchema
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
    <USelect
      v-model="value"
      :items="field.options"
      size="sm"
      class="w-full"
    />
  </UFormField>
</template>
