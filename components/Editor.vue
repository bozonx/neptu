<script setup lang="ts">
import EditorTabs from '~/components/EditorTabs.vue'

const editor = useEditorStore()

function onInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  editor.setContent(target.value)
}
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
        :value="editor.currentContent"
        class="w-full flex-1 resize-none bg-transparent outline-none p-6 font-mono text-sm leading-relaxed text-default"
        spellcheck="false"
        placeholder="Start writing markdown…"
        @input="onInput"
      />
    </div>
  </div>
</template>
