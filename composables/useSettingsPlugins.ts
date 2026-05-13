import { builtinPlugins } from '~/app-plugins'

export function useSettingsPlugins() {
  const settingsStore = useSettingsStore()
  const plugins = usePluginsStore()

  function isPluginEnabled(pluginId: string) {
    return (settingsStore.settings.enabledPlugins ?? []).includes(pluginId)
  }

  async function togglePlugin(pluginId: string, enabled: boolean) {
    const list = new Set(settingsStore.settings.enabledPlugins ?? [])
    if (enabled) {
      list.add(pluginId)
      const plugin = builtinPlugins.find((p) => p.manifest.id === pluginId)
      if (plugin) await plugins.load(plugin)
    }
    else {
      list.delete(pluginId)
      await plugins.unload(pluginId)
    }
    await settingsStore.updateSettings({ enabledPlugins: Array.from(list) })
  }

  return {
    builtinPlugins,
    isPluginEnabled,
    togglePlugin,
  }
}
