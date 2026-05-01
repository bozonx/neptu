<script setup lang="ts">
const props = defineProps<{
  diff: string
}>()

const parsedLines = computed(() => {
  if (!props.diff) return []
  return props.diff.split('\n').map(line => {
    if (line.startsWith('diff --git')) return { type: 'header', text: line }
    if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('index ')) return { type: 'file', text: line }
    if (line.startsWith('@@')) return { type: 'chunk', text: line }
    if (line.startsWith('+')) return { type: 'add', text: line }
    if (line.startsWith('-')) return { type: 'del', text: line }
    return { type: 'context', text: line }
  })
})
</script>

<template>
  <div class="font-mono text-[11px] sm:text-xs leading-relaxed whitespace-pre overflow-x-auto p-4 bg-elevated rounded-md border border-default text-left select-text">
    <div
      v-for="(line, index) in parsedLines"
      :key="index"
      class="px-2 rounded-sm"
      :class="{
        'text-primary font-bold mt-4 first:mt-0': line.type === 'header',
        'text-muted': line.type === 'file' || line.type === 'context',
        'text-blue-500 bg-blue-500/10 my-1': line.type === 'chunk',
        'text-green-600 dark:text-green-400 bg-green-500/10': line.type === 'add',
        'text-red-600 dark:text-red-400 bg-red-500/10': line.type === 'del'
      }"
    >
      {{ line.text || ' ' }}
    </div>
  </div>
</template>
