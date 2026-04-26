<script setup lang="ts">
import { PanelGroup, Panel as ResizablePanel, PanelResizeHandle } from 'vue-resizable-panels'
import type { Panel } from '~/types'
import Editor from '~/components/Editor.vue'

const props = defineProps<{
  panel: Panel
}>()

const tabsStore = useTabsStore()

function handleLayout(sizes: number[]) {
  if (props.panel.type === 'node') {
    tabsStore.updatePanelRatio(props.panel.id, sizes[0] / 100)
  }
}
</script>

<template>
  <div class="flex-1 flex min-w-0 min-h-0 overflow-hidden relative">
    <template v-if="panel.type === 'leaf'">
      <Editor :panel-id="panel.id" />
      <div
        v-if="tabsStore.activeDesktopPanelId === panel.id"
        class="absolute inset-0 border-2 border-primary/30 pointer-events-none z-10"
      />
    </template>

    <template v-else>
      <PanelGroup
        :key="panel.id"
        :direction="panel.direction"
        class="flex-1 flex min-w-0 min-h-0"
        @layout="handleLayout"
      >
        <ResizablePanel
          :id="panel.first.id"
          :default-size="panel.ratio * 100"
          class="flex min-w-0 min-h-0"
        >
          <PanelContainer :panel="panel.first" />
        </ResizablePanel>

        <PanelResizeHandle
          class="bg-default border-default z-20 transition-colors hover:bg-primary/30"
          :class="panel.direction === 'horizontal' ? 'w-1 cursor-col-resize h-full border-r' : 'h-1 cursor-row-resize w-full border-b'"
        />

        <ResizablePanel
          :id="panel.second.id"
          :default-size="(1 - panel.ratio) * 100"
          class="flex min-w-0 min-h-0"
        >
          <PanelContainer :panel="panel.second" />
        </ResizablePanel>
      </PanelGroup>
    </template>
  </div>
</template>
