<script setup lang="ts">
defineProps<{
  filePath: string
  content: string
}>()

defineEmits<{
  input: [event: Event]
  paste: [event: ClipboardEvent]
  keydown: [event: KeyboardEvent]
  keyup: [event: KeyboardEvent]
  mouseup: [event: MouseEvent]
  blur: []
  select: []
}>()

const textarea = ref<HTMLTextAreaElement | null>(null)

defineExpose({
  textarea,
})
</script>

<template>
  <textarea
    :key="filePath"
    ref="textarea"
    :value="content"
    class="h-full min-h-[480px] w-full resize-none bg-transparent pb-8 font-mono text-base leading-7 text-default outline-none"
    spellcheck="false"
    :data-editor-file-path="filePath"
    :placeholder="$t('editor.startWriting')"
    @input="$emit('input', $event)"
    @paste="$emit('paste', $event)"
    @keydown="$emit('keydown', $event)"
    @keyup="$emit('keyup', $event)"
    @mouseup="$emit('mouseup', $event)"
    @blur="$emit('blur')"
    @select="$emit('select')"
  />
</template>
