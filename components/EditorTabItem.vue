<script setup lang="ts">
import type { EditorTab } from '~/types'

const props = defineProps<{
  tab: EditorTab
  activeId: string | null
  isMobile?: boolean
  fileName: string
  vaultName: string | null
}>()

const emit = defineEmits<{
  click: [tab: EditorTab]
  close: [tab: EditorTab]
}>()

const settingsStore = useSettingsStore()
const editorStore = useEditorStore()
</script>

<template>
  <div
    role="button"
    tabindex="0"
    :data-tab-id="tab.id"
    class="group flex items-center gap-2 shrink-0 border-default text-sm whitespace-nowrap transition-colors relative cursor-default"
    :class="[
      isMobile ? 'h-10 px-3' : 'h-9 px-3.5',
      settingsStore.settings.tabDisplayMode === 'left_vertical'
        ? 'w-full border-b'
        : 'border-r border-b',
      tab.id === activeId
        ? 'bg-default text-default'
        : 'bg-elevated/50 text-muted hover:text-default',
    ]"
    :title="tab.filePath"
    @click="emit('click', tab)"
    @auxclick.prevent="($event.button === 1 && !tab.pinned) ? emit('close', tab) : null"
    @keydown.enter.space.prevent="emit('click', tab)"
  >
    <!-- Active indicator bar -->
    <div
      v-if="tab.id === activeId"
      class="absolute bg-primary"
      :class="settingsStore.settings.tabDisplayMode === 'left_vertical' ? 'top-0 bottom-0 left-0 w-0.5' : 'bottom-0 left-0 right-0 h-0.5'"
    />
    <!-- Drag handle -->
    <span
      class="tab-sort-handle -ml-1 flex items-center justify-center rounded p-0.5 text-muted/70 hover:text-default cursor-grab active:cursor-grabbing"
      :title="$t('editor.reorderTabs', 'Reorder tabs')"
    >
      <UIcon
        name="i-lucide-grip-vertical"
        class="size-3"
      />
    </span>
    <!-- Dirty indicator -->
    <span
      v-if="tab.id === activeId && editorStore.buffers[tab.filePath]?.isDirty"
      class="size-1.5 rounded-full bg-primary"
    />
    <!-- Pin icon -->
    <UIcon
      v-if="tab.pinned"
      name="i-lucide-pin"
      class="size-3 text-primary"
    />
    <!-- File name -->
    <span class="font-medium truncate max-w-[150px]">{{ fileName }}</span>
    <!-- Vault name -->
    <span
      v-if="vaultName"
      class="text-[10px] text-muted opacity-70"
    >{{ vaultName }}</span>
    <!-- Close button -->
    <UButton
      v-if="!tab.pinned"
      icon="i-lucide-x"
      size="xs"
      variant="ghost"
      color="neutral"
      class="size-4 p-0 opacity-0 group-hover:opacity-100"
      @click.stop="emit('close', tab)"
    />
  </div>
</template>
