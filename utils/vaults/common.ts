import type { Vault } from '~/types'

export function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Returns the deepest vault whose `path` is a prefix of `filePath`.
 * Used to associate the currently edited file with its owning vault.
 */
export function pickVaultForPath(vaults: Vault[], filePath: string): Vault | null {
  let best: Vault | null = null
  for (const v of vaults) {
    const prefix = v.path.endsWith('/') || v.path.endsWith('\\')
      ? v.path
      : v.path + '/'
    const candidate = filePath === v.path || filePath.startsWith(prefix)
    if (!candidate) continue
    if (!best || v.path.length > best.path.length) best = v
  }
  return best
}
