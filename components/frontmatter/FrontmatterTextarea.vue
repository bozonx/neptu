<script setup lang="ts">
import type { TextareaFieldSchema } from '~/types/vault-config'

const props = defineProps<{
  field: TextareaFieldSchema
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
    <UTextarea
      v-model="value"
      :rows="field.rows ?? 4"
      size="sm"
      class="w-full"
    />
  </UFormField>
</template>
