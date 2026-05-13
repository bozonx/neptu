<script setup lang="ts">
import type { Editor } from '@tiptap/core'

type CalloutVariant = 'note' | 'tip' | 'important' | 'warning' | 'caution'

const props = defineProps<{
  editor: Editor | null
  isLinkMenuOpen: boolean
  isSearchOpen: boolean
}>()

const isSourceMode = defineModel<boolean>('sourceMode', { required: true })
const calloutVariants: CalloutVariant[] = ['note', 'tip', 'important', 'warning', 'caution']

defineEmits<{
  setLink: []
  insertTable: []
  toggleTaskList: []
  insertCallout: [variant: CalloutVariant]
  toggleSearch: []
  showAiPlaceholder: [kind: 'write' | 'rewrite' | 'translate']
}>()
</script>

<template>
  <div class="mx-8 mb-3 flex shrink-0 flex-wrap items-center gap-1 rounded-md border border-default bg-muted/40 px-2 py-1">
    <UButton
      :color="isSourceMode ? 'primary' : 'neutral'"
      :variant="isSourceMode ? 'soft' : 'ghost'"
      size="xs"
      icon="i-lucide-code-2"
      :label="$t('editor.toolbar.markdown')"
      @click="isSourceMode = !isSourceMode"
    />
    <div class="mx-1 h-5 w-px bg-default" />

    <template v-if="!isSourceMode && props.editor">
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
      <UButton
        :color="props.editor.isActive('code') ? 'primary' : 'neutral'"
        :variant="props.editor.isActive('code') ? 'soft' : 'ghost'"
        size="xs"
        icon="i-lucide-code"
        :aria-label="$t('editor.toolbar.code')"
        @click="props.editor.chain().focus().toggleCode().run()"
      />
      <div class="mx-1 h-5 w-px bg-default" />
      <UButton
        :color="props.editor.isActive('heading', { level: 2 }) ? 'primary' : 'neutral'"
        :variant="props.editor.isActive('heading', { level: 2 }) ? 'soft' : 'ghost'"
        size="xs"
        label="H2"
        @click="props.editor.chain().focus().toggleHeading({ level: 2 }).run()"
      />
      <UButton
        :color="props.editor.isActive('heading', { level: 3 }) ? 'primary' : 'neutral'"
        :variant="props.editor.isActive('heading', { level: 3 }) ? 'soft' : 'ghost'"
        size="xs"
        label="H3"
        @click="props.editor.chain().focus().toggleHeading({ level: 3 }).run()"
      />
      <UButton
        :color="props.editor.isActive('heading', { level: 4 }) ? 'primary' : 'neutral'"
        :variant="props.editor.isActive('heading', { level: 4 }) ? 'soft' : 'ghost'"
        size="xs"
        label="H4"
        @click="props.editor.chain().focus().toggleHeading({ level: 4 }).run()"
      />
      <div class="mx-1 h-5 w-px bg-default" />
      <UButton
        :color="props.editor.isActive('bulletList') ? 'primary' : 'neutral'"
        :variant="props.editor.isActive('bulletList') ? 'soft' : 'ghost'"
        size="xs"
        icon="i-lucide-list"
        :aria-label="$t('editor.toolbar.bulletList')"
        @click="props.editor.chain().focus().toggleBulletList().run()"
      />
      <UButton
        :color="props.editor.isActive('orderedList') ? 'primary' : 'neutral'"
        :variant="props.editor.isActive('orderedList') ? 'soft' : 'ghost'"
        size="xs"
        icon="i-lucide-list-ordered"
        :aria-label="$t('editor.toolbar.orderedList')"
        @click="props.editor.chain().focus().toggleOrderedList().run()"
      />
      <UButton
        :color="props.editor.isActive('taskList') ? 'primary' : 'neutral'"
        :variant="props.editor.isActive('taskList') ? 'soft' : 'ghost'"
        size="xs"
        icon="i-lucide-check-square"
        :aria-label="$t('editor.toolbar.taskList')"
        @click="$emit('toggleTaskList')"
      />
      <UButton
        :color="props.editor.isActive('blockquote') ? 'primary' : 'neutral'"
        :variant="props.editor.isActive('blockquote') ? 'soft' : 'ghost'"
        size="xs"
        icon="i-lucide-quote"
        :aria-label="$t('editor.toolbar.quote')"
        @click="props.editor.chain().focus().toggleBlockquote().run()"
      />
      <UDropdownMenu
        :items="calloutVariants.map(v => ({ label: $t(`editor.callout.${v}`), onSelect: () => $emit('insertCallout', v) }))"
      >
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-alert-circle"
          :aria-label="$t('editor.toolbar.callout')"
        />
      </UDropdownMenu>
      <UButton
        :color="props.editor.isActive('codeBlock') ? 'primary' : 'neutral'"
        :variant="props.editor.isActive('codeBlock') ? 'soft' : 'ghost'"
        size="xs"
        icon="i-lucide-square-code"
        :aria-label="$t('editor.toolbar.codeBlock')"
        @click="props.editor.chain().focus().toggleCodeBlock().run()"
      />
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        icon="i-lucide-minus"
        :aria-label="$t('editor.toolbar.divider')"
        @click="props.editor.chain().focus().setHorizontalRule().run()"
      />
      <div class="mx-1 h-5 w-px bg-default" />
      <UButton
        :color="(props.editor.isActive('link') || props.isLinkMenuOpen) ? 'primary' : 'neutral'"
        :variant="(props.editor.isActive('link') || props.isLinkMenuOpen) ? 'soft' : 'ghost'"
        size="xs"
        icon="i-lucide-link"
        :aria-label="$t('editor.toolbar.link')"
        @mousedown.prevent
        @click="$emit('setLink')"
      />
      <UButton
        :color="props.editor.isActive('table') ? 'primary' : 'neutral'"
        :variant="props.editor.isActive('table') ? 'soft' : 'ghost'"
        size="xs"
        icon="i-lucide-table"
        :aria-label="$t('editor.toolbar.table')"
        @click="$emit('insertTable')"
      />
      <div class="mx-1 h-5 w-px bg-default" />
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        icon="i-lucide-undo-2"
        :aria-label="$t('editor.toolbar.undo')"
        :disabled="!props.editor.can().undo()"
        @click="props.editor.chain().focus().undo().run()"
      />
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        icon="i-lucide-redo-2"
        :aria-label="$t('editor.toolbar.redo')"
        :disabled="!props.editor.can().redo()"
        @click="props.editor.chain().focus().redo().run()"
      />
      <div class="mx-1 h-5 w-px bg-default" />
      <UButton
        :color="props.isSearchOpen ? 'primary' : 'neutral'"
        :variant="props.isSearchOpen ? 'soft' : 'ghost'"
        size="xs"
        icon="i-lucide-search"
        :aria-label="$t('editor.toolbar.search')"
        @click="$emit('toggleSearch')"
      />
    </template>

    <div class="min-w-2 flex-1" />
    <template v-if="!isSourceMode">
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        icon="i-lucide-sparkles"
        :label="$t('editor.ai.write')"
        @click="$emit('showAiPlaceholder', 'write')"
      />
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        icon="i-lucide-wand-sparkles"
        :label="$t('editor.ai.rewrite')"
        @click="$emit('showAiPlaceholder', 'rewrite')"
      />
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        icon="i-lucide-languages"
        :label="$t('editor.ai.translate')"
        @click="$emit('showAiPlaceholder', 'translate')"
      />
    </template>
  </div>
</template>
