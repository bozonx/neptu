<script setup lang="ts">
import type { Editor } from '@tiptap/core'

defineProps<{
  editor: Editor
}>()

defineEmits<{
  toggleTaskList: []
  toggleSearch: []
}>()
</script>

<template>
  <div class="sticky top-0 z-20 hidden pb-2 md:flex items-center gap-1">
    <UButton
      :color="editor.isActive('bold') ? 'primary' : 'neutral'"
      :variant="editor.isActive('bold') ? 'soft' : 'ghost'"
      size="xs"
      icon="i-lucide-bold"
      :aria-label="$t('editor.toolbar.bold')"
      @click="editor.chain().focus().toggleBold().run()"
    />
    <UButton
      :color="editor.isActive('italic') ? 'primary' : 'neutral'"
      :variant="editor.isActive('italic') ? 'soft' : 'ghost'"
      size="xs"
      icon="i-lucide-italic"
      :aria-label="$t('editor.toolbar.italic')"
      @click="editor.chain().focus().toggleItalic().run()"
    />
    <UButton
      :color="editor.isActive('strike') ? 'primary' : 'neutral'"
      :variant="editor.isActive('strike') ? 'soft' : 'ghost'"
      size="xs"
      icon="i-lucide-strikethrough"
      :aria-label="$t('editor.toolbar.strike')"
      @click="editor.chain().focus().toggleStrike().run()"
    />
    <UButton
      :color="editor.isActive('heading', { level: 2 }) ? 'primary' : 'neutral'"
      :variant="editor.isActive('heading', { level: 2 }) ? 'soft' : 'ghost'"
      size="xs"
      label="H2"
      @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
    />
    <UButton
      :color="editor.isActive('heading', { level: 4 }) ? 'primary' : 'neutral'"
      :variant="editor.isActive('heading', { level: 4 }) ? 'soft' : 'ghost'"
      size="xs"
      label="H4"
      @click="editor.chain().focus().toggleHeading({ level: 4 }).run()"
    />
    <UButton
      :color="editor.isActive('bulletList') ? 'primary' : 'neutral'"
      :variant="editor.isActive('bulletList') ? 'soft' : 'ghost'"
      size="xs"
      icon="i-lucide-list"
      :aria-label="$t('editor.toolbar.bulletList')"
      @click="editor.chain().focus().toggleBulletList().run()"
    />
    <UButton
      :color="editor.isActive('taskList') ? 'primary' : 'neutral'"
      :variant="editor.isActive('taskList') ? 'soft' : 'ghost'"
      size="xs"
      icon="i-lucide-check-square"
      :aria-label="$t('editor.toolbar.taskList')"
      @click="$emit('toggleTaskList')"
    />
    <UButton
      color="neutral"
      variant="ghost"
      size="xs"
      icon="i-lucide-minus"
      :aria-label="$t('editor.toolbar.divider')"
      @click="editor.chain().focus().setHorizontalRule().run()"
    />
    <div class="min-w-2 flex-1" />
    <UButton
      color="neutral"
      variant="ghost"
      size="xs"
      icon="i-lucide-search"
      :aria-label="$t('editor.toolbar.search')"
      @click="$emit('toggleSearch')"
    />
  </div>
</template>
