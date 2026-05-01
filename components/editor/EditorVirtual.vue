<script setup lang="ts">
const props = defineProps<{
  filePath: string
}>()

const virtualType = computed(() => {
  if (props.filePath.startsWith('neptu://')) {
    return props.filePath.slice('neptu://'.length)
  }
  return 'unknown'
})
</script>

<template>
  <div class="flex-1 overflow-hidden flex flex-col items-center justify-center bg-default p-8 text-center">
    <UIcon name="i-lucide-monitor" class="size-20 text-primary opacity-50 mb-6" />
    <h2 class="text-2xl font-semibold mb-2 capitalize">{{ virtualType }} Virtual Page</h2>
    <p class="text-muted max-w-md">
      This is a placeholder for the virtual page architecture.
      Virtual pages (like Settings, Diff) will be rendered here.
    </p>
  </div>
</template>
