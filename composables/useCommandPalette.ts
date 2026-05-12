import { ref, computed, watch } from 'vue'
import type { RegisteredCommandPaletteItem } from '~/types/plugin'

const isOpen = ref(false)
const query = ref('')
const selectedIndex = ref(0)

function normalizeSearch(text: string): string {
  return text.toLowerCase().trim()
}

function commandLabel(cmd: RegisteredCommandPaletteItem): string {
  return typeof cmd.label === 'function' ? cmd.label() : cmd.label
}

function matches(cmd: RegisteredCommandPaletteItem, q: string): boolean {
  if (!q) return true
  const searchTerms = q.split(/\s+/).filter(Boolean)
  const haystack = normalizeSearch([
    commandLabel(cmd),
    ...(cmd.keywords ?? []),
  ].join(' '))
  return searchTerms.every((term) => haystack.includes(normalizeSearch(term)))
}

export function useCommandPalette() {
  const plugins = usePluginsStore()

  const allCommands = computed(() => plugins.sortedCommandPaletteItems)

  const filteredCommands = computed(() => {
    return allCommands.value.filter((cmd) => {
      if (cmd.visible && !cmd.visible()) return false
      return matches(cmd, query.value)
    })
  })

  watch(filteredCommands, (commands) => {
    if (commands.length === 0) {
      selectedIndex.value = 0
      return
    }
    if (selectedIndex.value >= commands.length) {
      selectedIndex.value = commands.length - 1
    }
  })

  function open() {
    query.value = ''
    selectedIndex.value = 0
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
  }

  function toggle() {
    if (isOpen.value) {
      close()
    }
    else {
      open()
    }
  }

  function selectNext() {
    const len = filteredCommands.value.length
    if (len === 0) return
    selectedIndex.value = (selectedIndex.value + 1) % len
  }

  function selectPrev() {
    const len = filteredCommands.value.length
    if (len === 0) return
    selectedIndex.value = (selectedIndex.value - 1 + len) % len
  }

  function executeSelected() {
    const cmd = filteredCommands.value[selectedIndex.value]
    if (!cmd) return
    close()
    cmd.onRun()
  }

  function execute(cmd: RegisteredCommandPaletteItem) {
    close()
    cmd.onRun()
  }

  return {
    isOpen,
    query,
    selectedIndex,
    filteredCommands,
    commandLabel,
    open,
    close,
    toggle,
    selectNext,
    selectPrev,
    executeSelected,
    execute,
  }
}
