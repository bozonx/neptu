<script setup lang="ts">
import { Splitpanes, Pane } from 'splitpanes'
import type { Panel } from '~/types'

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

const isRtl = typeof document !== 'undefined' && document.dir === 'rtl'

function paneSize(panel: Panel & { type: 'node' }, isFirst: boolean): number {
  const raw = isFirst ? panel.ratio : 1 - panel.ratio
  /* In RTL horizontal splits, first/second are visually swapped */
  if (isRtl && panel.direction === 'horizontal') {
    return (isFirst ? 1 - panel.ratio : panel.ratio) * 100
  }
  return raw * 100
}
</script>

<template>
  <div
    :key="panel.id"
    class="flex-1 flex min-w-0 min-h-0 overflow-hidden relative"
  >
    <template v-if="panel.type === 'leaf'">
      <Editor
        :panel-id="panel.id"
        :class="{ 'active-editor-panel': tabsStore.activeDesktopPanelId === panel.id }"
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
          :size="paneSize(panel, true)"
          min-size="10"
          class="flex min-w-0 min-h-0"
        >
          <PanelContainer :panel="panel.first" />
        </Pane>

        <Pane
          :size="paneSize(panel, false)"
          min-size="10"
          class="flex min-w-0 min-h-0"
        >
          <PanelContainer :panel="panel.second" />
        </Pane>
      </Splitpanes>
    </template>
  </div>
</template>

<style scoped>
/* Use box-shadow inset instead of an overlay div for the active panel indicator.
   This avoids z-index issues with scrollbars and nested content. */
.active-editor-panel {
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--ui-primary) 30%, transparent);
}
</style>
