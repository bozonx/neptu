<script setup lang="ts">
interface ToggleItem {
  label: string
  value: string
  icon?: string
}

const props = defineProps<{
  modelValue: string
  items: ToggleItem[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

function select(value: string) {
  if (value !== props.modelValue) {
    emit('update:modelValue', value)
  }
}
</script>

<template>
  <div class="inline-flex rounded-md border border-default overflow-hidden">
    <button
      v-for="item in items"
      :key="item.value"
      type="button"
      class="px-3 py-1.5 text-xs font-medium transition-colors"
      :class="modelValue === item.value
        ? 'bg-primary text-primary-contrast'
        : 'bg-default text-muted hover:text-default hover:bg-elevated'"
      @click="select(item.value)"
    >
      <span v-if="item.icon">
        <UIcon
          :name="item.icon"
          class="size-3.5 inline-block align-text-bottom mr-1"
        />
      </span>
      {{ item.label }}
    </button>
  </div>
</template>
