import type { Plugin } from '~/types/plugin'
import { loadPlugins } from './api'
import { outlinePlugin } from './builtin/outline'
import { fileInfoPlugin } from './builtin/file-info'
import { historyPlugin } from './builtin/history'
import { contentTypesPlugin } from './builtin/content-types'
import { backlinksPlugin } from './builtin/backlinks'

export const builtinPlugins: Plugin[] = [
  outlinePlugin,
  fileInfoPlugin,
  backlinksPlugin,
  historyPlugin,
  contentTypesPlugin,
]

/**
 * Bootstraps enabled built-in plugins. Intended to be called once during app
 * initialization, after settings have been hydrated so plugins can rely on
 * stores being ready.
 */
export async function initBuiltinPlugins(): Promise<void> {
  const settings = useSettingsStore()
  const enabled = new Set(settings.settings.enabledPlugins ?? builtinPlugins.map((p) => p.manifest.id))
  const toLoad = builtinPlugins.filter((p) => enabled.has(p.manifest.id))
  await loadPlugins(toLoad)
}
