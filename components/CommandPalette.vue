<script setup lang="ts">
const palette = useCommandPalette()
const { t } = useI18n()

const inputRef = ref<HTMLInputElement | null>(null)

const listRef = ref<HTMLDivElement | null>(null)

function onAfterEnter() {
  nextTick(() => {
    inputRef.value?.focus()
  })
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    palette.selectNext()
    scrollSelectedIntoView()
  }
  else if (event.key === 'ArrowUp') {
    event.preventDefault()
    palette.selectPrev()
    scrollSelectedIntoView()
  }
  else if (event.key === 'Enter') {
    event.preventDefault()
    palette.executeSelected()
  }
  else if (event.key === 'Escape') {
    palette.close()
  }
}

function scrollSelectedIntoView() {
  nextTick(() => {
    const list = listRef.value
    if (!list) return
    const item = list.querySelector('[data-selected="true"]') as HTMLElement | null
    if (item) {
      item.scrollIntoView({ block: 'nearest' })
    }
  })
}

function handleMouseEnter(index: number) {
  palette.selectedIndex.value = index
}

function handleClick(index: number) {
  palette.selectedIndex.value = index
  palette.executeSelected()
}
</script>

<template>
  <UModal
    v-model:open="palette.isOpen.value"
    :dismissible="true"
    :ui="{
      content: 'sm:max-w-xl overflow-hidden',
      body: 'p-0',
      header: 'hidden',
      footer: 'hidden',
    }"
    @after-enter="onAfterEnter"
    @keydown="onKeydown"
  >
    <template #body>
      <div class="flex flex-col max-h-[60vh]">
        <!-- Search input -->
        <div class="border-b border-default p-2">
          <UInput
            ref="inputRef"
            v-model="palette.query.value"
            icon="i-lucide-search"
            :placeholder="t('commands.searchPlaceholder')"
            variant="none"
            class="w-full"
            autocomplete="off"
            @keydown="onKeydown"
          />
        </div>

        <!-- Results list -->
        <div
          ref="listRef"
          class="flex-1 overflow-y-auto p-2"
        >
          <div
            v-if="palette.filteredCommands.value.length === 0"
            class="text-center text-sm text-muted py-8"
          >
            {{ t('commands.noResults') }}
          </div>

          <template v-else>
            <div
              v-for="(cmd, i) in palette.filteredCommands.value"
              :key="cmd.fqid"
              :data-selected="palette.selectedIndex.value === i"
              :class="[
                'flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-sm select-none',
                palette.selectedIndex.value === i
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-elevated/50',
              ]"
              @mouseenter="handleMouseEnter(i)"
              @click="handleClick(i)"
            >
              <UIcon
                :name="cmd.icon || 'i-lucide-command'"
                class="shrink-0 text-muted"
              />
              <span class="flex-1 truncate">
                {{ cmd.label }}
              </span>
              <span
                v-if="cmd.shortcut"
                class="shrink-0 text-xs text-muted ml-2 font-mono"
              >
                {{ cmd.shortcut }}
              </span>
            </div>
          </template>
        </div>

        <!-- Footer hint -->
        <div class="border-t border-default px-3 py-2 flex items-center gap-3 text-xs text-muted">
          <span class="flex items-center gap-1">
            <UKbd value="↑" />
            <UKbd value="↓" />
            {{ t('commands.toNavigate') }}
          </span>
          <span class="flex items-center gap-1">
            <UKbd value="↵" />
            {{ t('commands.toSelect') }}
          </span>
          <span class="flex items-center gap-1">
            <UKbd value="esc" />
            {{ t('commands.toClose') }}
          </span>
        </div>
      </div>
    </template>
  </UModal>
</template>
