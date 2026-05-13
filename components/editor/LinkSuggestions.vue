<script setup lang="ts">
import type { LinkSuggestionItem } from '~/composables/useLinkSuggestions'

const props = defineProps<{
  items: LinkSuggestionItem[]
  position: { left: number, top: number } | null
}>()

const emit = defineEmits<{
  'select': [item: LinkSuggestionItem]
  'close': []
  'focus-editor': []
}>()

const activeIndex = ref(0)
const listRef = ref<HTMLUListElement | null>(null)

watch(() => props.items, () => {
  activeIndex.value = 0
})

function scrollActiveIntoView() {
  nextTick(() => {
    const el = listRef.value?.children[activeIndex.value] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  })
}

function handleKeydown(event: KeyboardEvent) {
  if (props.items.length === 0) return

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % props.items.length
    scrollActiveIntoView()
  }
  else if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (activeIndex.value <= 0) {
      emit('focus-editor')
      return
    }
    activeIndex.value = activeIndex.value - 1
    scrollActiveIntoView()
  }
  else if (event.key === 'Enter' || event.key === 'Tab') {
    event.preventDefault()
    event.stopPropagation()
    const item = props.items[activeIndex.value]
    if (item) emit('select', item)
  }
  else if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
  }
}

defineExpose({ handleKeydown })
</script>

<template>
  <Teleport to="body">
    <div
      v-if="position && items.length > 0"
      class="fixed z-50 w-80 max-h-64 overflow-y-auto rounded-lg border border-default bg-elevated shadow-lg"
      :style="{ left: `${position.left}px`, top: `${position.top + 4}px` }"
    >
      <ul
        ref="listRef"
        class="py-1"
      >
        <li
          v-for="(item, index) in items"
          :key="item.path"
          :class="[
            'px-3 py-2 text-sm cursor-pointer flex items-center gap-2 select-none',
            index === activeIndex ? 'bg-primary/10 text-primary' : 'text-default hover:bg-muted/50',
          ]"
          @mousedown.prevent="emit('select', item)"
          @mouseenter="activeIndex = index"
        >
          <UIcon
            :name="item.isMarkdown ? 'i-lucide-file-text' : 'i-lucide-file'"
            class="size-4 shrink-0 text-muted"
          />
          <span class="truncate">{{ item.stem }}</span>
          <span class="ml-auto text-xs text-muted truncate max-w-[120px]">
            {{ item.vaultRelative }}
          </span>
        </li>
      </ul>
    </div>
  </Teleport>
</template>
