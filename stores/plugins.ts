import { defineStore } from 'pinia'
import type {
  Plugin,
  PluginManifest,
  RegisteredModal,
  RegisteredRightSidebarView,
  RegisteredSettingsTab,
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
  const sidebarButtons = ref<RegisteredSidebarButton[]>([])
  const rightSidebarViews = ref<RegisteredRightSidebarView[]>([])
  const settingsTabs = ref<RegisteredSettingsTab[]>([])
  const modals = ref<RegisteredModal[]>([])
  const activeRightSidebarView = ref<string | null>(null)
  const loaded = ref<Map<string, LoadedPlugin>>(new Map())

  function buttonsFor(location: SidebarButtonLocation) {
    return computed(() => sortByOrder(sidebarButtons.value.filter((b) => b.location === location)))
  }

  const sortedRightSidebarViews = computed(() => sortByOrder(rightSidebarViews.value))
  const sortedSettingsTabs = computed(() => sortByOrder(settingsTabs.value))

  /** Currently active right-sidebar view, with fallback to the first one. */
  const resolvedActiveRightSidebarView = computed(() => {
    const views = sortedRightSidebarViews.value
    if (views.length === 0) return null
    const match = views.find((v) => v.fqid === activeRightSidebarView.value)
    return match ?? views[0] ?? null
  })

  function setActiveRightSidebarView(fqid: string | null) {
    activeRightSidebarView.value = fqid
  }

  function registerSidebarButton(button: RegisteredSidebarButton) {
    sidebarButtons.value.push(button)
    return () => {
      const idx = sidebarButtons.value.findIndex((b) => b.fqid === button.fqid)
      if (idx !== -1) sidebarButtons.value.splice(idx, 1)
    }
  }

  function registerRightSidebarView(view: RegisteredRightSidebarView) {
    rightSidebarViews.value.push(view)
    return () => {
      const idx = rightSidebarViews.value.findIndex((v) => v.fqid === view.fqid)
      if (idx !== -1) rightSidebarViews.value.splice(idx, 1)
      if (activeRightSidebarView.value === view.fqid) {
        activeRightSidebarView.value = null
      }
    }
  }

  function registerSettingsTab(tab: RegisteredSettingsTab) {
    settingsTabs.value.push(tab)
    return () => {
      const idx = settingsTabs.value.findIndex((t) => t.fqid === tab.fqid)
      if (idx !== -1) settingsTabs.value.splice(idx, 1)
    }
  }

  function pushModal(modal: RegisteredModal) {
    modals.value.push(modal)
  }

  function closeModal(fqid: string) {
    const idx = modals.value.findIndex((m) => m.fqid === fqid)
    if (idx === -1) return
    const [removed] = modals.value.splice(idx, 1)
    removed?.onClose?.()
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
  }

  return {
    sidebarButtons,
    rightSidebarViews,
    settingsTabs,
    modals,
    activeRightSidebarView,
    loaded,
    buttonsFor,
    sortedRightSidebarViews,
    sortedSettingsTabs,
    resolvedActiveRightSidebarView,
    setActiveRightSidebarView,
    registerSidebarButton,
    registerRightSidebarView,
    registerSettingsTab,
    pushModal,
    closeModal,
    load,
    unload,
  }
})
