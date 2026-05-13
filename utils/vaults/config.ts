import { dump } from 'js-yaml'
import {
  DEFAULT_VAULT_CONFIG,
  isValidVaultConfig,
  type VaultConfig,
} from '~/types/vault-config'
import type { Vault } from '~/types'
import vaultTemplateRaw from '~/assets/templates/vault.neptu-vault.yaml?raw'
import blogTemplateRaw from '~/assets/templates/blog.neptu-vault.yaml?raw'
import siteTemplateRaw from '~/assets/templates/site.neptu-vault.yaml?raw'
import customTemplateRaw from '~/assets/templates/custom.neptu-vault.yaml?raw'

export function getContentStructureConfig(contentStructureId?: string): VaultConfig | null {
  if (!contentStructureId || contentStructureId === 'custom') return null
  return usePluginsStore().contentStructures.find((structure) => structure.fqid === contentStructureId)?.config ?? null
}

export function getTemplateYaml(contentType?: string, contentStructureId?: string): string {
  const structureConfig = contentType === 'custom' ? getContentStructureConfig(contentStructureId) : null
  if (structureConfig) return dump(structureConfig, { noRefs: true, lineWidth: 100 })

  switch (contentType) {
    case 'blog': return blogTemplateRaw
    case 'site': return siteTemplateRaw
    case 'custom': return customTemplateRaw
    default: return vaultTemplateRaw
  }
}

export function normalizeVaultConfig(config: unknown): unknown {
  if (!config || typeof config !== 'object') return config
  const raw = config as Record<string, unknown>
  if (raw['media-dir'] !== undefined) {
    if (raw.mediaDir === undefined) raw.mediaDir = raw['media-dir']
    delete raw['media-dir']
  }
  if (raw['auto-convert'] !== undefined) {
    if (raw.autoConvert === undefined) raw.autoConvert = raw['auto-convert']
    delete raw['auto-convert']
  }
  return raw
}

export async function writeVaultTemplate(path: string, contentType?: string, contentStructureId?: string) {
  await useFs().writeText(path, getTemplateYaml(contentType, contentStructureId))
}

export async function ensureVaultMarker(vault: Vault) {
  const fs = useFs()
  const markerPath = await fs.join(vault.path, '.neptu-vault.yaml')
  if (!(await fs.exists(markerPath))) {
    await writeVaultTemplate(markerPath, vault.contentType, vault.contentStructureId)
  }
}

export async function readVaultConfig(vault: Vault): Promise<VaultConfig> {
  const fs = useFs()
  const path = await fs.join(vault.path, '.neptu-vault.yaml')
  try {
    const data = normalizeVaultConfig(await fs.readYaml<unknown>(path))
    if (isValidVaultConfig(data)) return data
    console.warn('[vaults] Invalid .neptu-vault.yaml, using defaults', vault.path)
  }
  catch {
    // File missing or unreadable - fall through to defaults.
  }
  return { ...DEFAULT_VAULT_CONFIG }
}
