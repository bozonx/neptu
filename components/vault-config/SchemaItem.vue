<script setup lang="ts">
import type { Schema, FieldSchema } from '~/types/vault-config'
import FieldItem from './FieldItem.vue'

const props = defineProps<{
  modelValue: Schema
  index: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Schema]
  'remove': []
}>()

const { t } = useI18n()
const expanded = ref(true)

const schema = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

function addField() {
  schema.value.fields.push({
    key: '',
    type: 'text',
    label: '',
    required: false,
  })
}

function removeField(idx: number) {
  schema.value.fields.splice(idx, 1)
}

function updateField(idx: number, value: FieldSchema) {
  schema.value.fields.splice(idx, 1, value)
}
</script>

<template>
  <div class="border border-default rounded-lg bg-default">
    <div class="flex items-center gap-2 px-3 py-2 border-b border-default">
      <UButton
        :icon="expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
        size="xs"
        color="neutral"
        variant="ghost"
        @click="expanded = !expanded"
      />
      <span class="text-xs font-mono text-muted">#{{ index + 1 }}</span>
      <UInput
        v-model="schema.glob"
        :placeholder="t('vault.globPlaceholder')"
        class="flex-1"
        size="sm"
      />
      <span class="text-xs text-muted">
        {{ schema.fields.length }} {{ t('vault.fields') }}
      </span>
      <UButton
        icon="i-lucide-trash-2"
        size="xs"
        color="error"
        variant="ghost"
        :label="t('vault.removeSchema')"
        @click="emit('remove')"
      />
    </div>

    <div
      v-if="expanded"
      class="p-3 space-y-2"
    >
      <div
        v-if="schema.fields.length === 0"
        class="text-sm text-muted text-center py-4"
      >
        {{ t('vault.noFields', 'No fields yet') }}
      </div>
      <FieldItem
        v-for="(field, i) in schema.fields"
        :key="i"
        :model-value="field"
        :index="i"
        @update:model-value="updateField(i, $event)"
        @remove="removeField(i)"
      />
      <UButton
        icon="i-lucide-plus"
        size="sm"
        color="neutral"
        variant="soft"
        block
        :label="t('vault.addField')"
        @click="addField"
      />
    </div>
  </div>
</template>
