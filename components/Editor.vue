<script setup lang="ts">
import EditorTabs from '~/components/EditorTabs.vue'

const editor = useEditorStore()
const textareaRef = ref<HTMLTextAreaElement | null>(null)

function onInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  editor.setContent(target.value)
}

watch(() => editor.scrollToLineTrigger, (line) => {
  if (line !== null && textareaRef.value) {
    const text = textareaRef.value.value
    const lines = text.split('\n')
    let charIndex = 0
    for (let i = 0; i < line; i++) {
      charIndex += (lines[i] ?? '').length + 1
    }

    textareaRef.value.focus()
    textareaRef.value.setSelectionRange(charIndex, charIndex)

    // Estimate line height for scrolling
    const lineHeight = 20 // Approx for text-sm
    textareaRef.value.scrollTop = line * lineHeight
  }
})
</script>

<template>
  <div class="flex h-full flex-col bg-default overflow-hidden">
    <!-- Panel Header (Tabs) -->
    <div class="h-10 border-b border-default flex items-center px-1 shrink-0 overflow-x-auto overflow-y-hidden">
      <EditorTabs />
    </div>

    <!-- Panel Body -->
    <div class="flex-1 overflow-hidden flex flex-col">
      <div
        v-if="!editor.currentFilePath"
        class="flex flex-1 items-center justify-center text-muted"
      >
        <div class="text-center space-y-2">
          <UIcon
            name="i-lucide-file-text"
            class="size-10 mx-auto"
          />
          <p class="text-sm px-4">
            Select or create a markdown file to start editing
          </p>
        </div>
      </div>

      <textarea
        v-else
        ref="textareaRef"
        :value="editor.currentContent"
        class="w-full flex-1 resize-none bg-transparent outline-none p-6 font-mono text-sm leading-relaxed text-default"
        spellcheck="false"
        placeholder="Start writing markdown…"
        @input="onInput"
      />

      <!-- Mobile Bottom Toolbar Placeholder -->
      <div class="lg:hidden h-10 border-t border-default bg-elevated/50 flex items-center px-4 shrink-0">
        <div class="flex items-center gap-4">
          <UButton
            icon="i-lucide-bold"
            variant="ghost"
            size="xs"
            color="neutral"
          />
          <UButton
            icon="i-lucide-italic"
            variant="ghost"
            size="xs"
            color="neutral"
          />
          <UButton
            icon="i-lucide-list"
            variant="ghost"
            size="xs"
            color="neutral"
          />
          <UButton
            icon="i-lucide-link"
            variant="ghost"
            size="xs"
            color="neutral"
          />
          <UButton
            icon="i-lucide-image"
            variant="ghost"
            size="xs"
            color="neutral"
          />
        </div>
      </div>
    </div>
  </div>
</template>
