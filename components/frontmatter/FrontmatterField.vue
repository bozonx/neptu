<script setup lang="ts">
import type { Component } from 'vue'
import type { FieldSchema } from '~/types/vault-config'
import FrontmatterText from './FrontmatterText.vue'
import FrontmatterTextarea from './FrontmatterTextarea.vue'
import FrontmatterNumber from './FrontmatterNumber.vue'
import FrontmatterSelect from './FrontmatterSelect.vue'
import FrontmatterMultiSelect from './FrontmatterMultiSelect.vue'
import FrontmatterCheckbox from './FrontmatterCheckbox.vue'
import FrontmatterRadio from './FrontmatterRadio.vue'
import FrontmatterImage from './FrontmatterImage.vue'
import FrontmatterFile from './FrontmatterFile.vue'
import FrontmatterDate from './FrontmatterDate.vue'
import FrontmatterDateTime from './FrontmatterDateTime.vue'

const props = defineProps<{
  field: FieldSchema
  modelValue: unknown
}>()

const emit = defineEmits<{
  'update:modelValue': [unknown]
}>()

const componentMap: Record<string, Component> = {
  'text': FrontmatterText,
  'textarea': FrontmatterTextarea,
  'number': FrontmatterNumber,
  'select': FrontmatterSelect,
  'multi-select': FrontmatterMultiSelect,
  'checkbox': FrontmatterCheckbox,
  'radio': FrontmatterRadio,
  'image': FrontmatterImage,
  'file': FrontmatterFile,
  'date': FrontmatterDate,
  'datetime': FrontmatterDateTime,
}

const comp = computed(() => componentMap[props.field.type])
</script>

<template>
  <component
    :is="comp"
    v-if="comp"
    :field="field"
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <div
    v-else
    class="text-red-500 text-xs"
  >
    Unknown field type: {{ field.type }}
  </div>
</template>
