<script setup lang="ts">
import { Splitpanes, Pane } from 'splitpanes'
import type { Panel } from '~/types'
import Editor from '~/components/Editor.vue'

const props = defineProps<{
  panel: Panel
}>()

const tabsStore = useTabsStore()

function handleResize(event: Array<{ pane: number, size: number }>) {
  const panel = props.panel!
  if (panel.type === 'node' && event.length === 2) {
    const isRtl = typeof document !== 'undefined' && document.dir === 'rtl'
    const isHorizontalSplit = panel.direction === 'horizontal'
    const ratio = (isRtl && isHorizontalSplit)
      ? 1 - (event[0]!.size / 100)
      : event[0]!.size / 100

    tabsStore.updatePanelRatio(panel.id, ratio)
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
      <Splitpanes
        :key="panel.id"
        :horizontal="panel.direction === 'vertical'"
        class="flex-1 flex min-w-0 min-h-0"
        @resized="handleResize"
      >
        <Pane
          :size="panel.ratio * 100"
          min-size="10"
          class="flex min-w-0 min-h-0"
        >
          <PanelContainer :panel="panel.first" />
        </Pane>

        <Pane
          :size="(1 - panel.ratio) * 100"
          min-size="10"
          class="flex min-w-0 min-h-0"
        >
          <PanelContainer :panel="panel.second" />
        </Pane>
      </Splitpanes>
    </template>
  </div>
</template>
