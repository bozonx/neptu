import type { Plugin } from '~/types/plugin'
import { loadPlugins } from './api'
import { outlinePlugin } from './builtin/outline'
import { fileInfoPlugin } from './builtin/file-info'

export const builtinPlugins: Plugin[] = [
  outlinePlugin,
  fileInfoPlugin,
]

/**
 * Bootstraps all built-in plugins. Intended to be called once during app
 * initialization, after settings have been hydrated so plugins can rely on
 * stores being ready.
 */
export async function initBuiltinPlugins(): Promise<void> {
  await loadPlugins(builtinPlugins)
}
