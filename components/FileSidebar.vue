<script setup lang="ts">
const editor = useEditorStore()
const vaults = useVaultsStore()

const fileName = computed(() => {
  if (!editor.currentFilePath) return null
  const parts = editor.currentFilePath.split(/[\\/]/)
  return parts[parts.length - 1]
})

const vaultName = computed(() => {
  if (!editor.currentFilePath) return null
  return vaults.findVaultForPath(editor.currentFilePath)?.name
})

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
  <div class="flex flex-col h-full bg-default">
    <!-- Right Sidebar Toolbar -->
    <div class="h-10 border-b border-default flex items-center px-2 shrink-0">
      <FileSidebarToolbar class="flex-1" />
    </div>

    <!-- Right Sidebar Content -->
    <div class="flex-1 overflow-auto p-4">
      <div v-if="editor.currentFilePath">
        <!-- Info Tab -->
        <div
          v-if="editor.activeRightTab === 'info'"
          class="space-y-6"
        >
          <section>
            <h3 class="text-[10px] font-bold text-muted uppercase tracking-widest mb-3">
              File Info
            </h3>
            <div class="space-y-3">
              <div>
                <div class="text-[10px] text-muted uppercase">
                  Name
                </div>
                <div
                  class="text-sm font-medium truncate"
                  :title="fileName ?? ''"
                >
                  {{ fileName }}
                </div>
              </div>
              <div>
                <div class="text-[10px] text-muted uppercase">
                  Vault
                </div>
                <div class="text-sm truncate">
                  {{ vaultName }}
                </div>
              </div>
              <div>
                <div class="text-[10px] text-muted uppercase">
                  Path
                </div>
                <div class="text-[11px] text-muted break-all leading-relaxed">
                  {{ editor.currentFilePath }}
                </div>
              </div>
            </div>
          </section>
        </div>

        <!-- Outline Tab -->
        <div
          v-if="editor.activeRightTab === 'outline'"
          class="space-y-6"
        >
          <section>
            <h3 class="text-[10px] font-bold text-muted uppercase tracking-widest mb-3">
              Outline
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
              No headers found in this file
            </div>
          </section>
        </div>
      </div>

      <div
        v-else
        class="h-full flex flex-col items-center justify-center text-muted text-sm italic space-y-2 opacity-50"
      >
        <UIcon
          name="i-lucide-file-question"
          class="size-8"
        />
        <span>No file selected</span>
      </div>
    </div>
  </div>
</template>
