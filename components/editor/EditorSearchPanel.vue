<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'
import { getSearchState } from '~/app-extensions/SearchHighlight'

const props = defineProps<{
  editor: Editor | null
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const query = ref('')
const replacement = ref('')
const caseSensitive = ref(false)
const wholeWord = ref(false)
const regex = ref(false)
const showReplace = ref(false)
const matchCount = ref(0)
const activeIndex = ref(-1)

const findInputRef = ref<HTMLInputElement | null>(null)

function applyOptions() {
  props.editor?.commands.setSearchQuery({
    query: query.value,
    caseSensitive: caseSensitive.value,
    wholeWord: wholeWord.value,
    regex: regex.value,
    activeIndex: 0,
  })
  syncFromState()
}

function syncFromState() {
  const editor = props.editor
  if (!editor) {
    matchCount.value = 0
    activeIndex.value = -1
    return
  }
  const state = getSearchState(editor.state)
  matchCount.value = state?.matches.length ?? 0
  activeIndex.value = state?.activeIndex ?? -1
}

watch([query, caseSensitive, wholeWord, regex], applyOptions)

watch(() => props.open, (next) => {
  if (next) {
    nextTick(() => {
      findInputRef.value?.focus()
      findInputRef.value?.select()
      applyOptions()
    })
  }
  else {
    props.editor?.commands.clearSearch()
  }
})

function gotoMatch(direction: 1 | -1) {
  if (!props.editor || matchCount.value === 0) return
  const next = (activeIndex.value + direction + matchCount.value) % matchCount.value
  props.editor.commands.setActiveSearchIndex(next)
  syncFromState()
  scrollActiveIntoView()
}

function scrollActiveIntoView() {
  if (typeof document === 'undefined') return
  nextTick(() => {
    document.querySelector('.neptu-search-match-active')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  })
}

function replaceOne() {
  if (!props.editor || matchCount.value === 0) return
  props.editor.commands.replaceCurrentMatch(replacement.value)
  syncFromState()
}

function replaceAll() {
  if (!props.editor || matchCount.value === 0) return
  props.editor.commands.replaceAllMatches(replacement.value)
  syncFromState()
}

function onFindKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
  }
  else if (event.key === 'Enter') {
    event.preventDefault()
    gotoMatch(event.shiftKey ? -1 : 1)
  }
}
</script>

<template>
  <div
    v-if="props.open"
    class="mx-8 mb-2 flex shrink-0 flex-col gap-1 rounded-md border border-default bg-elevated/80 p-2 shadow-sm backdrop-blur"
  >
    <div class="flex flex-wrap items-center gap-2">
      <UInput
        ref="findInputRef"
        v-model="query"
        :placeholder="$t('editor.search.find')"
        size="xs"
        class="min-w-48 flex-1"
        @keydown="onFindKeydown"
      />
      <UButton
        size="xs"
        variant="ghost"
        :color="caseSensitive ? 'primary' : 'neutral'"
        icon="i-lucide-case-sensitive"
        :aria-label="$t('editor.search.caseSensitive')"
        @click="caseSensitive = !caseSensitive"
      />
      <UButton
        size="xs"
        variant="ghost"
        :color="wholeWord ? 'primary' : 'neutral'"
        icon="i-lucide-whole-word"
        :aria-label="$t('editor.search.wholeWord')"
        @click="wholeWord = !wholeWord"
      />
      <UButton
        size="xs"
        variant="ghost"
        :color="regex ? 'primary' : 'neutral'"
        icon="i-lucide-regex"
        :aria-label="$t('editor.search.regex')"
        @click="regex = !regex"
      />
      <span class="min-w-16 text-right text-xs text-muted tabular-nums">
        <template v-if="matchCount > 0">{{ $t('editor.search.matchCount', { current: activeIndex + 1, total: matchCount }) }}</template>
        <template v-else-if="query">{{ $t('editor.search.noMatches') }}</template>
      </span>
      <UButton
        size="xs"
        variant="ghost"
        icon="i-lucide-chevron-up"
        :aria-label="$t('editor.search.prev')"
        :disabled="matchCount === 0"
        @click="gotoMatch(-1)"
      />
      <UButton
        size="xs"
        variant="ghost"
        icon="i-lucide-chevron-down"
        :aria-label="$t('editor.search.next')"
        :disabled="matchCount === 0"
        @click="gotoMatch(1)"
      />
      <UButton
        size="xs"
        variant="ghost"
        :color="showReplace ? 'primary' : 'neutral'"
        icon="i-lucide-replace"
        :aria-label="$t('editor.search.replace')"
        @click="showReplace = !showReplace"
      />
      <UButton
        size="xs"
        variant="ghost"
        icon="i-lucide-x"
        :aria-label="$t('editor.search.close')"
        @click="emit('close')"
      />
    </div>
    <div
      v-if="showReplace"
      class="flex flex-wrap items-center gap-2"
    >
      <UInput
        v-model="replacement"
        :placeholder="$t('editor.search.replace')"
        size="xs"
        class="min-w-48 flex-1"
      />
      <UButton
        size="xs"
        :label="$t('editor.search.replaceOne')"
        :disabled="matchCount === 0"
        @click="replaceOne"
      />
      <UButton
        size="xs"
        color="primary"
        :label="$t('editor.search.replaceAll')"
        :disabled="matchCount === 0"
        @click="replaceAll"
      />
    </div>
  </div>
</template>
