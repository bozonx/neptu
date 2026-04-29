<script setup lang="ts">
import type { ImageFieldSchema } from '~/types/vault-config'

const props = defineProps<{
  field: ImageFieldSchema
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
      :placeholder="field.accept ? field.accept.join(', ') : undefined"
    />
  </UFormField>
</template>
