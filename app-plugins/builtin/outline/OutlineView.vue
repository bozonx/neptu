<script setup lang="ts">
const editor = useEditorStore()

interface Header {
  level: number
  text: string
  line: number
}

const outline = computed<Header[]>(() => {
  if (!editor.currentContent) return []
  const lines = editor.currentContent.split('\n')
  const headers: Header[] = []

  lines.forEach((line, index) => {
    const match = line.match(/^(#{1,6})\s+(.+)$/)
    if (match && match[1] && match[2]) {
      headers.push({
        level: match[1].length,
        text: match[2].trim(),
        line: index,
      })
    }
  })

  return headers
})

function scrollToHeader(header: Header) {
  editor.scrollToLine(header.line)
}
</script>

<template>
  <section>
    <h3 class="text-[10px] font-bold text-muted uppercase tracking-widest mb-3">
      {{ $t('sidebar.outline') }}
    </h3>
    <div
      v-if="outline.length > 0"
      class="space-y-1"
    >
      <button
        v-for="(header, index) in outline"
        :key="index"
        class="w-full text-left px-2 py-1.5 rounded hover:bg-elevated text-xs transition-colors truncate flex items-baseline gap-2 group"
        :style="{ paddingLeft: `${(header.level - 1) * 12 + 8}px` }"
        @click="scrollToHeader(header)"
      >
        <span class="text-muted text-[10px] opacity-40 group-hover:opacity-100 transition-opacity font-mono">H{{ header.level }}</span>
        <span class="truncate">{{ header.text }}</span>
      </button>
    </div>
    <div
      v-else
      class="text-xs text-muted italic px-2 py-8 text-center border-2 border-dashed border-default rounded-lg"
    >
      {{ $t('sidebar.noHeaders') }}
    </div>
  </section>
</template>
