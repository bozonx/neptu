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
  get() {
    const v = props.modelValue
    if (Array.isArray(v)) return v as string[]
    if (v === undefined || v === null) return []
    return [String(v)]
  },
  set(v: string[]) {
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
      v-model="value as any"
      :items="field.options"
      multiple
      size="sm"
      class="w-full"
    />
  </UFormField>
</template>
