<script setup lang="ts">
import type { TextFieldSchema } from '~/types/vault-config'

const props = defineProps<{
  field: TextFieldSchema
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
      type="text"
      size="sm"
      class="w-full"
    />
  </UFormField>
</template>
