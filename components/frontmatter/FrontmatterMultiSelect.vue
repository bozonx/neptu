<script setup lang="ts">
import type { MultiSelectFieldSchema } from '~/types/vault-config'

const props = defineProps<{
  field: MultiSelectFieldSchema
  modelValue: unknown
}>()

const emit = defineEmits<{
  'update:modelValue': [unknown]
}>()

const value = computed({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(): any {
    const v = props.modelValue
    if (Array.isArray(v)) return v
    if (v === undefined || v === null) return []
    return [String(v)]
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set(v: any) {
    emit('update:modelValue', v.length ? v : undefined)
  },
})
</script>

<template>
  <UFormField
    :label="field.label"
    :required="field.required"
  >
    <USelectMenu
      v-model="value"
      :items="field.options"
      multiple
      size="sm"
      class="w-full"
    />
  </UFormField>
</template>
