<script setup lang="ts">
import type { Panel } from '~/types'
import Editor from '~/components/Editor.vue'

const props = defineProps<{
  panel: Panel
}>()

const tabsStore = useTabsStore()

function handleSplitterResize(event: MouseEvent, panel: any) {
  // Simple resize logic could be added here
  // For now we'll just keep it at 50/50 or whatever is set in ratio
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
      <div
        class="flex-1 flex min-w-0 min-h-0"
        :class="panel.direction === 'horizontal' ? 'flex-row' : 'flex-col'"
      >
        <div
          :style="{
            flex: panel.ratio,
          }"
          class="flex min-w-0 min-h-0"
        >
          <PanelContainer :panel="panel.first" />
        </div>

        <div
          class="bg-default border-default z-20"
          :class="panel.direction === 'horizontal' ? 'w-px cursor-col-resize h-full border-r' : 'h-px cursor-row-resize w-full border-b'"
        />

        <div
          :style="{
            flex: 1 - panel.ratio,
          }"
          class="flex min-w-0 min-h-0"
        >
          <PanelContainer :panel="panel.second" />
        </div>
      </div>
    </template>
  </div>
</template>
