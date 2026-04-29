import { defineStore } from 'pinia'
import type { CommitStatus, GitStatusInfo } from '~/types'

/**
 * Per-vault scheduled commit timers. Lives outside reactive state so that
 * Pinia does not try to make `setTimeout` handles reactive.
 */
const commitTimers = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * Owns git-related runtime state: per-vault status, commit status and the
 * debounced auto-commit pipeline. Author resolution honours app settings
 * first, then falls back to git's global config.
 */
export const useGitStore = defineStore('git', () => {
  const status = ref<Record<string, GitStatusInfo>>({})
  const commitStatus = ref<Record<string, CommitStatus>>({})
  const pendingCommits = ref<Record<string, boolean>>({})

  async function refreshStatus(vaultId: string) {
    const vaults = useVaultsStore()
    const vault = vaults.findById(vaultId)
    if (!vault || vault.type !== 'git') return
    const git = useGit()
    try {
      status.value[vaultId] = await git.status(vault.path)
    }
    catch (error) {
      console.error('Failed to read git status', vault.path, error)
      status.value[vaultId] = { dirty: false, changedFiles: 0 }
    }
  }

  async function refreshAllStatuses() {
    const vaults = useVaultsStore()
    await Promise.all(
      vaults.list
        .filter((v) => v.type === 'git')
        .map((v) => refreshStatus(v.id)),
    )
  }

  /**
   * Resolves the commit author. App settings take precedence over git's
   * global config so users can override it per-installation.
   */
  async function resolveAuthor(): Promise<{ name: string, email: string } | null> {
    const { settings } = useSettingsStore()
    const overrideName = settings.gitAuthorName.trim()
    const overrideEmail = settings.gitAuthorEmail.trim()
    if (overrideName && overrideEmail) {
      return { name: overrideName, email: overrideEmail }
    }
    const git = useGit()
    const global = await git.globalAuthor()
    const name = overrideName || (global.name ?? '').trim()
    const email = overrideEmail || (global.email ?? '').trim()
    if (!name || !email) return null
    return { name, email }
  }

  function cancelCommit(vaultId: string) {
    const t = commitTimers.get(vaultId)
    if (t) {
      clearTimeout(t)
      commitTimers.delete(vaultId)
    }
    pendingCommits.value[vaultId] = false
  }

  /**
   * Schedules a debounced auto-commit for a git vault in `auto` mode.
   * The timer is cancelled by `cancelCommit` whenever the user types
   * (so the commit only runs after the next autosave settles).
   */
  function scheduleCommit(vaultId: string) {
    const vault = useVaultsStore().findById(vaultId)
    if (!vault || vault.type !== 'git' || !vault.git) return
    if (vault.git.commitMode !== 'auto') return
    cancelCommit(vaultId)
    const delay = Math.max(1000, vault.git.commitDebounceMs)
    pendingCommits.value[vaultId] = true
    const handle = setTimeout(() => {
      commitTimers.delete(vaultId)
      pendingCommits.value[vaultId] = false
      commit(vaultId).catch((error) => {
        console.error('Auto-commit failed', error)
      })
    }, delay)
    commitTimers.set(vaultId, handle)
  }

  async function commit(vaultId: string, message?: string) {
    const vault = useVaultsStore().findById(vaultId)
    if (!vault || vault.type !== 'git') return

    const author = await resolveAuthor()
    if (!author) {
      commitStatus.value[vaultId] = 'error'
      throw new Error(
        'Git author is not configured. Set it in Settings or run '
        + '`git config --global user.name/email`.',
      )
    }

    commitStatus.value[vaultId] = 'committing'
    try {
      const git = useGit()
      // Pre-flight to build a more meaningful message
      const current = await git.status(vault.path)
      if (!current.dirty) {
        commitStatus.value[vaultId] = 'idle'
        status.value[vaultId] = current
        return
      }
      const settings = useSettingsStore()
      const template = settings.settings.gitAutoMessageTemplate || 'Update notes ({files} {fileWord})'
      const count = current.changedFiles
      const autoMessage = template
        .replace(/\{files\}/g, String(count))
        .replace(/\{fileWord\}/g, count === 1 ? 'file' : 'files')
      const finalMessage = message?.trim() || autoMessage
      const result = await git.commitAll({
        path: vault.path,
        message: finalMessage,
        authorName: author.name,
        authorEmail: author.email,
      })
      if (result.committed) {
        status.value[vaultId] = { dirty: false, changedFiles: 0 }
      }
      commitStatus.value[vaultId] = result.committed ? 'committed' : 'idle'
    }
    catch (error) {
      commitStatus.value[vaultId] = 'error'
      throw error
    }
  }

  function resetCommitStatus(vaultId: string) {
    commitStatus.value[vaultId] = 'idle'
  }

  /** Drops cached status for a removed vault. */
  function dropVault(vaultId: string) {
    Reflect.deleteProperty(status.value, vaultId)
    Reflect.deleteProperty(commitStatus.value, vaultId)
    Reflect.deleteProperty(pendingCommits.value, vaultId)
  }

  return {
    status,
    commitStatus,
    pendingCommits,
    refreshStatus,
    refreshAllStatuses,
    resolveAuthor,
    cancelCommit,
    scheduleCommit,
    commit,
    resetCommitStatus,
    dropVault,
  }
})
