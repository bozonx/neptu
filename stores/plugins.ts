import { defineStore } from 'pinia'
import { shallowRef, ref, computed } from 'vue'
import type {
  Plugin,
  PluginManifest,
  RegisteredContentStructure,
  RegisteredLeftSidebarView,
  RegisteredModal,
  RegisteredRightSidebarView,
  RegisteredSettingsTab,
  RegisteredCommandPaletteItem,
  RegisteredSidebarButton,
  SidebarButtonLocation,
} from '~/types/plugin'

interface LoadedPlugin {
  manifest: PluginManifest
  cleanups: Array<() => void>
}

function sortByOrder<T extends { order?: number, fqid: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ao = a.order ?? 100
    const bo = b.order ?? 100
    if (ao !== bo) return ao - bo
    return a.fqid.localeCompare(b.fqid)
  })
}

/**
 * Single source of truth for plugin UI extension points.
 * Registrations are keyed by a fully qualified id `${pluginId}:${spec.id}`
 * so multiple plugins can safely use the same local ids.
 */
export const usePluginsStore = defineStore('plugins', () => {
  const sidebarButtons = shallowRef<RegisteredSidebarButton[]>([])
  const leftSidebarViews = shallowRef<RegisteredLeftSidebarView[]>([])
  const rightSidebarViews = shallowRef<RegisteredRightSidebarView[]>([])
  const settingsTabs = shallowRef<RegisteredSettingsTab[]>([])
  const contentStructures = shallowRef<RegisteredContentStructure[]>([])
  const commandPaletteItems = shallowRef<RegisteredCommandPaletteItem[]>([])
  const modals = shallowRef<RegisteredModal[]>([])
  const activeLeftSidebarView = ref<string | null>(null)
  const activeRightSidebarView = ref<string | null>(null)
  const loaded = ref<Map<string, LoadedPlugin>>(new Map())

  function buttonsFor(location: SidebarButtonLocation) {
    return computed(() => sortByOrder(sidebarButtons.value.filter((b) => b.location === location)))
  }

  const sortedLeftSidebarViews = computed(() => sortByOrder(leftSidebarViews.value))
  const sortedRightSidebarViews = computed(() => sortByOrder(rightSidebarViews.value))
  const sortedSettingsTabs = computed(() => sortByOrder(settingsTabs.value))
  const sortedContentStructures = computed(() => sortByOrder(contentStructures.value))
  const sortedCommandPaletteItems = computed(() => sortByOrder(commandPaletteItems.value))

  /** Currently active left-sidebar view. Null means the built-in Files panel. */
  const resolvedActiveLeftSidebarView = computed(() => {
    if (!activeLeftSidebarView.value) return null
    return sortedLeftSidebarViews.value.find((v) => v.fqid === activeLeftSidebarView.value) ?? null
  })

  /** Currently active right-sidebar view, with fallback to the first one. */
  const resolvedActiveRightSidebarView = computed(() => {
    const views = sortedRightSidebarViews.value
    if (views.length === 0) return null
    const match = views.find((v) => v.fqid === activeRightSidebarView.value)
    return match ?? views[0] ?? null
  })

  function setActiveLeftSidebarView(fqid: string | null) {
    activeLeftSidebarView.value = fqid
  }

  function setActiveRightSidebarView(fqid: string | null) {
    activeRightSidebarView.value = fqid
  }

  function registerSidebarButton(button: RegisteredSidebarButton) {
    sidebarButtons.value = [...sidebarButtons.value, button]
    return () => {
      sidebarButtons.value = sidebarButtons.value.filter((b) => b.fqid !== button.fqid)
    }
  }

  function registerLeftSidebarView(view: RegisteredLeftSidebarView) {
    leftSidebarViews.value = [...leftSidebarViews.value, view]
    return () => {
      leftSidebarViews.value = leftSidebarViews.value.filter((v) => v.fqid !== view.fqid)
      if (activeLeftSidebarView.value === view.fqid) {
        activeLeftSidebarView.value = null
      }
    }
  }

  function registerRightSidebarView(view: RegisteredRightSidebarView) {
    rightSidebarViews.value = [...rightSidebarViews.value, view]
    return () => {
      rightSidebarViews.value = rightSidebarViews.value.filter((v) => v.fqid !== view.fqid)
      if (activeRightSidebarView.value === view.fqid) {
        activeRightSidebarView.value = null
      }
    }
  }

  function registerSettingsTab(tab: RegisteredSettingsTab) {
    settingsTabs.value = [...settingsTabs.value, tab]
    return () => {
      settingsTabs.value = settingsTabs.value.filter((t) => t.fqid !== tab.fqid)
    }
  }

  function registerContentStructure(structure: RegisteredContentStructure) {
    contentStructures.value = [...contentStructures.value.filter((item) => item.fqid !== structure.fqid), structure]
    return () => {
      contentStructures.value = contentStructures.value.filter((item) => item.fqid !== structure.fqid)
    }
  }

  function registerCommandPaletteItem(item: RegisteredCommandPaletteItem) {
    commandPaletteItems.value = [...commandPaletteItems.value, item]
    return () => {
      commandPaletteItems.value = commandPaletteItems.value.filter((i) => i.fqid !== item.fqid)
    }
  }

  function pushModal(modal: RegisteredModal) {
    modals.value = [...modals.value, modal]
  }

  function closeModal(fqid: string) {
    const modal = modals.value.find((m) => m.fqid === fqid)
    if (!modal) return
    modals.value = modals.value.filter((m) => m.fqid !== fqid)
    modal.onClose?.()
  }

  async function load(plugin: Plugin) {
    if (loaded.value.has(plugin.manifest.id)) return
    const cleanups: Array<() => void> = []
    const { createPluginContext } = await import('~/app-plugins/api')
    const ctx = createPluginContext(plugin.manifest, cleanups)
    try {
      await plugin.activate(ctx)
      loaded.value.set(plugin.manifest.id, { manifest: plugin.manifest, cleanups })
    }
    catch (error) {
      for (const fn of cleanups) {
        try {
          fn()
        }
        catch {
          /* ignore */
        }
      }
      console.error(`[plugins] failed to activate ${plugin.manifest.id}`, error)
      throw error
    }
  }

  async function unload(pluginId: string) {
    const entry = loaded.value.get(pluginId)
    if (!entry) return
    for (const fn of entry.cleanups) {
      try {
        fn()
      }
      catch (error) {
        console.error(`[plugins] cleanup error for ${pluginId}`, error)
      }
    }
    loaded.value.delete(pluginId)
    // Drop any modals still owned by this plugin.
    modals.value = modals.value.filter((m) => m.pluginId !== pluginId)
    sidebarButtons.value = sidebarButtons.value.filter((b) => b.pluginId !== pluginId)
    rightSidebarViews.value = rightSidebarViews.value.filter((v) => v.pluginId !== pluginId)
    settingsTabs.value = settingsTabs.value.filter((t) => t.pluginId !== pluginId)
    contentStructures.value = contentStructures.value.filter((s) => s.pluginId !== pluginId)
    commandPaletteItems.value = commandPaletteItems.value.filter((i) => i.pluginId !== pluginId)
    // Drop any left sidebar views still owned by this plugin.
    const removedLsView = leftSidebarViews.value.find((v) => v.pluginId === pluginId)
    if (removedLsView) {
      leftSidebarViews.value = leftSidebarViews.value.filter((v) => v.pluginId !== pluginId)
      if (activeLeftSidebarView.value === removedLsView.fqid) {
        activeLeftSidebarView.value = null
      }
    }
  }

  return {
    sidebarButtons,
    leftSidebarViews,
    rightSidebarViews,
    settingsTabs,
    contentStructures,
    modals,
    activeLeftSidebarView,
    activeRightSidebarView,
    loaded,
    buttonsFor,
    sortedLeftSidebarViews,
    sortedRightSidebarViews,
    sortedSettingsTabs,
    sortedContentStructures,
    commandPaletteItems,
    sortedCommandPaletteItems,
    resolvedActiveLeftSidebarView,
    resolvedActiveRightSidebarView,
    setActiveLeftSidebarView,
    setActiveRightSidebarView,
    registerSidebarButton,
    registerLeftSidebarView,
    registerRightSidebarView,
    registerSettingsTab,
    registerContentStructure,
    registerCommandPaletteItem,
    pushModal,
    closeModal,
    load,
    unload,
  }
})
