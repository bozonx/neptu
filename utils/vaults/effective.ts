import { DEFAULT_FILE_FILTERS, type FileFilterSettings, type MediaDirSettings, type Vault } from '~/types'
import type { AutoConvertSettings, VaultConfig } from '~/types/vault-config'

function cloneFilterSettings(settings: FileFilterSettings): FileFilterSettings {
  return JSON.parse(JSON.stringify(settings)) as FileFilterSettings
}

export function getEffectiveFilters(vault: Vault, config?: VaultConfig): FileFilterSettings {
  const configFilters = config?.filters
  if (vault.filters !== undefined) return cloneFilterSettings(vault.filters)
  if (configFilters !== undefined) return cloneFilterSettings(configFilters)
  return cloneFilterSettings(DEFAULT_FILE_FILTERS)
}

export function getEffectiveExcludes(vault: Vault, config?: VaultConfig): string[] {
  const configExcludes = config?.excludes
  if (vault.excludes !== undefined) return [...vault.excludes]
  if (configExcludes !== undefined) return [...configExcludes]
  return []
}

export function getEffectiveContentFolder(vault: Vault, config?: VaultConfig): string | undefined {
  const configRoot = config?.contentRoot
  if (vault.contentFolder !== undefined) return vault.contentFolder
  return configRoot
}

export function getEffectiveMediaDir(vault: Vault, config?: VaultConfig): MediaDirSettings {
  if (vault.mediaDir !== undefined) return { ...vault.mediaDir }
  const mediaDir = config?.mediaDir
  if (mediaDir !== undefined) return { ...mediaDir }
  if (config?.media) {
    return {
      mode: config.media.uploadMode,
      folder: config.media.globalFolder,
      naming: 'original',
    }
  }
  return {
    mode: 'adjacent-folder',
    folder: 'media',
    naming: 'original',
  }
}

export function getEffectiveAutoConvert(vault: Vault, config?: VaultConfig): AutoConvertSettings | undefined {
  if (vault.autoConvert !== undefined) return vault.autoConvert
  return config?.autoConvert
}

export function getEffectiveContentRoot(vault: Vault, contentFolder?: string): string {
  if (!contentFolder || vault.contentType === 'vault' || !vault.contentType) {
    return vault.path.replace(/[/\\]+$/, '')
  }
  const base = vault.path.replace(/[/\\]+$/, '')
  return `${base}/${contentFolder}`
}
