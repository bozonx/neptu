<script setup lang="ts">
import type { CheckboxFieldSchema } from '~/types/vault-config'

const props = defineProps<{
  field: CheckboxFieldSchema
  modelValue: unknown
}>()

const emit = defineEmits<{
  'update:modelValue': [unknown]
}>()

const value = computed({
  get: () => Boolean(props.modelValue),
  set: (v: boolean) => emit('update:modelValue', v),
})
</script>

<template>
  <div class="flex items-center gap-2 py-1">
    <UCheckbox
      v-model="value"
      :label="field.label"
      :required="field.required"
    />
  </div>
</template>
