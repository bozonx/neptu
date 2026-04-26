<script setup lang="ts">
const editor = useEditorStore()

function onInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  editor.setContent(target.value)
}
</script>

<template>
  <UDashboardPanel>
    <template #body>
      <div class="flex h-full flex-col">
        <div
          v-if="!editor.currentFilePath"
          class="flex flex-1 items-center justify-center text-muted"
        >
          <div class="text-center space-y-2">
            <UIcon
              name="i-lucide-file-text"
              class="size-10 mx-auto"
            />
            <p class="text-sm">
              Select or create a markdown file to start editing
            </p>
          </div>
        </div>

        <textarea
          v-else
          :value="editor.currentContent"
          class="w-full flex-1 resize-none bg-transparent outline-none p-4 font-mono text-sm leading-relaxed"
          spellcheck="false"
          placeholder="Start writing markdown…"
          @input="onInput"
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
