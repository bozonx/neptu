<script setup lang="ts">
defineProps<{
  modelValue: string
  placeholder?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'clear'): void
}>()

function clear() {
  emit('update:modelValue', '')
  emit('clear')
}
</script>

<template>
  <div class="relative flex items-center">
    <UInput
      :model-value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      class="flex-1 pr-8"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <UButton
      v-if="modelValue && !disabled"
      icon="i-lucide-x"
      size="xs"
      color="neutral"
      variant="ghost"
      class="absolute right-1 size-6 justify-center"
      @click="clear"
    />
  </div>
</template>
