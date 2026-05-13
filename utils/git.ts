import type { SharedSettings, Vault } from '~/types'

export function getEffectiveCommitMode(vault: Vault, defaultCommitMode: SharedSettings['defaultCommitMode']): SharedSettings['defaultCommitMode'] {
  const mode = vault.git?.commitMode ?? 'respect_config'
  return mode === 'respect_config' ? defaultCommitMode : mode
}

export function getEffectiveCommitDebounceMs(vault: Vault, defaultDebounceMs: number): number {
  const custom = vault.git?.commitDebounceMs
  return Math.max(1000, custom ?? defaultDebounceMs)
}

export function buildCommitMessage(template: string | undefined, changedFiles: number): string {
  const resolvedTemplate = template || 'Update notes ({files} {fileWord})'
  return resolvedTemplate
    .replace(/\{files\}/g, String(changedFiles))
    .replace(/\{fileWord\}/g, changedFiles === 1 ? 'file' : 'files')
}
