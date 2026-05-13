<script setup lang="ts">
const props = defineProps<{
  filePath: string
}>()

const fileName = computed(() => props.filePath.split(/[/\\]/).pop() || '')
</script>

<template>
  <div class="flex-1 overflow-hidden flex flex-col items-center justify-center bg-elevated/30 p-8 text-center">
    <UIcon
      name="i-lucide-file-question"
      class="size-20 text-muted opacity-50 mb-6"
    />
    <h2 class="text-xl font-semibold mb-2">
      Unsupported File Type
    </h2>
    <p class="text-muted max-w-md">
      The file <span class="font-mono text-default">{{ fileName }}</span> cannot be displayed in the editor.
    </p>
  </div>
</template>
