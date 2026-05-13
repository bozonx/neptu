<script setup lang="ts">
import type { Editor } from '@tiptap/core'
import { BubbleMenu } from '@tiptap/vue-3/menus'

const props = defineProps<{
  editor: Editor | null
  isSourceMode: boolean
  isLinkMenuOpen: boolean
}>()

const linkUrlInput = defineModel<string>('linkUrlInput', { required: true })

defineEmits<{
  setLink: []
  applyLink: []
  cancelLink: []
  removeLink: []
  showAiPlaceholder: [kind: 'write' | 'rewrite' | 'translate']
}>()
</script>

<template>
  <BubbleMenu
    v-if="props.editor"
    :editor="props.editor"
    plugin-key="neptu-formatting-bubble"
    :options="{ offset: 8, placement: 'top' }"
    :should-show="({ editor: e, state }) => !props.isSourceMode && !props.isLinkMenuOpen && !state.selection.empty && !e.isActive('table') && !e.isActive('codeBlock')"
  >
    <div class="flex items-center gap-0.5 rounded-md border border-default bg-default p-1 shadow-lg">
      <UButton
        :color="props.editor.isActive('bold') ? 'primary' : 'neutral'"
        :variant="props.editor.isActive('bold') ? 'soft' : 'ghost'"
        size="xs"
        icon="i-lucide-bold"
        :aria-label="$t('editor.toolbar.bold')"
        @click="props.editor.chain().focus().toggleBold().run()"
      />
      <UButton
        :color="props.editor.isActive('italic') ? 'primary' : 'neutral'"
        :variant="props.editor.isActive('italic') ? 'soft' : 'ghost'"
        size="xs"
        icon="i-lucide-italic"
        :aria-label="$t('editor.toolbar.italic')"
        @click="props.editor.chain().focus().toggleItalic().run()"
      />
      <UButton
        :color="props.editor.isActive('strike') ? 'primary' : 'neutral'"
        :variant="props.editor.isActive('strike') ? 'soft' : 'ghost'"
        size="xs"
        icon="i-lucide-strikethrough"
        :aria-label="$t('editor.toolbar.strike')"
        @click="props.editor.chain().focus().toggleStrike().run()"
      />
      <div class="mx-1 h-4 w-px bg-default" />
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        icon="i-lucide-link"
        :aria-label="$t('editor.toolbar.link')"
        @mousedown.prevent
        @click="$emit('setLink')"
      />
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        icon="i-lucide-sparkles"
        :aria-label="$t('editor.ai.rewrite')"
        @click="$emit('showAiPlaceholder', 'rewrite')"
      />
    </div>
  </BubbleMenu>

  <BubbleMenu
    v-if="props.editor"
    :editor="props.editor"
    plugin-key="neptu-link-bubble"
    :options="{ offset: 8, placement: 'top' }"
    :should-show="() => props.isLinkMenuOpen"
  >
    <div class="flex items-center gap-2 rounded-md border border-default bg-default p-2 shadow-lg">
      <UInput
        v-model="linkUrlInput"
        size="xs"
        class="w-56"
        placeholder="https://"
        @keydown.enter="$emit('applyLink')"
        @keydown.esc="$emit('cancelLink')"
      />
      <UButton
        size="xs"
        color="primary"
        :label="$t('editor.apply')"
        @click="$emit('applyLink')"
      />
      <UButton
        v-if="props.editor.isActive('link')"
        size="xs"
        color="error"
        variant="ghost"
        icon="i-lucide-trash-2"
        :aria-label="$t('editor.toolbar.unlink')"
        @click="$emit('removeLink')"
      />
      <UButton
        v-else
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        :aria-label="$t('editor.close')"
        @click="$emit('cancelLink')"
      />
    </div>
  </BubbleMenu>

  <BubbleMenu
    v-if="props.editor"
    :editor="props.editor"
    plugin-key="neptu-table-bubble"
    :options="{ offset: 8, placement: 'bottom' }"
    :should-show="({ editor: e }) => !props.isSourceMode && e.isActive('table')"
  >
    <div class="flex max-w-[90vw] items-center gap-0.5 overflow-x-auto rounded-md border border-default bg-default p-1 shadow-lg">
      <UButton
        size="xs"
        variant="ghost"
        icon="i-lucide-plus"
        :aria-label="$t('editor.table.addColumnBefore')"
        @click="props.editor.chain().focus().addColumnBefore().run()"
      />
      <UButton
        size="xs"
        variant="ghost"
        icon="i-lucide-plus"
        class="rotate-90"
        :aria-label="$t('editor.table.addColumnAfter')"
        @click="props.editor.chain().focus().addColumnAfter().run()"
      />
      <UButton
        size="xs"
        color="error"
        variant="ghost"
        icon="i-lucide-trash-2"
        :aria-label="$t('editor.table.deleteColumn')"
        @click="props.editor.chain().focus().deleteColumn().run()"
      />
      <div class="mx-1 h-4 w-px bg-default" />
      <UButton
        size="xs"
        variant="ghost"
        icon="i-lucide-panel-top"
        :aria-label="$t('editor.table.addRowBefore')"
        @click="props.editor.chain().focus().addRowBefore().run()"
      />
      <UButton
        size="xs"
        variant="ghost"
        icon="i-lucide-panel-bottom"
        :aria-label="$t('editor.table.addRowAfter')"
        @click="props.editor.chain().focus().addRowAfter().run()"
      />
      <UButton
        size="xs"
        color="error"
        variant="ghost"
        icon="i-lucide-trash-2"
        :aria-label="$t('editor.table.deleteRow')"
        @click="props.editor.chain().focus().deleteRow().run()"
      />
      <div class="mx-1 h-4 w-px bg-default" />
      <UButton
        size="xs"
        color="error"
        variant="ghost"
        icon="i-lucide-table-x"
        :aria-label="$t('editor.table.deleteTable')"
        @click="props.editor.chain().focus().deleteTable().run()"
      />
    </div>
  </BubbleMenu>
</template>
