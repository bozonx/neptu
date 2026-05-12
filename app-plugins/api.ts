import type {
  CommandPaletteItem,
  LeftSidebarViewSpec,
  ModalSpec,
  Plugin,
  PluginAPI,
  PluginContext,
  ContentStructureSpec,
  PluginManifest,
  RightSidebarViewSpec,
  SettingsTabSpec,
  SidebarButtonSpec,
  StatusBarItemSpec,
} from '~/types/plugin'

function fqid(pluginId: string, localId: string) {
  return `${pluginId}:${localId}`
}

function generateModalId() {
  return `modal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Builds a PluginAPI bound to a specific plugin identity. All registrations
 * are routed through `usePluginsStore`, which is the single source of truth.
 */
export function createPluginAPI(manifest: PluginManifest, cleanups?: Array<() => void>): PluginAPI {
  const pluginId = manifest.id
  const store = usePluginsStore()
  const config = useConfig()

  function trackCleanup(cleanup: () => void) {
    cleanups?.push(cleanup)
    return cleanup
  }

  return {
    ui: {
      addCommand(spec: CommandPaletteItem) {
        return trackCleanup(store.registerCommandPaletteItem({
          ...spec,
          pluginId,
          fqid: fqid(pluginId, spec.id),
        }))
      },
      addSidebarButton(spec: SidebarButtonSpec) {
        return trackCleanup(store.registerSidebarButton({
          ...spec,
          pluginId,
          fqid: fqid(pluginId, spec.id),
        }))
      },
      addLeftSidebarView(spec: LeftSidebarViewSpec) {
        return trackCleanup(store.registerLeftSidebarView({
          ...spec,
          pluginId,
          fqid: fqid(pluginId, spec.id),
        }))
      },
      addRightSidebarView(spec: RightSidebarViewSpec) {
        return trackCleanup(store.registerRightSidebarView({
          ...spec,
          pluginId,
          fqid: fqid(pluginId, spec.id),
        }))
      },
      addSettingsTab(spec: SettingsTabSpec) {
        return trackCleanup(store.registerSettingsTab({
          ...spec,
          pluginId,
          fqid: fqid(pluginId, spec.id),
        }))
      },
      openModal(spec: ModalSpec) {
        const modalFqid = fqid(pluginId, spec.id || generateModalId())
        store.pushModal({ ...spec, pluginId, fqid: modalFqid })
        const handle = {
          id: modalFqid,
          close: () => store.closeModal(modalFqid),
        }
        cleanups?.push(handle.close)
        return handle
      },
      addStatusBarItem(spec: StatusBarItemSpec) {
        return trackCleanup(store.registerStatusBarItem({
          ...spec,
          pluginId,
          fqid: fqid(pluginId, spec.id),
        }))
      },
    },
    storage: {
      get: <T = unknown>() => {
        const settings = useSettingsStore()
        if (!settings.mainRepoPath) return Promise.resolve(null)
        return config.loadPluginState<T>(settings.mainRepoPath, pluginId)
      },
      set: <T = unknown>(value: T) => {
        const settings = useSettingsStore()
        if (!settings.mainRepoPath) return Promise.resolve()
        return config.savePluginState<T>(settings.mainRepoPath, pluginId, value)
      },
    },
    content: {
      addStructure(spec: ContentStructureSpec) {
        return trackCleanup(store.registerContentStructure({
          ...spec,
          pluginId,
          fqid: fqid(pluginId, spec.id),
        }))
      },
    },
  }
}

/**
 * Builds the `PluginContext` passed to `activate(ctx)`. The returned object
 * wires `onUnload` into the cleanup array the store holds for this plugin.
 */
export function createPluginContext(
  manifest: PluginManifest,
  cleanups: Array<() => void>,
): PluginContext {
  return {
    manifest,
    api: createPluginAPI(manifest, cleanups),
    onUnload(cb: () => void) {
      cleanups.push(cb)
    },
  }
}

/**
 * Helper to load a set of plugins sequentially. Errors are caught so one
 * bad plugin cannot prevent the others from activating.
 */
export async function loadPlugins(plugins: Plugin[]): Promise<void> {
  const store = usePluginsStore()
  for (const plugin of plugins) {
    try {
      await store.load(plugin)
    }
    catch (error) {
      console.error('[plugins] load error', plugin.manifest.id, error)
    }
  }
}
