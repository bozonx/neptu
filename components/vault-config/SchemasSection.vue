<script setup lang="ts">
import type { Schema } from '~/types/vault-config'
import SchemaItem from './SchemaItem.vue'

const schemas = defineModel<Schema[] | undefined>({ required: true })
const { t } = useI18n()

function addSchema() {
  if (!schemas.value) schemas.value = []
  schemas.value.push({ glob: '', fields: [] })
}

function removeSchema(idx: number) {
  if (!schemas.value) return
  schemas.value.splice(idx, 1)
  if (schemas.value.length === 0) schemas.value = undefined
}

function updateSchema(idx: number, value: Schema) {
  if (!schemas.value) return
  schemas.value.splice(idx, 1, value)
}
</script>

<template>
  <div class="space-y-3">
    <h3 class="text-sm font-semibold text-muted uppercase tracking-wide">
      {{ t('vault.schemas') }}
    </h3>
    <p class="text-xs text-muted">
      {{ t('vault.schemasHint') }}
    </p>

    <div
      v-if="!schemas || schemas.length === 0"
      class="text-sm text-muted text-center py-4 border border-dashed border-default rounded-md"
    >
      {{ t('vault.noSchemas') }}
    </div>

    <div
      v-else
      class="space-y-3"
    >
      <SchemaItem
        v-for="(schema, i) in schemas"
        :key="i"
        :model-value="schema"
        :index="i"
        @update:model-value="updateSchema(i, $event)"
        @remove="removeSchema(i)"
      />
    </div>

    <UButton
      icon="i-lucide-plus"
      size="sm"
      color="neutral"
      variant="soft"
      block
      :label="t('vault.addSchema')"
      @click="addSchema"
    />
  </div>
</template>
