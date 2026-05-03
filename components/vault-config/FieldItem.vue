<script setup lang="ts">
import type { FieldSchema, SelectOption } from '~/types/vault-config'

const props = defineProps<{
  modelValue: FieldSchema
  index: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: FieldSchema]
  'remove': []
}>()

const { t } = useI18n()
const expanded = ref(false)

const fieldTypeItems = computed(() => [
  { label: t('vault.fieldTypes.text'), value: 'text' },
  { label: t('vault.fieldTypes.textarea'), value: 'textarea' },
  { label: t('vault.fieldTypes.number'), value: 'number' },
  { label: t('vault.fieldTypes.select'), value: 'select' },
  { label: t('vault.fieldTypes.multi-select'), value: 'multi-select' },
  { label: t('vault.fieldTypes.checkbox'), value: 'checkbox' },
  { label: t('vault.fieldTypes.radio'), value: 'radio' },
  { label: t('vault.fieldTypes.image'), value: 'image' },
  { label: t('vault.fieldTypes.file'), value: 'file' },
  { label: t('vault.fieldTypes.date'), value: 'date' },
  { label: t('vault.fieldTypes.datetime'), value: 'datetime' },
])

/**
 * Loosen the union to a record so the template can read/write type-specific
 * properties without exhaustive narrowing.
 */
const field = computed<Record<string, unknown> & FieldSchema>({
  get: () => props.modelValue as Record<string, unknown> & FieldSchema,
  set: (v) => emit('update:modelValue', v as FieldSchema),
})

/**
 * Replace the entire field object when the type changes so that type-specific
 * properties from the previous variant don't leak into the new one.
 */
function changeType(next: string) {
  const base = {
    key: field.value.key,
    label: field.value.label,
    required: field.value.required,
    default: field.value.default,
  }
  switch (next) {
    case 'text':
      field.value = { ...base, type: 'text' }
      break
    case 'textarea':
      field.value = { ...base, type: 'textarea' }
      break
    case 'number':
      field.value = { ...base, type: 'number' }
      break
    case 'select':
      field.value = { ...base, type: 'select', options: [] }
      break
    case 'multi-select':
      field.value = { ...base, type: 'multi-select', options: [] }
      break
    case 'radio':
      field.value = { ...base, type: 'radio', options: [] }
      break
    case 'checkbox':
      field.value = { ...base, type: 'checkbox' }
      break
    case 'image':
      field.value = { ...base, type: 'image' }
      break
    case 'file':
      field.value = { ...base, type: 'file' }
      break
    case 'date':
      field.value = { ...base, type: 'date' }
      break
    case 'datetime':
      field.value = { ...base, type: 'datetime' }
      break
  }
}

function setRequired(v: boolean | 'indeterminate') {
  field.value = { ...field.value, required: v === true }
}

const hasOptions = computed(() => ['select', 'multi-select', 'radio'].includes(field.value.type))

const fieldOptions = computed<SelectOption[]>(() => {
  const f = field.value as { options?: SelectOption[] }
  return f.options ?? []
})

function addOption() {
  if (!hasOptions.value) return
  const f = field.value as { options?: SelectOption[] }
  if (!f.options) f.options = []
  f.options.push({ label: '', value: '' })
}

function removeOption(idx: number) {
  const f = field.value as { options?: SelectOption[] }
  if (!f.options) return
  f.options.splice(idx, 1)
}

function getAcceptString(): string {
  const f = field.value as { accept?: string[] }
  return (f.accept ?? []).join(', ')
}

function setAcceptString(raw: string) {
  const list = raw.split(',').map((s) => s.trim().replace(/^\.+/, '').toLowerCase()).filter(Boolean)
  const f = field.value as { accept?: string[] }
  if (list.length === 0) {
    delete f.accept
  }
  else {
    f.accept = list
  }
}
</script>

<template>
  <div class="border border-default rounded-md">
    <div class="flex items-center gap-2 px-3 py-2">
      <UButton
        :icon="expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
        size="xs"
        color="neutral"
        variant="ghost"
        @click="expanded = !expanded"
      />
      <span class="text-xs font-mono text-muted">#{{ index + 1 }}</span>
      <span class="text-sm font-medium truncate">
        {{ field.label || field.key || t('vault.unnamedField', 'Unnamed') }}
      </span>
      <span class="text-xs text-muted">({{ t(`vault.fieldTypes.${field.type}`) }})</span>
      <span
        v-if="field.required"
        class="text-xs text-error"
      >*</span>
      <div class="flex-1" />
      <UButton
        icon="i-lucide-trash-2"
        size="xs"
        color="error"
        variant="ghost"
        @click="emit('remove')"
      />
    </div>

    <div
      v-if="expanded"
      class="px-3 pb-3 pt-1 space-y-3 border-t border-default"
    >
      <div class="grid grid-cols-2 gap-3">
        <UFormField :label="t('vault.fieldKey')">
          <UInput
            v-model="field.key"
            :placeholder="t('vault.fieldKeyPlaceholder')"
          />
        </UFormField>
        <UFormField :label="t('vault.fieldLabel')">
          <UInput v-model="field.label" />
        </UFormField>
      </div>

      <UFormField :label="t('vault.fieldType')">
        <USelect
          :model-value="field.type"
          :items="fieldTypeItems"
          @update:model-value="(v: string) => changeType(v)"
        />
      </UFormField>

      <UCheckbox
        :model-value="field.required ?? false"
        :label="t('vault.fieldRequired')"
        @update:model-value="setRequired"
      />

      <!-- text / textarea -->
      <template v-if="field.type === 'text' || field.type === 'textarea'">
        <UFormField :label="t('vault.fieldDefault')">
          <UInput
            :model-value="(field.default as string | undefined) ?? ''"
            @update:model-value="(v: string | number) => field.default = String(v)"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField :label="t('vault.fieldMinLength')">
            <UInput
              v-model.number="field.minLength"
              type="number"
              :min="0"
            />
          </UFormField>
          <UFormField :label="t('vault.fieldMaxLength')">
            <UInput
              v-model.number="field.maxLength"
              type="number"
              :min="0"
            />
          </UFormField>
        </div>
        <UFormField
          v-if="field.type === 'text'"
          :label="t('vault.fieldPattern')"
        >
          <UInput
            v-model="field.pattern"
            placeholder="^[a-z0-9-]+$"
          />
        </UFormField>
        <UFormField
          v-if="field.type === 'textarea'"
          :label="t('vault.fieldRows')"
        >
          <UInput
            v-model.number="field.rows"
            type="number"
            :min="1"
          />
        </UFormField>
      </template>

      <!-- number -->
      <template v-if="field.type === 'number'">
        <UFormField :label="t('vault.fieldDefault')">
          <UInput
            v-model.number="field.default as number | undefined"
            type="number"
          />
        </UFormField>
        <div class="grid grid-cols-3 gap-3">
          <UFormField :label="t('vault.fieldMin')">
            <UInput
              v-model.number="field.min"
              type="number"
            />
          </UFormField>
          <UFormField :label="t('vault.fieldMax')">
            <UInput
              v-model.number="field.max"
              type="number"
            />
          </UFormField>
          <UFormField :label="t('vault.fieldStep')">
            <UInput
              v-model.number="field.step"
              type="number"
            />
          </UFormField>
        </div>
        <UCheckbox
          :model-value="field.integer ?? false"
          :label="t('vault.fieldInteger')"
          @update:model-value="(v: boolean | 'indeterminate') => field.integer = v === true"
        />
      </template>

      <!-- checkbox -->
      <template v-if="field.type === 'checkbox'">
        <UCheckbox
          :model-value="(field.default as boolean | undefined) ?? false"
          :label="t('vault.fieldDefault')"
          @update:model-value="(v: boolean | 'indeterminate') => field.default = v === true"
        />
      </template>

      <!-- select / multi-select / radio -->
      <template v-if="hasOptions">
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">{{ t('vault.fieldOptions') }}</span>
            <UButton
              icon="i-lucide-plus"
              size="xs"
              color="neutral"
              variant="ghost"
              :label="t('vault.addOption')"
              @click="addOption"
            />
          </div>
          <div
            v-for="(opt, i) in fieldOptions"
            :key="i"
            class="flex items-center gap-2"
          >
            <UInput
              v-model="opt.label"
              :placeholder="t('vault.optionLabel')"
              class="flex-1"
            />
            <UInput
              v-model="opt.value"
              :placeholder="t('vault.optionValue')"
              class="flex-1"
            />
            <UButton
              icon="i-lucide-x"
              size="xs"
              color="neutral"
              variant="ghost"
              @click="removeOption(i)"
            />
          </div>
        </div>
        <UFormField
          v-if="field.type === 'select' || field.type === 'radio'"
          :label="t('vault.fieldDefault')"
        >
          <UInput
            :model-value="(field.default as string | undefined) ?? ''"
            @update:model-value="(v: string | number) => field.default = String(v)"
          />
        </UFormField>
        <div
          v-if="field.type === 'multi-select'"
          class="grid grid-cols-2 gap-3"
        >
          <UFormField :label="t('vault.fieldMinItems')">
            <UInput
              v-model.number="field.minItems"
              type="number"
              :min="0"
            />
          </UFormField>
          <UFormField :label="t('vault.fieldMaxItems')">
            <UInput
              v-model.number="field.maxItems"
              type="number"
              :min="0"
            />
          </UFormField>
        </div>
      </template>

      <!-- image / file -->
      <template v-if="field.type === 'image' || field.type === 'file'">
        <UFormField :label="t('vault.fieldAccept')">
          <UInput
            :model-value="getAcceptString()"
            :placeholder="t('vault.fieldAcceptPlaceholder')"
            @update:model-value="(v: string | number) => setAcceptString(String(v))"
          />
        </UFormField>
        <UFormField :label="t('vault.fieldMaxSizeKb')">
          <UInput
            v-model.number="field.maxSizeKb"
            type="number"
            :min="0"
          />
        </UFormField>
      </template>

      <!-- date / datetime -->
      <template v-if="field.type === 'date' || field.type === 'datetime'">
        <UFormField :label="t('vault.fieldDefault')">
          <UInput
            :model-value="(field.default as string | undefined) ?? ''"
            :type="field.type === 'date' ? 'date' : 'datetime-local'"
            @update:model-value="(v: string | number) => field.default = String(v)"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField :label="t('vault.fieldMinDate')">
            <UInput
              v-model="field.min"
              :type="field.type === 'date' ? 'date' : 'datetime-local'"
            />
          </UFormField>
          <UFormField :label="t('vault.fieldMaxDate')">
            <UInput
              v-model="field.max"
              :type="field.type === 'date' ? 'date' : 'datetime-local'"
            />
          </UFormField>
        </div>
      </template>
    </div>
  </div>
</template>
