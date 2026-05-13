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
  RegisteredStatusBarItem,
  SidebarButtonLocation,
} from '~/types/plugin'

interface LoadedPlugin {
  manifest: PluginManifest
  cleanups: Array<() => void>
  deactivate?: () => void | Promise<void>
}

function sortByOrder<T extends { order?: number, fqid: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ao = a.order ?? 100
    const bo = b.order ?? 100
    if (ao !== bo) return ao - bo
    return a.fqid.localeCompare(b.fqid)
  })
}

function reportPluginError(message: string, error: unknown) {
  console.error(`[plugins] ${message}`, error)
}

function safeRun<TArgs extends unknown[]>(label: string, fn: (...args: TArgs) => unknown): (...args: TArgs) => void {
  return (...args) => {
    try {
      const result = fn(...args)
      if (result && typeof (result as Promise<void>).catch === 'function') {
        void (result as Promise<void>).catch((error) => reportPluginError(label, error))
      }
    }
    catch (error) {
      reportPluginError(label, error)
    }
  }
}

function safePredicate(label: string, fn?: () => boolean): (() => boolean) | undefined {
  if (!fn) return undefined
  return () => {
    try {
      return fn()
    }
    catch (error) {
      reportPluginError(label, error)
      return false
    }
  }
}

function replaceByFqid<T extends { fqid: string }>(items: T[], item: T): T[] {
  return [...items.filter((i) => i.fqid !== item.fqid), item]
}

function removeRegistered<T>(items: T[], item: T): T[] {
  return items.filter((i) => i !== item)
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
  const statusBarItems = shallowRef<RegisteredStatusBarItem[]>([])
  const activeLeftSidebarView = ref<string | null>(null)
  const activeRightSidebarView = ref<string | null>(null)
  const loaded = ref<Map<string, LoadedPlugin>>(new Map())
  const loading = new Map<string, Promise<void>>()

  function buttonsFor(location: SidebarButtonLocation) {
    return computed(() => sortByOrder(sidebarButtons.value.filter((b) => b.location === location)))
  }

  const sortedLeftSidebarViews = computed(() => sortByOrder(leftSidebarViews.value))
  const sortedRightSidebarViews = computed(() => sortByOrder(rightSidebarViews.value))
  const sortedSettingsTabs = computed(() => sortByOrder(settingsTabs.value))
  const sortedContentStructures = computed(() => sortByOrder(contentStructures.value))
  const sortedCommandPaletteItems = computed(() => sortByOrder(commandPaletteItems.value))
  const sortedStatusBarItems = computed(() => sortByOrder(statusBarItems.value))

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
    const registered = {
      ...button,
      onClick: safeRun(`${button.fqid} sidebar button failed`, button.onClick),
      visible: safePredicate(`${button.fqid} sidebar button visibility failed`, button.visible),
      active: safePredicate(`${button.fqid} sidebar button active state failed`, button.active),
    }
    sidebarButtons.value = replaceByFqid(sidebarButtons.value, registered)
    return () => {
      sidebarButtons.value = removeRegistered(sidebarButtons.value, registered)
    }
  }

  function registerLeftSidebarView(view: RegisteredLeftSidebarView) {
    leftSidebarViews.value = replaceByFqid(leftSidebarViews.value, view)
    return () => {
      leftSidebarViews.value = removeRegistered(leftSidebarViews.value, view)
      if (activeLeftSidebarView.value === view.fqid) {
        activeLeftSidebarView.value = null
      }
    }
  }

  function registerRightSidebarView(view: RegisteredRightSidebarView) {
    rightSidebarViews.value = replaceByFqid(rightSidebarViews.value, view)
    return () => {
      rightSidebarViews.value = removeRegistered(rightSidebarViews.value, view)
      if (activeRightSidebarView.value === view.fqid) {
        activeRightSidebarView.value = null
      }
    }
  }

  function registerSettingsTab(tab: RegisteredSettingsTab) {
    settingsTabs.value = replaceByFqid(settingsTabs.value, tab)
    return () => {
      settingsTabs.value = removeRegistered(settingsTabs.value, tab)
    }
  }

  function registerContentStructure(structure: RegisteredContentStructure) {
    contentStructures.value = replaceByFqid(contentStructures.value, structure)
    return () => {
      contentStructures.value = removeRegistered(contentStructures.value, structure)
    }
  }

  function registerCommandPaletteItem(item: RegisteredCommandPaletteItem) {
    const registered = {
      ...item,
      onRun: safeRun(`${item.fqid} command failed`, item.onRun),
      visible: safePredicate(`${item.fqid} command visibility failed`, item.visible),
    }
    commandPaletteItems.value = replaceByFqid(commandPaletteItems.value, registered)
    return () => {
      commandPaletteItems.value = removeRegistered(commandPaletteItems.value, registered)
    }
  }

  function registerStatusBarItem(item: RegisteredStatusBarItem) {
    const registered = {
      ...item,
      visible: safePredicate(`${item.fqid} status bar item visibility failed`, item.visible),
    }
    statusBarItems.value = replaceByFqid(statusBarItems.value, registered)
    return () => {
      statusBarItems.value = removeRegistered(statusBarItems.value, registered)
    }
  }

  function pushModal(modal: RegisteredModal) {
    modals.value = [...modals.value, modal]
  }

  function closeModal(fqid: string) {
    const modal = modals.value.find((m) => m.fqid === fqid)
    if (!modal) return
    modals.value = modals.value.filter((m) => m.fqid !== fqid)
    if (modal.onClose) {
      safeRun(`${modal.fqid} modal close failed`, modal.onClose)()
    }
  }

  async function load(plugin: Plugin) {
    if (loaded.value.has(plugin.manifest.id)) return
    const activeLoad = loading.get(plugin.manifest.id)
    if (activeLoad) return activeLoad

    const cleanups: Array<() => void> = []
    const loadPromise = (async () => {
      const { createPluginContext } = await import('~/app-plugins/api')
      const ctx = createPluginContext(plugin.manifest, cleanups)
      try {
        await plugin.activate(ctx)
        loaded.value.set(plugin.manifest.id, { manifest: plugin.manifest, cleanups, deactivate: plugin.deactivate })
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
      finally {
        loading.delete(plugin.manifest.id)
      }
    })()

    loading.set(plugin.manifest.id, loadPromise)
    return loadPromise
  }

  async function unload(pluginId: string) {
    const entry = loaded.value.get(pluginId)
    if (!entry) return

    try {
      await entry.deactivate?.()
    }
    catch (e) {
      console.error(`Plugin deactivate failed for ${pluginId}:`, e)
    }

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
    if (activeRightSidebarView.value && !rightSidebarViews.value.some((v) => v.fqid === activeRightSidebarView.value)) {
      activeRightSidebarView.value = null
    }
    settingsTabs.value = settingsTabs.value.filter((t) => t.pluginId !== pluginId)
    contentStructures.value = contentStructures.value.filter((s) => s.pluginId !== pluginId)
    commandPaletteItems.value = commandPaletteItems.value.filter((i) => i.pluginId !== pluginId)
    statusBarItems.value = statusBarItems.value.filter((i) => i.pluginId !== pluginId)
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
    statusBarItems,
    sortedStatusBarItems,
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
    registerStatusBarItem,
    pushModal,
    closeModal,
    load,
    unload,
  }
})
